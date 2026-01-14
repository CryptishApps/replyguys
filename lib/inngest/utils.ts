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

/**
 * Maps scraped tweets to the database reply format.
 */
export function mapToReplyRecords(replies: ScrapedTweet[], reportId: string) {
    return replies.map((reply) => ({
        id: reply.id,
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
 * Used for pagination with the since: filter.
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
}

export interface FilterAndInsertResult {
    inserted: number;
    lastReplyDate: string | null;
    filteredReplies: ScrapedTweet[];
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
        return {
            inserted: 0,
            lastReplyDate: settings.last_reply_date ?? null,
            filteredReplies: [],
        };
    }

    log("filter", `Processing ${replies.length} replies`);

    // Apply client-side filters
    let filteredReplies = filterRepliesByBlueOnly(replies, settings.blue_only);
    filteredReplies = filterRepliesByMinLength(filteredReplies, settings.min_length);
    filteredReplies = filterRepliesByMinFollowers(
        filteredReplies,
        settings.min_followers ?? 0
    );

    log("filter", `After client-side filters: ${filteredReplies.length} replies remain`);

    // Calculate how many we can insert to reach threshold
    const remaining = settings.reply_threshold - settings.useful_count;
    const repliesToInsert = filteredReplies.slice(0, remaining);

    log("filter", `Will insert ${repliesToInsert.length} replies (threshold: ${settings.reply_threshold}, current: ${settings.useful_count}, remaining: ${remaining})`);

    const lastReplyDate = getLatestReplyDate(replies, settings.last_reply_date ?? null);

    if (repliesToInsert.length === 0) {
        return { inserted: 0, lastReplyDate, filteredReplies };
    }

    const replyRecords = mapToReplyRecords(repliesToInsert, reportId);

    log("insert", `Upserting ${replyRecords.length} replies to database`);

    const { error } = await supabase
        .from("replies")
        .upsert(replyRecords, { onConflict: "id" });

    if (error) {
        log("insert", "Failed to insert replies", { error: error.message });
        throw new Error(`Failed to insert replies: ${error.message}`);
    }

    log("insert", `Successfully inserted ${replyRecords.length} replies`);

    return { inserted: repliesToInsert.length, lastReplyDate, filteredReplies };
}

/**
 * Updates the report progress in the database.
 * Sets status to "completed" if threshold is met, otherwise keeps it as "scraping".
 */
export async function updateReportProgress(
    supabase: SupabaseClient,
    reportId: string,
    newUsefulCount: number,
    threshold: number,
    lastReplyDate: string | null,
    log: LogFn
): Promise<{ thresholdMet: boolean }> {
    const thresholdMet = newUsefulCount >= threshold;

    log("progress", `Updating progress: ${newUsefulCount}/${threshold}`, {
        thresholdMet,
        lastReplyDate,
    });

    const { error } = await supabase
        .from("reports")
        .update({
            status: thresholdMet ? "completed" : "scraping",
            useful_count: newUsefulCount,
            reply_count: newUsefulCount,
            last_reply_date: lastReplyDate,
        })
        .eq("id", reportId);

    if (error) {
        log("progress", "Failed to update progress", { error: error.message });
        throw new Error(`Failed to update report progress: ${error.message}`);
    }

    log("progress", `Status updated to: ${thresholdMet ? "completed" : "scraping"}`);

    return { thresholdMet };
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
