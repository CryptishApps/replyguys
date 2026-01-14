import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ReportContent } from "./report-content";
import { FriendlyDate } from "./friendly-date";
import { IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Fetch report and replies in parallel
    const [reportResult, repliesResult] = await Promise.all([
        supabase
            .from("reports")
            .select(`
                id, x_post_url, conversation_id, status, reply_count, created_at,
                original_tweet_text, original_author_username, original_author_avatar,
                reply_threshold, useful_count, title
            `)
            .eq("id", id)
            .eq("user_id", user.id)
            .single(),
        supabase
            .from("replies")
            .select("id, username, is_premium, follower_count, text, tweet_created_at, author_avatar, is_useful")
            .eq("report_id", id)
            .order("tweet_created_at", { ascending: false }),
    ]);

    if (reportResult.error || !reportResult.data) {
        notFound();
    }

    const report = reportResult.data;
    const replies = repliesResult.data ?? [];

    return (
        <div className="lg:px-12 md:px-6 px-2 space-y-6 mt-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">
                        {report.title || "Report"}
                    </h1>
                    <p className="text-muted-foreground">
                        <FriendlyDate date={report.created_at} />
                    </p>
                </div>
                <Link
                    href={report.x_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }))}
                >
                    View on X
                    <IconExternalLink className="size-4" />
                </Link>
            </div>

            <ReportContent
                reportId={report.id}
                initialReport={{
                    id: report.id,
                    status: report.status,
                    reply_count: report.reply_count,
                    reply_threshold: report.reply_threshold,
                    useful_count: report.useful_count,
                    original_tweet_text: report.original_tweet_text,
                    original_author_username: report.original_author_username,
                    original_author_avatar: report.original_author_avatar,
                    title: report.title,
                }}
                initialReplies={replies}
            />
        </div>
    );
}
