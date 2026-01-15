import { ViewTransition } from "react";
import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/auth-button";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-1";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { Pricing } from "@/components/landing/pricing";
import { FooterSection } from "@/components/landing/footer-section";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
    description:
        "Transform hundreds of X replies into high-signal reports. ReplyGuys uses AI to find the valuable insights hidden in your audience's responses.",
    path: "/",
});

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 flex justify-center border-b border-border bg-background/80 backdrop-blur-sm px-6 lg:px-0">
                <div className="container flex h-14 items-center justify-between w-full gap-4">
                    <ViewTransition name="logo">
                        <Logo size="lg" />
                    </ViewTransition>

                    <nav className="hidden sm:flex items-center gap-1">
                        <a href="#how-it-works" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            How it Works
                        </a>
                        <a href="#pricing" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            Pricing
                        </a>
                        <a href="/leaderboard" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            Leaderboard
                        </a>
                    </nav>

                    <AuthButton size="sm">
                        Sign in with X
                    </AuthButton>
                </div>
            </header>

            <main className="flex-1 flex-col items-center justify-center">
                <HeroSection />
                <FeaturesGrid />
                <FeaturesSection />
                <Pricing />
            </main>


            <FooterSection />
        </div>
    );
}
