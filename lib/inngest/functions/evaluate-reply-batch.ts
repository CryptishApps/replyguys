import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger, logReportActivity } from "@/lib/inngest/utils";
import { evaluateReply, type EvaluationContext, type ReplyToEvaluate } from "@/lib/ai/evaluate-reply";
import type { Weights } from "@/lib/ai/schemas";

const log = createLogger("evaluate-batch");

interface ReplyInput {
    replyId: string;
    text: string;
}

interface ReportContext {
    original_tweet_text: string | null;
    goal: string;
    persona: string | null;
    weights: Weights;
    reply_threshold: number;
    status: string;
}

export const evaluateReplyBatchFunction = inngest.createFunction(
    {
        id: "evaluate-reply-batch",
        retries: 2,
        throttle: {
            limit: 20, // 20 batches × 50 replies = 1000 AI calls/min (Gemini limit)
            period: "1m",
        },
    },
    { event: "reply.evaluate-batch" },
    async ({ event, step }) => {
        const { reportId, minLength, replies } = event.data as {
            reportId: string;
            minLength: number;
            replies: ReplyInput[];
        };

        const supabase = getSupabaseAdmin();

        // Early exit: Check if threshold already met before doing any AI work
        const shouldSkip = await step.run("check-threshold-early", async () => {
            const [countResult, reportResult] = await Promise.all([
                supabase
                    .from("replies")
                    .select("id", { count: "exact", head: true })
                    .eq("report_id", reportId)
                    .eq("to_be_included", true),
                supabase
                    .from("reports")
                    .select("reply_threshold, status")
                    .eq("id", reportId)
                    .single(),
            ]);

            if (reportResult.error || !reportResult.data) {
                log("skip", "Failed to fetch report for early check", { error: reportResult.error?.message });
                return false; // Continue with evaluation
            }

            const qualifiedCount = countResult.count ?? 0;
            const threshold = reportResult.data.reply_threshold;
            const status = reportResult.data.status;

            // Skip if already completed or threshold met
            if (status !== "scraping" || qualifiedCount >= threshold) {
                log("skip", `Skipping batch - threshold already met or report not scraping`, {
                    qualifiedCount,
                    threshold,
                    status,
                });
                return true;
            }

            return false;
        });

        if (shouldSkip) {
            return {
                skipped: true,
                reason: "threshold_already_met",
                batchSize: replies.length,
            };
        }

        // Fetch report context once for all replies
        const context = await step.run("fetch-context", async () => {
            const { data, error } = await supabase
                .from("reports")
                .select("original_tweet_text, goal, persona, weights, reply_threshold, status")
                .eq("id", reportId)
                .single();

            if (error || !data) {
                throw new Error(`Failed to fetch report: ${error?.message}`);
            }

            return data as ReportContext;
        });

        // Fetch all reply details in one query
        const replyDetailsMap = await step.run("fetch-reply-details", async () => {
            const replyIds = replies.map((r) => r.replyId);
            const { data, error } = await supabase
                .from("replies")
                .select("id, username, follower_count")
                .eq("report_id", reportId)
                .in("id", replyIds);

            if (error) {
                throw new Error(`Failed to fetch reply details: ${error.message}`);
            }

            // Return as plain object (Maps aren't serializable)
            const lookup: Record<string, { username: string; follower_count: number }> = {};
            for (const r of data || []) {
                lookup[r.id] = { username: r.username, follower_count: r.follower_count };
            }
            return lookup;
        });

        // Filter out short replies and prepare for evaluation
        const toEvaluate: Array<{ reply: ReplyInput; details: { username: string; follower_count: number } }> = [];
        const tooShort: ReplyInput[] = [];

        for (const reply of replies) {
            if (reply.text.length < minLength) {
                tooShort.push(reply);
            } else {
                const details = replyDetailsMap[reply.replyId];
                if (details) {
                    toEvaluate.push({ reply, details });
                }
            }
        }

        // Mark short replies as excluded
        if (tooShort.length > 0) {
            await step.run("mark-short-excluded", async () => {
                const ids = tooShort.map((r) => r.replyId);
                await supabase
                    .from("replies")
                    .update({
                        to_be_included: false,
                        evaluation_status: "evaluated",
                    })
                    .eq("report_id", reportId)
                    .in("id", ids);

                log("skip", `Marked ${tooShort.length} short replies as excluded`);
            });
        }

        // Run AI evaluations in parallel
        const evaluations = await step.run("ai-evaluate-batch", async () => {
            log("evaluate", `Evaluating ${toEvaluate.length} replies in parallel`);

            const evalContext: EvaluationContext = {
                originalTweetText: context.original_tweet_text || "",
                goal: context.goal,
                persona: context.persona || undefined,
            };

            const promises = toEvaluate.map(async ({ reply, details }) => {
                const replyToEval: ReplyToEvaluate = {
                    id: reply.replyId,
                    username: details.username,
                    followerCount: details.follower_count,
                    text: reply.text,
                };

                try {
                    const result = await evaluateReply(evalContext, replyToEval, context.weights);
                    return { replyId: reply.replyId, evaluation: result, error: null };
                } catch (err) {
                    log("error", `Failed to evaluate reply ${reply.replyId}`, { error: String(err) });
                    return { replyId: reply.replyId, evaluation: null, error: String(err) };
                }
            });

            return Promise.all(promises);
        });

        // Update all replies with evaluation results
        const updateResults = await step.run("update-replies", async () => {
            let qualified = 0;
            let failed = 0;

            for (const { replyId, evaluation, error } of evaluations) {
                if (error || !evaluation) {
                    failed++;
                    continue;
                }

                const { error: updateError } = await supabase
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
                    .eq("report_id", reportId);

                if (updateError) {
                    log("error", `Failed to update reply ${replyId}`, { error: updateError.message });
                    failed++;
                } else if (evaluation.to_be_included) {
                    qualified++;
                }
            }

            log("evaluate", `Batch complete: ${qualified} qualified, ${failed} failed`);
            return { qualified, failed };
        });

        // Check if threshold is now met
        const shouldTriggerSummary = await step.run("check-threshold-final", async () => {
            const [countResult, reportResult] = await Promise.all([
                supabase
                    .from("replies")
                    .select("id", { count: "exact", head: true })
                    .eq("report_id", reportId)
                    .eq("to_be_included", true),
                supabase
                    .from("reports")
                    .select("reply_threshold, status")
                    .eq("id", reportId)
                    .single(),
            ]);

            if (reportResult.error || !reportResult.data) {
                return false;
            }

            const qualifiedCount = countResult.count ?? 0;
            const threshold = reportResult.data.reply_threshold;
            const status = reportResult.data.status;

            if (status !== "scraping") {
                return false;
            }

            const crossed = qualifiedCount >= threshold;
            log("qualified", `Threshold check: ${qualifiedCount}/${threshold}`, { crossed });
            return crossed;
        });

        if (shouldTriggerSummary) {
            log("qualified", `Threshold met for report ${reportId}, marking completed`);

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
                        message: "Target reached! Generating your summary...",
                    },
                    log
                );
            });

            await step.sendEvent("trigger-summary", {
                name: "report.generate-summary",
                data: { reportId },
            });
        }

        return {
            batchSize: replies.length,
            evaluated: toEvaluate.length,
            tooShort: tooShort.length,
            qualified: updateResults.qualified,
            failed: updateResults.failed,
            triggeredSummary: shouldTriggerSummary,
        };
    }
);
