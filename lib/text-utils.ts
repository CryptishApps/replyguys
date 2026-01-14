/**
 * Text normalization utilities for meaningful content length calculation.
 * Used primarily for min-length filtering of replies.
 */

/**
 * Remove @mentions from text.
 * X usernames are 1-15 alphanumeric characters or underscores.
 */
export function stripMentions(text: string): string {
    return text.replace(/@[a-zA-Z0-9_]{1,15}/g, "").trim();
}

/**
 * Remove URLs from text.
 * Handles both http and https URLs.
 */
export function stripUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/gi, "").trim();
}

/**
 * Get the "meaningful" length of text after stripping:
 * - @mentions
 * - URLs
 * - Extra whitespace
 *
 * This gives a better estimate of actual content length for filtering.
 *
 * @example
 * getMeaningfulLength("@user https://t.co/abc Check this out!")
 * // Returns 15 (length of "Check this out!")
 */
export function getMeaningfulLength(text: string): number {
    let normalized = stripMentions(text);
    normalized = stripUrls(normalized);
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized.length;
}
