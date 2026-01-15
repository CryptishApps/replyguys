"use client";

import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";

interface ReportStatsProps {
    totalReplies: number;
    usefulReplies: number;
    qualifiedReplies: number;
    threshold: number;
    status: "setting_up" | "pending" | "scraping" | "completed" | "failed";
}

export function ReportStats({
    totalReplies,
    usefulReplies,
    qualifiedReplies,
    threshold,
    status,
}: ReportStatsProps) {
    const progress = threshold > 0 ? qualifiedReplies / threshold : 0;
    const isActive = status === "scraping" || status === "pending" || status === "setting_up";

    return (
        <motion.div
            className="grid grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Total Scraped */}
            <div className="flex flex-col gap-1 p-4 border rounded-lg">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Total Scraped
                </span>
                <NumberFlow
                    value={totalReplies}
                    className="text-2xl font-semibold tabular-nums"
                />
            </div>

            {/* Qualified Replies */}
            <div className="flex flex-col gap-1 p-4 border rounded-lg">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Qualified Replies
                </span>
                <div className="flex items-baseline gap-2">
                    <NumberFlow
                        value={qualifiedReplies}
                        className="text-2xl font-semibold tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">
                        / {threshold}
                    </span>
                </div>
                <span className="text-xs text-muted-foreground/70">
                    May exceed if replies arrive quickly
                </span>
            </div>

            {/* Progress */}
            <div className="flex flex-col gap-1 p-4 border rounded-lg">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Progress
                </span>
                <div className="flex items-baseline gap-1">
                    <NumberFlow
                        value={Math.min(progress * 100, 100)}
                        className="text-2xl font-semibold tabular-nums"
                        format={{ maximumFractionDigits: 0 }}
                    />
                    <span className="text-lg text-muted-foreground">%</span>
                </div>
                {isActive && (
                    <motion.div
                        className="h-1 bg-primary/20 rounded-full overflow-hidden mt-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
