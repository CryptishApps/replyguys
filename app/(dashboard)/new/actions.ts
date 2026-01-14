"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { inngest } from "@/lib/inngest/client";
import { WEIGHT_PRESETS, type Weights } from "@/lib/ai/schemas";

type ActionResult =
    | { success: true; reportId: string }
    | { success: false; error: string };

function extractConversationId(url: string): string | null {
    // Match patterns like:
    // https://x.com/user/status/1234567890
    // https://twitter.com/user/status/1234567890
    const match = url.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
    return match ? match[1] : null;
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
                originality: Math.min(100, Math.max(0, parsed.originality ?? 25)),
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

    if (!url) {
        return { success: false, error: "URL is required" };
    }

    const conversationId = extractConversationId(url);
    if (!conversationId) {
        return { success: false, error: "Invalid X post URL" };
    }

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

    const { data: report, error } = await supabase
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
