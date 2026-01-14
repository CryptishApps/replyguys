"use client";

import { formatFriendlyDate } from "@/lib/format-date";

interface FriendlyDateProps {
    date: string;
}

/**
 * Client component that formats a date in the user's local timezone.
 * Shows format like "6th January 2026 at 12:40pm"
 */
export function FriendlyDate({ date }: FriendlyDateProps) {
    return <>{formatFriendlyDate(date)}</>;
}
