import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'

export const ReportIllustration = ({ className }: { className?: string }) => {
    return (
        <div
            aria-hidden
            className="relative">
            <div className={cn('mask-b-from-65% before:bg-background before:border-border after:border-border after:bg-background/50 before:z-1 group relative -mx-4 px-4 pt-6 before:absolute before:inset-x-6 before:bottom-0 before:top-4 before:rounded-2xl before:border after:absolute after:inset-x-9 after:bottom-0 after:top-2 after:rounded-2xl after:border', className)}>
                <div className="bg-illustration ring-border-illustration relative z-10 overflow-hidden rounded-2xl border border-transparent text-sm shadow-xl shadow-black/10">
                    {/* Header with avatar and status */}
                    <div className="flex items-start justify-between p-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-muted-foreground font-bold text-sm">S</span>
                            </div>
                            <div className="space-y-1">
                                <div className="bg-border h-2.5 w-20 rounded-full" />
                                <div className="bg-border/60 h-2 w-12 rounded-full" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Completed</span>
                        </div>
                    </div>

                    {/* Title and description placeholders */}
                    <div className="px-4 pb-4 space-y-2">
                        <div className="bg-border h-3 w-3/4 rounded-full" />
                        <div className="bg-border/60 h-2.5 w-full rounded-full" />
                        <div className="bg-border/60 h-2.5 w-2/3 rounded-full" />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 border-t border-border text-center">
                        <div className="py-3 px-2">
                            <p className="font-semibold text-foreground">248</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="py-3 px-2 border-x border-border">
                            <p className="font-semibold text-foreground">47</p>
                            <p className="text-xs text-muted-foreground">Qualified</p>
                        </div>
                        <div className="py-3 px-2">
                            <p className="font-semibold text-foreground">72</p>
                            <p className="text-xs text-muted-foreground">Quality</p>
                        </div>
                    </div>

                    {/* Footer with logo */}
                    <div className="border-t border-border p-3 flex items-center justify-center">
                        <Logo includeText={false} size="sm" />
                    </div>
                </div>
            </div>
        </div>
    )
}