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
    goalRelevance: number;
    actionability: number;
    specificity: number;
    substantiveness: number;
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
Scores: goal_relevance=${reply.goalRelevance}, actionability=${reply.actionability}, specificity=${reply.specificity}, substantiveness=${reply.substantiveness}, constructiveness=${reply.constructiveness}
Tags: ${reply.tags.join(", ")}
Summary: ${reply.miniSummary}
Full text: ${reply.text}
---`;
        })
        .join("\n\n");

    const prompt = `You are analyzing replies to a social media post to generate insights that help the user achieve their SPECIFIC GOAL.

USER'S GOAL: "${context.goal}"

CRITICAL: Every insight and recommendation must directly serve the user's goal above. Discard anything that doesn't help the user understand or act on their stated objective.

ORIGINAL POST:
${context.originalTweetText}

${context.persona ? `TARGET AUDIENCE:\n${context.persona}\n\n` : ""}QUALIFIED REPLIES (${qualifiedReplies.length} total, pre-filtered for goal relevance):
${repliesSection}

Generate a comprehensive analysis. Include ONLY sections that are relevant and have meaningful content - do not force sections if the data doesn't support them.

Guidelines:
- executive_summary: Required. 2-3 paragraph overview of key findings that address the user's goal.
- key_themes: Include if there are clear patterns/groupings in the replies relevant to the goal.
- top_insights: Up to 5 standout insights that most directly inform the goal. Include reply_id, username, and why it's notable.
- action_items: Concrete next steps based on feedback. Include priority and reply_ids that support each action.
- sentiment_overview: Include if there's useful sentiment information. Breakdown percentages should sum to 100.
- hidden_gems: Replies from accounts with <5000 followers that provide exceptional value toward the goal. Mark is_big_little_guy=true if follower_count < 500.
- controversial_takes: Well-argued dissenting opinions that counter mainstream views about the goal topic.
- quality_note: Only include if reply quality was notably low or if there were issues with the feedback.

Remember: Only include sections with genuine, meaningful content. Every section should help the user achieve their stated goal.`;

    const { output: summary } = await generateText({
        model: google("gemini-3-pro-preview"),
        prompt,
        temperature: 0.4,
        output: Output.object({ schema: ReportSummarySchema }),
    });

    return summary;
}
