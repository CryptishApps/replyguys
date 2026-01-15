import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LeaderboardContent } from "@/components/leaderboard-content";
import { IconLoader2 } from "@tabler/icons-react";

interface PageProps {
    searchParams: Promise<{ user?: string; tab?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get current user's X username for "Find Me" feature
    let currentUsername: string | null = null;
    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("x_username")
            .eq("id", user.id)
            .single();
        currentUsername = profile?.x_username ?? null;
    }

    const initialTab = (params.tab === "average" || params.tab === "audiences")
        ? params.tab
        : "total";

    return (
        <div className="lg:px-12 md:px-6 px-2 py-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">
                    Top performers across all analyzed posts
                </p>
            </div>

            <Suspense
                fallback={
                    <div className="flex items-center justify-center py-24">
                        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                }
            >
                <LeaderboardContent
                    currentUsername={currentUsername}
                    initialSearch={params.user}
                    initialTab={initialTab}
                />
            </Suspense>
        </div>
    );
}
