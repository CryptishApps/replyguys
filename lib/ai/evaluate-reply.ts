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

ORIGINAL POST:
${context.originalTweetText}

${context.persona ? `TARGET AUDIENCE:\n${context.persona}\n\n` : ""}REPLY TO EVALUATE:
Author: @${reply.username} (${reply.followerCount.toLocaleString()} followers)
Text: ${reply.text}

---

CRITICAL SCORING RULES (apply BEFORE scoring):

1. QUESTIONS provide NO value to the goal-owner. A reply that only asks a question gives no actionable information → ALL metrics should be LOW (under 25).

2. INTEREST SIGNALS WITHOUT SUBSTANCE are worthless. Replies like "In", "Interested", "🙋", "Following" express intent but provide ZERO information → ALL metrics should be VERY LOW (under 15).

3. The reply must contain ACTUAL CONTENT that informs the goal. "I might have someone" or "DM me" requires a follow-up to get value → score LOW.

4. For goals about FINDING PEOPLE (candidates, experts, collaborators, etc.): The replier must DEMONSTRATE their value in the reply itself - credentials, experience, portfolio, specific skills. Just expressing interest is not enough.

---

CALIBRATION: Picture 100 diverse replies. Ask: "Where does THIS one fall?"
- ~10% exceptional (85-100): detailed, specific, highly valuable
- ~25% good (60-84): solid contributions with useful content  
- ~35% medium (35-59): some value but vague or tangential
- ~20% weak (15-34): minimal value, mostly noise
- ~10% poor (0-14): completely off-topic, questions only, or empty

SCORE THESE METRICS (0-100):

1. goal_relevance: Does this reply INFORM the goal with actual content?
   [90-100] Directly addresses the goal with substantial content
   [70-89] Clearly related, provides useful content
   [40-69] Tangentially related, some useful content
   [15-39] Loosely connected, minimal useful content
   [0-14] Off-topic, OR only asks questions, OR only expresses interest without substance

2. actionability: Does this give the goal-owner information they can USE right now?
   [90-100] Specific data, examples, or clear next steps
   [70-89] Useful information with some interpretation needed
   [40-69] Some hints, but vague
   [15-39] Minimal usable content
   [0-14] Nothing usable (questions, "interested", "DM me", etc.)

3. specificity: Does this contain concrete details relevant to the goal?
   [90-100] Numbers, examples, named entities, credentials, portfolio links
   [70-89] Good detail but missing some specifics
   [40-69] Some detail, mostly general statements
   [15-39] Vague with occasional specific word
   [0-14] Completely generic or empty of detail

4. substantiveness: Is there actual reasoning or content beyond a surface reaction?
   [90-100] Multi-sentence explanation with reasoning
   [70-89] Provides reasoning but could be deeper
   [40-69] Some explanation beyond surface reaction
   [15-39] Brief reaction with minimal reasoning
   [0-14] One word/emoji, "In", "Interested", "Nice", "I agree", etc.

5. constructiveness: Does this advance the goal-owner's understanding?
   [90-100] Significantly advances understanding with valuable perspective
   [70-89] Adds useful perspective
   [40-69] Somewhat helpful
   [15-39] Minor contribution
   [0-14] No contribution (off-topic, reactive, or requires follow-up to extract value)

TAGS: feature_request, complaint, praise, question, suggestion, personal_experience, data_point, counterpoint, agreement

MINI_SUMMARY: One SHORT sentence capturing the core point (max 300 chars, aim for under 150)

TO_BE_INCLUDED: TRUE only if ALL conditions are met:
1. goal_relevance >= 35
2. substantiveness >= 25
3. The reply contains actual information/opinion (NOT just a question or interest signal)

---
EXAMPLES for goal "Find interesting candidates":

EXCELLENT - "Built AI-first products, shipped 1M+ LOC across 3 startups. I handle product, distribution, and branding end-to-end. Portfolio: example.com/work"
→ goal_relevance: 92, actionability: 85, specificity: 88, substantiveness: 78, constructiveness: 90
→ to_be_included: true (demonstrates credentials, specific experience, portfolio)

GOOD - "5 years in growth marketing at YC companies. Specialized in B2B SaaS acquisition. Happy to chat."
→ goal_relevance: 75, actionability: 62, specificity: 68, substantiveness: 55, constructiveness: 72
→ to_be_included: true (credentials and specialization, though could be more specific)

LOW - "I have someone, are you still hiring?"
→ goal_relevance: 22, actionability: 8, specificity: 5, substantiveness: 15, constructiveness: 12
→ to_be_included: false (asks question, provides no information about the candidate)

VERY LOW - "In" / "Interested" / "🙋"
→ goal_relevance: 5, actionability: 0, specificity: 0, substantiveness: 3, constructiveness: 2
→ to_be_included: false (zero-content interest signal)

VERY LOW - "What's the role?" / "Remote?"
→ goal_relevance: 12, actionability: 0, specificity: 8, substantiveness: 8, constructiveness: 5
→ to_be_included: false (question only, no information about the person)

---
EXAMPLES for goal "What people think about the product change":

EXCELLENT - "The AI-generated posts feel more natural now. Before it took 30min, now under 10. The tone matching is noticeably better."
→ goal_relevance: 95, actionability: 72, specificity: 88, substantiveness: 82, constructiveness: 91
→ to_be_included: true (direct feedback with specific comparison and data)

GOOD - "Faster, but sometimes misses context. Overall an improvement though."
→ goal_relevance: 78, actionability: 45, specificity: 52, substantiveness: 65, constructiveness: 71
→ to_be_included: true (relevant feedback, some detail)

LOW - "What was the model before?"
→ goal_relevance: 18, actionability: 5, specificity: 28, substantiveness: 12, constructiveness: 15
→ to_be_included: false (question, no opinion about the change)

Now evaluate the reply above.`;

    const { output: evaluation } = await generateText({
        model: google("gemini-3-flash-preview"),
        prompt,
        temperature: 0.3,
        output: Output.object({ schema: ReplyEvaluationSchema }),
    });

    if (!evaluation) {
        throw new Error("AI returned empty evaluation");
    }

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
