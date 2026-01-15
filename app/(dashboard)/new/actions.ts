"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { inngest } from "@/lib/inngest/client";
import { WEIGHT_PRESETS, type Weights } from "@/lib/ai/schemas";

type ActionResult =
    | { success: true; reportId: string }
    | { success: false; error: string; rateLimited?: false }
    | { success: false; error: string; rateLimited: true; retryAfter: string };

type UrlValidationResult =
    | { valid: true; conversationId: string }
    | { valid: false; error: string };

function validateXPostUrl(url: string): UrlValidationResult {
    // Normalize and trim
    const trimmed = url.trim();
    if (!trimmed) {
        return { valid: false, error: "URL is required" };
    }

    // Parse as URL
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { valid: false, error: "Invalid URL format" };
    }

    // Check protocol
    if (!["https:"].includes(parsed.protocol)) {
        return { valid: false, error: "URL must use https" };
    }

    // Check domain (allow www. prefix and mobile. prefix)
    const hostname = parsed.hostname.replace(/^(www\.|mobile\.)/, "");
    if (hostname !== "x.com" && hostname !== "twitter.com") {
        return { valid: false, error: "URL must be from x.com or twitter.com" };
    }

    // Parse path: /:username/status/:id
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length < 3) {
        return { valid: false, error: "URL must include username and status ID (e.g., /username/status/123)" };
    }

    const [username, statusKeyword, statusId] = pathParts;

    // Validate username exists and is valid
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return { valid: false, error: "Invalid username in URL" };
    }

    // Check for /status/ path
    if (statusKeyword !== "status") {
        return { valid: false, error: "URL must be a post URL containing /status/" };
    }

    // Validate status ID is numeric
    if (!statusId || !/^\d+$/.test(statusId)) {
        return { valid: false, error: "Invalid status ID - must be a number" };
    }

    return { valid: true, conversationId: statusId };
}

function parseWeights(weightsStr: string | null, preset: string): Weights {
    // If valid preset, use preset weights
    if (preset && preset !== "custom" && preset in WEIGHT_PRESETS) {
        return WEIGHT_PRESETS[preset as keyof typeof WEIGHT_PRESETS];
    }

    // Try to parse custom weights
    if (weightsStr) {
        try {
            const parsed = JSON.parse(weightsStr);
            return {
                actionability: Math.min(100, Math.max(0, parsed.actionability ?? 25)),
                specificity: Math.min(100, Math.max(0, parsed.specificity ?? 25)),
                substantiveness: Math.min(100, Math.max(0, parsed.substantiveness ?? 25)),
                constructiveness: Math.min(100, Math.max(0, parsed.constructiveness ?? 25)),
            };
        } catch {
            // Fall through to default
        }
    }

    return WEIGHT_PRESETS.balanced;
}

export async function createReport(formData: FormData): Promise<ActionResult> {
    const url = formData.get("url") as string;
    
    const urlValidation = validateXPostUrl(url);
    if (!urlValidation.valid) {
        return { success: false, error: urlValidation.error };
    }
    const { conversationId } = urlValidation;

    // Parse goal (required)
    const goal = (formData.get("goal") as string)?.trim();
    if (!goal) {
        return { success: false, error: "Goal is required" };
    }

    // Parse persona (optional)
    const personaRaw = formData.get("persona") as string;
    const persona = personaRaw?.trim() || null;

    // Parse preset and weights
    const preset = (formData.get("preset") as string) || "balanced";
    const weightsStr = formData.get("weights") as string;
    const weights = parseWeights(weightsStr, preset);

    // Parse form fields with validation
    const replyThresholdRaw = parseInt(formData.get("replyThreshold") as string);
    const replyThreshold = Math.min(
        Math.max(isNaN(replyThresholdRaw) ? 100 : replyThresholdRaw, 1),
        250
    );

    const minLengthRaw = parseInt(formData.get("minLength") as string);
    const minLength = isNaN(minLengthRaw) ? 0 : Math.max(minLengthRaw, 0);

    const blueOnly = formData.get("blueOnly") === "on";

    const minFollowersRaw = parseInt(formData.get("minFollowers") as string);
    const minFollowers = isNaN(minFollowersRaw) || minFollowersRaw <= 0 ? null : minFollowersRaw;

    // Server-side validation
    if (replyThreshold > 250) {
        return { success: false, error: "Reply threshold cannot exceed 250" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Rate limiting: max 3 reports per minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentReports, error: rateError } = await supabase
        .from("reports")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", oneMinuteAgo)
        .order("created_at", { ascending: true })
        .limit(3);

    if (rateError) {
        console.error("Failed to check rate limit:", rateError);
        return { success: false, error: "Failed to check rate limit" };
    }

    if (recentReports && recentReports.length >= 3) {
        // Calculate when the oldest report falls outside the window
        const oldestReportTime = new Date(recentReports[0].created_at).getTime();
        const retryAfter = new Date(oldestReportTime + 60 * 1000).toISOString();
        return {
            success: false,
            error: "Rate limit exceeded. Please wait before creating another report.",
            rateLimited: true,
            retryAfter,
        };
    }

    // Use admin client for insert to enforce rate limiting via server action only
    const adminClient = createAdminClient();
    const { data: report, error } = await adminClient
        .from("reports")
        .insert({
            user_id: user.id,
            x_post_url: url,
            conversation_id: conversationId,
            status: "setting_up",
            reply_threshold: replyThreshold,
            min_length: minLength,
            blue_only: blueOnly,
            min_followers: minFollowers,
            useful_count: 0,
            qualified_count: 0,
            goal,
            persona,
            preset,
            weights,
            summary_status: "pending",
        })
        .select("id")
        .single();

    if (error) {
        console.error("Failed to create report:", error);
        return { success: false, error: "Failed to create report" };
    }

    // Trigger Inngest event to start scraping
    await inngest.send({
        name: "report.created",
        data: {
            reportId: report.id,
            conversationId,
        },
    });

    redirect(`/report/${report.id}`);
}
