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
                { report_id: reportId, key: "scrape", message: "Checking for replies" },
                log
            );
            log("check", "Fetching report status and settings");

            // Fetch report settings and count qualified replies in parallel
            const [reportResult, countResult] = await Promise.all([
                supabase
                    .from("reports")
                    .select("status, reply_threshold, min_length, blue_only, min_followers, useful_count, oldest_reply_date, newest_reply_date, scrape_phase")
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
                phase: reportResult.data.scrape_phase,
                qualified: `${qualifiedCount}/${reportResult.data.reply_threshold}`,
                oldestReplyDate: reportResult.data.oldest_reply_date,
                newestReplyDate: reportResult.data.newest_reply_date,
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

        // Determine current phase
        const currentPhase = report.scrape_phase ?? "backwards";

        // Step 2: Scrape replies based on current phase
        const scrapeResult = await step.run("scrape-replies", async () => {
            if (currentPhase === "backwards") {
                // Phase 1: Backwards pagination - get older replies
                const parsedDate = report.oldest_reply_date ? new Date(report.oldest_reply_date) : null;
                const untilTime = parsedDate
                    ? Math.floor(parsedDate.getTime() / 1000) - 1
                    : undefined;

                log("scrape", "Phase 1 (backwards): Fetching older replies", {
                    untilTime,
                    oldestReplyDate: report.oldest_reply_date,
                });

                const result = await scrapeConversation(conversationId, {
                    sortOrder: "recency",
                    maxItems: 100,
                    untilTime,
                    blueOnly: report.blue_only,
                    minFollowers: report.min_followers ?? undefined,
                    includeOriginalTweet: false,
                });

                log("scrape", "Backwards scrape completed", { repliesCount: result.replies.length });
                return { ...result, phase: "backwards" as const, exhausted: result.replies.length < 100 };
            } else {
                // Phase 2: Forward pagination - get newer replies
                const parsedDate = report.newest_reply_date ? new Date(report.newest_reply_date) : null;
                const sinceTime = parsedDate
                    ? Math.floor(parsedDate.getTime() / 1000) + 1
                    : undefined;

                log("scrape", "Phase 2 (forward): Checking for new replies", {
                    sinceTime,
                    newestReplyDate: report.newest_reply_date,
                });

                const result = await scrapeConversation(conversationId, {
                    sortOrder: "recency",
                    maxItems: 50,
                    sinceTime,
                    blueOnly: report.blue_only,
                    minFollowers: report.min_followers ?? undefined,
                    includeOriginalTweet: false,
                });

                log("scrape", "Forward scrape completed", { repliesCount: result.replies.length });
                return { ...result, phase: "forward" as const, exhausted: false };
            }
        });

        // Step 3: Filter and insert replies
        const insertResult = await step.run("filter-and-insert-replies", async () => {
            return filterAndInsertReplies(
                supabase,
                reportId,
                scrapeResult.replies,
                report,
                log
            );
        });

        // Determine if we should switch phases
        const shouldSwitchToForward = scrapeResult.phase === "backwards" && scrapeResult.exhausted;
        const newPhase = shouldSwitchToForward ? "forward" : scrapeResult.phase;

        if (shouldSwitchToForward) {
            log("phase", "Backwards pagination exhausted, switching to forward phase");
        }

        // Step 4: Update report progress
        const newUsefulCount = report.useful_count + insertResult.inserted;
        await step.run("update-report-progress", async () => {
            return updateReportProgress(
                supabase,
                reportId,
                {
                    usefulCount: newUsefulCount,
                    oldestReplyDate: insertResult.oldestReplyDate,
                    newestReplyDate: insertResult.newestReplyDate,
                    scrapePhase: newPhase,
                },
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

        // Step 6: Chain another scrape if needed
        // In backwards phase: chain if we got max results
        // In forward phase: don't chain (wait for cron)
        const shouldChain = scrapeResult.phase === "backwards" && 
                            scrapeResult.replies.length >= 100 && 
                            insertResult.inserted > 0;

        if (shouldChain) {
            await step.run("log-chaining", async () => {
                log("queue", "More history available - queuing another scrape");
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
            phase: scrapeResult.phase,
            phaseSwitched: shouldSwitchToForward,
            repliesFound: scrapeResult.replies.length,
            repliesInserted: insertResult.inserted,
            totalUsefulCount: newUsefulCount,
            chainedRecurring: shouldChain,
        };

        log("done", "Recurring scrape finished", result);
        return result;
    }
);
