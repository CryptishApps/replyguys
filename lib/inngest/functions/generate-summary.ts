import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";
import { generateSummary, type SummaryContext, type QualifiedReply } from "@/lib/ai/generate-summary";
import type { ReplyTag } from "@/lib/ai/schemas";

const log = createLogger("generate-summary");

export const generateSummaryFunction = inngest.createFunction(
    {
        id: "generate-summary",
        retries: 2,
        concurrency: { limit: 1 }, // Global limit for Gemini Pro rate
    },
    { event: "report.generate-summary" },
    async ({ event, step }) => {
        const { reportId } = event.data;
        const supabase = getSupabaseAdmin();

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
                    actionability, specificity, originality, constructiveness,
                    tags, mini_summary
                `)
                .eq("report_id", reportId)
                .eq("to_be_included", true)
                .order("weighted_score", { ascending: false });

            if (error) {
                throw new Error(`Failed to fetch replies: ${error.message}`);
            }

            log("fetch", `Found ${data?.length ?? 0} qualified replies`);

            return (data ?? []).map((reply) => ({
                id: reply.id,
                username: reply.username,
                followerCount: reply.follower_count,
                text: reply.text,
                actionability: reply.actionability ?? 0,
                specificity: reply.specificity ?? 0,
                originality: reply.originality ?? 0,
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
