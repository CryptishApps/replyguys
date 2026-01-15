"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { generateTweetIntentUrl } from "@/lib/x-api";
import type { ReportSummary } from "@/lib/ai/schemas";

type ActionResult =
    | { success: true }
    | { success: false; error: string };

type ShareToXResult =
    | { success: true; status: "queued" }
    | { success: false; error: string };

type GetShareUrlResult =
    | { success: true; url: string }
    | { success: false; error: string };

export async function generateSummary(reportId: string): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Verify user owns this report and it has qualified replies
    const { data: report, error } = await supabase
        .from("reports")
        .select("id, qualified_count, summary_status")
        .eq("id", reportId)
        .eq("user_id", user.id)
        .single();

    if (error || !report) {
        return { success: false, error: "Report not found" };
    }

    if (report.qualified_count === 0) {
        return { success: false, error: "No qualified replies to summarize" };
    }

    if (report.summary_status === "generating") {
        return { success: false, error: "Summary is already being generated" };
    }

    if (report.summary_status === "completed") {
        return { success: false, error: "Summary already exists" };
    }

    // Trigger summary generation
    await inngest.send({
        name: "report.generate-summary",
        data: { reportId },
    });

    return { success: true };
}

export async function shareToX(reportId: string): Promise<ShareToXResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Verify user owns this report and it has a completed summary
    const { data: report, error } = await supabase
        .from("reports")
        .select("id, summary_status, viral_tweet_status")
        .eq("id", reportId)
        .eq("user_id", user.id)
        .single();

    if (error || !report) {
        return { success: false, error: "Report not found" };
    }

    if (report.summary_status !== "completed") {
        return { success: false, error: "Summary not completed" };
    }

    if (report.viral_tweet_status === "generating") {
        return { success: false, error: "Already generating viral tweet" };
    }

    if (report.viral_tweet_status === "posted") {
        return { success: false, error: "Viral tweet already posted" };
    }

    // Check user has X tokens
    const { data: profile } = await supabase
        .from("profiles")
        .select("x_access_token")
        .eq("id", user.id)
        .single();

    if (!profile?.x_access_token) {
        return { success: false, error: "X account not connected. Please log out and log in again to grant posting permissions." };
    }

    // Trigger viral tweet generation
    await inngest.send({
        name: "report.generate-viral-tweet",
        data: { reportId, userId: user.id },
    });

    return { success: true, status: "queued" };
}

/**
 * Generate a share URL that opens X's tweet composer with pre-filled text
 * This works without API posting permissions (Free tier friendly)
 */
export async function getShareToXUrl(reportId: string): Promise<GetShareUrlResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Fetch report with summary
    const { data: report, error } = await supabase
        .from("reports")
        .select("id, x_post_url, summary, summary_status, original_author_username")
        .eq("id", reportId)
        .eq("user_id", user.id)
        .single();

    if (error || !report) {
        return { success: false, error: "Report not found" };
    }

    if (report.summary_status !== "completed" || !report.summary) {
        return { success: false, error: "Summary not completed" };
    }

    const summary = report.summary as ReportSummary;

    // Build tweet text
    const sentences = summary.executive_summary.split(/(?<=[.!?])\s+/).slice(0, 2);
    let tweetText = sentences.join(" ");
    
    // Truncate if too long (leave room for URL and branding)
    const maxLength = 200;
    if (tweetText.length > maxLength) {
        tweetText = tweetText.slice(0, maxLength - 3) + "...";
    }

    // Add mentions from hidden gems or top insights
    const mentions: string[] = [];
    const seen = new Set<string>();
    const originalAuthor = report.original_author_username?.toLowerCase();

    const addMention = (username: string) => {
        const normalized = username.toLowerCase();
        if (!seen.has(normalized) && normalized !== originalAuthor && mentions.length < 2) {
            seen.add(normalized);
            mentions.push(username);
        }
    };

    summary.hidden_gems?.forEach(g => addMention(g.username));
    summary.top_insights?.forEach(i => addMention(i.username));

    if (mentions.length > 0) {
        tweetText += `\n\nShoutout to ${mentions.map(u => `@${u}`).join(" ")} for the insights`;
    }

    tweetText += "\n\nAssessed by @replyguysapp";

    // Generate the intent URL with the original tweet URL for quoting
    const url = generateTweetIntentUrl({
        text: tweetText,
        quoteTweetUrl: report.x_post_url,
    });

    return { success: true, url };
}
