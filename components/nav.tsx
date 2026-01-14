import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";
import { ReportPicker } from "@/components/report-picker";
import { IconPlus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let profile = null;
    let reports = null;

    if (user) {
        const [profileResult, reportsResult] = await Promise.all([
            supabase
                .from("profiles")
                .select("x_username, avatar_url")
                .eq("id", user.id)
                .single(),
            supabase
                .from("reports")
                .select("id, conversation_id, status, created_at, title")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(10),
        ]);

        profile = profileResult.data;
        reports = reportsResult.data;
    }

    return (
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between w-full gap-2 px-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-border">
            {/* Left: Logo + Report Picker */}
            <div className="flex items-center gap-2">
                <Link href="/dashboard" className="flex items-center">
                    <Logo size="sm" />
                </Link>

                <Separator
                    orientation="vertical"
                    className="hidden md:block mx-2 data-[orientation=vertical]:h-4"
                />

                <div className="hidden md:block">
                    <ReportPicker reports={reports} />
                </div>
            </div>

            {/* Right: New Report + User Menu */}
            <div className="flex items-center gap-2">
                <Button asChild size="sm">
                    <Link href="/new">
                        <IconPlus className="size-4" />
                        New Report
                    </Link>
                </Button>

                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-4"
                />

                {profile && (
                    <UserMenu
                        username={profile.x_username}
                        avatarUrl={profile.avatar_url}
                    />
                )}
            </div>
        </header>
    );
}
