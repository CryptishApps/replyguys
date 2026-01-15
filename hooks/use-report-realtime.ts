"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ReplyTag } from "@/lib/ai/schemas";

export interface ReportData {
    id: string;
    status: "setting_up" | "pending" | "scraping" | "completed" | "failed";
    created_at: string;
    reply_count: number;
    reply_threshold: number;
    useful_count: number;
    qualified_count: number;
    original_tweet_text: string | null;
    original_author_username: string | null;
    original_author_avatar: string | null;
    title: string | null;
    summary: unknown | null;
    summary_status: "pending" | "generating" | "completed" | "failed";
    viral_tweet_id: string | null;
    viral_tweet_status: "pending" | "generating" | "posted" | "failed" | null;
}

export interface Reply {
    id: string;
    username: string;
    is_premium: boolean;
    follower_count: number;
    text: string;
    tweet_created_at: string | null;
    author_avatar: string | null;
    // AI Evaluation fields
    goal_relevance: number | null;
    actionability: number | null;
    specificity: number | null;
    substantiveness: number | null;
    constructiveness: number | null;
    weighted_score: number | null;
    tags: ReplyTag[] | null;
    mini_summary: string | null;
    to_be_included: boolean | null;
}

export interface ReportActivityEvent {
    id: number;
    report_id: string;
    created_at: string;
    key: string;
    message: string;
    meta: unknown | null;
}

interface UseReportRealtimeOptions {
    reportId: string;
    initialReport: ReportData;
    initialReplies: Reply[];
    initialActivity: ReportActivityEvent[];
}

function isFullyComplete(report: ReportData): boolean {
    return (
        (report.status === "completed" || report.status === "failed") &&
        (report.summary_status === "completed" || report.summary_status === "failed")
    );
}

/**
 * Hook that provides realtime updates for a report and its replies.
 * Automatically unsubscribes when the report status becomes "completed" or "failed".
 * Falls back to polling if realtime doesn't deliver events.
 */
export function useReportRealtime({
    reportId,
    initialReport,
    initialReplies,
    initialActivity,
}: UseReportRealtimeOptions) {
    const [report, setReport] = useState<ReportData>(initialReport);
    const [replies, setReplies] = useState<Reply[]>(initialReplies);
    const [activity, setActivity] = useState<ReportActivityEvent[]>(initialActivity);
    const [isConnected, setIsConnected] = useState(false);
    const supabaseRef = useRef(createClient());
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isCompleteRef = useRef(isFullyComplete(initialReport));

    // Manual refresh function for fallback
    const refresh = useCallback(async () => {
        const supabase = supabaseRef.current;

        const [reportResult, repliesResult, activityResult] = await Promise.all([
            supabase
                .from("reports")
                .select("id, status, reply_count, reply_threshold, useful_count, qualified_count, original_tweet_text, original_author_username, original_author_avatar, title, summary, summary_status, viral_tweet_id, viral_tweet_status")
                .eq("id", reportId)
                .single(),
            supabase
                .from("replies")
                .select("id, username, is_premium, follower_count, text, tweet_created_at, author_avatar, goal_relevance, actionability, specificity, substantiveness, constructiveness, weighted_score, tags, mini_summary, to_be_included")
                .eq("report_id", reportId)
                .eq("to_be_included", true)
                .order("weighted_score", { ascending: false }),
            supabase
                .from("report_activity")
                .select("id, report_id, created_at, key, message, meta")
                .eq("report_id", reportId)
                .order("created_at", { ascending: false })
                .limit(25),
        ]);

        if (reportResult.data) {
            setReport(reportResult.data as ReportData);
        }
        if (repliesResult.data) {
            setReplies(repliesResult.data as Reply[]);
        }
        if (activityResult.data) {
            setActivity(activityResult.data as ReportActivityEvent[]);
        }
    }, [reportId]);

    useEffect(() => {
        // Skip subscription only if FULLY complete from the start
        if (isCompleteRef.current) {
            console.log("[realtime] Report already complete, skipping subscription");
            return;
        }

        const supabase = supabaseRef.current;
        let isCancelled = false;

        // Set up subscriptions after auth is ready
        const setupSubscriptions = async () => {
            // Set auth token explicitly for realtime (recommended by Supabase)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                console.log("[realtime] Setting auth token for realtime");
                await supabase.realtime.setAuth(session.access_token);
            } else {
                console.log("[realtime] WARNING: No auth session available");
            }

            if (isCancelled) return;

            console.log("[realtime] Setting up subscriptions for report:", reportId);

            // Subscribe to reply changes
            // Only show replies where to_be_included = true
            const repliesChannel = supabase
                .channel(`replies-${reportId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "replies",
                    filter: `report_id=eq.${reportId}`,
                },
                (payload) => {
                    console.log("[realtime] New reply received via realtime:", payload.new);
                    const newReply = payload.new as Reply;
                    // Only add if it's already been evaluated and marked as to_be_included
                    // (unlikely on INSERT, but handle it just in case)
                    if (!newReply.to_be_included) {
                        console.log("[realtime] Reply not yet evaluated, skipping");
                        return;
                    }
                    setReplies((prev) => {
                        if (prev.some((r) => r.id === newReply.id)) {
                            return prev;
                        }
                        // Insert in score order
                        const newReplies = [...prev, newReply];
                        return newReplies.sort((a, b) => (b.weighted_score ?? 0) - (a.weighted_score ?? 0));
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "replies",
                    filter: `report_id=eq.${reportId}`,
                },
                (payload) => {
                    console.log("[realtime] Reply updated via realtime:", payload.new);
                    const updatedReply = payload.new as Reply;

                    setReplies((prev) => {
                        const existingIndex = prev.findIndex((r) => r.id === updatedReply.id);

                        // If reply was evaluated and now has to_be_included = true
                        if (updatedReply.to_be_included) {
                            if (existingIndex >= 0) {
                                // Update existing reply
                                const newReplies = [...prev];
                                newReplies[existingIndex] = updatedReply;
                                return newReplies.sort((a, b) => (b.weighted_score ?? 0) - (a.weighted_score ?? 0));
                            } else {
                                // Add new reply (it was just evaluated and marked as included)
                                const newReplies = [...prev, updatedReply];
                                return newReplies.sort((a, b) => (b.weighted_score ?? 0) - (a.weighted_score ?? 0));
                            }
                        } else {
                            // Reply is not included - remove from list if it was there
                            if (existingIndex >= 0) {
                                return prev.filter((r) => r.id !== updatedReply.id);
                            }
                            return prev;
                        }
                    });
                }
            )
            .subscribe((status, err) => {
                console.log("[realtime] Replies channel status:", status, err || "");
                if (status === "CHANNEL_ERROR") {
                    console.error("[realtime] Channel error, will rely on polling");
                }
                setIsConnected(status === "SUBSCRIBED");
            });

            // Subscribe to report updates
            const reportChannel = supabase
                .channel(`report-${reportId}-report`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "reports",
                    filter: `id=eq.${reportId}`,
                },
                (payload) => {
                    console.log("[realtime] Report update received via realtime:", payload.new);
                    const newReport = payload.new as ReportData;
                    setReport(newReport);

                    // Check if report just became complete - do a final refresh
                    if (isFullyComplete(newReport) && !isCompleteRef.current) {
                        console.log("[realtime] Report just completed, doing final refresh");
                        isCompleteRef.current = true;
                        // Clear polling and do one final refresh
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                        refresh();
                    }
                }
            )
            .subscribe((status, err) => {
                console.log("[realtime] Report channel status:", status, err || "");
                if (status === "CHANNEL_ERROR") {
                    console.error("[realtime] Channel error, will rely on polling");
                }
            });

            const activityChannel = supabase
                .channel(`report-activity-${reportId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "report_activity",
                        filter: `report_id=eq.${reportId}`,
                    },
                    (payload) => {
                        console.log("[realtime] Activity event received via realtime:", payload.new);
                        const evt = payload.new as ReportActivityEvent;
                        setActivity((prev) => {
                            if (prev.some((e) => e.id === evt.id)) return prev;
                            const next = [evt, ...prev];
                            return next.slice(0, 50);
                        });
                    }
                )
                .subscribe((status, err) => {
                    console.log("[realtime] Activity channel status:", status, err || "");
                });

            channelsRef.current = [repliesChannel, reportChannel, activityChannel];
        };

        // Start subscription setup
        setupSubscriptions();

        // Fallback polling - poll every 5 seconds as backup
        // Skip polling if already complete
        pollIntervalRef.current = setInterval(() => {
            if (isCompleteRef.current) {
                console.log("[realtime] Skipping poll - report complete");
                return;
            }
            console.log("[realtime] Polling for updates");
            refresh();
        }, 5000);

        // Also do an immediate refresh after a short delay to catch any updates
        const initialRefresh = setTimeout(() => {
            console.log("[realtime] Initial refresh after subscription");
            refresh();
        }, 1000);

        return () => {
            console.log("[realtime] Cleaning up subscriptions");
            isCancelled = true;
            clearTimeout(initialRefresh);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            channelsRef.current.forEach((channel) => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        };
    }, [reportId, refresh]); // Only re-run if reportId changes, not on every status update

    return { report, replies, activity, isConnected, refresh };
}
