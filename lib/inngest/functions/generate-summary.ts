import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger, logReportActivity } from "@/lib/inngest/utils";
import { generateSummary, type SummaryContext, type QualifiedReply } from "@/lib/ai/generate-summary";
import type { ReplyTag } from "@/lib/ai/schemas";

const log = createLogger("generate-summary");

export const generateSummaryFunction = inngest.createFunction(
    {
        id: "generate-summary",
        retries: 2,
        throttle: { // 25 RPM is the limit for Gemini Pro
            limit: 20,
            period: "1m"
        }, // Allow parallel summaries for different reports
        idempotency: "event.data.reportId", // Dedupe by reportId - prevents duplicate summary runs
    },
    { event: "report.generate-summary" },
    async ({ event, step }) => {
        const { reportId } = event.data;
        const supabase = getSupabaseAdmin();
        await logReportActivity(
            supabase,
            { report_id: reportId, key: "summary", message: "Preparing to generate summary" },
            log
        );

        // Step 0: Check if summary already exists (idempotency fallback)
        const alreadyDone = await step.run("check-existing-summary", async () => {
            const { data, error } = await supabase
                .from("reports")
                .select("summary_status, summary")
                .eq("id", reportId)
                .single();

            if (error) {
                log("check", "Failed to check existing summary", { error: error.message });
                return false;
            }

            // Skip if already completed or currently generating
            if (data.summary_status === "completed" && data.summary) {
                log("check", "Summary already exists, skipping");
                return true;
            }

            if (data.summary_status === "generating") {
                log("check", "Summary already being generated, skipping");
                return true;
            }

            return false;
        });

        if (alreadyDone) {
            return { reportId, skipped: true, reason: "Summary already exists or in progress" };
        }

        // Step 1: Mark summary as generating
        await step.run("mark-generating", async () => {
            const { error } = await supabase
                .from("reports")
                .update({ summary_status: "generating" })
                .eq("id", reportId);

            if (error) {
                throw new Error(`Failed to update summary status: ${error.message}`);
            }

            log("status", "Marked report as generating summary");
        });

        // Step 2: Fetch report context
        const context = await step.run("fetch-context", async () => {
            const { data, error } = await supabase
                .from("reports")
                .select("original_tweet_text, goal, persona")
                .eq("id", reportId)
                .single();

            if (error || !data) {
                throw new Error(`Failed to fetch report: ${error?.message}`);
            }

            return data as { original_tweet_text: string | null; goal: string; persona: string | null };
        });

        // Step 3: Fetch all qualified replies
        const qualifiedReplies = await step.run("fetch-qualified-replies", async () => {
            const { data, error } = await supabase
                .from("replies")
                .select(`
                    id, username, follower_count, text,
                    goal_relevance, actionability, specificity, substantiveness, constructiveness,
                    tags, mini_summary
                `)
                .eq("report_id", reportId)
                .eq("to_be_included", true)
                .order("weighted_score", { ascending: false });

            if (error) {
                throw new Error(`Failed to fetch replies: ${error.message}`);
            }

            log("fetch", `Found ${data?.length ?? 0} qualified replies`);
            const count = data?.length ?? 0;
            await logReportActivity(
                supabase,
                {
                    report_id: reportId,
                    key: "summary",
                    message: `Analyzing ${count} qualified ${count === 1 ? "reply" : "replies"}`,
                    meta: { count },
                },
                log
            );

            return (data ?? []).map((reply) => ({
                id: reply.id,
                username: reply.username,
                followerCount: reply.follower_count,
                text: reply.text,
                goalRelevance: reply.goal_relevance ?? 0,
                actionability: reply.actionability ?? 0,
                specificity: reply.specificity ?? 0,
                substantiveness: reply.substantiveness ?? 0,
                constructiveness: reply.constructiveness ?? 0,
                tags: (reply.tags ?? []) as ReplyTag[],
                miniSummary: reply.mini_summary ?? "",
            })) as QualifiedReply[];
        });

        // Step 4: Generate summary with AI
        const summary = await step.run("generate-ai-summary", async () => {
            if (qualifiedReplies.length === 0) {
                log("summary", "No qualified replies, generating minimal summary");
                return {
                    executive_summary:
                        "This report did not receive enough high-quality replies to generate meaningful insights. " +
                        "The replies that were collected either lacked specificity, actionability, or relevance to the stated goal.",
                    quality_note: "Insufficient quality replies for comprehensive analysis.",
                };
            }

            const summaryContext: SummaryContext = {
                originalTweetText: context.original_tweet_text || "",
                goal: context.goal,
                persona: context.persona || undefined,
            };

            log("summary", `Generating summary for ${qualifiedReplies.length} replies`);
            return generateSummary(summaryContext, qualifiedReplies);
        });

        // Step 5: Store summary and mark complete
        await step.run("store-summary", async () => {
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "summary", message: "Finalizing your report" },
                log
            );
            const { error } = await supabase
                .from("reports")
                .update({
                    summary,
                    summary_status: "completed",
                    status: "completed",
                })
                .eq("id", reportId);

            if (error) {
                throw new Error(`Failed to store summary: ${error.message}`);
            }

            log("complete", "Summary stored successfully", {
                hasKeyThemes: !!summary.key_themes?.length,
                hasTopInsights: !!summary.top_insights?.length,
                hasActionItems: !!summary.action_items?.length,
            });
        });

        return {
            reportId,
            qualifiedRepliesCount: qualifiedReplies.length,
            summaryGenerated: true,
        };
    }
);
