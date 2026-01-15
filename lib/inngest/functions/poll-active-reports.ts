import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";

const log = createLogger("poll-active-reports");

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Cron function that runs every 3 minutes to check for active reports
 * and dispatch recurring scrape events for each one.
 * Also handles 24-hour idle timeout for stale reports.
 */
export const pollActiveReportsFunction = inngest.createFunction(
    {
        id: "poll-active-reports",
        retries: 2,
    },
    { cron: "*/3 * * * *" }, // Every 3 minutes
    async ({ step }) => {
        log("init", "Polling for active reports");

        const supabase = getSupabaseAdmin();

        // Find all reports that are actively scraping or stuck in pending/setting_up
        const activeReports = await step.run("fetch-active-reports", async () => {
            const { data, error } = await supabase
                .from("reports")
                .select("id, conversation_id, created_at, summary_status, status")
                .in("status", ["scraping", "pending", "setting_up"]);

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

        // Check each report for timeout (24 hours from report creation, not reply date)
        for (const report of activeReports) {
            const reportCreatedTime = new Date(report.created_at).getTime();
            const timeSinceCreation = now - reportCreatedTime;

            if (timeSinceCreation > TWENTY_FOUR_HOURS_MS) {
                // Report has been running for 24+ hours - monitoring period complete
                reportsTimedOut.push(report);
            } else {
                reportsToScrape.push(report);
            }
        }

        // Handle timed out reports
        if (reportsTimedOut.length > 0) {
            await step.run("handle-timeouts", async () => {
                for (const report of reportsTimedOut) {
                    // Count actual qualified replies (don't trust the counter)
                    const { count: qualifiedCount } = await supabase
                        .from("replies")
                        .select("id", { count: "exact", head: true })
                        .eq("report_id", report.id)
                        .eq("to_be_included", true);

                    const actualCount = qualifiedCount ?? 0;
                    log("timeout", `Report ${report.id} has ${actualCount} actual qualified replies`);

                    if (actualCount > 0) {
                        // Mark as completed but keep summary_status pending for manual trigger
                        await supabase
                            .from("reports")
                            .update({ status: "completed" })
                            .eq("id", report.id);
                        log("timeout", `Report ${report.id} marked completed - user can generate summary from ${actualCount} replies`);
                    } else {
                        // No qualified replies - mark as fully completed with placeholder summary
                        await supabase
                            .from("reports")
                            .update({
                                status: "completed",
                                summary_status: "completed",
                                summary: {
                                    executive_summary:
                                        "Our post monitor checks for 24 hours. As you haven't received enough quality replies, we have marked the report as complete.",
                                    quality_note: "No qualified replies were collected during the 24-hour monitoring period.",
                                },
                            })
                            .eq("id", report.id);
                        log("timeout", `Marked report ${report.id} as completed with no qualified replies`);
                    }
                }
            });
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
