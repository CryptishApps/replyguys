"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useReportRealtime, ReportData, Reply } from "@/hooks/use-report-realtime";
import { usePrevious } from "@/hooks/use-previous";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ReplyCard } from "@/components/reply-card";
import { ReportStats } from "@/components/report-stats";
import { ReportSummary } from "@/components/report-summary";
import { ReportActivityFeed } from "@/components/report-activity-feed";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconLoader2 } from "@tabler/icons-react";
import type { ReportSummary as ReportSummaryType } from "@/lib/ai/schemas";
import { generateSummary } from "./actions";

interface ReportContentProps {
    reportId: string;
    initialReport: ReportData;
    initialReplies: Reply[];
    initialActivity: Array<{
        id: number;
        report_id: string;
        created_at: string;
        key: string;
        message: string;
        meta: unknown | null;
    }>;
}

const statusConfig = {
    setting_up: { label: "Setting up...", variant: "secondary" as const },
    pending: { label: "Pending", variant: "secondary" as const },
    scraping: { label: "Monitoring replies...", variant: "default" as const },
    completed: { label: "Completed", variant: "default" as const },
    failed: { label: "Failed", variant: "destructive" as const },
};

/**
 * Derives the display status based on report and summary state.
 * - If scraping but threshold not met: "Monitoring replies..."
 * - If threshold met but evaluating: "Evaluating..."
 * - If evaluating but generating summary: "Generating summary..."
 * - If fully done: "Completed"
 */
function getDisplayStatus(report: ReportData): { label: string; variant: "secondary" | "default" | "destructive"; isLoading: boolean } {
    // Failed state
    if (report.status === "failed") {
        return { label: "Failed", variant: "destructive", isLoading: false };
    }

    // Setting up or pending
    if (report.status === "setting_up" || report.status === "pending") {
        return { label: statusConfig[report.status].label, variant: "secondary", isLoading: true };
    }

    // Scraping and threshold not met yet
    if (report.status === "scraping" && report.useful_count < report.reply_threshold) {
        return { label: "Monitoring replies...", variant: "default", isLoading: true };
    }

    // Threshold met, but summary not started/in progress
    if (report.summary_status === "pending" || report.summary_status === "generating") {
        if (report.summary_status === "generating") {
            return { label: "Generating summary...", variant: "default", isLoading: true };
        }
        // Evaluating replies (threshold met, summary pending)
        return { label: "Monitoring replies...", variant: "default", isLoading: true };
    }

    // Summary failed
    if (report.summary_status === "failed") {
        return { label: "Summary failed", variant: "destructive", isLoading: false };
    }

    // Fully completed
    return { label: "Completed", variant: "default", isLoading: false };
}

function OriginalPostSkeleton() {
    return (
        <div className="animate-pulse space-y-3 min-h-[100px]">
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="space-y-2">
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
        </div>
    );
}

function RepliesSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-2 animate-pulse">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="size-5 rounded-full bg-muted" />
                            <div className="h-4 w-24 bg-muted rounded" />
                        </div>
                        <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ReportContent({
    reportId,
    initialReport,
    initialReplies,
    initialActivity,
}: ReportContentProps) {
    const router = useRouter();

    const { report, replies, activity, isConnected, refresh } = useReportRealtime({
        reportId,
        initialReport,
        initialReplies,
        initialActivity,
    });

    const {
        visibleItems: visibleReplies,
        totalCount: totalReplies,
        hasMore,
        isLoading: isLoadingMore,
        sentinelRef,
    } = useInfiniteScroll({
        items: replies,
        pageSize: 20,
    });

    const handleGenerateSummary = useCallback(async () => {
        const result = await generateSummary(reportId);
        if (result.success) {
            // Refresh to get the updated summary_status
            refresh();
        }
        return result;
    }, [reportId, refresh]);

    const displayStatus = getDisplayStatus(report);
    const isLoading = displayStatus.isLoading;
    const isComplete =
        (report.status === "completed" || report.status === "failed") &&
        (report.summary_status === "completed" || report.summary_status === "failed");

    const wasComplete = usePrevious(isComplete);

    // Refresh the page when report just completed to show Report Highlights
    useEffect(() => {
        if (isComplete && wasComplete === false) {
            router.refresh();
        }
    }, [isComplete, wasComplete, router]);

    return (
        <div className="space-y-6">
            {/* Original Post Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>{report.title || "Original Post"}</CardTitle>
                    <Badge variant={displayStatus.variant} className="flex items-center gap-1">
                        {isLoading && (
                            <IconLoader2 className="size-3 animate-spin" />
                        )}
                        {displayStatus.label}
                    </Badge>
                </CardHeader>
                <CardContent>
                    <AnimatePresence mode="wait">
                        {report.original_tweet_text ? (
                            <motion.div
                                key="content"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-3 min-h-[100px]"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-10">
                                        <AvatarImage src={report.original_author_avatar ?? undefined} />
                                        <AvatarFallback>
                                            {report.original_author_username?.[0]?.toUpperCase() ?? "X"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">
                                        @{report.original_author_username}
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed">{report.original_tweet_text}</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="skeleton"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <OriginalPostSkeleton />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>

            {/* Activity Feed (while report is running) */}
            <ReportActivityFeed
                activity={activity}
                isConnected={isConnected}
                isComplete={isComplete}
                replyThreshold={report.reply_threshold}
            />

            {/* Stats Section */}
            <ReportStats
                totalReplies={report.reply_count}
                usefulReplies={report.useful_count}
                qualifiedReplies={replies.length}
                threshold={report.reply_threshold}
                status={report.status}
            />

            {/* AI Summary Section */}
            {(report.summary_status !== "pending" || report.status === "completed" || replies.length > 0) && (
                <ReportSummary
                    summary={report.summary as ReportSummaryType}
                    summaryStatus={report.summary_status}
                    qualifiedCount={replies.length}
                    isMonitoringComplete={report.status === "completed"}
                    onGenerateSummary={handleGenerateSummary}
                />
            )}

            {/* Replies Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Qualified Replies</CardTitle>
                    <CardDescription>
                        {isLoading
                            ? "Live feed of qualified replies"
                            : totalReplies === 0
                                ? "No qualified replies yet"
                                : `Showing ${visibleReplies.length} of ${totalReplies} qualified replies`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AnimatePresence mode="wait">
                        {report.status === "setting_up" ? (
                            <motion.div
                                key="skeleton"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <RepliesSkeleton />
                            </motion.div>
                        ) : totalReplies === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-center py-12 text-muted-foreground"
                            >
                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <IconLoader2 className="size-8 animate-spin" />
                                        <p>Evaluating replies...</p>
                                    </div>
                                ) : (
                                    <p>No qualified replies found</p>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="replies"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-3"
                            >
                                {visibleReplies.map((reply, index) => (
                                    <motion.div
                                        key={reply.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(index, 5) * 0.02, duration: 0.2 }}
                                    >
                                        <ReplyCard reply={reply} />
                                    </motion.div>
                                ))}

                                {/* Sentinel for infinite scroll */}
                                <div ref={sentinelRef} className="h-4" />

                                {/* Loading indicator */}
                                {isLoadingMore && (
                                    <div className="flex justify-center py-4">
                                        <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}

                                {/* End of list indicator */}
                                {!hasMore && totalReplies > 20 && (
                                    <p className="text-center text-sm text-muted-foreground py-4">
                                        All {totalReplies} replies loaded
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}
