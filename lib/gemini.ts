/**
 * Gemini Flash utilities for quick AI tasks
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiResponse {
    candidates?: Array<{
        content: {
            parts: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message: string;
    };
}

/**
 * Generate a short 3-5 word title for a tweet/post
 */
export async function generateReportTitle(tweetText: string): Promise<string | null> {
    if (!GEMINI_API_KEY) {
        console.warn("[gemini] No GEMINI_API_KEY set, skipping title generation");
        return null;
    }

    const prompt = `Generate a short, catchy title (3-5 words max) that summarizes this tweet.
The title should be descriptive and help identify the topic at a glance.
Do NOT use quotes or punctuation. Just return the title, nothing else.

Tweet: "${tweetText.slice(0, 500)}"`;

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        maxOutputTokens: 20,
                        temperature: 0.7,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error("[gemini] API error:", response.status);
            return null;
        }

        const result: GeminiResponse = await response.json();

        if (result.error) {
            console.error("[gemini] Error:", result.error.message);
            return null;
        }

        const title = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!title) {
            console.warn("[gemini] No title generated");
            return null;
        }

        // Clean up the title - remove quotes if present
        const cleanTitle = title.replace(/^["']|["']$/g, "").trim();

        console.log("[gemini] Generated title:", cleanTitle);
        return cleanTitle;
    } catch (error) {
        console.error("[gemini] Failed to generate title:", error);
        return null;
    }
}
