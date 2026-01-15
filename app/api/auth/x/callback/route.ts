import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`;

interface XTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

interface XUserResponse {
    data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
    };
}


export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const cookieStore = await cookies();
    const storedState = cookieStore.get("x_oauth_state")?.value;
    const codeVerifier = cookieStore.get("x_code_verifier")?.value;

    // Clear OAuth cookies
    cookieStore.delete("x_oauth_state");
    cookieStore.delete("x_code_verifier");

    if (error) {
        console.error("X OAuth error:", error);
        return NextResponse.redirect(
            new URL("/login?error=oauth_error", request.url)
        );
    }

    if (!code || !state || state !== storedState || !codeVerifier) {
        return NextResponse.redirect(
            new URL("/login?error=invalid_state", request.url)
        );
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`)}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Token exchange failed:", errorText);
            return NextResponse.redirect(
                new URL("/login?error=token_exchange", request.url)
            );
        }

        const tokens: XTokenResponse = await tokenResponse.json();
        console.log("[auth] Token exchange successful");

        const adminClient = createAdminClient();
        const supabase = await createClient();

        // Fetch user info from X API (tokens are opaque, not JWTs)
        const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error("[auth] Failed to fetch X user:", userResponse.status, errorText);
            return NextResponse.redirect(
                new URL("/login?error=user_fetch", request.url)
            );
        }

        const xUser: XUserResponse = await userResponse.json();
        console.log("[auth] Fetched user from X API:", xUser.data.username);
        const xUserData = xUser.data;

        // Use X user ID as the unique identifier for Supabase auth
        const email = `${xUserData.id}@x.replyguys.app`;
        const password = `${xUserData.id}_${process.env.X_CLIENT_SECRET}`;

        // Try to sign in first
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        let userId: string;

        if (signInError) {
            // Sign in failed, create new user
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        x_username: xUserData.username,
                        x_id: xUserData.id,
                        avatar_url: xUserData.profile_image_url,
                    },
                },
            });

            if (signUpError || !signUpData.user) {
                console.error("Sign up failed:", signUpError);
                return NextResponse.redirect(
                    new URL("/login?error=signup_failed", request.url)
                );
            }

            userId = signUpData.user.id;
        } else {
            if (!signInData.user) {
                return NextResponse.redirect(
                    new URL("/login?error=no_user", request.url)
                );
            }
            userId = signInData.user.id;
        }

        // Upsert profile with fresh X tokens
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        const { error: profileError } = await adminClient
            .from("profiles")
            .upsert({
                id: userId,
                x_username: xUserData.username,
                x_id: xUserData.id,
                avatar_url: xUserData.profile_image_url?.replace("_normal", "_bigger"),
                x_access_token: tokens.access_token,
                x_refresh_token: tokens.refresh_token,
                x_token_expires_at: expiresAt.toISOString(),
            });

        if (profileError) {
            console.error("Profile upsert failed:", profileError);
        }

        return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (err) {
        console.error("OAuth callback error:", err);
        return NextResponse.redirect(
            new URL("/login?error=callback_error", request.url)
        );
    }
}
