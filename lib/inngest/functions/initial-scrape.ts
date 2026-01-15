import { inngest } from "@/lib/inngest/client";
import { scrapeConversation, type OriginalTweet } from "@/lib/apify";
import { generateReportTitle } from "@/lib/gemini";
import {
    getSupabaseAdmin,
    createLogger,
    filterAndInsertReplies,
    updateReportProgress,
    createEvaluationEvents,
    logReportActivity,
    type ReportSettings,
} from "@/lib/inngest/utils";

const log = createLogger("initial-scrape");

export const initialScrapeFunction = inngest.createFunction(
    {
        id: "initial-scrape",
        retries: 3,
        concurrency: { limit: 5 },
    },
    { event: "report.created" },
    async ({ event, step }) => {
        const { reportId, conversationId } = event.data;
        log("init", "Starting initial scrape", { reportId, conversationId });

        const supabase = getSupabaseAdmin();

        // Step 1: Set status to setting_up and fetch report settings
        const settings = await step.run("setup-and-fetch-settings", async () => {
            log("setup", "Setting status to setting_up and fetching settings");
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "setup", message: "Preparing your report" },
                log
            );

            const { error: updateError } = await supabase
                .from("reports")
                .update({ status: "setting_up" })
                .eq("id", reportId);

            if (updateError) {
                log("setup", "Failed to update status", { error: updateError.message });
                throw new Error(`Failed to update report status: ${updateError.message}`);
            }

            const { data, error } = await supabase
                .from("reports")
                .select("reply_threshold, min_length, blue_only, min_followers, useful_count")
                .eq("id", reportId)
                .single();

            if (error || !data) {
                log("setup", "Failed to fetch settings", { error: error?.message });
                throw new Error(`Failed to fetch report settings: ${error?.message}`);
            }

            log("setup", "Settings loaded", data);
            return data as ReportSettings;
        });

        // Step 2: Scrape conversation (original tweet + replies in parallel)
        // The callback fires as soon as the original tweet is fetched,
        // saving it to DB immediately without waiting for replies
        const scrapeResult = await step.run("scrape-conversation", async () => {
            log("scrape", "Starting Apify scrape", {
                conversationId,
                blueOnly: settings.blue_only,
                minFollowers: settings.min_followers,
            });
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "scrape", message: "Looking up initial posts" },
                log
            );

            const result = await scrapeConversation(
                conversationId,
                {
                    sort: "Oldest",
                    maxItems: 100,
                    blueOnly: settings.blue_only,
                    minFollowers: settings.min_followers ?? undefined,
                    includeOriginalTweet: true,
                },
                {
                    // This callback fires immediately when original tweet is fetched,
                    // while replies are still being scraped
                    onOriginalTweetFetched: async (tweet: OriginalTweet) => {
                        log("callback", "Original tweet fetched, saving immediately", {
                            author: `@${tweet.author.userName}`,
                        });
                        await logReportActivity(
                            supabase,
                            {
                                report_id: reportId,
                                key: "scrape",
                                message: `Found your post by @${tweet.author.userName}`,
                                meta: { author: tweet.author.userName },
                            },
                            log
                        );

                        // Save original tweet data immediately
                        const { error: tweetError } = await supabase
                            .from("reports")
                            .update({
                                original_tweet_text: tweet.text,
                                original_author_username: tweet.author.userName,
                                original_author_avatar: tweet.author.profilePicture,
                            })
                            .eq("id", reportId);

                        if (tweetError) {
                            log("callback", "Failed to store original tweet", { error: tweetError.message });
                        } else {
                            log("callback", "Original tweet saved - UI should update now");
                        }

                        // Also generate and save title immediately
                        const title = await generateReportTitle(tweet.text);
                        if (title) {
                            const { error: titleError } = await supabase
                                .from("reports")
                                .update({ title })
                                .eq("id", reportId);

                            if (titleError) {
                                log("callback", "Failed to store title", { error: titleError.message });
                            } else {
                                log("callback", "Title saved", { title });
                            }
                        }
                    },
                }
            );

            log("scrape", "Scrape completed", {
                originalTweetFound: !!result.originalTweet,
                repliesCount: result.replies.length,
            });

            return result;
        });

        // Step 3: Filter and insert replies (using shared utility)
        const insertResult = await step.run("filter-and-insert-replies", async () => {
            return filterAndInsertReplies(
                supabase,
                reportId,
                scrapeResult.replies,
                settings,
                log
            );
        });

        // Step 4: Update report progress (using shared utility)
        const newUsefulCount = settings.useful_count + insertResult.inserted;
        const { reachedScrapeCap } = await step.run("update-report-progress", async () => {
            return updateReportProgress(
                supabase,
                reportId,
                newUsefulCount,
                settings.reply_threshold,
                insertResult.lastReplyDate,
                log
            );
        });

        // Step 5: Fan-out evaluation events for inserted replies
        if (insertResult.inserted > 0) {
            log("evaluate", `Sending ${insertResult.insertedReplies.length} evaluation events`);
            await logReportActivity(
                supabase,
                {
                    report_id: reportId,
                    key: "evaluate",
                    message: `Evaluating ${insertResult.insertedReplies.length} ${insertResult.insertedReplies.length === 1 ? "reply" : "replies"}`,
                    meta: { count: insertResult.insertedReplies.length },
                },
                log
            );

            const events = createEvaluationEvents(insertResult.insertedReplies, reportId, settings.min_length);
            await step.sendEvent("evaluation-events", events);

            log("evaluate", "Evaluation events sent");
        }

        // Step 6: If we got max replies (100), inserted some, and filtered some out, queue recurring scrape
        // This avoids waiting for the cron when we know there are more replies available
        // Skip if we've reached the scrape cap (3x threshold) or inserted nothing
        const scrapedMax = scrapeResult.replies.length >= 100;
        const insertedSome = insertResult.inserted > 0;
        const filteredSome = insertResult.inserted < scrapeResult.replies.length;

        if (!reachedScrapeCap && scrapedMax && insertedSome && filteredSome) {
            log("queue", "Got max replies and filtered some - queuing immediate recurring scrape");
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "scrape", message: "Fetching more replies..." },
                log
            );
            await step.sendEvent("immediate-recurring-scrape", {
                name: "report.scrape.recurring",
                data: { reportId, conversationId },
            });
        }

        const result = {
            repliesScraped: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            reachedScrapeCap,
            originalTweetFetched: !!scrapeResult.originalTweet,
            queuedRecurring: !reachedScrapeCap && scrapedMax && insertedSome && filteredSome,
        };

        log("done", "Initial scrape finished", result);
        return result;
    }
);
