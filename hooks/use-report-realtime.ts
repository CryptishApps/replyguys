"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ReportData {
    id: string;
    status: "setting_up" | "pending" | "scraping" | "completed" | "failed";
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
}

export interface Reply {
    id: string;
    username: string;
    is_premium: boolean;
    follower_count: number;
    text: string;
    tweet_created_at: string | null;
    author_avatar: string | null;
    is_useful: boolean | null;
}

interface UseReportRealtimeOptions {
    reportId: string;
    initialReport: ReportData;
    initialReplies: Reply[];
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
}: UseReportRealtimeOptions) {
    const [report, setReport] = useState<ReportData>(initialReport);
    const [replies, setReplies] = useState<Reply[]>(initialReplies);
    const [isConnected, setIsConnected] = useState(false);
    const supabaseRef = useRef(createClient());
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const hasReceivedRealtimeRef = useRef(false);

    // Sync initial data when it changes (e.g., on page refresh)
    useEffect(() => {
        setReport(initialReport);
        setReplies(initialReplies);
    }, [initialReport, initialReplies]);

    // Manual refresh function for fallback
    const refresh = useCallback(async () => {
        const supabase = supabaseRef.current;

        const [reportResult, repliesResult] = await Promise.all([
            supabase
                .from("reports")
                .select("id, status, reply_count, reply_threshold, useful_count, qualified_count, original_tweet_text, original_author_username, original_author_avatar, title, summary, summary_status")
                .eq("id", reportId)
                .single(),
            supabase
                .from("replies")
                .select("id, username, is_premium, follower_count, text, tweet_created_at, author_avatar, is_useful")
                .eq("report_id", reportId)
                .order("tweet_created_at", { ascending: false }),
        ]);

        if (reportResult.data) {
            setReport(reportResult.data as ReportData);
        }
        if (repliesResult.data) {
            setReplies(repliesResult.data as Reply[]);
        }
    }, [reportId]);

    useEffect(() => {
        // Skip subscription if already complete
        const isTerminal = report.status === "completed" || report.status === "failed";
        if (isTerminal) {
            console.log("[realtime] Report is terminal, skipping subscription");
            return;
        }

        const supabase = supabaseRef.current;
        hasReceivedRealtimeRef.current = false;

        // Set auth token explicitly for realtime (recommended by Supabase)
        const setupAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                console.log("[realtime] Setting auth token for realtime");
                supabase.realtime.setAuth(session.access_token);
            } else {
                console.log("[realtime] WARNING: No auth session available");
            }
        };

        setupAuth();

        console.log("[realtime] Setting up subscriptions for report:", reportId);

        // Subscribe to new replies
        const repliesChannel = supabase
            .channel(`replies-${reportId}-${Date.now()}`)
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
                    hasReceivedRealtimeRef.current = true;
                    const newReply = payload.new as Reply;
                    setReplies((prev) => {
                        // Avoid duplicates
                        if (prev.some((r) => r.id === newReply.id)) {
                            return prev;
                        }
                        return [newReply, ...prev];
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
                    hasReceivedRealtimeRef.current = true;
                    const updatedReply = payload.new as Reply;
                    setReplies((prev) =>
                        prev.map((r) => (r.id === updatedReply.id ? updatedReply : r))
                    );
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
            .channel(`report-${reportId}-${Date.now()}`)
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
                    hasReceivedRealtimeRef.current = true;
                    const newReport = payload.new as ReportData;
                    setReport(newReport);
                }
            )
            .subscribe((status, err) => {
                console.log("[realtime] Report channel status:", status, err || "");
                if (status === "CHANNEL_ERROR") {
                    console.error("[realtime] Channel error, will rely on polling");
                }
            });

        channelsRef.current = [repliesChannel, reportChannel];

        // Fallback polling - only if realtime hasn't delivered any events
        const pollInterval = setInterval(() => {
            if (!hasReceivedRealtimeRef.current) {
                console.log("[realtime] No realtime events received, polling for updates...");
                refresh();
            }
        }, 5000);

        return () => {
            console.log("[realtime] Cleaning up subscriptions");
            clearInterval(pollInterval);
            channelsRef.current.forEach((channel) => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        };
    }, [reportId, report.status, refresh]);

    return { report, replies, isConnected, refresh };
}
