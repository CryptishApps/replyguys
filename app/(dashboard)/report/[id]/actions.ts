"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

type ActionResult =
    | { success: true }
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
