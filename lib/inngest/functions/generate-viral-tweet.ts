import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger, logReportActivity } from "@/lib/inngest/utils";
import { generateVisualSummary } from "@/lib/ai/generate-visual-summary";
import { getValidAccessToken, uploadMedia, postTweet, extractTweetId } from "@/lib/x-api";
import type { ReportSummary } from "@/lib/ai/schemas";

const log = createLogger("generate-viral-tweet");

/**
 * Select users to mention in the viral tweet
 * Prioritizes hidden gems (smaller accounts), then top insights
 */
function selectMentions(
    summary: ReportSummary,
    originalAuthor: string,
    maxMentions: number = 3
): string[] {
    const mentions: string[] = [];
    const seen = new Set<string>();

    // Helper to add a mention if not already added
    const addMention = (username: string): boolean => {
        const normalized = username.toLowerCase();
        if (seen.has(normalized) || normalized === originalAuthor.toLowerCase()) {
            return false;
        }
        seen.add(normalized);
        mentions.push(username);
        return true;
    };

    // Priority 1: Hidden gems (smaller accounts with valuable insights)
    if (summary.hidden_gems) {
        for (const gem of summary.hidden_gems) {
            if (mentions.length >= maxMentions) break;
            addMention(gem.username);
        }
    }

    // Priority 2: Top insights
    if (summary.top_insights && mentions.length < maxMentions) {
        for (const insight of summary.top_insights) {
            if (mentions.length >= maxMentions) break;
            addMention(insight.username);
        }
    }

    return mentions;
}

/**
 * Compose the viral tweet text
 */
function composeTweetText(
    executiveSummary: string,
    mentions: string[],
    _originalAuthor: string
): string {
    // Extract first 1-2 punchy sentences from the summary
    const sentences = executiveSummary.split(/(?<=[.!?])\s+/).slice(0, 2);
    const summarySnippet = sentences.join(" ");

    // Build tweet parts
    const parts: string[] = [];

    // Summary (truncate if needed to fit within tweet limits)
    const maxSummaryLength = 200;
    if (summarySnippet.length > maxSummaryLength) {
        parts.push(summarySnippet.slice(0, maxSummaryLength - 3) + "...");
    } else {
        parts.push(summarySnippet);
    }

    // Mentions (if any)
    if (mentions.length > 0) {
        const mentionStr = mentions.map((u) => `@${u}`).join(" ");
        parts.push(`\nShoutout to ${mentionStr} for the insights`);
    }

    // Branding
    parts.push("\n\nAssessed by @replyguysapp");

    return parts.join("");
}

export const generateViralTweetFunction = inngest.createFunction(
    {
        id: "generate-viral-tweet",
        retries: 2,
        throttle: {
            limit: 5,
            period: "1m",
        },
    },
    { event: "report.generate-viral-tweet" },
    async ({ event, step }) => {
        const { reportId, userId } = event.data;
        const supabase = getSupabaseAdmin();

        await logReportActivity(
            supabase,
            { report_id: reportId, key: "viral", message: "Starting viral tweet generation" },
            log
        );

        // Step 1: Fetch report, summary, and user profile
        const data = await step.run("fetch-data", async () => {
            const [reportResult, profileResult] = await Promise.all([
                supabase
                    .from("reports")
                    .select(`
                        id, x_post_url, title, summary, summary_status,
                        original_tweet_text, original_author_username,
                        reply_count, qualified_count, viral_tweet_status
                    `)
                    .eq("id", reportId)
                    .single(),
                supabase
                    .from("profiles")
                    .select("x_access_token, x_refresh_token, x_token_expires_at, x_username")
                    .eq("id", userId)
                    .single(),
            ]);

            if (reportResult.error || !reportResult.data) {
                throw new Error(`Report not found: ${reportResult.error?.message}`);
            }

            if (profileResult.error || !profileResult.data) {
                throw new Error(`Profile not found: ${profileResult.error?.message}`);
            }

            const report = reportResult.data;
            const profile = profileResult.data;

            if (report.summary_status !== "completed" || !report.summary) {
                throw new Error("Summary not completed");
            }

            if (report.viral_tweet_status === "posted") {
                throw new Error("Viral tweet already posted");
            }

            if (!profile.x_access_token || !profile.x_refresh_token) {
                throw new Error("X tokens not found - user needs to re-authenticate");
            }

            return {
                report: {
                    id: report.id,
                    xPostUrl: report.x_post_url,
                    title: report.title ?? "Reply Analysis",
                    summary: report.summary as ReportSummary,
                    originalTweetText: report.original_tweet_text ?? "",
                    originalAuthor: report.original_author_username ?? "unknown",
                    totalReplies: report.reply_count,
                    qualifiedReplies: report.qualified_count ?? 0,
                },
                profile: {
                    accessToken: profile.x_access_token,
                    refreshToken: profile.x_refresh_token,
                    expiresAt: new Date(profile.x_token_expires_at),
                    username: profile.x_username,
                },
            };
        });

        // Step 2: Mark as generating
        await step.run("mark-generating", async () => {
            const { error } = await supabase
                .from("reports")
                .update({ viral_tweet_status: "generating" })
                .eq("id", reportId);

            if (error) {
                throw new Error(`Failed to update status: ${error.message}`);
            }

            log("status", "Marked as generating");
        });

        // Step 3: Get valid access token (refresh if needed)
        const tokens = await step.run("refresh-token", async () => {
            // expiresAt is serialized to string by Inngest, convert back to Date
            const expiresAt = typeof data.profile.expiresAt === "string" 
                ? new Date(data.profile.expiresAt) 
                : data.profile.expiresAt;
            
            const result = await getValidAccessToken({
                accessToken: data.profile.accessToken,
                refreshToken: data.profile.refreshToken,
                expiresAt,
            });

            if (result.wasRefreshed) {
                log("token", "Refreshed X access token");
                // Update stored tokens
                await supabase
                    .from("profiles")
                    .update({
                        x_access_token: result.accessToken,
                        x_refresh_token: result.refreshToken,
                        x_token_expires_at: result.expiresAt.toISOString(),
                    })
                    .eq("id", userId);
            }

            return result;
        });

        // Step 4: Select users to mention
        const mentions = selectMentions(
            data.report.summary,
            data.report.originalAuthor,
            3
        );

        log("mentions", `Selected ${mentions.length} users to mention`, { mentions });

        // Step 5: Generate visual summary
        const image = await step.run("generate-image", async () => {
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "viral", message: "Generating visual summary" },
                log
            );

            const result = await generateVisualSummary(
                data.report.summary,
                {
                    reportTitle: data.report.title,
                    originalTweetText: data.report.originalTweetText,
                    originalAuthor: data.report.originalAuthor,
                    totalReplies: data.report.totalReplies,
                    qualifiedReplies: data.report.qualifiedReplies,
                },
                mentions
            );

            if (!result) {
                log("image", "Image generation failed, proceeding without image");
                return null;
            }

            log("image", "Visual summary generated successfully");
            return result;
        });

        // Step 6: Upload media to X (if image was generated)
        const mediaId = await step.run("upload-media", async () => {
            if (!image) {
                log("media", "No image to upload");
                return null;
            }

            await logReportActivity(
                supabase,
                { report_id: reportId, key: "viral", message: "Uploading image to X" },
                log
            );

            try {
                const id = await uploadMedia(
                    tokens.accessToken,
                    image.imageBase64,
                    image.mimeType
                );
                log("media", `Media uploaded successfully: ${id}`);
                return id;
            } catch (error) {
                log("media", "Media upload failed, proceeding without image", { error });
                return null;
            }
        });

        // Step 7: Compose and post tweet
        const tweet = await step.run("post-tweet", async () => {
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "viral", message: "Posting tweet" },
                log
            );

            const tweetText = composeTweetText(
                data.report.summary.executive_summary,
                mentions,
                data.report.originalAuthor
            );

            const quoteTweetId = extractTweetId(data.report.xPostUrl);

            if (!quoteTweetId) {
                throw new Error(`Could not extract tweet ID from URL: ${data.report.xPostUrl}`);
            }

            log("tweet", "Posting tweet", { textLength: tweetText.length, hasMedia: !!mediaId });

            const result = await postTweet(tokens.accessToken, {
                text: tweetText,
                mediaId: mediaId ?? undefined,
                quoteTweetId,
            });

            log("tweet", `Tweet posted successfully: ${result.data.id}`);
            return result;
        });

        // Step 8: Update report with tweet ID
        await step.run("update-report", async () => {
            const { error } = await supabase
                .from("reports")
                .update({
                    viral_tweet_id: tweet.data.id,
                    viral_tweet_status: "posted",
                })
                .eq("id", reportId);

            if (error) {
                log("update", "Failed to update report with tweet ID", { error: error.message });
            } else {
                log("update", "Report updated with viral tweet ID");
            }

            await logReportActivity(
                supabase,
                {
                    report_id: reportId,
                    key: "viral",
                    message: "Viral tweet posted successfully!",
                    meta: { tweetId: tweet.data.id },
                },
                log
            );
        });

        return {
            reportId,
            tweetId: tweet.data.id,
            mentions,
            hasImage: !!mediaId,
        };
    }
);
