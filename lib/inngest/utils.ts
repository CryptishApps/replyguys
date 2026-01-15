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
 * Gets the most recent reply date from a list of replies.
 * Used for 24-hour timeout logic.
 */
export function getLatestReplyDate(
    replies: ScrapedTweet[],
    fallback: string | null = null
): string | null {
    if (replies.length === 0) return fallback;

    const sortedByDate = [...replies].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sortedByDate[0]?.createdAt ?? fallback;
}

/**
 * Gets the highest reply ID from a list of replies.
 * Used for pagination with since_id filter.
 */
export function getLatestReplyId(
    replies: ScrapedTweet[],
    fallback: string | null = null
): string | null {
    if (replies.length === 0) return fallback;

    // Tweet IDs are snowflake IDs - higher = newer
    // Compare as BigInt for accuracy with large IDs
    const maxId = replies.reduce((max, reply) => {
        const replyId = BigInt(reply.id);
        return replyId > max ? replyId : max;
    }, BigInt(0));

    return maxId > 0 ? maxId.toString() : fallback;
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
    last_reply_date?: string | null;
    last_reply_id?: string | null;
}

export interface FilterAndInsertResult {
    inserted: number;
    lastReplyDate: string | null;
    lastReplyId: string | null;
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
            lastReplyDate: settings.last_reply_date ?? null,
            lastReplyId: settings.last_reply_id ?? null,
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

    // Track pagination: use ALL replies (not just filtered) for cursor position
    const lastReplyDate = getLatestReplyDate(replies, settings.last_reply_date ?? null);
    const lastReplyId = getLatestReplyId(replies, settings.last_reply_id ?? null);

    if (filteredReplies.length === 0) {
        return { inserted: 0, lastReplyDate, lastReplyId, insertedReplies: [] };
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
        return { inserted: 0, lastReplyDate, lastReplyId, insertedReplies: [] };
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

    return { inserted: uniqueNewReplies.length, lastReplyDate, lastReplyId, insertedReplies: uniqueNewReplies };
}

/**
 * Updates the report progress in the database.
 * Status is always kept as "scraping" - only evaluate-reply triggers completion
 * when qualified_count meets threshold.
 */
export async function updateReportProgress(
    supabase: SupabaseClient,
    reportId: string,
    newUsefulCount: number,
    lastReplyDate: string | null,
    lastReplyId: string | null,
    log: LogFn
): Promise<void> {
    log("progress", `Updating progress: ${newUsefulCount} scraped`, {
        lastReplyId,
    });

    const { error } = await supabase
        .from("reports")
        .update({
            status: "scraping",
            useful_count: newUsefulCount,
            reply_count: newUsefulCount,
            last_reply_date: lastReplyDate,
            last_reply_id: lastReplyId,
        })
        .eq("id", reportId);

    if (error) {
        log("progress", "Failed to update progress", { error: error.message });
        throw new Error(`Failed to update report progress: ${error.message}`);
    }

    log("progress", `Progress updated, status remains: scraping`);
    await logReportActivity(
        supabase,
        {
            report_id: reportId,
            key: "progress",
            message: `Updated report counts`,
            meta: { usefulCount: newUsefulCount },
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

/**
 * Creates evaluation event payloads for replies.
 * Call step.sendEvent with these to fan out evaluation.
 */
export function createEvaluationEvents(
    replies: ScrapedTweet[],
    reportId: string,
    minLength: number
): Array<{ name: "reply.evaluate"; data: EvaluationEventData }> {
    return replies.map((reply) => ({
        name: "reply.evaluate" as const,
        data: {
            replyId: String(reply.id),
            reportId,
            text: reply.text,
            minLength,
        },
    }));
}
