import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ScrapedTweet } from "@/lib/apify";
import {
    filterRepliesByMinLength,
    filterRepliesByMinFollowers,
    filterRepliesByBlueOnly,
} from "@/lib/apify";

/**
 * Creates a Supabase admin client for use in Inngest functions.
 * Uses the service role key to bypass RLS.
 */
export function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    );
}

/**
 * Creates a prefixed logger for Inngest functions.
 * Returns a log function that includes timestamp and step context.
 */
export function createLogger(functionName: string) {
    return function log(step: string, message: string, data?: unknown) {
        const timestamp = new Date().toISOString();
        if (data !== undefined) {
            console.log(
                `[${functionName} ${timestamp}] [${step}] ${message}`,
                JSON.stringify(data, null, 2)
            );
        } else {
            console.log(`[${functionName} ${timestamp}] [${step}] ${message}`);
        }
    };
}

type ReportActivityInsert = {
    report_id: string;
    key: string;
    message: string;
    meta?: unknown;
};

/**
 * Best-effort UI activity log. This should never fail the Inngest function.
 * It gives the frontend a realtime "something is happening" feed.
 */
export async function logReportActivity(
    supabase: SupabaseClient,
    activity: ReportActivityInsert,
    log?: (step: string, message: string, data?: unknown) => void
) {
    try {
        const { error } = await supabase.from("report_activity").insert({
            report_id: activity.report_id,
            key: activity.key,
            message: activity.message,
            meta: activity.meta ?? null,
        });

        if (error) {
            log?.("activity", "Failed to write report activity", { error: error.message, activity });
        }
    } catch (err) {
        log?.("activity", "Failed to write report activity (exception)", { err, activity });
    }
}

/**
 * Bot usernames to exclude from replies.
 * Note: These are also excluded at the query level (-from:grok) in apify.ts,
 * but we keep this as a backup filter in case any slip through.
 */
const BOT_USERNAMES = new Set(["grok"]);

/**
 * Filters out replies from known bot accounts (backup filter).
 */
export function filterOutBots(replies: ScrapedTweet[]): ScrapedTweet[] {
    return replies.filter((reply) => {
        const username = reply.author?.userName?.toLowerCase();
        return username && !BOT_USERNAMES.has(username);
    });
}

/**
 * Maps scraped tweets to the database reply format.
 * Ensures IDs are strings to avoid precision loss with large tweet IDs.
 */
export function mapToReplyRecords(replies: ScrapedTweet[], reportId: string) {
    return replies.map((reply) => ({
        id: String(reply.id),
        report_id: reportId,
        username: reply.author?.userName ?? "unknown",
        x_user_id: reply.author?.id,
        is_premium: reply.author?.isBlueVerified ?? false,
        follower_count: reply.author?.followers ?? 0,
        text: reply.text,
        tweet_created_at: reply.createdAt,
        author_avatar: reply.author?.profilePicture,
        evaluation_status: "pending",
    }));
}

/**
 * Gets the newest reply date from a batch.
 * Only returns if NEWER than the previous value (for forward pagination).
 */
export function getNewestReplyDate(
    replies: ScrapedTweet[],
    previousNewest: string | null = null
): string | null {
    if (replies.length === 0) return previousNewest;

    const previousTime = previousNewest ? new Date(previousNewest).getTime() : 0;
    let maxTime = previousTime;
    let maxDate = previousNewest;

    for (const reply of replies) {
        const time = new Date(reply.createdAt).getTime();
        if (time > maxTime) {
            maxTime = time;
            maxDate = reply.createdAt;
        }
    }

    return maxDate;
}

/**
 * Gets the oldest reply date from a batch.
 * Only returns if OLDER than the previous value (for backwards pagination).
 */
export function getOldestReplyDate(
    replies: ScrapedTweet[],
    previousOldest: string | null = null
): string | null {
    if (replies.length === 0) return previousOldest;

    const previousTime = previousOldest ? new Date(previousOldest).getTime() : Infinity;
    let minTime = previousTime;
    let minDate = previousOldest;

    for (const reply of replies) {
        const time = new Date(reply.createdAt).getTime();
        if (time < minTime) {
            minTime = time;
            minDate = reply.createdAt;
        }
    }

    return minDate;
}

// ============================================================================
// Shared Processing Logic
// ============================================================================

export interface ReportSettings {
    reply_threshold: number;
    min_length: number;
    min_followers: number | null;
    blue_only: boolean;
    useful_count: number;
    last_reply_date?: string | null; // For 24hr timeout logic
    oldest_reply_date?: string | null; // For backwards pagination (Phase 1)
    newest_reply_date?: string | null; // For forward pagination (Phase 2)
    scrape_phase?: "backwards" | "forward"; // Current scrape phase
}

export interface FilterAndInsertResult {
    inserted: number;
    oldestReplyDate: string | null; // Oldest in batch - for backwards pagination
    newestReplyDate: string | null; // Newest in batch - for forward pagination
    insertedReplies: ScrapedTweet[];
}

type LogFn = (step: string, message: string, data?: unknown) => void;

/**
 * Filters replies by min-length and min-followers, then inserts them into the database.
 * Returns the number of inserted replies and the last reply date for pagination.
 */
export async function filterAndInsertReplies(
    supabase: SupabaseClient,
    reportId: string,
    replies: ScrapedTweet[],
    settings: ReportSettings,
    log: LogFn
): Promise<FilterAndInsertResult> {
    if (replies.length === 0) {
        log("filter", "No replies to process");
        await logReportActivity(
            supabase,
            { report_id: reportId, key: "scrape", message: "No new replies found" },
            log
        );
        return {
            inserted: 0,
            oldestReplyDate: settings.oldest_reply_date ?? null,
            newestReplyDate: settings.newest_reply_date ?? null,
            insertedReplies: [],
        };
    }

    log("filter", `Processing ${replies.length} replies`);
    await logReportActivity(
        supabase,
        {
            report_id: reportId,
            key: "scrape",
            message: `Processing ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`,
            meta: { found: replies.length },
        },
        log
    );

    // Apply client-side filters
    let filteredReplies = filterOutBots(replies);
    log("filter", `After bot filter: ${filteredReplies.length} replies remain`);

    filteredReplies = filterRepliesByBlueOnly(filteredReplies, settings.blue_only);
    filteredReplies = filterRepliesByMinLength(filteredReplies, settings.min_length);
    filteredReplies = filterRepliesByMinFollowers(
        filteredReplies,
        settings.min_followers ?? 0
    );

    log("filter", `After client-side filters: ${filteredReplies.length} replies remain`);
    const filteredOut = Math.max(0, replies.length - filteredReplies.length);
    if (filteredOut > 0) {
        await logReportActivity(
            supabase,
            {
                report_id: reportId,
                key: "filter",
                message: `Filtered ${filteredOut} low-signal ${filteredOut === 1 ? "reply" : "replies"}`,
                meta: { filteredOut, kept: filteredReplies.length },
            },
            log
        );
    }

    // Track both dates for pagination:
    // - oldestReplyDate: Only update if OLDER than previous (backwards pagination)
    // - newestReplyDate: Only update if NEWER than previous (forward pagination)
    const oldestReplyDate = getOldestReplyDate(replies, settings.oldest_reply_date ?? null);
    const newestReplyDate = getNewestReplyDate(replies, settings.newest_reply_date ?? null);

    // Debug: log date range of batch
    if (replies.length > 0) {
        const dates = replies.map(r => new Date(r.createdAt).getTime()).sort((a, b) => a - b);
        const oldestDateStr = new Date(dates[0]).toISOString();
        const newestDateStr = new Date(dates[dates.length - 1]).toISOString();
        log?.("pagination", `Batch: ${oldestDateStr} → ${newestDateStr}`);
        log?.("pagination", `Cursors: oldest=${oldestReplyDate}, newest=${newestReplyDate}`);
    }

    if (filteredReplies.length === 0) {
        return { inserted: 0, oldestReplyDate, newestReplyDate, insertedReplies: [] };
    }

    // Check which replies already exist IN THIS REPORT to get accurate "new" count
    // Note: Primary key is (id, report_id), so same tweet can exist in multiple reports
    const replyIds = filteredReplies.map(r => String(r.id));
    const { data: existingReplies } = await supabase
        .from("replies")
        .select("id")
        .eq("report_id", reportId)
        .in("id", replyIds);

    const existingIds = new Set(existingReplies?.map(r => r.id) ?? []);
    const newReplies = filteredReplies.filter(r => !existingIds.has(String(r.id)));

    // Deduplicate within batch (Apify can return duplicates)
    const seenIds = new Set<string>();
    const uniqueNewReplies = newReplies.filter(r => {
        const id = String(r.id);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
    });

    log("filter", `${filteredReplies.length} passed filters, ${uniqueNewReplies.length} are new (${existingIds.size} already exist, ${newReplies.length - uniqueNewReplies.length} duplicates in batch)`);

    if (uniqueNewReplies.length === 0) {
        log("filter", "No new replies to insert");
        return { inserted: 0, oldestReplyDate, newestReplyDate, insertedReplies: [] };
    }

    const replyRecords = mapToReplyRecords(uniqueNewReplies, reportId);

    log("insert", `Inserting ${replyRecords.length} NEW replies to database`);

    // Insert new replies - we've already checked for duplicates, but handle race conditions
    const { error } = await supabase
        .from("replies")
        .insert(replyRecords);

    if (error) {
        // Handle race condition: if another process inserted the same reply, just log and continue
        if (error.code === "23505") { // Postgres unique violation
            log("insert", "Some replies already exist (race condition), continuing", { 
                error: error.message 
            });
        } else {
            log("insert", "Failed to insert replies", { error: error.message });
            throw new Error(`Failed to insert replies: ${error.message}`);
        }
    }

    log("insert", `Successfully inserted ${replyRecords.length} new replies`);
    await logReportActivity(
        supabase,
        {
            report_id: reportId,
            key: "insert",
            message: `Saved ${replyRecords.length} ${replyRecords.length === 1 ? "reply" : "replies"} for evaluation`,
            meta: { inserted: replyRecords.length },
        },
        log
    );

    return { inserted: uniqueNewReplies.length, oldestReplyDate, newestReplyDate, insertedReplies: uniqueNewReplies };
}

/**
 * Updates the report progress in the database.
 * Status is always kept as "scraping" - only evaluate-reply triggers completion
 * when qualified_count meets threshold.
 */
export async function updateReportProgress(
    supabase: SupabaseClient,
    reportId: string,
    updates: {
        usefulCount: number;
        oldestReplyDate: string | null;
        newestReplyDate: string | null;
        scrapePhase?: "backwards" | "forward";
    },
    log: LogFn
): Promise<void> {
    log("progress", `Updating progress: ${updates.usefulCount} scraped`, {
        oldestReplyDate: updates.oldestReplyDate,
        newestReplyDate: updates.newestReplyDate,
        scrapePhase: updates.scrapePhase,
    });

    const updateData: Record<string, unknown> = {
        status: "scraping",
        useful_count: updates.usefulCount,
        reply_count: updates.usefulCount,
        oldest_reply_date: updates.oldestReplyDate,
        newest_reply_date: updates.newestReplyDate,
    };

    // Also update last_reply_date with newest for 24hr timeout logic
    if (updates.newestReplyDate) {
        updateData.last_reply_date = updates.newestReplyDate;
    }

    if (updates.scrapePhase) {
        updateData.scrape_phase = updates.scrapePhase;
    }

    const { error } = await supabase
        .from("reports")
        .update(updateData)
        .eq("id", reportId);

    if (error) {
        log("progress", "Failed to update progress", { error: error.message });
        throw new Error(`Failed to update report progress: ${error.message}`);
    }

    log("progress", `Progress updated, phase: ${updates.scrapePhase ?? "unchanged"}`);
    await logReportActivity(
        supabase,
        {
            report_id: reportId,
            key: "progress",
            message: `Updated report counts`,
            meta: { usefulCount: updates.usefulCount },
        },
        log
    );
}

export interface EvaluationEventData {
    replyId: string;
    reportId: string;
    text: string;
    minLength: number;
}

const BATCH_SIZE = 10;

interface BatchEventData {
    reportId: string;
    minLength: number;
    replies: Array<{ replyId: string; text: string }>;
}

/**
 * Creates batched evaluation events (groups of 10).
 * Call step.sendEvent with these to fan out evaluation.
 */
export function createEvaluationEvents(
    replies: ScrapedTweet[],
    reportId: string,
    minLength: number
): Array<{ name: "reply.evaluate-batch"; data: BatchEventData }> {
    const batches: Array<{ name: "reply.evaluate-batch"; data: BatchEventData }> = [];

    for (let i = 0; i < replies.length; i += BATCH_SIZE) {
        const batch = replies.slice(i, i + BATCH_SIZE);
        batches.push({
            name: "reply.evaluate-batch" as const,
            data: {
                reportId,
                minLength,
                replies: batch.map((reply) => ({
                    replyId: String(reply.id),
                    text: reply.text,
                })),
            },
        });
    }

    return batches;
}
