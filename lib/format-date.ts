/**
 * Format a date in a friendly, localized format
 * e.g., "6th January 2026 at 12:40pm"
 */
export function formatFriendlyDate(
    date: Date | string,
    options: { includeTime?: boolean } = { includeTime: true }
): string {
    const d = typeof date === "string" ? new Date(date) : date;

    const day = d.getDate();
    const ordinal = getOrdinalSuffix(day);

    const month = d.toLocaleDateString(undefined, { month: "long" });
    const year = d.getFullYear();

    if (!options.includeTime) {
        return `${day}${ordinal} ${month} ${year}`;
    }

    const time = d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).toLowerCase();

    return `${day}${ordinal} ${month} ${year} at ${time}`;
}

function getOrdinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) {
        return "th";
    }
    switch (day % 10) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
        default:
            return "th";
    }
}

/**
 * Format a relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatFriendlyDate(d, { includeTime: false });
}
