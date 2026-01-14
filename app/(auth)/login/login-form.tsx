"use client";

import { ViewTransition } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { IconBrandX, IconAlertCircle } from "@tabler/icons-react";

const ERROR_MESSAGES: Record<string, string> = {
    oauth_error: "X denied the login request. Please try again.",
    invalid_state: "Login session expired. Please try again.",
    token_exchange: "Failed to complete login with X. Please try again.",
    invalid_token: "Invalid response from X. Please try again.",
    user_fetch: "Could not retrieve your X profile. Please try again.",
    signup_failed: "Failed to create your account. Please try again.",
    no_user: "Login failed. Please try again.",
    callback_error: "Something went wrong during login. Please try again.",
};

function getErrorMessage(code: string | null): string | null {
    if (!code) return null;
    return ERROR_MESSAGES[code] ?? "An unexpected error occurred. Please try again.";
}

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const searchParams = useSearchParams();
    const errorCode = searchParams.get("error");
    const errorMessage = getErrorMessage(errorCode);

    const handleLogin = () => {
        window.location.href = "/api/auth/x";
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">Welcome to ReplyGuys</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        Sign in with your X account to get started
                    </p>
                </div>

                {errorMessage && (
                    <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <IconAlertCircle className="size-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Login failed</p>
                            <p className="text-destructive/80">{errorMessage}</p>
                        </div>
                    </div>
                )}

                <ViewTransition name="auth-button">
                    <Button
                        onClick={handleLogin}
                        size="lg"
                        className="w-full mt-4"
                    >
                        <IconBrandX className="size-5" />
                        {errorMessage ? "Try Again" : "Continue with X"}
                    </Button>
                </ViewTransition>
            </FieldGroup>
        </div>
    );
}
