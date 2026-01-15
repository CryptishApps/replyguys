import { inngest } from "@/lib/inngest/client";
import { scrapeConversation } from "@/lib/apify";
import {
    getSupabaseAdmin,
    createLogger,
    filterAndInsertReplies,
    updateReportProgress,
    createEvaluationEvents,
    logReportActivity,
    type ReportSettings,
} from "@/lib/inngest/utils";

const log = createLogger("recurring-scrape");

interface ReportData extends ReportSettings {
    status: string;
}

export const recurringScrapeFunction = inngest.createFunction(
    {
        id: "recurring-scrape",
        retries: 3,
        concurrency: { limit: 5 },
    },
    { event: "report.scrape.recurring" },
    async ({ event, step }) => {
        const { reportId, conversationId } = event.data;
        log("init", "Starting recurring scrape", { reportId, conversationId });

        const supabase = getSupabaseAdmin();
        await logReportActivity(
            supabase,
            { report_id: reportId, key: "scrape", message: "Checking for new replies" },
            log
        );

        // Step 1: Fetch report and check if still active
        const report = await step.run("check-report-status", async () => {
            log("check", "Fetching report status and settings");

            const { data, error } = await supabase
                .from("reports")
                .select(
                    "status, reply_threshold, min_length, blue_only, min_followers, useful_count, last_reply_date"
                )
                .eq("id", reportId)
                .single();

            if (error || !data) {
                log("check", "Failed to fetch report", { error: error?.message });
                throw new Error(`Failed to fetch report: ${error?.message}`);
            }

            log("check", "Report loaded", {
                status: data.status,
                progress: `${data.useful_count}/${data.reply_threshold}`,
                lastReplyDate: data.last_reply_date,
            });

            return data as ReportData;
        });

        // Exit early if report is no longer active
        if (report.status !== "scraping") {
            log("check", `Report is ${report.status}, skipping recurring scrape`);
            return { skipped: true, reason: `Report status is ${report.status}` };
        }

        // Exit early if we've reached the scrape cap (3x threshold)
        const scrapeCap = report.reply_threshold * 3;
        if (report.useful_count >= scrapeCap) {
            log("check", `Reached scrape cap (${report.useful_count}/${scrapeCap}), skipping`);
            return { skipped: true, reason: "Scrape cap reached" };
        }

        // Step 2: Scrape new replies using since: filter
        const scrapeResult = await step.run("scrape-new-replies", async () => {
            log("scrape", "Starting Apify scrape for new replies", {
                sinceDate: report.last_reply_date,
                blueOnly: report.blue_only,
                minFollowers: report.min_followers,
            });

            const result = await scrapeConversation(conversationId, {
                sort: "Latest",
                maxItems: 100,
                sinceDate: report.last_reply_date ?? undefined,
                blueOnly: report.blue_only,
                minFollowers: report.min_followers ?? undefined,
                includeOriginalTweet: false, // Don't need original tweet for recurring scrapes
            });

            log("scrape", "Scrape completed", { repliesCount: result.replies.length });

            return result;
        });

        // Step 3: Filter and insert replies (using shared utility)
        const insertResult = await step.run("filter-and-insert-replies", async () => {
            return filterAndInsertReplies(
                supabase,
                reportId,
                scrapeResult.replies,
                report,
                log
            );
        });

        // Step 4: Update report progress (using shared utility)
        const newUsefulCount = report.useful_count + insertResult.inserted;
        const { reachedScrapeCap } = await step.run("update-report-progress", async () => {
            return updateReportProgress(
                supabase,
                reportId,
                newUsefulCount,
                report.reply_threshold,
                insertResult.lastReplyDate,
                log
            );
        });

        // Step 5: Fan-out evaluation events for new replies
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

            const events = createEvaluationEvents(insertResult.insertedReplies, reportId, report.min_length);
            await step.sendEvent("evaluation-events", events);

            log("evaluate", "Evaluation events sent");
        }

        // Step 6: If we got max replies (100), inserted some, and filtered some out, chain another scrape
        // This continues scraping when there are more replies available
        // Skip if we've reached the scrape cap (3x threshold) or inserted nothing
        const scrapedMax = scrapeResult.replies.length >= 100;
        const insertedSome = insertResult.inserted > 0;
        const filteredSome = insertResult.inserted < scrapeResult.replies.length;

        if (!reachedScrapeCap && scrapedMax && insertedSome && filteredSome) {
            log("queue", "Got max replies and filtered some - queuing another recurring scrape");
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "scrape", message: "Fetching more replies..." },
                log
            );
            await step.sendEvent("chain-recurring-scrape", {
                name: "report.scrape.recurring",
                data: { reportId, conversationId },
            });
        }

        const result = {
            newRepliesFound: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            totalUsefulCount: newUsefulCount,
            reachedScrapeCap,
            chainedRecurring: !reachedScrapeCap && scrapedMax && insertedSome && filteredSome,
        };

        log("done", "Recurring scrape finished", result);
        return result;
    }
);
