"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { usePrevious } from "@/hooks/use-previous";
import { LeaderboardRow } from "@/components/leaderboard-row";
import {
    getLeaderboardData,
    type LeaderboardTab,
    type LeaderboardEntry,
    type ReplierEntry,
    type AudienceEntry,
} from "@/app/(dashboard)/leaderboard/actions";
import {
    IconSearch,
    IconLoader2,
    IconUser,
    IconTrophy,
    IconChartBar,
    IconUsers,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface LeaderboardContentProps {
    currentUsername: string | null;
    initialSearch?: string;
    initialTab?: LeaderboardTab;
}

function isReplierEntry(entry: LeaderboardEntry): entry is ReplierEntry {
    return "x_user_id" in entry;
}

export function LeaderboardContent({
    currentUsername,
    initialSearch,
    initialTab = "total",
}: LeaderboardContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [tab, setTab] = useState<LeaderboardTab>(initialTab);
    const [search, setSearch] = useState(initialSearch ?? "");
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch ?? "");
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    const prevTab = usePrevious(tab);
    const prevSearch = usePrevious(debouncedSearch);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch data when tab or search changes
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            const result = await getLeaderboardData(tab, debouncedSearch || undefined);

            if (result.error) {
                setError(result.error);
            } else {
                setEntries(result.entries);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [tab, debouncedSearch]);

    // Update URL when search changes
    useEffect(() => {
        if (prevSearch !== undefined && prevSearch !== debouncedSearch) {
            const params = new URLSearchParams(searchParams.toString());
            if (debouncedSearch) {
                params.set("user", debouncedSearch);
            } else {
                params.delete("user");
            }
            params.set("tab", tab);
            startTransition(() => {
                router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
            });
        }
    }, [debouncedSearch, prevSearch, tab, router, searchParams]);

    // Update URL when tab changes
    useEffect(() => {
        if (prevTab !== undefined && prevTab !== tab) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", tab);
            startTransition(() => {
                router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
            });
        }
    }, [tab, prevTab, router, searchParams]);

    const {
        visibleItems,
        totalCount,
        hasMore,
        isLoading: isLoadingMore,
        sentinelRef,
        reset,
    } = useInfiniteScroll({
        items: entries,
        pageSize: 25,
    });

    // Reset scroll when data changes
    useEffect(() => {
        reset();
    }, [entries, reset]);

    const handleFindMe = useCallback(() => {
        if (currentUsername) {
            setSearch(currentUsername);
            // Scroll to highlighted row after data loads
            setTimeout(() => {
                highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 500);
        }
    }, [currentUsername]);

    const handleTabChange = (value: string) => {
        setTab(value as LeaderboardTab);
    };

    const getUsername = (entry: LeaderboardEntry): string => {
        return isReplierEntry(entry) ? entry.username : (entry as AudienceEntry).op_username;
    };

    const isHighlighted = (entry: LeaderboardEntry): boolean => {
        const username = getUsername(entry);
        return Boolean(debouncedSearch && username.toLowerCase() === debouncedSearch.toLowerCase());
    };

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex justify-center pb-2">
                <AnimatedTabs
                    value={tab}
                    onValueChange={handleTabChange}
                    items={[
                        {
                            value: "total",
                            label: (
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline">Total Score</span>
                                    <span className="sm:hidden">Total</span>
                                </div>
                            ),
                        },
                        {
                            value: "average",
                            label: (
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline">Average Score</span>
                                    <span className="sm:hidden">Average</span>
                                </div>
                            ),
                        },
                        {
                            value: "audiences",
                            label: (
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline">Top Audiences</span>
                                    <span className="sm:hidden">Audiences</span>
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Search and Find Me */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by username..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9"
                    />
                    {isPending && (
                        <IconLoader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                    )}
                </div>
                {currentUsername && tab !== "audiences" && (
                    <Button
                        variant="outline"
                        onClick={handleFindMe}
                        className="gap-2 shrink-0"
                    >
                        <IconUser className="size-4" />
                        Find Me
                    </Button>
                )}
            </div>

            {/* Results */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center justify-between">
                        <span>
                            {tab === "total" && "Top Repliers by Total Score"}
                            {tab === "average" && "Top Repliers by Average Score"}
                            {tab === "audiences" && "Top Audiences by Reply Quality"}
                        </span>
                        {!isLoading && (
                            <span className="text-sm font-normal text-muted-foreground">
                                {totalCount} {totalCount === 1 ? "entry" : "entries"}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-destructive">
                            <p>{error}</p>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {debouncedSearch ? (
                                <div className="space-y-2">
                                    <p>No results for &quot;@{debouncedSearch}&quot;</p>
                                    <p className="text-sm">
                                        They might not have replied to any analyzed posts yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p>The leaderboard is warming up!</p>
                                    <p className="text-sm">
                                        Start analyzing posts to see rankings.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {visibleItems.map((entry, index) => {
                                    const highlighted = isHighlighted(entry);
                                    return (
                                        <motion.div
                                            key={isReplierEntry(entry) ? entry.x_user_id : (entry as AudienceEntry).op_username}
                                            ref={highlighted ? highlightRef : undefined}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -12 }}
                                            transition={{
                                                duration: 0.2,
                                                delay: Math.min(index, 10) * 0.02,
                                            }}
                                            className={cn(
                                                "rounded-lg transition-colors",
                                                highlighted && "ring-2 ring-primary/50 bg-primary/5"
                                            )}
                                        >
                                            <LeaderboardRow
                                                entry={entry}
                                                tab={tab}
                                                isHighlighted={highlighted}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {/* Sentinel for infinite scroll */}
                            <div ref={sentinelRef} className="h-4" />

                            {/* Loading more indicator */}
                            {isLoadingMore && (
                                <div className="flex justify-center py-4">
                                    <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {/* End of list */}
                            {!hasMore && totalCount > 25 && (
                                <p className="text-center text-sm text-muted-foreground py-4">
                                    All {totalCount} entries loaded
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
