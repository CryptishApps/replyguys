import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconRosetteDiscountCheck, IconCheck, IconX } from "@tabler/icons-react";

interface Reply {
    id: string;
    username: string;
    is_premium: boolean;
    follower_count: number;
    text: string;
    tweet_created_at: string | null;
    author_avatar?: string | null;
    is_useful?: boolean | null;
}

export function ReplyCard({ reply }: { reply: Reply }) {
    return (
        <div className="border border-border rounded-lg p-4 space-y-2">
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
                    {reply.is_useful !== null && (
                        reply.is_useful ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconCheck className="size-4 text-green-500" />
                                </TooltipTrigger>
                                <TooltipContent>Useful reply</TooltipContent>
                            </Tooltip>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconX className="size-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Not useful</TooltipContent>
                            </Tooltip>
                        )
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
            <p className="text-sm">{reply.text}</p>
        </div>
    );
}
