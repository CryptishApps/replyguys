"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[GlobalError]", error);
    }, [error]);

    return (
        <html lang="en">
            <body className="antialiased dark bg-[#1a1a1a] text-[#fafafa]">
                <div className="min-h-screen flex flex-col">
                    <header className="flex justify-center border-b border-white/10">
                        <div className="container flex h-14 items-center justify-between w-full max-w-5xl px-4">
                            <div className="flex items-center gap-2 font-medium">
                                <span className="text-lg font-bold">ReplyGuys</span>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 flex items-center justify-center">
                        <div className="max-w-md text-center space-y-6 py-20 px-4">
                            <div className="space-y-2">
                                <div className="inline-flex items-center justify-center size-16 rounded-full bg-red-500/10 mb-4">
                                    <span className="text-3xl text-red-500">!</span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Critical error
                                </h1>
                                <p className="text-[#a1a1a1]">
                                    A critical error occurred. Please refresh the page or try again later.
                                </p>
                                {error.digest && (
                                    <p className="text-xs text-[#666] font-mono pt-2">
                                        Error ID: {error.digest}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-center gap-3 pt-4">
                                <button
                                    onClick={reset}
                                    className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    Try again
                                </button>
                                <a
                                    href="/"
                                    className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-[#6366f1] text-white hover:bg-[#5558e3] transition-colors"
                                >
                                    Home
                                </a>
                            </div>
                        </div>
                    </main>

                    <footer className="border-t border-white/10 py-6">
                        <div className="text-center text-sm text-[#666]">
                            Built for X creators
                        </div>
                    </footer>
                </div>
            </body>
        </html>
    );
}
