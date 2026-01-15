import { z } from "zod";

/**
 * Tags for categorizing reply content
 */
export const ReplyTagSchema = z.enum([
    "feature_request",
    "complaint",
    "praise",
    "question",
    "suggestion",
    "personal_experience",
    "data_point",
    "counterpoint",
    "agreement",
]);

export type ReplyTag = z.infer<typeof ReplyTagSchema>;

/**
 * Schema for individual reply evaluation (Gemini 2.0 Flash)
 */
export const ReplyEvaluationSchema = z.object({
    goal_relevance: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "How directly does this reply address the user's stated goal? 100 = directly answers/informs the goal, 0 = completely off-topic or asks an unrelated question"
        ),
    actionability: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Does this give the goal-owner specific steps or information they can act on toward their goal? 100 = specific actionable info, 0 = no actionable content"
        ),
    specificity: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Does this provide concrete details that directly inform the user's goal? 100 = concrete examples/data, 0 = generic statements"
        ),
    substantiveness: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Does this go beyond a surface reaction to provide reasoning or explanation? 100 = detailed reasoning, 0 = one-liner reaction"
        ),
    constructiveness: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Does this advance the goal-owner's understanding of their objective? 100 = builds understanding helpfully, 0 = off-topic or just reactive"
        ),
    tags: z.array(ReplyTagSchema).describe("Categories that apply to this reply"),
    mini_summary: z
        .string()
        .max(300)
        .describe("One concise sentence capturing the core point of this reply (max 290 chars)"),
    to_be_included: z
        .boolean()
        .describe(
            "Should this reply be included in the final analysis? True only if goal_relevance >= 30 AND provides substantive information"
        ),
});

export type ReplyEvaluation = z.infer<typeof ReplyEvaluationSchema>;

/**
 * Schema for sentiment values
 */
export const SentimentSchema = z.enum(["positive", "negative", "mixed", "neutral"]);

export type Sentiment = z.infer<typeof SentimentSchema>;

/**
 * Schema for priority levels
 */
export const PrioritySchema = z.enum(["high", "medium", "low"]);

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Schema for key themes in summary
 */
export const KeyThemeSchema = z.object({
    theme: z.string().describe("Name/title of the theme"),
    description: z.string().describe("Brief explanation of what this theme covers"),
    reply_ids: z.array(z.string()).describe("IDs of replies that belong to this theme"),
    sentiment: SentimentSchema.describe("Overall sentiment of replies in this theme"),
});

/**
 * Schema for top insights
 */
export const TopInsightSchema = z.object({
    insight: z.string().describe("The key insight or takeaway"),
    reply_id: z.string().describe("ID of the reply this insight comes from"),
    username: z.string().describe("Username of the person who made this insight"),
    why_notable: z.string().describe("Why this insight stands out"),
});

/**
 * Schema for action items
 */
export const ActionItemSchema = z.object({
    action: z.string().describe("The recommended action to take"),
    priority: PrioritySchema.describe("How urgent/important this action is"),
    based_on: z.array(z.string()).describe("Reply IDs that support this action"),
});

/**
 * Schema for sentiment overview
 */
export const SentimentOverviewSchema = z.object({
    overall: SentimentSchema.describe("Overall sentiment across all replies"),
    breakdown: z.object({
        positive: z.number().describe("Percentage of positive replies"),
        negative: z.number().describe("Percentage of negative replies"),
        neutral: z.number().describe("Percentage of neutral replies"),
    }),
    notable_sentiment_shifts: z
        .string()
        .optional()
        .describe("Any notable patterns in sentiment"),
});

/**
 * Schema for hidden gems
 */
export const HiddenGemSchema = z.object({
    reply_id: z.string().describe("ID of the reply"),
    username: z.string().describe("Username of the person"),
    follower_count: z.number().describe("Number of followers"),
    insight: z.string().describe("What makes this reply valuable"),
    is_big_little_guy: z
        .boolean()
        .describe("True if followers < 500 (gets special 'Big Little Guy' badge)"),
});

/**
 * Schema for controversial takes
 */
export const ControversialTakeSchema = z.object({
    reply_id: z.string().describe("ID of the reply"),
    username: z.string().describe("Username of the person"),
    take: z.string().describe("The controversial opinion/perspective"),
    counterpoint_to: z.string().describe("What mainstream view this counters"),
});

/**
 * Schema for report summary (Gemini 3 Pro)
 * All sections except executive_summary are optional - AI includes only relevant ones
 */
export const ReportSummarySchema = z.object({
    executive_summary: z
        .string()
        .describe("2-3 paragraph overview of key findings"),

    key_themes: z
        .array(KeyThemeSchema)
        .optional()
        .describe("Major themes/topics that emerged from replies"),

    top_insights: z
        .array(TopInsightSchema)
        .max(5)
        .optional()
        .describe("Up to 5 standout insights with attribution"),

    action_items: z
        .array(ActionItemSchema)
        .optional()
        .describe("Concrete next steps based on the feedback"),

    sentiment_overview: SentimentOverviewSchema.optional().describe(
        "Overall sentiment analysis"
    ),

    hidden_gems: z
        .array(HiddenGemSchema)
        .optional()
        .describe("Exceptional replies from smaller accounts"),

    controversial_takes: z
        .array(ControversialTakeSchema)
        .optional()
        .describe("Well-argued dissenting opinions"),

    quality_note: z
        .string()
        .optional()
        .describe("Note if reply quality was lower than expected"),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/**
 * Schema for evaluation weights (user-configurable)
 */
export const WeightsSchema = z.object({
    actionability: z.number().min(0).max(100).default(25),
    specificity: z.number().min(0).max(100).default(25),
    substantiveness: z.number().min(0).max(100).default(25),
    constructiveness: z.number().min(0).max(100).default(25),
});

export type Weights = z.infer<typeof WeightsSchema>;

/**
 * Preset configurations for weights
 */
export const WEIGHT_PRESETS = {
    balanced: {
        actionability: 25,
        specificity: 25,
        substantiveness: 25,
        constructiveness: 25,
    },
    research: {
        actionability: 35,
        specificity: 35,
        substantiveness: 15,
        constructiveness: 15,
    },
    ideas: {
        actionability: 15,
        specificity: 15,
        substantiveness: 40,
        constructiveness: 30,
    },
    feedback: {
        actionability: 35,
        specificity: 20,
        substantiveness: 10,
        constructiveness: 35,
    },
} as const;

export type PresetName = keyof typeof WEIGHT_PRESETS;
