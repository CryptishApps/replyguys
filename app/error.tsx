"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { IconRefresh, IconHome } from "@tabler/icons-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("[Error]", error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex justify-center border-b border-border">
                <div className="container flex h-14 items-center justify-between w-full">
                    <Link href="/">
                        <Logo size="lg" />
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center">
                <div className="container max-w-md text-center space-y-6 py-20">
                    <div className="space-y-2">
                        <div className="inline-flex items-center justify-center size-16 rounded-full bg-destructive/10 mb-4">
                            <span className="text-3xl">!</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Something went wrong
                        </h1>
                        <p className="text-muted-foreground">
                            An unexpected error occurred. Please try again or contact support if the problem persists.
                        </p>
                        {error.digest && (
                            <p className="text-xs text-muted-foreground/60 font-mono pt-2">
                                Error ID: {error.digest}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-center gap-3 pt-4">
                        <Button variant="outline" onClick={reset}>
                            <IconRefresh className="size-4" />
                            Try again
                        </Button>
                        <Button asChild>
                            <Link href="/">
                                <IconHome className="size-4" />
                                Home
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>

            <footer className="border-t border-border py-6">
                <div className="container text-center text-sm text-muted-foreground">
                    Built for X creators
                </div>
            </footer>
        </div>
    );
}
