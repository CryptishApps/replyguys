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
 * goal_relevance acts as a multiplier (0-100%) on the final score
 */
function calculateWeightedScore(
    evaluation: ReplyEvaluation,
    weights: Weights
): number {
    const totalWeight =
        weights.actionability +
        weights.specificity +
        weights.substantiveness +
        weights.constructiveness;

    if (totalWeight === 0) return 0;

    const weightedSum =
        evaluation.actionability * weights.actionability +
        evaluation.specificity * weights.specificity +
        evaluation.substantiveness * weights.substantiveness +
        evaluation.constructiveness * weights.constructiveness;

    const baseScore = weightedSum / totalWeight;

    // goal_relevance acts as a multiplier (0-100%) on the final score
    const relevanceMultiplier = evaluation.goal_relevance / 100;

    return Math.round(baseScore * relevanceMultiplier);
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
    const prompt = `You are evaluating whether a reply helps the user achieve their SPECIFIC GOAL.

USER'S GOAL: "${context.goal}"

CRITICAL RULE: Score this reply ONLY on how well it helps the user achieve the above goal.
- A reply asking a question provides NO actionable information to the goal-owner → score LOW
- A reply about an unrelated topic scores NEAR-ZERO regardless of how articulate it is
- Only replies that DIRECTLY inform the goal should score above 50 on any metric

ORIGINAL POST:
${context.originalTweetText}

${context.persona ? `TARGET AUDIENCE:\n${context.persona}\n\n` : ""}REPLY TO EVALUATE:
Author: @${reply.username} (${reply.followerCount.toLocaleString()} followers)
Text: ${reply.text}

CALIBRATION TECHNIQUE:
Before scoring, imagine 100 diverse replies to this post - from "lol" to detailed multi-paragraph analyses.
Picture this distribution:
- ~10% would be exceptional (85-100): detailed, specific, highly valuable
- ~25% would be good (60-84): solid contributions with useful content  
- ~35% would be medium (35-59): some value but vague or tangential
- ~20% would be weak (15-34): minimal value, mostly noise
- ~10% would be poor (0-14): completely off-topic or empty

Now ask: "Where does THIS reply fall among those imagined 100?"
Pick a PRECISE score within that bracket (it doesn't have to be a multiple of 5 or 10) based on exactly where it sits.

SCORE THESE METRICS (0-100), evaluated through the lens of the user's goal.
For each metric, first identify the bracket, then pick a precise score within it:

1. goal_relevance: How directly does this reply address the user's stated goal?
   [90-100] Directly and fully addresses the goal → pick 90-94 if solid, 95-100 if exceptional
   [70-89] Clearly related, addresses it partially → pick 70-79 if decent, 80-89 if strong
   [40-69] Tangentially related, touches on topic → pick 40-54 if weak connection, 55-69 if clearer
   [15-39] Loosely connected, mostly off-topic → pick 15-24 if barely related, 25-39 if some connection
   [0-14] Completely unrelated or just asks an unrelated question

2. actionability: Does this give the goal-owner specific steps or information they can act on?
   [90-100] Specific, implementable suggestions or clear actionable data
   [70-89] Actionable ideas but needs some interpretation
   [40-69] Some actionable hints, but vague
   [15-39] Minimal actionable content
   [0-14] No actionable info (pure questions, vague agreement)

3. specificity: Does this provide concrete details that directly inform the user's goal?
   [90-100] Numbers, specific examples, named tools/products, timeframes
   [70-89] Good detail but missing some specifics
   [40-69] Some detail, mostly general
   [15-39] Vague with occasional specific word
   [0-14] Completely generic

4. substantiveness: Does this go beyond a surface reaction to provide reasoning?
   [90-100] Multi-sentence reasoning with explanation of why
   [70-89] Provides reasoning but could be deeper
   [40-69] Some explanation beyond surface reaction
   [15-39] Brief reaction with minimal reasoning
   [0-14] One-liner reaction ("cool!", "nice", "I agree")

5. constructiveness: Does this advance the goal-owner's understanding of their objective?
   [90-100] Significantly advances understanding with valuable perspective
   [70-89] Adds useful perspective
   [40-69] Somewhat helpful to understanding
   [15-39] Minor contribution
   [0-14] Off-topic, reactive, or detracts from goal

TAGS: Categorize as one or more of: feature_request, complaint, praise, question, suggestion, personal_experience, data_point, counterpoint, agreement

MINI_SUMMARY: One SHORT sentence capturing the core point (max 300 chars, aim for under 150)

TO_BE_INCLUDED: Set to TRUE only if ALL conditions are met:
1. goal_relevance >= 35 (the reply meaningfully relates to the goal)
2. substantiveness >= 25 (more than a one-liner reaction)
3. The reply provides actual information, opinion, or perspective (not just a question)

---
SCORING EXAMPLES (for goal: "What people think about the change to my products"):

EXCELLENT (85+) - "The AI-generated job posts feel more natural now. Before it took me 30min to write one, now it's under 10. The tone matching is noticeably better with Grok vs GPT-4."
→ goal_relevance: 95, actionability: 72, specificity: 88, substantiveness: 82, constructiveness: 91
→ to_be_included: true (direct feedback with specific comparison and data)

GOOD (60-84) - "I noticed the AI suggestions are faster, but sometimes they miss context. Overall an improvement though."
→ goal_relevance: 78, actionability: 45, specificity: 52, substantiveness: 65, constructiveness: 71
→ to_be_included: true (relevant feedback, some detail, but could be more specific)

MEDIUM (35-59) - "Interesting move to xAI. Curious how it compares cost-wise."
→ goal_relevance: 55, actionability: 22, specificity: 35, substantiveness: 42, constructiveness: 48
→ to_be_included: true (tangentially related, shows interest but no actual opinion on the change)

LOW (15-34) - "What was your preferred model before? 4o?"
→ goal_relevance: 18, actionability: 5, specificity: 28, substantiveness: 12, constructiveness: 15
→ to_be_included: false (asks question, provides no opinion about the change)

VERY LOW (0-14) - "Your CSS is broken on another site"
→ goal_relevance: 8, actionability: 3, specificity: 35, substantiveness: 18, constructiveness: 6
→ to_be_included: false (off-topic bug report, not about the AI change)

Now evaluate the reply above.`;

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
