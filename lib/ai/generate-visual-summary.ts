/**
 * Generate visual summary images using Gemini's image generation
 */

import { promises as fs } from "fs";
import path from "path";
import type { ReportSummary } from "./schemas";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const STYLE_EXAMPLES_DIR = path.join(process.cwd(), "assets/images/viral-examples");

interface VisualSummaryInput {
    reportTitle: string;
    originalTweetText: string;
    originalAuthor: string;
    executiveSummary: string;
    topInsights: Array<{ username: string; insight: string }>;
    hiddenGems: Array<{ username: string; insight: string }>;
    mentionedUsers: string[];
    stats: {
        totalReplies: number;
        qualifiedReplies: number;
    };
}

interface GeminiImageResponse {
    candidates?: Array<{
        content: {
            parts: Array<{
                text?: string;
                inline_data?: {
                    mime_type: string;
                    data: string;
                };
            }>;
        };
    }>;
    error?: {
        message: string;
        code: number;
    };
}

/**
 * Load style reference images from the viral-examples directory
 */
async function loadStyleExamples(): Promise<
    Array<{ mime_type: string; data: string }>
> {
    try {
        const files = await fs.readdir(STYLE_EXAMPLES_DIR);
        const imageFiles = files.filter((f) =>
            /\.(png|jpg|jpeg|webp)$/i.test(f)
        );

        const examples: Array<{ mime_type: string; data: string }> = [];

        for (const file of imageFiles.slice(0, 3)) {
            const filePath = path.join(STYLE_EXAMPLES_DIR, file);
            const buffer = await fs.readFile(filePath);
            const ext = path.extname(file).toLowerCase();
            const mimeType =
                ext === ".png"
                    ? "image/png"
                    : ext === ".webp"
                      ? "image/webp"
                      : "image/jpeg";

            examples.push({
                mime_type: mimeType,
                data: buffer.toString("base64"),
            });
        }

        return examples;
    } catch {
        // Directory doesn't exist or no images - proceed without style examples
        console.log("[visual-summary] No style examples found, generating without references");
        return [];
    }
}

/**
 * Build the design prompt for the visual summary
 */
function buildDesignPrompt(input: VisualSummaryInput): string {
    const mentionsText =
        input.mentionedUsers.length > 0
            ? `Highlighted contributors: ${input.mentionedUsers.map((u) => `@${u}`).join(", ")}`
            : "";

    return `Create a visually striking social media summary card image (1200x675 pixels, optimized for X/Twitter).

BRAND: ReplyGuys - "Assessed by @replyguysapp"
The branding should be subtle but present - small logo or text in a corner.

CONTENT TO DISPLAY:
Title: "${input.reportTitle}"
Original post by @${input.originalAuthor}

KEY FINDINGS:
${input.executiveSummary.slice(0, 300)}${input.executiveSummary.length > 300 ? "..." : ""}

${mentionsText}

STATS:
- ${input.stats.totalReplies} total replies analyzed
- ${input.stats.qualifiedReplies} qualified insights extracted

DESIGN REQUIREMENTS:
1. Modern, premium aesthetic - NOT generic "AI slop"
2. Dark theme preferred with accent colors (not purple gradients)
3. Clean typography with hierarchy - use a distinctive font pairing
4. Include visual elements like subtle patterns, geometric shapes, or gradients
5. The image should feel like it was designed by a professional, not generated
6. Include the ReplyGuys branding subtly
7. Make key stats and findings scannable at a glance
8. Professional data visualization aesthetic

The goal is to create something that people will want to share because it looks premium and informative.`;
}

/**
 * Generate a visual summary image using Gemini
 */
export async function generateVisualSummary(
    summary: ReportSummary,
    context: {
        reportTitle: string;
        originalTweetText: string;
        originalAuthor: string;
        totalReplies: number;
        qualifiedReplies: number;
    },
    mentionedUsers: string[]
): Promise<{ imageBase64: string; mimeType: string } | null> {
    if (!GEMINI_API_KEY) {
        console.error("[visual-summary] No GEMINI_API_KEY set");
        return null;
    }

    // Prepare input for the design
    const input: VisualSummaryInput = {
        reportTitle: context.reportTitle,
        originalTweetText: context.originalTweetText,
        originalAuthor: context.originalAuthor,
        executiveSummary: summary.executive_summary,
        topInsights:
            summary.top_insights?.slice(0, 3).map((i) => ({
                username: i.username,
                insight: i.insight,
            })) ?? [],
        hiddenGems:
            summary.hidden_gems?.slice(0, 2).map((g) => ({
                username: g.username,
                insight: g.insight,
            })) ?? [],
        mentionedUsers,
        stats: {
            totalReplies: context.totalReplies,
            qualifiedReplies: context.qualifiedReplies,
        },
    };

    // Build multi-part request with style examples
    const parts: Array<{
        text?: string;
        inline_data?: { mime_type: string; data: string };
    }> = [{ text: buildDesignPrompt(input) }];

    // Load and add style reference images
    const styleExamples = await loadStyleExamples();

    if (styleExamples.length > 0) {
        parts.push({
            text: "Here are STYLE REFERENCE images. Match this aesthetic quality and visual approach:",
        });

        for (const example of styleExamples) {
            parts.push({
                inline_data: {
                    mime_type: example.mime_type,
                    data: example.data,
                },
            });
        }

        parts.push({
            text: "Create a visual summary that matches or exceeds this level of design quality. The content should be as specified above.",
        });
    }

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        thinkingConfig: { thinkingBudget: 4096 },
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                "[visual-summary] API error:",
                response.status,
                errorText
            );
            return null;
        }

        const result: GeminiImageResponse = await response.json();

        if (result.error) {
            console.error("[visual-summary] Gemini error:", result.error.message);
            return null;
        }

        // Extract the generated image from the response
        const imagePart = result.candidates?.[0]?.content?.parts?.find(
            (p) => p.inline_data
        );

        if (!imagePart?.inline_data) {
            console.error("[visual-summary] No image in response");
            return null;
        }

        console.log("[visual-summary] Generated image successfully");

        return {
            imageBase64: imagePart.inline_data.data,
            mimeType: imagePart.inline_data.mime_type,
        };
    } catch (error) {
        console.error("[visual-summary] Failed to generate image:", error);
        return null;
    }
}
