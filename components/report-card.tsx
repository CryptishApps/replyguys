import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

type ReportStatus = "setting_up" | "pending" | "scraping" | "completed" | "failed";

interface ReportCardProps {
    id: string;
    xPostUrl: string;
    conversationId: string;
    status: ReportStatus;
    replyCount: number;
    createdAt: string;
    originalAuthorUsername?: string | null;
    originalAuthorAvatar?: string | null;
    originalTweetText?: string | null;
    replyThreshold?: number;
    usefulCount?: number;
}

const statusConfig: Record<ReportStatus, { label: string; variant: "secondary" | "default" | "destructive" }> = {
    setting_up: { label: "Setting up", variant: "secondary" },
    pending: { label: "Pending", variant: "secondary" },
    scraping: { label: "Scraping", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
};

function extractUsernameFromUrl(url: string): string | null {
    const match = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)\/status/i);
    return match ? match[1] : null;
}

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ReportCard({
    id,
    xPostUrl,
    conversationId,
    status,
    replyCount,
    createdAt,
    originalAuthorUsername,
    originalAuthorAvatar,
    originalTweetText,
    replyThreshold = 100,
    usefulCount = 0,
}: ReportCardProps) {
    const fallbackUsername = extractUsernameFromUrl(xPostUrl);
    const displayUsername = originalAuthorUsername || fallbackUsername;
    const statusInfo = statusConfig[status];
    const timeAgo = formatTimeAgo(createdAt);

    const disregardedCount = replyCount - usefulCount;
    const progressPercent = replyThreshold > 0 ? Math.min(100, (usefulCount / replyThreshold) * 100) : 0;
    const isLoading = status === "setting_up" || status === "pending" || status === "scraping";

    return (
        <div className="flex flex-col bg-card text-card-foreground rounded-lg border border-border overflow-hidden transition-colors hover:border-primary/40">
            {/* Tweet-like Header */}
            <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-10 shrink-0">
                        <AvatarImage src={originalAuthorAvatar ?? undefined} />
                        <AvatarFallback className="text-muted-foreground font-bold text-sm">
                            {displayUsername ? displayUsername.charAt(0).toUpperCase() : "X"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                            {displayUsername ? `@${displayUsername}` : "X Post"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {timeAgo}
                        </p>
                    </div>
                </div>
                <Badge variant={statusInfo.variant} className="shrink-0">
                    {statusInfo.label}
                </Badge>
            </div>

            {/* Original tweet text snippet or loading skeleton */}
            <div className="px-4 pb-4">
                {originalTweetText ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {originalTweetText}
                    </p>
                ) : status === "setting_up" ? (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground font-mono truncate">
                        {conversationId}
                    </p>
                )}
            </div>

            {/* Progress bar for active scrapes */}
            {isLoading && (
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{usefulCount} / {replyThreshold}</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 border-t border-border text-center text-sm">
                <div className="py-3 px-2">
                    <p className="font-semibold text-foreground">{replyCount}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="py-3 px-2 border-x border-border">
                    <p className="font-semibold text-foreground">{usefulCount}</p>
                    <p className="text-xs text-muted-foreground">Useful</p>
                </div>
                <div className="py-3 px-2">
                    <p className="font-semibold text-foreground">{disregardedCount > 0 ? disregardedCount : 0}</p>
                    <p className="text-xs text-muted-foreground">Filtered</p>
                </div>
            </div>

            {/* View Report Button */}
            <div className="p-3 pt-0">
                <Button asChild variant="secondary" className="w-full">
                    <Link href={`/report/${id}`}>
                        View Report
                    </Link>
                </Button>
            </div>
        </div>
    );
}
