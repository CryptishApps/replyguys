import { inngest } from "@/lib/inngest/client";
import { scrapeConversation } from "@/lib/apify";
import {
    getSupabaseAdmin,
    createLogger,
    filterAndInsertReplies,
    updateReportProgress,
    createEvaluationEvents,
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
        concurrency: { limit: 10 },
    },
    { event: "report.scrape.recurring" },
    async ({ event, step }) => {
        const { reportId, conversationId } = event.data;
        log("init", "Starting recurring scrape", { reportId, conversationId });

        const supabase = getSupabaseAdmin();

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

        // Exit early if threshold already met
        if (report.useful_count >= report.reply_threshold) {
            log("check", "Threshold already met, marking completed");
            await step.run("mark-completed", async () => {
                const { error } = await supabase
                    .from("reports")
                    .update({ status: "completed" })
                    .eq("id", reportId);

                if (error) {
                    log("check", "Failed to mark as completed", { error: error.message });
                    throw new Error(`Failed to mark report as completed: ${error.message}`);
                }
            });
            return { skipped: true, reason: "Threshold already met" };
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
        const { thresholdMet } = await step.run("update-report-progress", async () => {
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
            const repliesToEvaluate = scrapeResult.replies.slice(0, insertResult.inserted);
            log("evaluate", `Sending ${repliesToEvaluate.length} evaluation events`);

            const events = createEvaluationEvents(repliesToEvaluate, reportId, report.min_length);
            await step.sendEvent("evaluation-events", events);

            log("evaluate", "Evaluation events sent");
        }

        // Note: No more sleep/scheduling - the poll-active-reports cron handles this

        const result = {
            newRepliesFound: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            totalUsefulCount: newUsefulCount,
            thresholdMet,
        };

        log("done", "Recurring scrape finished", result);
        return result;
    }
);
