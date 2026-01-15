"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconRosetteDiscountCheck } from "@tabler/icons-react";
import type { ReplyTag } from "@/lib/ai/schemas";

const TEXT_CHAR_LIMIT = 480;

interface Reply {
    id: string;
    username: string;
    is_premium: boolean;
    follower_count: number;
    text: string;
    tweet_created_at: string | null;
    author_avatar?: string | null;
    // AI Evaluation fields
    goal_relevance?: number | null;
    actionability?: number | null;
    specificity?: number | null;
    substantiveness?: number | null;
    constructiveness?: number | null;
    weighted_score?: number | null;
    tags?: ReplyTag[] | null;
    mini_summary?: string | null;
}

const tagColors: Record<ReplyTag, string> = {
    feature_request: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    complaint: "bg-red-500/10 text-red-600 border-red-500/20",
    praise: "bg-green-500/10 text-green-600 border-green-500/20",
    question: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    suggestion: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    personal_experience: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    data_point: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    counterpoint: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    agreement: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-300`}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className="text-xs font-medium w-8 text-right">{value}</span>
        </div>
    );
}

/**
 * Strips trailing punctuation that's unlikely to be part of a URL
 */
function cleanUrl(url: string): { url: string; trailing: string } {
    const match = url.match(/[.,;:!?\])"']+$/);
    if (match) {
        return {
            url: url.slice(0, -match[0].length),
            trailing: match[0],
        };
    }
    return { url, trailing: "" };
}

/**
 * Parses text and highlights @mentions and URLs with Twitter blue
 */
function FormattedText({ text }: { text: string }) {
    // Match @mentions and URLs (greedily match URLs, we'll clean them after)
    const combinedRegex = /(@\w+|https?:\/\/[^\s]+)/g;

    const parts = text.split(combinedRegex);

    return (
        <>
            {parts.map((part, index) => {
                if (!part) return null;

                if (part.startsWith("@")) {
                    // It's a mention
                    const username = part.slice(1);
                    return (
                        <a
                            key={index}
                            href={`https://x.com/${username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1d9bf0] hover:underline"
                        >
                            {part}
                        </a>
                    );
                } else if (part.startsWith("http")) {
                    // It's a URL - clean trailing punctuation
                    const { url, trailing } = cleanUrl(part);
                    return (
                        <span key={index}>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#1d9bf0] hover:underline"
                            >
                                {url.length > 30 ? url.slice(0, 30) + "…" : url}
                            </a>
                            {trailing}
                        </span>
                    );
                }
                // Regular text
                return part;
            })}
        </>
    );
}

export function ReplyCard({ reply }: { reply: Reply }) {
    const hasEvaluation = reply.weighted_score != null;
    const [isExpanded, setIsExpanded] = useState(false);

    const needsTruncation = reply.text.length > TEXT_CHAR_LIMIT;
    const truncatedText = needsTruncation
        ? reply.text.slice(0, TEXT_CHAR_LIMIT).trimEnd()
        : reply.text;

    return (
        <div className="border border-border rounded-lg p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                        <AvatarImage src={reply.author_avatar ?? undefined} />
                        <AvatarFallback className="text-xs">
                            {reply.username[0]?.toUpperCase() ?? "X"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">@{reply.username}</span>
                    {reply.is_premium && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <IconRosetteDiscountCheck className="size-4 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>X Premium subscriber</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                        {reply.follower_count.toLocaleString()} followers
                    </Badge>
                    {reply.tweet_created_at && (
                        <span className="text-xs text-muted-foreground">
                            {new Date(reply.tweet_created_at).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Reply text */}
            <p className="text-sm leading-relaxed">
                {isExpanded || !needsTruncation ? (
                    <>
                        <FormattedText text={reply.text} />
                        {needsTruncation && (
                            <>
                                {" "}
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Show less
                                </button>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <FormattedText text={truncatedText} />
                        {"… "}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            className="text-primary hover:underline"
                        >
                            Read more
                        </button>
                    </>
                )}
            </p>

            {/* Mini summary */}
            {reply.mini_summary && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                    {reply.mini_summary}
                </p>
            )}

            {/* AI Evaluation Stats */}
            {hasEvaluation && (
                <div className="pt-3 border-t border-border space-y-3">
                    {/* Tags */}
                    {reply.tags && reply.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {reply.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className={`text-xs`}
                                >
                                    {tag.replace("_", " ")}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Score bars */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <ScoreBar
                            label="Goal Relevance"
                            value={reply.goal_relevance ?? 0}
                            color="bg-rose-500"
                        />
                        <ScoreBar
                            label="Actionability"
                            value={reply.actionability ?? 0}
                            color="bg-green-500"
                        />
                        <ScoreBar
                            label="Specificity"
                            value={reply.specificity ?? 0}
                            color="bg-blue-500"
                        />
                        <ScoreBar
                            label="Substantive"
                            value={reply.substantiveness ?? 0}
                            color="bg-purple-500"
                        />
                        <ScoreBar
                            label="Constructive"
                            value={reply.constructiveness ?? 0}
                            color="bg-amber-500"
                        />
                    </div>

                    {/* Overall score */}
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">Weighted Score</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold">{reply.weighted_score}</span>
                            <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
