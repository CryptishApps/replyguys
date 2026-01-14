"use client";

import { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    IconBulb,
    IconChecklist,
    IconChartBar,
    IconMessageCircle,
    IconSparkles,
    IconAlertCircle,
    IconStar,
    IconLoader2,
} from "@tabler/icons-react";
import type { ReportSummary as ReportSummaryType } from "@/lib/ai/schemas";

interface ReportSummaryProps {
    summary: ReportSummaryType;
    summaryStatus: "pending" | "generating" | "completed" | "failed";
    qualifiedCount?: number;
    onGenerateSummary?: () => Promise<{ success: boolean; error?: string }>;
}

const priorityColors = {
    high: "bg-red-500/10 text-red-500 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-green-500/10 text-green-500 border-green-500/20",
};

const sentimentColors = {
    positive: "bg-green-500/10 text-green-600 border-green-500/20",
    negative: "bg-red-500/10 text-red-600 border-red-500/20",
    mixed: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    neutral: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export function ReportSummary({ summary, summaryStatus, qualifiedCount = 0, onGenerateSummary }: ReportSummaryProps) {
    const [isPending, startTransition] = useTransition();

    const handleGenerateSummary = () => {
        if (!onGenerateSummary) return;
        startTransition(async () => {
            await onGenerateSummary();
        });
    };

    if (summaryStatus === "pending") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="size-5" />
                        AI Summary
                    </CardTitle>
                    <CardDescription>
                        {qualifiedCount > 0
                            ? `${qualifiedCount} qualified replies ready for analysis`
                            : "Summary will be generated once enough qualified replies are collected"}
                    </CardDescription>
                </CardHeader>
                {qualifiedCount > 0 && onGenerateSummary && (
                    <CardContent>
                        <Button
                            onClick={handleGenerateSummary}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <IconLoader2 className="size-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <IconSparkles className="size-4" />
                                    Generate Summary Now
                                </>
                            )}
                        </Button>
                    </CardContent>
                )}
            </Card>
        );
    }

    if (summaryStatus === "generating") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="size-5 animate-pulse" />
                        Generating Summary...
                    </CardTitle>
                    <CardDescription>
                        Analyzing qualified replies and generating insights
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (summaryStatus === "failed" || !summary) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <IconAlertCircle className="size-5" />
                        Summary Failed
                    </CardTitle>
                    <CardDescription>
                        There was an error generating the summary. Please try again.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Executive Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="size-5 text-primary" />
                        Executive Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        {summary.executive_summary.split("\n\n").map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                    {summary.quality_note && (
                        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
                            <strong>Note:</strong> {summary.quality_note}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Collapsible Sections */}
            <Accordion type="multiple" defaultValue={["insights", "themes"]} className="space-y-2">
                {/* Top Insights */}
                {summary.top_insights && summary.top_insights.length > 0 && (
                    <AccordionItem value="insights" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconBulb className="size-5 text-yellow-500" />
                                Top Insights ({summary.top_insights.length})
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-2">
                                {summary.top_insights.map((insight, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border bg-card"
                                    >
                                        <p className="font-medium">{insight.insight}</p>
                                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>@{insight.username}</span>
                                            <span>-</span>
                                            <span className="text-xs">{insight.why_notable}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Key Themes */}
                {summary.key_themes && summary.key_themes.length > 0 && (
                    <AccordionItem value="themes" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconMessageCircle className="size-5 text-blue-500" />
                                Key Themes ({summary.key_themes.length})
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-2">
                                {summary.key_themes.map((theme, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border bg-card"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className="font-medium">{theme.theme}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {theme.description}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={sentimentColors[theme.sentiment]}
                                            >
                                                {theme.sentiment}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {theme.reply_ids.length} related replies
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Action Items */}
                {summary.action_items && summary.action_items.length > 0 && (
                    <AccordionItem value="actions" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconChecklist className="size-5 text-green-500" />
                                Action Items ({summary.action_items.length})
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-3 pt-2">
                                {summary.action_items.map((action, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                                    >
                                        <Badge
                                            variant="outline"
                                            className={priorityColors[action.priority]}
                                        >
                                            {action.priority}
                                        </Badge>
                                        <div>
                                            <p className="text-sm">{action.action}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Based on {action.based_on.length} replies
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Sentiment Overview */}
                {summary.sentiment_overview && (
                    <AccordionItem value="sentiment" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconChartBar className="size-5 text-purple-500" />
                                Sentiment Overview
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="pt-2 space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Overall:</span>
                                    <Badge
                                        variant="outline"
                                        className={sentimentColors[summary.sentiment_overview.overall]}
                                    >
                                        {summary.sentiment_overview.overall}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm w-20">Positive</span>
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500"
                                                style={{
                                                    width: `${summary.sentiment_overview.breakdown.positive}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right">
                                            {summary.sentiment_overview.breakdown.positive}%
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm w-20">Negative</span>
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-500"
                                                style={{
                                                    width: `${summary.sentiment_overview.breakdown.negative}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right">
                                            {summary.sentiment_overview.breakdown.negative}%
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm w-20">Neutral</span>
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gray-400"
                                                style={{
                                                    width: `${summary.sentiment_overview.breakdown.neutral}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right">
                                            {summary.sentiment_overview.breakdown.neutral}%
                                        </span>
                                    </div>
                                </div>
                                {summary.sentiment_overview.notable_sentiment_shifts && (
                                    <p className="text-sm text-muted-foreground">
                                        {summary.sentiment_overview.notable_sentiment_shifts}
                                    </p>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Hidden Gems */}
                {summary.hidden_gems && summary.hidden_gems.length > 0 && (
                    <AccordionItem value="gems" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconStar className="size-5 text-amber-500" />
                                Hidden Gems ({summary.hidden_gems.length})
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-2">
                                {summary.hidden_gems.map((gem, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border bg-card"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">@{gem.username}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {gem.follower_count.toLocaleString()} followers
                                                    </span>
                                                    {gem.is_big_little_guy && (
                                                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                                            Big Little Guy
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm mt-2">{gem.insight}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Controversial Takes */}
                {summary.controversial_takes && summary.controversial_takes.length > 0 && (
                    <AccordionItem value="controversial" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2">
                                <IconAlertCircle className="size-5 text-orange-500" />
                                Controversial Takes ({summary.controversial_takes.length})
                            </span>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-2">
                                {summary.controversial_takes.map((take, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border bg-card"
                                    >
                                        <p className="font-medium">@{take.username}</p>
                                        <p className="text-sm mt-2">{take.take}</p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Counters: {take.counterpoint_to}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    );
}
