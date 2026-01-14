import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { IconHome } from "@tabler/icons-react";

export default function NotFound() {
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
                        <p className="text-8xl font-bold text-primary">404</p>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Page not found
                        </h1>
                        <p className="text-muted-foreground">
                            The page you&apos;re looking for doesn&apos;t exist or has been moved.
                        </p>
                    </div>

                    <div className="flex justify-center pt-4">
                        <Button asChild>
                            <Link href="/">
                                <IconHome className="size-4" />
                                Back to Home
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
