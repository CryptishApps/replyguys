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

        // Step 1: Fetch report and check if still active
        const checkResult = await step.run("check-report-status", async () => {
            await logReportActivity(
                supabase,
                { report_id: reportId, key: "scrape", message: "Checking for new replies" },
                log
            );
            log("check", "Fetching report status and settings");

            // Fetch report settings and count qualified replies in parallel
            const [reportResult, countResult] = await Promise.all([
                supabase
                    .from("reports")
                    .select("status, reply_threshold, min_length, blue_only, min_followers, useful_count, last_reply_date, last_reply_id")
                    .eq("id", reportId)
                    .single(),
                supabase
                    .from("replies")
                    .select("id", { count: "exact", head: true })
                    .eq("report_id", reportId)
                    .eq("to_be_included", true),
            ]);

            if (reportResult.error || !reportResult.data) {
                log("check", "Failed to fetch report", { error: reportResult.error?.message });
                throw new Error(`Failed to fetch report: ${reportResult.error?.message}`);
            }

            const qualifiedCount = countResult.count ?? 0;

            log("check", "Report loaded", {
                status: reportResult.data.status,
                qualified: `${qualifiedCount}/${reportResult.data.reply_threshold}`,
                lastReplyId: reportResult.data.last_reply_id,
            });

            return { 
                report: reportResult.data as ReportData, 
                qualifiedCount,
            };
        });

        const { report, qualifiedCount } = checkResult;

        // Exit early if report is no longer active
        if (report.status !== "scraping") {
            log("check", `Report is ${report.status}, skipping recurring scrape`);
            return { skipped: true, reason: `Report status is ${report.status}` };
        }

        // Exit early if we've already met the threshold
        if (qualifiedCount >= report.reply_threshold) {
            log("check", `Threshold already met (${qualifiedCount}/${report.reply_threshold}), skipping`);
            return { skipped: true, reason: "Threshold already met" };
        }

        // Step 2: Scrape new replies using since_id for precise pagination
        const scrapeResult = await step.run("scrape-new-replies", async () => {
            log("scrape", "Starting Apify scrape for new replies", {
                sinceId: report.last_reply_id,
                blueOnly: report.blue_only,
                minFollowers: report.min_followers,
            });

            const result = await scrapeConversation(conversationId, {
                sort: "Oldest",
                maxItems: 100,
                sinceId: report.last_reply_id ?? undefined,
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
        await step.run("update-report-progress", async () => {
            return updateReportProgress(
                supabase,
                reportId,
                newUsefulCount,
                insertResult.lastReplyDate,
                insertResult.lastReplyId,
                log
            );
        });

        // Step 5: Fan-out evaluation events for new replies
        if (insertResult.inserted > 0) {
            await step.run("log-and-send-evaluations", async () => {
                log("evaluate", `Sending ${insertResult.insertedReplies.length} evaluation events`);
                await logReportActivity(
                    supabase,
                    {
                        report_id: reportId,
                        key: "evaluate",
                        message: `Found ${insertResult.insertedReplies.length} new ${insertResult.insertedReplies.length === 1 ? "reply" : "replies"}, scoring with AI...`,
                        meta: { count: insertResult.insertedReplies.length },
                    },
                    log
                );
            });

            const events = createEvaluationEvents(insertResult.insertedReplies, reportId, report.min_length);
            await step.sendEvent("evaluation-events", events);

            log("evaluate", "Evaluation events sent");
        } else if (scrapeResult.replies.length > 0) {
            // Found replies but all were duplicates or filtered
            await step.run("log-no-new-replies", async () => {
                await logReportActivity(
                    supabase,
                    {
                        report_id: reportId,
                        key: "scrape",
                        message: "No new replies to evaluate",
                    },
                    log
                );
            });
        }

        // Step 6: If we got max replies (100) and inserted some, chain another scrape
        // This continues scraping when there are more replies available
        const scrapedMax = scrapeResult.replies.length >= 100;
        const insertedSome = insertResult.inserted > 0;
        const shouldChain = scrapedMax && insertedSome;

        if (shouldChain) {
            await step.run("log-chaining", async () => {
                log("queue", "Got max replies - queuing another scrape");
                await logReportActivity(
                    supabase,
                    { report_id: reportId, key: "scrape", message: "Fetching more replies..." },
                    log
                );
            });
            await step.sendEvent("chain-recurring-scrape", {
                name: "report.scrape.recurring",
                data: { reportId, conversationId },
            });
        }

        const result = {
            newRepliesFound: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            totalUsefulCount: newUsefulCount,
            chainedRecurring: shouldChain,
        };

        log("done", "Recurring scrape finished", result);
        return result;
    }
);
