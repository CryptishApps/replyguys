import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReportCard } from "@/components/report-card";

type ReportStatus = "setting_up" | "pending" | "scraping" | "completed" | "failed";

interface Report {
    id: string;
    x_post_url: string;
    conversation_id: string;
    status: ReportStatus;
    reply_count: number;
    created_at: string;
    original_author_username: string | null;
    original_author_avatar: string | null;
    original_tweet_text: string | null;
    reply_threshold: number;
    useful_count: number;
}

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data } = await supabase
        .from("reports")
        .select(`
            id, x_post_url, conversation_id, status, reply_count, created_at,
            original_author_username, original_author_avatar, original_tweet_text,
            reply_threshold, useful_count
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const reports = data as Report[] | null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Your Reports</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Analyze replies to your X posts
                </p>
            </div>

            {reports && reports.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {reports.map((report) => (
                        <ReportCard
                            key={report.id}
                            id={report.id}
                            xPostUrl={report.x_post_url}
                            conversationId={report.conversation_id}
                            status={report.status}
                            replyCount={report.reply_count}
                            createdAt={report.created_at}
                            originalAuthorUsername={report.original_author_username}
                            originalAuthorAvatar={report.original_author_avatar}
                            originalTweetText={report.original_tweet_text}
                            replyThreshold={report.reply_threshold}
                            usefulCount={report.useful_count}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg bg-card/50">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <span className="text-2xl text-muted-foreground">X</span>
                    </div>
                    <h2 className="text-lg font-semibold mb-2">No reports yet</h2>
                    <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                        Create your first report by pasting an X post URL to analyze its replies
                    </p>
                    <Button asChild>
                        <Link href="/new">
                            Create Report
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
