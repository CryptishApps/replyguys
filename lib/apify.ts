import { ApifyClient } from "apify-client";
import { getMeaningfulLength } from "./text-utils";

const ACTOR_ID = "kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest";

export interface ScrapedTweet {
    id: string;
    text: string;
    createdAt: string;
    conversationId: string;
    author: {
        id: string;
        userName: string;
        name: string;
        followers: number;
        isBlueVerified: boolean;
        profilePicture?: string;
    };
}

export interface OriginalTweet {
    id: string;
    text: string;
    createdAt: string;
    author: {
        id: string;
        userName: string;
        name: string;
        profilePicture?: string;
    };
}

export interface ScrapeOptions {
    sort?: "Latest" | "Oldest" | "Top";
    maxItems?: number;
    sinceDate?: string;
    blueOnly?: boolean;
    minFollowers?: number;
    includeOriginalTweet?: boolean;
}

export interface ScrapeResult {
    originalTweet: OriginalTweet | null;
    replies: ScrapedTweet[];
}

function getApifyClient() {
    return new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });
}

function formatDateForQuery(isoDate: string): string {
    // X search uses YYYY-MM-DD format
    return isoDate.split("T")[0];
}

function log(message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
        console.log(`[apify ${timestamp}] ${message}`, data);
    } else {
        console.log(`[apify ${timestamp}] ${message}`);
    }
}

function validateTweet(item: unknown): item is ScrapedTweet {
    if (!item || typeof item !== "object") return false;
    const t = item as Record<string, unknown>;

    // Filter out mock tweets from Apify (they pad results with these)
    if (t.type === "mock_tweet" || t.id === -1) {
        return false;
    }

    // ID can be string or number from the API - we'll normalize later
    const hasValidId = typeof t.id === "string" || typeof t.id === "number";

    return (
        hasValidId &&
        typeof t.text === "string" &&
        typeof t.createdAt === "string" &&
        t.author !== null &&
        typeof t.author === "object"
    );
}

function validateApifyResponse(items: unknown[]): ScrapedTweet[] {
    const valid: ScrapedTweet[] = [];
    const invalid: number[] = [];

    items.forEach((item, index) => {
        if (validateTweet(item)) {
            // Normalize ID to string to avoid JavaScript number precision loss
            // Tweet IDs exceed MAX_SAFE_INTEGER (2^53-1), so numeric IDs lose precision
            const normalized = {
                ...item,
                id: String(item.id),
            } as ScrapedTweet;
            valid.push(normalized);
        } else {
            invalid.push(index);
        }
    });

    if (invalid.length > 0) {
        log(`Filtered out ${invalid.length} invalid items at indices: ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "..." : ""}`);
    }

    return valid;
}

/**
 * Fetches a single tweet by ID using the tweetIDs parameter.
 * This is separate from the conversation search because tweetIDs overrides searchTerms.
 */
async function fetchTweetById(
    client: ApifyClient,
    tweetId: string
): Promise<OriginalTweet | null> {
    log("Fetching original tweet by ID", { tweetId });

    const input = {
        tweetIDs: [tweetId],
        maxItems: 1,
    };

    try {
        const run = await client.actor(ACTOR_ID).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            clean: false,
        });

        log(`Original tweet fetch returned ${items.length} items`);

        const validTweets = validateApifyResponse(items);

        if (validTweets.length === 0) {
            log("No valid tweet found for ID", { tweetId });
            return null;
        }

        const tweet = validTweets[0];
        log("Found original tweet", {
            author: `@${tweet.author.userName}`,
            textPreview: tweet.text.slice(0, 50) + (tweet.text.length > 50 ? "..." : ""),
        });

        return {
            id: String(tweet.id),
            text: tweet.text,
            createdAt: tweet.createdAt,
            author: {
                id: tweet.author.id,
                userName: tweet.author.userName,
                name: tweet.author.name,
                profilePicture: tweet.author.profilePicture,
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log("Failed to fetch original tweet", { error: errorMessage, tweetId });
        return null;
    }
}

// Bot accounts to exclude at query level (more efficient than client-side filtering)
const EXCLUDED_BOTS = ["grok"];

/**
 * Fetches replies to a conversation using conversation_id: search.
 */
async function fetchReplies(
    client: ApifyClient,
    conversationId: string,
    options: {
        sort: "Latest" | "Oldest" | "Top";
        maxItems: number;
        sinceDate?: string;
        minFollowers?: number;
    }
): Promise<ScrapedTweet[]> {
    const { sort, maxItems, sinceDate, minFollowers } = options;

    // Build search query - filter to replies only and exclude bots
    let searchQuery = `conversation_id:${conversationId} filter:replies`;

    // Exclude known bot accounts
    for (const bot of EXCLUDED_BOTS) {
        searchQuery += ` -from:${bot}`;
    }

    if (sinceDate) {
        searchQuery += ` since:${formatDateForQuery(sinceDate)}`;
    }
    if (minFollowers) {
        searchQuery += ` min_followers:${minFollowers}`;
    }

    log("Fetching replies", { query: searchQuery, maxItems, sort });

    const input = {
        searchTerms: [searchQuery],
        maxItems,
        sort,
    };

    try {
        const run = await client.actor(ACTOR_ID).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            clean: false,
        });

        log(`Replies fetch returned ${items.length} raw items`);

        const validTweets = validateApifyResponse(items);
        log(`Validated ${validTweets.length}/${items.length} replies`);

        return validTweets;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log("Failed to fetch replies", { error: errorMessage, conversationId });
        throw new Error(`Failed to fetch replies: ${errorMessage}`);
    }
}

export interface ScrapeCallbacks {
    onOriginalTweetFetched?: (tweet: OriginalTweet) => Promise<void>;
}

export async function scrapeConversation(
    conversationId: string,
    options: ScrapeOptions = {},
    callbacks: ScrapeCallbacks = {}
): Promise<ScrapeResult> {
    const client = getApifyClient();
    const {
        sort = "Latest",
        maxItems = 100,
        sinceDate,
        minFollowers,
        includeOriginalTweet = true,
    } = options;

    log("Starting conversation scrape", {
        conversationId,
        maxItems,
        sort,
        includeOriginalTweet,
        sinceDate,
        minFollowers,
    });

    const startTime = Date.now();

    try {
        // Make parallel calls: one for original tweet (if needed), one for replies
        // The original tweet callback fires as soon as that promise resolves,
        // without waiting for replies
        const originalTweetPromise = includeOriginalTweet
            ? fetchTweetById(client, conversationId).then(async (tweet) => {
                if (tweet && callbacks.onOriginalTweetFetched) {
                    log("Original tweet fetched, calling callback immediately");
                    await callbacks.onOriginalTweetFetched(tweet);
                }
                return tweet;
            })
            : Promise.resolve(null);

        const [originalTweet, replies] = await Promise.all([
            originalTweetPromise,
            fetchReplies(client, conversationId, {
                sort,
                maxItems,
                sinceDate,
                minFollowers,
            }),
        ]);

        log("Scrape complete", {
            originalTweetFound: !!originalTweet,
            repliesCount: replies.length,
            totalDuration: `${Date.now() - startTime}ms`,
        });

        return { originalTweet, replies };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log("Scrape failed", { error: errorMessage, conversationId });

        // Re-throw to allow Inngest retry
        throw new Error(`Apify scrape failed for conversation ${conversationId}: ${errorMessage}`);
    }
}

// Backwards-compatible wrapper (deprecated - use scrapeConversation instead)
export async function scrapeReplies(
    conversationId: string,
    options: ScrapeOptions = {}
): Promise<ScrapedTweet[]> {
    const result = await scrapeConversation(conversationId, {
        ...options,
        includeOriginalTweet: false,
    });
    return result.replies;
}

// Client-side filter for min_length (can't be done in Apify query)
// Uses meaningful length (strips @mentions and URLs before checking)
export function filterRepliesByMinLength(
    replies: ScrapedTweet[],
    minLength: number
): ScrapedTweet[] {
    if (minLength <= 0) return replies;
    const filtered = replies.filter(
        (reply) => getMeaningfulLength(reply.text) >= minLength
    );
    if (filtered.length !== replies.length) {
        log(`Filtered by min_length (${minLength}): ${replies.length} → ${filtered.length}`);
    }
    return filtered;
}

// Client-side filter for min followers (backup if Apify filter doesn't work)
export function filterRepliesByMinFollowers(
    replies: ScrapedTweet[],
    minFollowers: number
): ScrapedTweet[] {
    if (!minFollowers || minFollowers <= 0) return replies;
    const filtered = replies.filter((reply) => reply.author.followers >= minFollowers);
    if (filtered.length !== replies.length) {
        log(`Filtered by min_followers (${minFollowers}): ${replies.length} → ${filtered.length}`);
    }
    return filtered;
}

// Client-side filter for blue verified users only
// We do this client-side (not in API query) to avoid filtering out the original tweet
export function filterRepliesByBlueOnly(
    replies: ScrapedTweet[],
    blueOnly: boolean
): ScrapedTweet[] {
    if (!blueOnly) return replies;
    const filtered = replies.filter((reply) => reply.author.isBlueVerified);
    if (filtered.length !== replies.length) {
        log(`Filtered by blue_only: ${replies.length} → ${filtered.length}`);
    }
    return filtered;
}

// Re-export ScrapedTweet as ScrapedReply for backwards compatibility
export type ScrapedReply = ScrapedTweet;

/**
 * Fetches just the original tweet by ID.
 * Useful when you want the original tweet immediately without waiting for replies.
 */
export async function fetchOriginalTweet(
    conversationId: string
): Promise<OriginalTweet | null> {
    const client = getApifyClient();
    return fetchTweetById(client, conversationId);
}

/**
 * Fetches just the replies to a conversation.
 * Useful when you've already fetched the original tweet separately.
 */
export async function fetchConversationReplies(
    conversationId: string,
    options: Omit<ScrapeOptions, "includeOriginalTweet"> = {}
): Promise<ScrapedTweet[]> {
    const client = getApifyClient();
    const {
        sort = "Latest",
        maxItems = 100,
        sinceDate,
        minFollowers,
    } = options;

    return fetchReplies(client, conversationId, {
        sort,
        maxItems,
        sinceDate,
        minFollowers,
    });
}
