"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useReportRealtime, ReportData, Reply } from "@/hooks/use-report-realtime";
import { ReplyCard } from "@/components/reply-card";
import { ReportStats } from "@/components/report-stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconLoader2 } from "@tabler/icons-react";

interface ReportContentProps {
    reportId: string;
    initialReport: ReportData;
    initialReplies: Reply[];
}

const statusConfig = {
    setting_up: { label: "Setting up...", variant: "secondary" as const },
    pending: { label: "Pending", variant: "secondary" as const },
    scraping: { label: "Scraping...", variant: "default" as const },
    completed: { label: "Completed", variant: "default" as const },
    failed: { label: "Failed", variant: "destructive" as const },
};

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
}: ReportContentProps) {
    const { report, replies } = useReportRealtime({
        reportId,
        initialReport,
        initialReplies,
    });

    const status = statusConfig[report.status];
    const isLoading = report.status === "setting_up" || report.status === "pending" || report.status === "scraping";

    return (
        <div className="space-y-6">
            {/* Original Post Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>{report.title || "Original Post"}</CardTitle>
                    <Badge variant={status.variant} className="flex items-center gap-1">
                        {isLoading && (
                            <IconLoader2 className="size-3 animate-spin" />
                        )}
                        {status.label}
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

            {/* Stats Section */}
            <ReportStats
                totalReplies={report.reply_count}
                usefulReplies={report.useful_count}
                threshold={report.reply_threshold}
                status={report.status}
            />

            {/* Replies Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Replies</CardTitle>
                    <CardDescription>
                        {isLoading ? "Live feed of replies to this post" : `${replies.length} replies collected`}
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
                        ) : replies.length === 0 ? (
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
                                        <p>Scraping replies...</p>
                                    </div>
                                ) : (
                                    <p>No replies found</p>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="replies"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-3"
                            >
                                {replies.map((reply, index) => (
                                    <motion.div
                                        key={reply.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.02, duration: 0.2 }}
                                    >
                                        <ReplyCard reply={reply} />
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}
