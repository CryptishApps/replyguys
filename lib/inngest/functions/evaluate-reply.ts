import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger, logReportActivity } from "@/lib/inngest/utils";
import { evaluateReply, type EvaluationContext, type ReplyToEvaluate } from "@/lib/ai/evaluate-reply";
import type { Weights } from "@/lib/ai/schemas";

const log = createLogger("evaluate-reply");

interface ReportContext {
    original_tweet_text: string | null;
    goal: string;
    persona: string | null;
    weights: Weights;
    reply_threshold: number;
}

export const evaluateReplyFunction = inngest.createFunction(
    {
        id: "evaluate-reply",
        retries: 2,
        throttle: {
            limit: 1000, // 2000 RPM is the limit for Gemini Flash 2
            period: "1m",
        }
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
                    .eq("id", replyId)
                    .eq("report_id", reportId); // Composite key: (id, report_id)
            });
            return { replyId, evaluated: true, toBeIncluded: false, reason: "too_short" };
        }

        // Fetch report context and reply details
        const context = await step.run("fetch-context", async () => {
            const [reportResult, replyResult] = await Promise.all([
                supabase
                    .from("reports")
                    .select("original_tweet_text, goal, persona, weights, reply_threshold")
                    .eq("id", reportId)
                    .single(),
                supabase
                    .from("replies")
                    .select("username, follower_count")
                    .eq("id", replyId)
                    .eq("report_id", reportId) // Composite key: (id, report_id)
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

        // Update reply with evaluation results - returns whether update succeeded
        const updateSucceeded = await step.run("update-reply", async () => {
            const { error, data } = await supabase
                .from("replies")
                .update({
                    goal_relevance: evaluation.goal_relevance,
                    actionability: evaluation.actionability,
                    specificity: evaluation.specificity,
                    substantiveness: evaluation.substantiveness,
                    constructiveness: evaluation.constructiveness,
                    weighted_score: evaluation.weightedScore,
                    tags: evaluation.tags,
                    mini_summary: evaluation.mini_summary,
                    to_be_included: evaluation.to_be_included,
                    is_useful: evaluation.to_be_included,
                    evaluation_status: "evaluated",
                })
                .eq("id", replyId)
                .eq("report_id", reportId) // Composite key: (id, report_id)
                .select("id");

            if (error) {
                throw new Error(`Failed to update reply: ${error.message}`);
            }

            const rowsUpdated = data?.length ?? 0;
            if (rowsUpdated === 0) {
                log("warning", `Update matched 0 rows for reply ${replyId}`);
                return false;
            }

            log("evaluate", `Reply ${replyId} evaluated`, {
                toBeIncluded: evaluation.to_be_included,
                weightedScore: evaluation.weightedScore,
            });

            return true;
        });

        // If qualified AND update succeeded, check if we should trigger summary
        if (evaluation.to_be_included && updateSucceeded) {
            const shouldTriggerSummary = await step.run("check-threshold", async () => {
                // Count actual qualified replies (source of truth)
                const { count, error: countError } = await supabase
                    .from("replies")
                    .select("id", { count: "exact", head: true })
                    .eq("report_id", reportId)
                    .eq("to_be_included", true);

                if (countError) {
                    log("warning", "Failed to count qualified replies", { error: countError.message });
                    return false;
                }

                // Check report status and threshold
                const { data: report } = await supabase
                    .from("reports")
                    .select("reply_threshold, status")
                    .eq("id", reportId)
                    .single();

                if (!report || report.status !== "scraping") {
                    return false;
                }

                const qualifiedCount = count ?? 0;
                const crossedThreshold = qualifiedCount >= report.reply_threshold;

                log("qualified", `Qualified count: ${qualifiedCount}/${report.reply_threshold}`, {
                    crossedThreshold,
                });

                return crossedThreshold;
            });

            if (shouldTriggerSummary) {
                log("qualified", `Threshold met for report ${reportId}, marking completed and triggering summary`);

                await step.run("mark-completed", async () => {
                    await supabase
                        .from("reports")
                        .update({ status: "completed" })
                        .eq("id", reportId);

                    await logReportActivity(
                        supabase,
                        {
                            report_id: reportId,
                            key: "complete",
                            message: `Target reached! Generating your summary...`,
                        },
                        log
                    );
                });

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
