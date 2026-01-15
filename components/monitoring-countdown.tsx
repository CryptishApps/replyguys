"use client";

import { useState, useEffect } from "react";
import { IconClock } from "@tabler/icons-react";

interface MonitoringCountdownProps {
    createdAt: string;
    className?: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function formatTimeRemaining(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "ending soon";

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
}

export function MonitoringCountdown({ createdAt, className }: MonitoringCountdownProps) {
    const [formattedTime, setFormattedTime] = useState<string | null>(null);

    useEffect(() => {
        const createdTime = new Date(createdAt).getTime();
        
        // Bail out if date is invalid
        if (!Number.isFinite(createdTime)) {
            return;
        }

        const endTime = createdTime + TWENTY_FOUR_HOURS_MS;

        function updateCountdown() {
            const remaining = endTime - Date.now();
            setFormattedTime(formatTimeRemaining(remaining));
        }

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);

        return () => clearInterval(interval);
    }, [createdAt]);

    if (!formattedTime) return null;

    return (
        <span className={className}>
            <IconClock className="size-3.5 inline-block mr-1 -mt-0.5" />
            {formattedTime}
        </span>
    );
}
