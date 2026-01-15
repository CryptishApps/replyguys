"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions<T> {
    /** All items to paginate through */
    items: T[];
    /** Number of items to load per page */
    pageSize?: number;
    /** Root margin for intersection observer (how far before bottom to trigger) */
    rootMargin?: string;
}

interface UseInfiniteScrollReturn<T> {
    /** Currently visible items */
    visibleItems: T[];
    /** Total number of items */
    totalCount: number;
    /** Whether there are more items to load */
    hasMore: boolean;
    /** Whether currently loading more items */
    isLoading: boolean;
    /** Ref to attach to the sentinel element at the bottom */
    sentinelRef: React.RefObject<HTMLDivElement>;
    /** Manually load more items */
    loadMore: () => void;
    /** Reset to initial state (useful when items change significantly) */
    reset: () => void;
}

/**
 * Hook for infinite scroll pagination of client-side data.
 * Attach the sentinelRef to a div at the bottom of your list.
 */
export function useInfiniteScroll<T>({
    items,
    pageSize = 20,
    rootMargin = "200px",
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const [isLoading, setIsLoading] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const prevItemsLengthRef = useRef(items.length);

    // Reset visible count when items array changes significantly (new data)
    useEffect(() => {
        // If items decreased significantly or reset, reset visible count
        if (items.length < prevItemsLengthRef.current - pageSize) {
            setVisibleCount(pageSize);
        }
        // If items increased and we were showing all, show the new ones too
        else if (prevItemsLengthRef.current === visibleCount && items.length > prevItemsLengthRef.current) {
            setVisibleCount(items.length);
        }
        prevItemsLengthRef.current = items.length;
    }, [items.length, pageSize, visibleCount]);

    const visibleItems = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    const loadMore = useCallback(() => {
        if (!hasMore || isLoading) return;

        setIsLoading(true);
        // Small delay for smooth UX
        setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
            setIsLoading(false);
        }, 100);
    }, [hasMore, isLoading, pageSize, items.length]);

    const reset = useCallback(() => {
        setVisibleCount(pageSize);
    }, [pageSize]);

    // Intersection observer for automatic loading
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && hasMore && !isLoading) {
                    loadMore();
                }
            },
            {
                rootMargin,
                threshold: 0,
            }
        );

        observer.observe(sentinel);

        return () => {
            observer.disconnect();
        };
    }, [hasMore, isLoading, loadMore, rootMargin]);

    return {
        visibleItems,
        totalCount: items.length,
        hasMore,
        isLoading,
        sentinelRef: sentinelRef as React.RefObject<HTMLDivElement>,
        loadMore,
        reset,
    };
}
