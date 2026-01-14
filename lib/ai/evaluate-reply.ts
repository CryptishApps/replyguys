import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { ReplyEvaluationSchema, type ReplyEvaluation, type Weights } from "./schemas";

const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export interface EvaluationContext {
    originalTweetText: string;
    goal: string;
    persona?: string;
}

export interface ReplyToEvaluate {
    id: string;
    username: string;
    followerCount: number;
    text: string;
}

export interface EvaluationResult extends ReplyEvaluation {
    replyId: string;
    weightedScore: number;
}

/**
 * Calculate weighted score from metrics and weights
 */
function calculateWeightedScore(
    evaluation: ReplyEvaluation,
    weights: Weights
): number {
    const totalWeight =
        weights.actionability +
        weights.specificity +
        weights.originality +
        weights.constructiveness;

    if (totalWeight === 0) return 0;

    const weightedSum =
        evaluation.actionability * weights.actionability +
        evaluation.specificity * weights.specificity +
        evaluation.originality * weights.originality +
        evaluation.constructiveness * weights.constructiveness;

    return Math.round(weightedSum / totalWeight);
}

/**
 * Evaluate a single reply using Gemini 2.0 Flash
 * Returns structured evaluation with scores, tags, and inclusion decision
 */
export async function evaluateReply(
    context: EvaluationContext,
    reply: ReplyToEvaluate,
    weights: Weights
): Promise<EvaluationResult> {
    const prompt = `You are evaluating a reply to a social media post.

ORIGINAL POST:
${context.originalTweetText}

USER'S GOAL:
${context.goal}

${context.persona ? `USER'S TARGET AUDIENCE:\n${context.persona}\n` : ""}
REPLY TO EVALUATE:
Author: @${reply.username} (${reply.followerCount.toLocaleString()} followers)
Text: ${reply.text}

Score this reply on these metrics (0-100):
- actionability: Can someone take concrete action based on this? (100 = specific steps/suggestions, 0 = vague agreement)
- specificity: Does it include details, examples, or data? (100 = concrete examples, 0 = generic statements)
- originality: Is this a unique perspective? (100 = fresh insight, 0 = obvious/repeated point)
- constructiveness: Does it add value to the conversation? (100 = builds on topic helpfully, 0 = off-topic or just reactive)

Also provide:
- tags: categorize as one or more of: feature_request, complaint, praise, question, suggestion, personal_experience, data_point, counterpoint, agreement
- mini_summary: One sentence capturing the core point of this reply
- to_be_included: Should this reply be included in the final analysis? (true if it provides genuine value given the user's goal)

Consider: Constructive criticism with specific suggestions scores HIGH on actionability and constructiveness.
Simple "great idea!" or "I agree" replies should score LOW and have to_be_included=false.
Replies with personal experiences or data points that support/counter the original post are valuable.`;

    const { output: evaluation } = await generateText({
        model: google("gemini-2.0-flash"),
        prompt,
        temperature: 0.3,
        output: Output.object({ schema: ReplyEvaluationSchema }),
    });

    const weightedScore = calculateWeightedScore(evaluation, weights);

    return {
        ...evaluation,
        replyId: reply.id,
        weightedScore,
    };
}

/**
 * Batch evaluate multiple replies (for initial scrape)
 * Returns array of evaluation results
 */
export async function evaluateRepliesBatch(
    context: EvaluationContext,
    replies: ReplyToEvaluate[],
    weights: Weights
): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const reply of replies) {
        try {
            const result = await evaluateReply(context, reply, weights);
            results.push(result);
        } catch (error) {
            console.error(`[evaluate-reply] Failed to evaluate reply ${reply.id}:`, error);
            // Continue with other replies even if one fails
        }
    }

    return results;
}
