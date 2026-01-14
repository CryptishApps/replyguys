import { Suspense } from "react";
import { ViewTransition } from "react";
import { LoginForm } from "./login-form";
import { LoginPanel } from "./login-panel";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LoginPage() {
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex justify-center gap-2 md:justify-start">
                    <Link href="/" className="flex items-center gap-2 font-medium">
                        <ViewTransition name="logo">
                            <Logo size="lg" />
                        </ViewTransition>
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <Suspense fallback={<LoginFormSkeleton />}>
                            <LoginForm />
                        </Suspense>
                    </div>
                </div>
            </div>
            <LoginPanel />
        </div>
    );
}

function LoginFormSkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-48 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
            </div>
            <div className="h-11 w-full bg-muted rounded-md mt-4" />
        </div>
    );
}
