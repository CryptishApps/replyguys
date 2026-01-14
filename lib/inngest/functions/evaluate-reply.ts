import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";
import { evaluateReply, type EvaluationContext, type ReplyToEvaluate } from "@/lib/ai/evaluate-reply";
import type { Weights } from "@/lib/ai/schemas";

const log = createLogger("evaluate-reply");

interface ReportContext {
    original_tweet_text: string | null;
    goal: string;
    persona: string | null;
    weights: Weights;
    reply_threshold: number;
    qualified_count: number;
}

export const evaluateReplyFunction = inngest.createFunction(
    {
        id: "evaluate-reply",
        retries: 2,
        concurrency: { limit: 30 }, // Conservative to stay under 1900/min rate limit
    },
    { event: "reply.evaluate" },
    async ({ event, step }) => {
        const { replyId, reportId, text, minLength } = event.data;
        const supabase = getSupabaseAdmin();

        // Check minimum length requirement first (skip AI call for short replies)
        if (text.length < minLength) {
            log("skip", `Reply ${replyId} too short (${text.length} < ${minLength})`);
            await step.run("mark-excluded", async () => {
                await supabase
                    .from("replies")
                    .update({
                        to_be_included: false,
                        evaluation_status: "evaluated",
                    })
                    .eq("id", replyId);
            });
            return { replyId, evaluated: true, toBeIncluded: false, reason: "too_short" };
        }

        // Fetch report context and reply details
        const context = await step.run("fetch-context", async () => {
            const [reportResult, replyResult] = await Promise.all([
                supabase
                    .from("reports")
                    .select("original_tweet_text, goal, persona, weights, reply_threshold, qualified_count")
                    .eq("id", reportId)
                    .single(),
                supabase
                    .from("replies")
                    .select("username, follower_count")
                    .eq("id", replyId)
                    .single(),
            ]);

            if (reportResult.error || !reportResult.data) {
                throw new Error(`Failed to fetch report: ${reportResult.error?.message}`);
            }
            if (replyResult.error || !replyResult.data) {
                throw new Error(`Failed to fetch reply: ${replyResult.error?.message}`);
            }

            return {
                report: reportResult.data as ReportContext,
                reply: replyResult.data as { username: string; follower_count: number },
            };
        });

        // Run AI evaluation
        const evaluation = await step.run("ai-evaluate", async () => {
            const evalContext: EvaluationContext = {
                originalTweetText: context.report.original_tweet_text || "",
                goal: context.report.goal,
                persona: context.report.persona || undefined,
            };

            const replyToEval: ReplyToEvaluate = {
                id: replyId,
                username: context.reply.username,
                followerCount: context.reply.follower_count,
                text,
            };

            log("evaluate", `Evaluating reply ${replyId} with AI`, {
                username: context.reply.username,
                textLength: text.length,
            });

            return evaluateReply(evalContext, replyToEval, context.report.weights);
        });

        // Update reply with evaluation results
        await step.run("update-reply", async () => {
            const { error } = await supabase
                .from("replies")
                .update({
                    actionability: evaluation.actionability,
                    specificity: evaluation.specificity,
                    originality: evaluation.originality,
                    constructiveness: evaluation.constructiveness,
                    weighted_score: evaluation.weightedScore,
                    tags: evaluation.tags,
                    mini_summary: evaluation.mini_summary,
                    to_be_included: evaluation.to_be_included,
                    is_useful: evaluation.to_be_included, // Keep is_useful in sync
                    evaluation_status: "evaluated",
                })
                .eq("id", replyId);

            if (error) {
                throw new Error(`Failed to update reply: ${error.message}`);
            }

            log("evaluate", `Reply ${replyId} evaluated`, {
                toBeIncluded: evaluation.to_be_included,
                weightedScore: evaluation.weightedScore,
                tags: evaluation.tags,
            });
        });

        // If qualified, increment count and check for summary trigger
        if (evaluation.to_be_included) {
            const shouldTriggerSummary = await step.run("increment-qualified", async () => {
                // Atomically increment qualified_count
                const { data, error } = await supabase.rpc("increment_qualified_count", {
                    report_id: reportId,
                });

                if (error) {
                    // Fallback to non-atomic increment if RPC doesn't exist
                    log("qualified", "RPC not available, using fallback increment");
                    const { data: report, error: fetchError } = await supabase
                        .from("reports")
                        .select("qualified_count, reply_threshold")
                        .eq("id", reportId)
                        .single();

                    if (fetchError) {
                        throw new Error(`Failed to fetch report: ${fetchError.message}`);
                    }

                    const newCount = (report.qualified_count || 0) + 1;
                    await supabase
                        .from("reports")
                        .update({ qualified_count: newCount })
                        .eq("id", reportId);

                    return newCount >= report.reply_threshold;
                }

                // Check if threshold met
                const { data: report } = await supabase
                    .from("reports")
                    .select("qualified_count, reply_threshold")
                    .eq("id", reportId)
                    .single();

                return report && report.qualified_count >= report.reply_threshold;
            });

            if (shouldTriggerSummary) {
                log("qualified", `Threshold met for report ${reportId}, triggering summary`);
                await step.sendEvent("trigger-summary", {
                    name: "report.generate-summary",
                    data: { reportId },
                });
            }
        }

        return {
            replyId,
            evaluated: true,
            toBeIncluded: evaluation.to_be_included,
            weightedScore: evaluation.weightedScore,
        };
    }
);
