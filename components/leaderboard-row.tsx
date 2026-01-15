"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    IconRosetteDiscountCheck,
    IconTrophy,
    IconMedal,
    IconAward,
} from "@tabler/icons-react";
import { cn, formatNumber } from "@/lib/utils";
import type {
    LeaderboardTab,
    LeaderboardEntry,
    ReplierEntry,
    AudienceEntry,
} from "@/app/(dashboard)/leaderboard/actions";

interface LeaderboardRowProps {
    entry: LeaderboardEntry;
    tab: LeaderboardTab;
    isHighlighted?: boolean;
}

function isReplierEntry(entry: LeaderboardEntry): entry is ReplierEntry {
    return "x_user_id" in entry;
}

function getRankIcon(rank: number) {
    if (rank === 1) {
        return <IconTrophy className="size-5 text-yellow-500" />;
    }
    if (rank === 2) {
        return <IconMedal className="size-5 text-gray-400" />;
    }
    if (rank === 3) {
        return <IconAward className="size-5 text-amber-600" />;
    }
    return null;
}

function getPercentileBadge(rank: number, total: number) {
    if (total < 20) return null;
    const percentile = (rank / total) * 100;
    if (percentile <= 1) {
        return (
            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                Top 1%
            </Badge>
        );
    }
    if (percentile <= 5) {
        return (
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                Top 5%
            </Badge>
        );
    }
    if (percentile <= 10) {
        return (
            <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Top 10%
            </Badge>
        );
    }
    return null;
}

export function LeaderboardRow({ entry, tab, isHighlighted }: LeaderboardRowProps) {
    const isReplier = isReplierEntry(entry);

    const username = isReplier ? entry.username : (entry as AudienceEntry).op_username;
    const avatar = isReplier ? entry.author_avatar : (entry as AudienceEntry).op_avatar;
    const rank = entry.rank;

    const rankIcon = getRankIcon(rank);
    // We don't have total count in props, so skip percentile for now
    // Could be added via context or parent prop

    return (
        <div
            className={cn(
                "flex items-center gap-4 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors",
                isHighlighted && "bg-primary/5 border-primary/30"
            )}
        >
            {/* Rank */}
            <div className="flex items-center justify-center w-10 shrink-0">
                {rankIcon || (
                    <span className="text-lg font-semibold text-muted-foreground tabular-nums">
                        {rank}
                    </span>
                )}
            </div>

            {/* Avatar + Username */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="size-10 shrink-0">
                    <AvatarImage src={avatar ?? undefined} />
                    <AvatarFallback>
                        {username?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <a
                        href={`https://x.com/${username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 group"
                    >
                        <span className="font-medium truncate group-hover:underline decoration-muted-foreground/50 underline-offset-2">
                            @{username}
                        </span>
                        {isReplier && entry.is_premium && (
                            <IconRosetteDiscountCheck className="size-4 text-blue-500 shrink-0" />
                        )}
                    </a>
                    <div className="text-xs text-muted-foreground">
                        {isReplier ? (
                            <span>{formatNumber(entry.follower_count)} followers</span>
                        ) : (
                            <span>
                                {(entry as AudienceEntry).report_count} {(entry as AudienceEntry).report_count === 1 ? "post" : "posts"} analyzed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 shrink-0">
                {/* Score */}
                <div className="text-right">
                    <div className="font-semibold tabular-nums">
                        {tab === "total" && isReplier && formatNumber(entry.total_score ?? 0)}
                        {tab === "average" && isReplier && (entry.avg_score ?? 0).toFixed(1)}
                        {tab === "audiences" && !isReplier && (entry as AudienceEntry).avg_reply_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {tab === "total" && "total"}
                        {tab === "average" && "avg"}
                        {tab === "audiences" && "avg score"}
                    </div>
                </div>

                {/* Reply/Post count */}
                <div className="text-right min-w-[60px]">
                    <div className="font-medium tabular-nums text-muted-foreground">
                        {isReplier
                            ? formatNumber(entry.reply_count)
                            : formatNumber((entry as AudienceEntry).total_replies)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {isReplier ? "replies" : "replies"}
                    </div>
                </div>
            </div>
        </div>
    );
}
