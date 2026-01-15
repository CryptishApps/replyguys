"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Loader } from "@/components/ai-elements/loader";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

export type ReportActivityEvent = {
    id: number;
    report_id: string;
    created_at: string;
    key: string;
    message: string;
    meta: unknown | null;
};

type ActivityGroup = {
    key: string;
    message: string;
    count: number;
    latestCreatedAt: string;
};

function groupConsecutive(eventsAsc: ReportActivityEvent[]): ActivityGroup[] {
    const groups: ActivityGroup[] = [];

    for (const evt of eventsAsc) {
        const last = groups[groups.length - 1];
        const sameAsLast = last && last.key === evt.key && last.message === evt.message;

        if (sameAsLast) {
            last.count += 1;
            last.latestCreatedAt = evt.created_at;
            continue;
        }

        groups.push({
            key: evt.key,
            message: evt.message,
            count: 1,
            latestCreatedAt: evt.created_at,
        });
    }

    return groups;
}

function formatMessage(message: string, count: number): string {
    if (count <= 1) return message;
    return `${message} (×${count})`;
}

export function ReportActivityFeed({
    activity,
    isConnected,
    isComplete,
    replyThreshold,
}: {
    activity: ReportActivityEvent[];
    isConnected: boolean;
    isComplete: boolean;
    replyThreshold: number;
}) {
    const reduceMotion = useReducedMotion();

    // Ensure stable ordering for animation (oldest -> newest)
    const eventsAsc = [...activity].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const groups = groupConsecutive(eventsAsc);
    const visibleGroups = groups.slice(Math.max(0, groups.length - 5));

    const shouldShow = !isComplete;

    return (
        <AnimatePresence initial={false}>
            {shouldShow && (
                <motion.div
                    key="activity"
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card className="border-border/60 bg-card/60 backdrop-blur supports-backdrop-filter:bg-card/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-semibold">
                                Activity
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        "size-2 rounded-full",
                                        isConnected ? "bg-emerald-500" : "bg-amber-500",
                                        !reduceMotion && !isConnected && "animate-pulse"
                                    )}
                                    aria-hidden
                                />
                                <span className="text-xs text-muted-foreground">
                                    {isConnected ? "Live" : "Updating…"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                            {/* Fixed height container to prevent layout jumps */}
                            <div className="relative min-h-[140px] overflow-hidden">
                                <div className="relative pl-6">
                                    {/* Vertical timeline line */}
                                    <div
                                        className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
                                        aria-hidden
                                    />

                                    <motion.div
                                        layout
                                        className="space-y-3"
                                        transition={{ duration: 0.2 }}
                                    >
                                        {visibleGroups.length === 0 ? (
                                            <div className="flex items-start gap-3">
                                                <div className="relative mt-0.5 flex-shrink-0">
                                                    <Loader size={14} className="text-primary" />
                                                </div>
                                                <Shimmer className="text-sm" duration={2.5}>
                                                    {`Working… (this can take a minute for larger thresholds like ${replyThreshold})`}
                                                </Shimmer>
                                            </div>
                                        ) : (
                                            <AnimatePresence initial={false} mode="popLayout">
                                                {visibleGroups.map((g, idx) => {
                                                    const isActive = idx === visibleGroups.length - 1;
                                                    const displayMessage = formatMessage(g.message, g.count);

                                                    return (
                                                        <motion.div
                                                            key={`${g.key}-${g.latestCreatedAt}`}
                                                            layout
                                                            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                                                            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
                                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                                            className="flex items-start gap-3"
                                                        >
                                                            {/* Timeline node */}
                                                            <div className="relative mt-0.5 flex-shrink-0">
                                                                {isActive ? (
                                                                    <Loader size={14} className="text-primary" />
                                                                ) : (
                                                                    <div className="flex size-[14px] items-center justify-center rounded-full bg-muted">
                                                                        <CheckIcon className="size-2.5 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Message content */}
                                                            <div className="flex-1 min-w-0">
                                                                {isActive ? (
                                                                    <Shimmer
                                                                        className="text-sm font-medium"
                                                                        duration={2.5}
                                                                    >
                                                                        {displayMessage}
                                                                    </Shimmer>
                                                                ) : (
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {displayMessage}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        )}
                                    </motion.div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
