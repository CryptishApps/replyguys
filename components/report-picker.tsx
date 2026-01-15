"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    IconChevronDown,
    IconPlus,
    IconFileAnalytics,
    IconExternalLink,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ReportStatus = "pending" | "scraping" | "completed" | "failed" | "setting_up";

interface Report {
    id: string;
    conversation_id: string;
    status: ReportStatus;
    created_at: string;
    title: string | null;
}

interface ReportPickerProps {
    reports: Report[] | null;
}

const statusColors: Record<ReportStatus, "secondary" | "default" | "destructive"> = {
    setting_up: "secondary",
    pending: "secondary",
    scraping: "default",
    completed: "default",
    failed: "destructive",
};

function truncateConversationId(id: string) {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function getReportDisplayName(report: Report): string {
    if (report.title) return report.title;
    return truncateConversationId(report.conversation_id);
}

export function ReportPicker({ reports }: ReportPickerProps) {
    const pathname = usePathname();
    const recentReports = reports?.slice(0, 5) ?? [];

    // Extract current report ID from URL path (e.g., /report/abc-123)
    const reportMatch = pathname.match(/^\/report\/([^/]+)/);
    const currentReportId = reportMatch?.[1];

    const currentReport = currentReportId
        ? reports?.find(r => r.id === currentReportId)
        : null;

    const triggerLabel = currentReport
        ? getReportDisplayName(currentReport)
        : "Reports";

    const isOnDashboard = pathname === "/dashboard";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 px-2">
                    <IconFileAnalytics className="size-4" />
                    <span className="font-medium">{triggerLabel}</span>
                    <IconChevronDown className="size-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                {/* Create New Report */}
                <DropdownMenuItem asChild>
                    <Link href="/new" className="w-full flex items-center gap-2 font-medium">
                        <IconPlus className="size-4" />
                        Create New Report
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Recent Reports */}
                <DropdownMenuLabel>Recent Reports</DropdownMenuLabel>

                {recentReports.length > 0 ? (
                    recentReports.map((report) => (
                        <DropdownMenuItem key={report.id} asChild>
                            <Link
                                href={`/report/${report.id}`}
                                className="w-full flex items-center justify-between gap-2"
                            >
                                <span className={`truncate text-xs ${report.title ? "" : "font-mono"}`}>
                                    {getReportDisplayName(report)}
                                </span>
                                <Badge
                                    variant={statusColors[report.status]}
                                    className="text-[10px] px-1.5 py-0"
                                >
                                    {report.status}
                                </Badge>
                            </Link>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No reports yet
                    </div>
                )}

                {/* Show All */}
                {!isOnDashboard && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link
                                href="/dashboard"
                                className="w-full flex items-center gap-2 text-muted-foreground"
                            >
                                <IconExternalLink className="size-4" />
                                Show All Reports
                            </Link>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
