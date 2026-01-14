import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";

const log = createLogger("poll-active-reports");

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Cron function that runs every 5 minutes to check for active reports
 * and dispatch recurring scrape events for each one.
 * Also handles 6-hour idle timeout for stale reports.
 */
export const pollActiveReportsFunction = inngest.createFunction(
    {
        id: "poll-active-reports",
        retries: 2,
    },
    { cron: "*/5 * * * *" }, // Every 5 minutes
    async ({ step }) => {
        log("init", "Polling for active reports");

        const supabase = getSupabaseAdmin();

        // Find all reports that are actively scraping
        const activeReports = await step.run("fetch-active-reports", async () => {
            const { data, error } = await supabase
                .from("reports")
                .select("id, conversation_id, useful_count, reply_threshold, qualified_count, last_reply_date, summary_status")
                .eq("status", "scraping");

            if (error) {
                log("fetch", "Failed to fetch active reports", { error: error.message });
                throw new Error(`Failed to fetch active reports: ${error.message}`);
            }

            log("fetch", `Found ${data?.length ?? 0} active reports`);
            return data ?? [];
        });

        if (activeReports.length === 0) {
            log("done", "No active reports to process");
            return { dispatched: 0, timedOut: 0 };
        }

        const now = Date.now();
        const reportsToScrape: typeof activeReports = [];
        const reportsTimedOut: typeof activeReports = [];

        // Check each report for timeout
        for (const report of activeReports) {
            const lastReplyTime = report.last_reply_date
                ? new Date(report.last_reply_date).getTime()
                : 0;

            const timeSinceLastReply = now - lastReplyTime;

            if (lastReplyTime > 0 && timeSinceLastReply > SIX_HOURS_MS) {
                // Report has been idle for 6+ hours
                if (report.qualified_count > 0 && report.summary_status === "pending") {
                    log("timeout", `Report ${report.id} timed out with ${report.qualified_count} qualified replies`);
                    reportsTimedOut.push(report);
                } else if (report.qualified_count === 0) {
                    log("timeout", `Report ${report.id} timed out with no qualified replies - marking failed`);
                    // Will be handled separately
                    reportsTimedOut.push(report);
                }
            } else {
                reportsToScrape.push(report);
            }
        }

        // Handle timed out reports
        if (reportsTimedOut.length > 0) {
            await step.run("handle-timeouts", async () => {
                const summaryEvents: Array<{ name: "report.generate-summary"; data: { reportId: string } }> = [];

                for (const report of reportsTimedOut) {
                    if (report.qualified_count > 0) {
                        // Trigger summary generation
                        summaryEvents.push({
                            name: "report.generate-summary",
                            data: { reportId: report.id },
                        });
                        log("timeout", `Queued summary generation for timed out report ${report.id}`);
                    } else {
                        // Mark as failed - no qualified replies
                        await supabase
                            .from("reports")
                            .update({
                                status: "completed",
                                summary_status: "completed",
                                summary: {
                                    executive_summary:
                                        "This report timed out without receiving enough quality replies. " +
                                        "The post may have had limited engagement or replies that didn't meet the quality threshold.",
                                    quality_note: "Report timed out after 6 hours of inactivity with no qualified replies.",
                                },
                            })
                            .eq("id", report.id);
                        log("timeout", `Marked report ${report.id} as completed with no qualified replies`);
                    }
                }

                if (summaryEvents.length > 0) {
                    return summaryEvents;
                }
                return [];
            });

            // Send summary events if any
            const summaryEventsToSend = reportsTimedOut
                .filter((r) => r.qualified_count > 0)
                .map((report) => ({
                    name: "report.generate-summary" as const,
                    data: { reportId: report.id },
                }));

            if (summaryEventsToSend.length > 0) {
                await step.sendEvent("timeout-summary-events", summaryEventsToSend);
            }
        }

        // Dispatch recurring scrape events for active reports
        if (reportsToScrape.length > 0) {
            log("dispatch", `Dispatching ${reportsToScrape.length} scrape events`);

            await step.sendEvent(
                "recurring-scrape-events",
                reportsToScrape.map((report) => ({
                    name: "report.scrape.recurring" as const,
                    data: {
                        reportId: report.id,
                        conversationId: report.conversation_id,
                    },
                }))
            );
        }

        log("done", "Poll complete", {
            dispatched: reportsToScrape.length,
            timedOut: reportsTimedOut.length,
        });

        return {
            dispatched: reportsToScrape.length,
            timedOut: reportsTimedOut.length,
        };
    }
);
