import { ViewTransition } from "react";
import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/auth-button";

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex justify-center border-b border-border">
                <div className="container flex h-14 items-center justify-between w-full">
                    <ViewTransition name="logo">
                        <Logo size="lg" />
                    </ViewTransition>
                    <AuthButton size="sm">
                        Sign in with X
                    </AuthButton>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center">
                <div className="container max-w-2xl text-center space-y-6 py-20">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                        Turn X replies into insights
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        ReplyGuys scrapes and analyzes replies to your X posts,
                        surfacing the most valuable responses and generating
                        data-driven reports.
                    </p>
                    <div className="flex justify-center gap-4">
                        <AuthButton size="lg">
                            Get Started
                        </AuthButton>
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
