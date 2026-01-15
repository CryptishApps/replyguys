import { ChartIllustration } from "@/components/landing/chart-illustration"
import { ReportIllustration } from "@/components/landing/report-illustration"

export function FeaturesSection() {
    return (
        <section className="bg-background">
            <div className="@container py-24">
                <div className="mx-auto max-w-5xl px-6">
                    <div className="ring-foreground/10 @4xl:grid-cols-2 @max-4xl:divide-y @4xl:divide-x relative grid overflow-hidden rounded-2xl border border-transparent bg-card shadow-md shadow-black/5 ring-1">
                        <div className="row-span-2 grid grid-rows-subgrid gap-8">
                            <div className="px-8 pt-8">
                                <h3 className="text-balance font-semibold">Watch Quality Rise Over Time</h3>
                                <p className="text-muted-foreground mt-3">As replies come in, our AI evaluates each one. See total replies climb while qualified insights are curated in real-time.</p>
                            </div>
                            <div className="self-end pb-4">
                                <ChartIllustration />
                            </div>
                        </div>
                        <div className="row-span-2 grid grid-rows-subgrid gap-8">
                            <div className="relative z-10 px-8 pt-8">
                                <h3 className="text-balance font-semibold">Reports That Surface the Signal</h3>
                                <p className="text-muted-foreground mt-3">AI-powered summaries, quality scores, and your top contributors — all in one place.</p>
                            </div>
                            <div className="self-end px-8 pb-8">
                                <ReportIllustration />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}