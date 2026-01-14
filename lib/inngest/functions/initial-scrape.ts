import { inngest } from "@/lib/inngest/client";
import { scrapeConversation } from "@/lib/apify";
import { generateReportTitle } from "@/lib/gemini";
import {
    getSupabaseAdmin,
    createLogger,
    filterAndInsertReplies,
    updateReportProgress,
    createEvaluationEvents,
    type ReportSettings,
} from "@/lib/inngest/utils";

const log = createLogger("initial-scrape");

export const initialScrapeFunction = inngest.createFunction(
    {
        id: "initial-scrape",
        retries: 3,
        concurrency: { limit: 5 },
    },
    { event: "report.created" },
    async ({ event, step }) => {
        const { reportId, conversationId } = event.data;
        log("init", "Starting initial scrape", { reportId, conversationId });

        const supabase = getSupabaseAdmin();

        // Step 1: Set status to setting_up and fetch report settings
        const settings = await step.run("setup-and-fetch-settings", async () => {
            log("setup", "Setting status to setting_up and fetching settings");

            const { error: updateError } = await supabase
                .from("reports")
                .update({ status: "setting_up" })
                .eq("id", reportId);

            if (updateError) {
                log("setup", "Failed to update status", { error: updateError.message });
                throw new Error(`Failed to update report status: ${updateError.message}`);
            }

            const { data, error } = await supabase
                .from("reports")
                .select("reply_threshold, min_length, blue_only, min_followers, useful_count")
                .eq("id", reportId)
                .single();

            if (error || !data) {
                log("setup", "Failed to fetch settings", { error: error?.message });
                throw new Error(`Failed to fetch report settings: ${error?.message}`);
            }

            log("setup", "Settings loaded", data);
            return data as ReportSettings;
        });

        // Step 2: Scrape conversation (original tweet + replies in ONE call)
        const scrapeResult = await step.run("scrape-conversation", async () => {
            log("scrape", "Starting Apify scrape", {
                conversationId,
                blueOnly: settings.blue_only,
                minFollowers: settings.min_followers,
            });

            const result = await scrapeConversation(conversationId, {
                sort: "Oldest",
                maxItems: 100,
                blueOnly: settings.blue_only,
                minFollowers: settings.min_followers ?? undefined,
                includeOriginalTweet: true,
            });

            log("scrape", "Scrape completed", {
                originalTweetFound: !!result.originalTweet,
                repliesCount: result.replies.length,
            });

            return result;
        });

        // Step 3: Store original post data and generate title (if found)
        if (scrapeResult.originalTweet) {
            await step.run("store-original-post", async () => {
                const tweet = scrapeResult.originalTweet!;
                log("store-original", "Storing original tweet", {
                    author: `@${tweet.author.userName}`,
                    textLength: tweet.text.length,
                });

                // Generate a short title using Gemini Flash
                const title = await generateReportTitle(tweet.text);
                log("store-original", "Generated title", { title });

                const { error } = await supabase
                    .from("reports")
                    .update({
                        original_tweet_text: tweet.text,
                        original_author_username: tweet.author.userName,
                        original_author_avatar: tweet.author.profilePicture,
                        title: title,
                    })
                    .eq("id", reportId);

                if (error) {
                    log("store-original", "Failed to store original tweet", { error: error.message });
                    throw new Error(`Failed to store original tweet: ${error.message}`);
                }

                log("store-original", "Original tweet stored successfully");
            });
        } else {
            log("scrape", "No original tweet found - may be filtered by blue_only or other settings");
        }

        // Step 4: Filter and insert replies (using shared utility)
        const insertResult = await step.run("filter-and-insert-replies", async () => {
            return filterAndInsertReplies(
                supabase,
                reportId,
                scrapeResult.replies,
                settings,
                log
            );
        });

        // Step 5: Update report progress (using shared utility)
        const newUsefulCount = settings.useful_count + insertResult.inserted;
        const { thresholdMet } = await step.run("update-report-progress", async () => {
            return updateReportProgress(
                supabase,
                reportId,
                newUsefulCount,
                settings.reply_threshold,
                insertResult.lastReplyDate,
                log
            );
        });

        // Step 6: Fan-out evaluation events for inserted replies
        if (insertResult.inserted > 0) {
            const repliesToEvaluate = scrapeResult.replies.slice(0, insertResult.inserted);
            log("evaluate", `Sending ${repliesToEvaluate.length} evaluation events`);

            const events = createEvaluationEvents(repliesToEvaluate, reportId, settings.min_length);
            await step.sendEvent("evaluation-events", events);

            log("evaluate", "Evaluation events sent");
        }

        // Note: No more sleep/scheduling - the poll-active-reports cron handles recurring scrapes

        const result = {
            repliesScraped: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            thresholdMet,
            originalTweetFetched: !!scrapeResult.originalTweet,
        };

        log("done", "Initial scrape finished", result);
        return result;
    }
);
