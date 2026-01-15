"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedTabItem {
    value: string;
    label: React.ReactNode;
}

export interface AnimatedTabsProps {
    items: AnimatedTabItem[];
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
}

export function AnimatedTabs({ items, value, onValueChange, className }: AnimatedTabsProps) {
    const [activeTab, setActiveTab] = useState(value || items[0]?.value);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLButtonElement>(null);

    // Sync with controlled value
    useEffect(() => {
        if (value !== undefined) {
            setActiveTab(value);
        }
    }, [value]);

    const handleTabClick = (val: string) => {
        setActiveTab(val);
        onValueChange?.(val);
    };

    useEffect(() => {
        const container = containerRef.current;
        const activeTabElement = activeTabRef.current;

        if (container && activeTabElement) {
            // Get relative position of active tab within the container
            const { offsetLeft, offsetWidth } = activeTabElement;

            // Calculate clip path values without extra padding offset
            const clipLeft = offsetLeft;
            const clipRight = offsetLeft + offsetWidth;

            const containerWidth = container.offsetWidth;
            
            const percentageRight = 100 - (clipRight / containerWidth) * 100;
            const percentageLeft = (clipLeft / containerWidth) * 100;

            container.style.clipPath = `inset(0 ${percentageRight.toFixed(2)}% 0 ${percentageLeft.toFixed(2)}% round 6px)`;
        }
    }, [activeTab, items]);

    return (
        <div className={cn(
            "relative mx-auto flex w-fit flex-col items-center rounded-lg bg-muted/50 border border-border/50 p-1",
            className
        )}>
            {/* Active Layer (Clipped) */}
            <div
                ref={containerRef}
                className="absolute z-10 w-full top-1 bottom-1 overflow-hidden [clip-path:inset(0px_100%_0px_0px_round_6px)] [transition:clip-path_0.3s_ease-in-out] pointer-events-none"
            >
                <div className="relative flex w-full justify-center gap-1">
                    {items.map((item) => (
                        <div
                            key={item.value}
                            className="flex h-8 items-center justify-center rounded-md px-4 text-sm font-medium text-primary-foreground bg-primary shadow-sm whitespace-nowrap"
                            // Use distinct key or ensure exact match with bottom layer layout
                            style={{ opacity: 1 }} 
                        >
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Inactive Layer (Base) */}
            <div className="relative flex w-full justify-center gap-1">
                {items.map((item) => {
                    const isActive = activeTab === item.value;

                    return (
                        <button
                            key={item.value}
                            ref={isActive ? activeTabRef : null}
                            onClick={() => handleTabClick(item.value)}
                            className={cn(
                                "flex h-8 items-center justify-center cursor-pointer rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isActive && "text-transparent hover:text-transparent" // Hide text here so clipped version shows through? Or just let clipped version sit on top.
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
