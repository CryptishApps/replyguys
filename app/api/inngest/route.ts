import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { initialScrapeFunction } from "@/lib/inngest/functions/initial-scrape";
import { recurringScrapeFunction } from "@/lib/inngest/functions/recurring-scrape";
import { evaluateReplyFunction } from "@/lib/inngest/functions/evaluate-reply";
import { pollActiveReportsFunction } from "@/lib/inngest/functions/poll-active-reports";
import { generateSummaryFunction } from "@/lib/inngest/functions/generate-summary";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        initialScrapeFunction,
        recurringScrapeFunction,
        evaluateReplyFunction,
        pollActiveReportsFunction,
        generateSummaryFunction,
    ],
});
