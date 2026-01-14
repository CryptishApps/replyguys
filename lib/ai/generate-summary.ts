import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { ReportSummarySchema, type ReportSummary, type ReplyTag } from "./schemas";

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export interface SummaryContext {
    originalTweetText: string;
    goal: string;
    persona?: string;
}

export interface QualifiedReply {
    id: string;
    username: string;
    followerCount: number;
    text: string;
    actionability: number;
    specificity: number;
    originality: number;
    constructiveness: number;
    tags: ReplyTag[];
    miniSummary: string;
}

/**
 * Generate a comprehensive summary using Gemini 3 Pro
 * Only includes sections that have meaningful content
 */
export async function generateSummary(
    context: SummaryContext,
    qualifiedReplies: QualifiedReply[]
): Promise<ReportSummary> {
    const repliesSection = qualifiedReplies
        .map((reply) => {
            return `---
ID: ${reply.id}
@${reply.username} (${reply.followerCount.toLocaleString()} followers)
Scores: actionability=${reply.actionability}, specificity=${reply.specificity}, originality=${reply.originality}, constructiveness=${reply.constructiveness}
Tags: ${reply.tags.join(", ")}
Summary: ${reply.miniSummary}
Full text: ${reply.text}
---`;
        })
        .join("\n\n");

    const prompt = `You are analyzing replies to a social media post to generate insights.

ORIGINAL POST:
${context.originalTweetText}

USER'S GOAL:
${context.goal}

${context.persona ? `USER'S TARGET AUDIENCE:\n${context.persona}\n` : ""}
QUALIFIED REPLIES (${qualifiedReplies.length} total):
${repliesSection}

Generate a comprehensive analysis. Include ONLY sections that are relevant and have meaningful content - do not force sections if the data doesn't support them.

Guidelines:
- executive_summary: Required. 2-3 paragraph overview of key findings.
- key_themes: Include if there are clear patterns/groupings in the replies.
- top_insights: Up to 5 standout insights. Include reply_id, username, and why it's notable.
- action_items: Concrete next steps based on feedback. Include priority and reply_ids that support each action.
- sentiment_overview: Include if there's useful sentiment information. Breakdown percentages should sum to 100.
- hidden_gems: Replies from accounts with <5000 followers that provide exceptional value. Mark is_big_little_guy=true if follower_count < 500.
- controversial_takes: Well-argued dissenting opinions that counter mainstream views.
- quality_note: Only include if reply quality was notably low or if there were issues with the feedback.

Remember: Only include sections with genuine, meaningful content. It's better to have fewer high-quality sections than to pad with low-value content.`;

    const { output: summary } = await generateText({
        model: google("gemini-3-pro-preview"),
        prompt,
        temperature: 0.4,
        output: Output.object({ schema: ReportSummarySchema }),
    });

    return summary;
}
