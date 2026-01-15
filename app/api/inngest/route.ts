import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { initialScrapeFunction } from "@/lib/inngest/functions/initial-scrape";
import { recurringScrapeFunction } from "@/lib/inngest/functions/recurring-scrape";
import { evaluateReplyFunction } from "@/lib/inngest/functions/evaluate-reply";
import { evaluateReplyBatchFunction } from "@/lib/inngest/functions/evaluate-reply-batch";
import { pollActiveReportsFunction } from "@/lib/inngest/functions/poll-active-reports";
import { generateSummaryFunction } from "@/lib/inngest/functions/generate-summary";

// Vercel Pro: 60s max, needed for batch AI evaluations
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        initialScrapeFunction,
        recurringScrapeFunction,
        evaluateReplyFunction, // Keep for backwards compatibility
        evaluateReplyBatchFunction,
        pollActiveReportsFunction,
        generateSummaryFunction,
    ],
});
