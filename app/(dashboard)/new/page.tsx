import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportForm } from "@/components/report-form";

export default async function NewReportPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">New Report</h1>
                <p className="text-muted-foreground">
                    Paste an X post URL to analyze its replies
                </p>
            </div>
            <ReportForm />
        </div>
    );
}
