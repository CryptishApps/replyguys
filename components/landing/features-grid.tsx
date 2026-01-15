import { Activity, Clock, MessageCircle } from 'lucide-react'
import { MessageIllustration } from "@/components/landing/message-illustration"
import { PollIllustration } from "@/components/landing/poll-illustration"
import { ProgressIllustration } from "@/components/landing/progress-illustration"

export function FeaturesGrid() {
    return (
        <section id="how-it-works" className="scroll-mt-16">
            <div className=" @container py-24">
                <div className="mx-auto w-full max-w-5xl px-6">
                    <div className="z-10 max-w-xl">
                        <h2 className="mb-4 text-4xl font-semibold">How It Works</h2>
                        <p className="mb-8 text-lg">
                            Add any X post, then let us do the work. <span className="text-muted-foreground">Check back anytime over 24 hours to see your insights build.</span>
                        </p>
                    </div>
                    <div className="@max-4xl:max-w-sm @max-4xl:mx-auto @4xl:grid-cols-3 grid gap-6 *:p-6">
                        <div className="bg-card ring-foreground/10 grid grid-rows-[auto_1fr] space-y-12 overflow-hidden rounded-2xl border border-transparent shadow-md shadow-black/5 ring-1">
                            <div>
                                <MessageCircle className="fill-foreground/10 mb-5 size-4" />
                                <h3 className="text-foreground text-lg font-semibold">Track Any Conversation</h3>
                                <p className="text-muted-foreground mt-3">
                                    Monitor replies on <span className="text-foreground font-medium">any X post</span> — yours or someone else's.
                                </p>
                            </div>
                            <div className="bg-linear-to-b relative -m-8 flex flex-col items-end justify-center from-transparent via-primary/5 to-primary/10 p-8">
                                <MessageIllustration />
                            </div>
                        </div>
                        <div className="bg-card ring-foreground/10 grid grid-rows-[auto_1fr] space-y-12 overflow-hidden rounded-2xl border border-transparent shadow-md shadow-black/5 ring-1">
                            <div>
                                <Clock className="fill-foreground/10 mb-5 size-4" />
                                <h3 className="text-foreground text-lg font-semibold">24-Hour Monitoring</h3>
                                <p className="text-muted-foreground mt-3">
                                    Come back anytime. We monitor for <span className="text-foreground font-medium">24 hours</span>, auto-generating when you hit your threshold.
                                </p>
                            </div>
                            <div className="bg-linear-to-b -m-8 flex flex-col items-end justify-center from-transparent via-emerald-500/5 to-emerald-500/10 p-8">
                                <div className="mt-6 w-full">
                                    <ProgressIllustration />
                                </div>
                            </div>
                        </div>
                        <div className="bg-card ring-foreground/10 grid grid-rows-[auto_1fr] space-y-12 overflow-hidden rounded-2xl border border-transparent shadow-md shadow-black/5 ring-1">
                            <div>
                                <Activity className="fill-foreground/10 mb-5 size-4" />
                                <h3 className="text-foreground text-lg font-semibold">Real-Time Activity</h3>
                                <p className="text-muted-foreground mt-3">
                                    Watch replies flow in <span className="text-foreground font-medium">live</span>. See exactly what's happening with your report.
                                </p>
                            </div>
                            <div className="bg-linear-to-b -m-8 flex flex-col items-end justify-center from-transparent via-amber-500/5 to-amber-500/10 p-8">
                                <div className="w-full px-2">
                                    <PollIllustration />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}