"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type LeaderboardTab = "total" | "average" | "audiences";

export interface ReplierEntry {
    x_user_id: string;
    username: string;
    author_avatar: string | null;
    is_premium: boolean;
    follower_count: number;
    total_score?: number;
    avg_score?: number;
    reply_count: number;
    rank: number;
}

export interface AudienceEntry {
    op_username: string;
    op_avatar: string | null;
    avg_reply_score: number;
    total_replies: number;
    report_count: number;
    rank: number;
}

export type LeaderboardEntry = ReplierEntry | AudienceEntry;

interface LeaderboardResult {
    entries: LeaderboardEntry[];
    error?: string;
}

export async function getLeaderboardData(
    tab: LeaderboardTab,
    search?: string
): Promise<LeaderboardResult> {
    const supabase = createAdminClient();

    try {
        if (tab === "total") {
            const { data, error } = await supabase.rpc("get_top_repliers_total", {
                p_limit: 500,
                p_offset: 0,
                p_search: search || null,
            });

            if (error) throw error;

            return {
                entries: (data ?? []).map((row: Record<string, unknown>) => ({
                    x_user_id: row.x_user_id as string,
                    username: row.username as string,
                    author_avatar: row.author_avatar as string | null,
                    is_premium: row.is_premium as boolean,
                    follower_count: row.follower_count as number,
                    total_score: Number(row.total_score),
                    reply_count: Number(row.reply_count),
                    rank: Number(row.rank),
                })),
            };
        }

        if (tab === "average") {
            const { data, error } = await supabase.rpc("get_top_repliers_avg", {
                p_limit: 500,
                p_offset: 0,
                p_search: search || null,
            });

            if (error) throw error;

            return {
                entries: (data ?? []).map((row: Record<string, unknown>) => ({
                    x_user_id: row.x_user_id as string,
                    username: row.username as string,
                    author_avatar: row.author_avatar as string | null,
                    is_premium: row.is_premium as boolean,
                    follower_count: row.follower_count as number,
                    avg_score: Number(row.avg_score),
                    reply_count: Number(row.reply_count),
                    rank: Number(row.rank),
                })),
            };
        }

        if (tab === "audiences") {
            const { data, error } = await supabase.rpc("get_top_audiences", {
                p_limit: 500,
                p_offset: 0,
                p_search: search || null,
            });

            if (error) throw error;

            return {
                entries: (data ?? []).map((row: Record<string, unknown>) => ({
                    op_username: row.op_username as string,
                    op_avatar: row.op_avatar as string | null,
                    avg_reply_score: Number(row.avg_reply_score),
                    total_replies: Number(row.total_replies),
                    report_count: Number(row.report_count),
                    rank: Number(row.rank),
                })),
            };
        }

        return { entries: [] };
    } catch (error) {
        console.error("[leaderboard] Error fetching data:", error);
        return {
            entries: [],
            error: error instanceof Error ? error.message : "Failed to fetch leaderboard data",
        };
    }
}

// Get a specific user's rank across all tabs
export async function getUserRank(username: string): Promise<{
    totalRank?: number;
    avgRank?: number;
    error?: string;
}> {
    const supabase = createAdminClient();

    try {
        const [totalResult, avgResult] = await Promise.all([
            supabase.rpc("get_top_repliers_total", {
                p_limit: 1,
                p_offset: 0,
                p_search: username,
            }),
            supabase.rpc("get_top_repliers_avg", {
                p_limit: 1,
                p_offset: 0,
                p_search: username,
            }),
        ]);

        return {
            totalRank: totalResult.data?.[0]?.rank ? Number(totalResult.data[0].rank) : undefined,
            avgRank: avgResult.data?.[0]?.rank ? Number(avgResult.data[0].rank) : undefined,
        };
    } catch (error) {
        console.error("[leaderboard] Error fetching user rank:", error);
        return {
            error: error instanceof Error ? error.message : "Failed to fetch user rank",
        };
    }
}
