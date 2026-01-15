"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function LoginPanel() {
    const [panelVisible, setPanelVisible] = useState(false);
    const [imageVisible, setImageVisible] = useState(false);

    useEffect(() => {
        // Start panel slide-in after a brief delay for view transition to settle
        const panelTimer = setTimeout(() => setPanelVisible(true), 100);

        return () => clearTimeout(panelTimer);
    }, []);

    const handlePanelAnimationEnd = () => {
        // Once panel animation completes, fade in the image
        setImageVisible(true);
    };

    return (
        <div
            className={cn(
                "lg:col-span-2 bg-muted relative hidden lg:block overflow-hidden",
                "transform transition-transform duration-500 ease-out",
                panelVisible ? "translate-x-0" : "translate-x-full"
            )}
            onTransitionEnd={handlePanelAnimationEnd}
        >
            <img
                src="/login-hero.webp"
                alt="ReplyGuys"
                className={cn(
                    "absolute inset-0 h-full w-full object-cover",
                    "transition-opacity duration-700 ease-out",
                    imageVisible ? "opacity-100" : "opacity-0"
                )}
            />
            {/* Gradient overlay for better text contrast if needed */}
            <div
                className={cn(
                    "absolute inset-0 bg-gradient-to-br from-background/20 to-transparent",
                    "transition-opacity duration-700 ease-out",
                    imageVisible ? "opacity-100" : "opacity-0"
                )}
            />
        </div>
    );
}
