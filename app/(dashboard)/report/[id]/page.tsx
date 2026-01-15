import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ReportContent } from "./report-content";
import { FriendlyDate } from "./friendly-date";
import {
    IconBolt,
    IconChartBar,
    IconExternalLink,
    IconInfoCircle,
    IconRosetteDiscountCheck,
    IconSparkles,
    IconTelescope,
    IconTrendingUp,
    IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import {
    buildReportHighlights,
    cn,
    formatNumber,
    formatPercent,
} from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimateIn, StaggerContainer, StaggerItem } from "@/components/ui/animate-in";
import type { Reply } from "@/hooks/use-report-realtime";

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
    // Only show replies that have been evaluated and marked as to_be_included
    const [reportResult, repliesResult, activityResult] = await Promise.all([
        supabase
            .from("reports")
            .select(`
                id, x_post_url, conversation_id, status, reply_count, created_at,
                original_tweet_text, original_author_username, original_author_avatar,
                reply_threshold, useful_count, qualified_count, title, summary, summary_status,
                viral_tweet_id, viral_tweet_status
            `)
            .eq("id", id)
            .eq("user_id", user.id)
            .single(),
        supabase
            .from("replies")
            .select("id, username, is_premium, follower_count, text, tweet_created_at, author_avatar, goal_relevance, actionability, specificity, substantiveness, constructiveness, weighted_score, tags, mini_summary, to_be_included")
            .eq("report_id", id)
            .eq("to_be_included", true)
            .order("weighted_score", { ascending: false }),
        supabase
            .from("report_activity")
            .select("id, report_id, created_at, key, message, meta")
            .eq("report_id", id)
            .order("created_at", { ascending: false })
            .limit(25),
    ]);

    if (reportResult.error || !reportResult.data) {
        console.error("[report-page] Failed to load report:", {
            reportId: id,
            userId: user.id,
            error: reportResult.error?.message,
            hasData: !!reportResult.data,
        });
        notFound();
    }

    const report = reportResult.data;
    const replies = (repliesResult.data ?? []) as Reply[];
    const activity = activityResult.data ?? [];

    const {
        isComplete,
        totalReplies,
        qualifiedReplies,
        usefulReplies,
        signalRate,
        usefulRate,
        avgScore,
        scoreStdDev,
        scoreSpread,
        signalScore,
        scoreAverages,
        topTags,
        topContributors,
        hiddenGems,
        signalLabel,
        consistencyLabel,
        medianDisplay,
        signalExplanation,
    } = buildReportHighlights(report, replies);

    return (
        <div className="lg:px-12 md:px-6 px-2 space-y-6 mt-6">
            <AnimateIn className="flex flex-col md:flex-row gap-y-4 items-start justify-between">
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
            </AnimateIn>

            {isComplete && (
                <AnimateIn as="section" delay={0.1} className="space-y-4">
                    <Card className="border-border/60 bg-linear-to-br from-card via-card to-muted/40">
                        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="text-xl">Report Highlights</CardTitle>
                                <CardDescription>
                                    {signalScore > 0
                                        ? `Signal score ${signalScore} - ${signalLabel.toLowerCase()} consensus across qualified replies.`
                                        : "Signal score will appear once enough replies are qualified."}
                                    {signalLabel === "Mixed signal" && (
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {signalExplanation}
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "border-border/60",
                                                signalScore >= 80 && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                                signalScore >= 65 && signalScore < 80 && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                                                signalScore > 0 && signalScore < 65 && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                            )}
                                        >
                                            <IconSparkles className="size-3" />
                                            {signalLabel}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="space-y-1">
                                            <p className="font-medium">Signal score {signalScore || "—"}</p>
                                            <p className="text-muted-foreground">
                                                80+ high, 65–79 solid, 1–64 mixed. Calculated from average reply score and signal rate.
                                            </p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                                {medianDisplay ? (
                                    <Badge variant="secondary">
                                        <IconChartBar className="size-3" />
                                        Median {medianDisplay}
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        <IconChartBar className="size-3" />
                                        Median —
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <StaggerContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <StaggerItem className="rounded-lg border border-border/60 bg-background/70 p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                                        <IconUsers className="size-4" />
                                        <span>Total scraped</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex size-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground">
                                                    <IconInfoCircle className="size-3.5" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Total replies pulled from the thread before filtering.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {formatNumber(totalReplies)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Useful: {formatNumber(usefulReplies)} ({formatPercent(usefulRate)})
                                    </div>
                                </StaggerItem>
                                <StaggerItem className="rounded-lg border border-border/60 bg-background/70 p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                                        <IconBolt className="size-4" />
                                        <span>Qualified signal</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex size-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground">
                                                    <IconInfoCircle className="size-3.5" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Replies that passed filters and met the scoring threshold.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {formatNumber(qualifiedReplies)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Signal rate: {formatPercent(signalRate)}
                                    </div>
                                </StaggerItem>
                                <StaggerItem className="rounded-lg border border-border/60 bg-background/70 p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                                        <IconTrendingUp className="size-4" />
                                        <span>Score spread</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex size-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground">
                                                    <IconInfoCircle className="size-3.5" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                How far apart strong vs weak replies score. Smaller spread = more consistent quality.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {scoreStdDev > 0 ? `±${Math.round(scoreStdDev)}` : "—"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Score gap: {scoreSpread > 0 ? scoreSpread : "—"} · {consistencyLabel}
                                    </div>
                                </StaggerItem>
                                <StaggerItem className="rounded-lg border border-border/60 bg-background/70 p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                                        <IconTelescope className="size-4" />
                                        <span>Quality index</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="inline-flex size-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground">
                                                    <IconInfoCircle className="size-3.5" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Average weighted score for qualified replies (0–100).
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {avgScore > 0 ? Math.round(avgScore) : "—"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Based on {formatNumber(qualifiedReplies)} qualified replies
                                    </div>
                                </StaggerItem>
                            </StaggerContainer>

                            <StaggerContainer className="grid gap-4 lg:grid-cols-3" staggerDelay={0.1}>
                                <StaggerItem>
                                    <Card className="border-border/60 h-full">
                                        <CardHeader>
                                            <CardTitle className="text-base">Signal profile</CardTitle>
                                        <CardDescription>
                                            Average scores across evaluation dimensions.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {[
                                            { label: "Goal relevance", value: scoreAverages.goal_relevance, color: "bg-rose-500" },
                                            { label: "Actionability", value: scoreAverages.actionability, color: "bg-emerald-500" },
                                            { label: "Specificity", value: scoreAverages.specificity, color: "bg-blue-500" },
                                            { label: "Substantive", value: scoreAverages.substantiveness, color: "bg-purple-500" },
                                            { label: "Constructive", value: scoreAverages.constructiveness, color: "bg-amber-500" },
                                        ].map((item) => (
                                            <div key={item.label} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{item.label}</span>
                                                    <span className="font-medium text-foreground">{item.value}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className={cn("h-full", item.color)}
                                                        style={{ width: `${item.value}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                    </Card>
                                </StaggerItem>

                                <StaggerItem>
                                    <Card className="border-border/60 h-full">
                                        <CardHeader>
                                            <CardTitle className="text-base">Top themes</CardTitle>
                                            <CardDescription>
                                                Most common reply tags from qualified answers.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-wrap gap-2">
                                            {topTags.length > 0 ? (
                                                topTags.map(([tag, count]) => (
                                                    <Badge key={tag} variant="outline" className="border-border/60">
                                                        {tag.replace(/_/g, " ")} · {formatNumber(count)}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    No tags available yet.
                                                </span>
                                            )}
                                        </CardContent>
                                    </Card>
                                </StaggerItem>

                                <StaggerItem>
                                    <Card className="border-border/60 h-full">
                                        <CardHeader>
                                            <CardTitle className="text-base">Standout voices</CardTitle>
                                            <CardDescription>
                                                Contributors delivering the highest average signal.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {topContributors.length > 0 ? (
                                                topContributors.map((contributor) => (
                                                    <div
                                                        key={contributor.username}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium truncate">
                                                                    @{contributor.username}
                                                                </span>
                                                                {contributor.is_premium && (
                                                                    <IconRosetteDiscountCheck className="size-4 text-blue-500" />
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatNumber(contributor.follower_count)} followers · {contributor.count} replies
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-semibold">{contributor.avgScore}</div>
                                                            <div className="text-xs text-muted-foreground">avg score</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    No contributors scored yet.
                                                </span>
                                            )}
                                            {hiddenGems.length > 0 && (
                                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                                                    Hidden gems:{" "}
                                                    {hiddenGems.map((reply) => `@${reply.username}`).join(", ")}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </StaggerItem>
                            </StaggerContainer>
                        </CardContent>
                    </Card>
                </AnimateIn>
            )}

            <AnimateIn delay={isComplete ? 0.2 : 0.1}>
                <ReportContent
                    reportId={report.id}
                    initialReport={{
                        id: report.id,
                        status: report.status,
                        created_at: report.created_at,
                        reply_count: report.reply_count,
                        reply_threshold: report.reply_threshold,
                        useful_count: report.useful_count,
                        qualified_count: report.qualified_count ?? 0,
                        original_tweet_text: report.original_tweet_text,
                        original_author_username: report.original_author_username,
                        original_author_avatar: report.original_author_avatar,
                        title: report.title,
                        summary: report.summary,
                        summary_status: report.summary_status ?? "pending",
                        viral_tweet_id: report.viral_tweet_id ?? null,
                        viral_tweet_status: report.viral_tweet_status ?? null,
                    }}
                    initialReplies={replies}
                    initialActivity={activity}
                />
            </AnimateIn>
        </div>
    );
}
