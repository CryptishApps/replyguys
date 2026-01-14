/**
 * Generate login hero image using Gemini 3 Pro Image Preview
 *
 * Usage: bun run scripts/generate-login-hero.ts
 *
 * Requires GEMINI_API_KEY in .env.local
 */

import { writeFile } from "fs/promises";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    console.error("Add it to your .env.local file");
    process.exit(1);
}

const apiKey: string = GEMINI_API_KEY;

const IMAGE_PROMPT = `Create a playful, cartoony illustration for a login page. PORTRAIT ORIENTATION (9:16 aspect ratio, taller than wide).

## THE SCENE
A whimsical scene showing the concept of "ReplyGuys" - an app that analyzes social media replies:

On the LEFT side: A queue of 5-7 diverse cartoon characters waiting in line. They're "reply guys" - friendly, goofy internet commenters of all types. Some look excited, some bored, some on their phones. They're waiting to enter...

In the CENTER: A fun machine or booth labeled with an "X" symbol (like Twitter/X). It could look like:
- A retro photo booth with an X logo
- A whimsical processing machine with gears and pipes
- A portal or doorway with the X symbol glowing

On the RIGHT side: Coming out of the machine - instead of people, we see DATA: bar charts, pie charts, sparklines, insight cards, and glowing data points floating upward. The transformation from chaotic replies to clean insights.

## CHARACTER STYLE (CRITICAL)
Draw the characters in the "DiceBear Micah" avatar style:
- Simple, minimal illustration style
- Round/oval heads with simple features
- Dot eyes or simple curved lines for eyes
- Simple geometric nose shapes
- Basic mouth expressions (smiles, surprised O shapes)
- Various simple hairstyles
- Clean line art, friendly and approachable
- Think: friendly doodles, not detailed portraits

## COLOR PALETTE (STRICT - MONOTONE)
- Background: Charcoal black or very dark gray
- Characters and elements: White, light gray, medium gray ONLY
- NO colors - purely grayscale/monotone
- High contrast between elements and background
- Maybe subtle white glow effects around the machine

## MOOD
- Playful and fun, not corporate
- Slightly humorous - these are "reply guys" after all
- Clean and modern despite being cartoony
- The kind of illustration that makes you smile

## WHAT TO AVOID
- Photorealism
- Any colors (must be monotone grayscale)
- Overly detailed or complex characters
- Scary or unfriendly vibes
- Cluttered composition

Generate a charming, story-telling illustration that explains what ReplyGuys does at a glance.`;

async function generateImage() {
    console.log("Generating login hero image with Gemini 3 Pro Image Preview...");
    console.log("This may take a moment as the model reasons through the design...\n");

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: IMAGE_PROMPT }],
                    },
                ],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                    thinkingConfig: {
                        thinkingBudget: 4096,
                    },
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        process.exit(1);
    }

    const result = (await response.json()) as {
        candidates: Array<{
            content: {
                parts: Array<{
                    inlineData?: { mimeType: string; data: string };
                    text?: string;
                }>;
            };
        }>;
    };

    // Log any text response (thinking output)
    const textPart = result.candidates?.[0]?.content?.parts?.find((p) => p.text);
    if (textPart?.text) {
        console.log("Model reasoning:\n", textPart.text.substring(0, 500), "...\n");
    }

    // Find the image part
    const imagePart = result.candidates?.[0]?.content?.parts?.find((p) =>
        p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
        console.error("No image generated. Response:", JSON.stringify(result, null, 2));
        process.exit(1);
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    const outputPath = path.join(process.cwd(), "public", "login-hero.jpg");

    // If the image is PNG, we'll still save it (browsers handle it fine even with .jpg extension)
    // For proper conversion, you'd use sharp, but this works for the use case
    await writeFile(outputPath, imageBuffer);

    console.log(`Image saved to: ${outputPath}`);
    console.log(`Size: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB`);
    console.log(`Format: ${imagePart.inlineData.mimeType}`);
}

generateImage().catch((error) => {
    console.error("Failed to generate image:", error);
    process.exit(1);
});
