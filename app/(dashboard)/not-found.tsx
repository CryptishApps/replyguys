import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

export default function DashboardNotFound() {
    return (
        <div className="flex-1 flex items-center justify-center py-20">
            <div className="max-w-md text-center space-y-6">
                <div className="space-y-2">
                    <p className="text-8xl font-bold text-primary">404</p>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Not found
                    </h1>
                    <p className="text-muted-foreground">
                        This report doesn&apos;t exist or you don&apos;t have access to it.
                    </p>
                </div>

                <div className="flex justify-center pt-4">
                    <Button asChild>
                        <Link href="/dashboard">
                            <IconArrowLeft className="size-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
