"use client";

import Link from "next/link";
import { IconChevronDown, IconDashboard, IconLogout, IconUser } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
    username: string | null;
    avatarUrl: string | null;
}

export function UserMenu({ username, avatarUrl }: UserMenuProps) {
    const displayName = username ? `@${username}` : "User";
    const initials = username ? username.slice(0, 2).toUpperCase() : "U";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-2">
                    <Avatar size="sm">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium max-w-24 truncate">
                        {displayName}
                    </span>
                    <IconChevronDown className="size-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                        <Avatar>
                            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                            <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{displayName}</span>
                            <span className="truncate text-xs text-muted-foreground">
                                X (Twitter)
                            </span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="w-full flex items-center gap-2">
                        <IconDashboard className="size-4" />
                        Dashboard
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild variant="destructive">
                    <Link href="/api/auth/logout" className="w-full flex items-center gap-2">
                        <IconLogout className="size-4" />
                        Log out
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
