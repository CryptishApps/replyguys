import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin, createLogger } from "@/lib/inngest/utils";

const log = createLogger("poll-active-reports");

/**
 * Cron function that runs every 5 minutes to check for active reports
 * and dispatch recurring scrape events for each one.
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
                .select("id, conversation_id, useful_count, reply_threshold")
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
            return { dispatched: 0 };
        }

        // Dispatch recurring scrape events for each active report
        log("dispatch", `Dispatching ${activeReports.length} scrape events`);

        await step.sendEvent(
            "recurring-scrape-events",
            activeReports.map((report) => ({
                name: "report.scrape.recurring" as const,
                data: {
                    reportId: report.id,
                    conversationId: report.conversation_id,
                },
            }))
        );

        log("done", "Poll complete", { dispatched: activeReports.length });
        return { dispatched: activeReports.length };
    }
);
