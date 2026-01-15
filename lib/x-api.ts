/**
 * X (Twitter) API utilities for posting tweets with media
 */

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

interface XTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

interface RefreshResult {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

/**
 * Refresh X access token using the refresh token
 */
export async function refreshXToken(refreshToken: string): Promise<RefreshResult> {
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidAccessToken(tokens: XTokens): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    wasRefreshed: boolean;
}> {
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minute buffer

    if (tokens.expiresAt.getTime() - bufferMs > now.getTime()) {
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            wasRefreshed: false,
        };
    }

    const refreshed = await refreshXToken(tokens.refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    return {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: newExpiresAt,
        wasRefreshed: true,
    };
}

/**
 * Upload media to X using v1.1 media upload endpoint
 * X API v2 doesn't have media upload, so we use v1.1 with OAuth 2.0 Bearer token
 */
export async function uploadMedia(
    accessToken: string,
    imageBase64: string,
    mimeType: string = "image/png"
): Promise<string> {
    // X media upload requires chunked upload for images > 5MB
    // For most generated images, simple upload works
    const mediaData = imageBase64;

    // Step 1: INIT
    const initResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                command: "INIT",
                total_bytes: String(Buffer.from(mediaData, "base64").length),
                media_type: mimeType,
                media_category: "tweet_image",
            }),
        }
    );

    if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(`Media upload INIT failed: ${initResponse.status} ${errorText}`);
    }

    const initResult = await initResponse.json();
    const mediaId = initResult.media_id_string;

    // Step 2: APPEND (single chunk for most images)
    const appendResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                command: "APPEND",
                media_id: mediaId,
                media_data: mediaData,
                segment_index: "0",
            }),
        }
    );

    if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        throw new Error(`Media upload APPEND failed: ${appendResponse.status} ${errorText}`);
    }

    // Step 3: FINALIZE
    const finalizeResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                command: "FINALIZE",
                media_id: mediaId,
            }),
        }
    );

    if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text();
        throw new Error(`Media upload FINALIZE failed: ${finalizeResponse.status} ${errorText}`);
    }

    return mediaId;
}

interface PostTweetOptions {
    text: string;
    mediaId?: string;
    quoteTweetId?: string;
}

interface TweetResponse {
    data: {
        id: string;
        text: string;
    };
}

/**
 * Post a tweet using X API v2
 */
export async function postTweet(
    accessToken: string,
    options: PostTweetOptions
): Promise<TweetResponse> {
    const body: Record<string, unknown> = {
        text: options.text,
    };

    if (options.mediaId) {
        body.media = {
            media_ids: [options.mediaId],
        };
    }

    if (options.quoteTweetId) {
        body.quote_tweet_id = options.quoteTweetId;
    }

    const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tweet post failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * Extract tweet ID from a tweet URL
 */
export function extractTweetId(url: string): string | null {
    // Handles both twitter.com and x.com URLs
    const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Generate a Web Intent URL for posting a tweet
 * This opens X's tweet composer with pre-filled text - works without API permissions
 */
export function generateTweetIntentUrl(options: {
    text: string;
    url?: string;
    quoteTweetUrl?: string;
}): string {
    const params = new URLSearchParams();
    params.set("text", options.text);
    
    if (options.url) {
        params.set("url", options.url);
    }
    
    // For quote tweets, include the URL in the tweet text
    if (options.quoteTweetUrl) {
        params.set("url", options.quoteTweetUrl);
    }
    
    return `https://x.com/intent/tweet?${params.toString()}`;
}
