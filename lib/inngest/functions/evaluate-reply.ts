import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";

const log = createLogger("evaluate-reply");

export const evaluateReplyFunction = inngest.createFunction(
    {
        id: "evaluate-reply",
        retries: 2,
        concurrency: { limit: 50 }, // High concurrency for validation
    },
    { event: "reply.evaluate" },
    async ({ event, step }) => {
        const { replyId, reportId, text, minLength } = event.data;
        const supabase = getSupabaseAdmin();

        const result = await step.run("evaluate-and-update", async () => {
            log("evaluate", `Evaluating reply ${replyId}`, { textLength: text.length, minLength });

            // Check minimum length requirement
            const meetsMinLength = text.length >= minLength;

            // For now: randomly assign is_useful
            // TODO: Replace with AI evaluation (Gemini)
            const isUseful = meetsMinLength ? Math.random() > 0.5 : false;

            const { error } = await supabase
                .from("replies")
                .update({
                    is_useful: isUseful,
                    evaluation_status: "evaluated",
                })
                .eq("id", replyId);

            if (error) {
                log("evaluate", `Failed to evaluate reply ${replyId}`, { error: error.message });
                throw new Error(`Failed to evaluate reply ${replyId}: ${error.message}`);
            }

            log("evaluate", `Reply ${replyId} evaluated`, { isUseful });
            return { isUseful };
        });

        return { replyId, evaluated: true, isUseful: result.isUseful };
    }
);
