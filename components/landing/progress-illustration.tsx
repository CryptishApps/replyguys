export const ProgressIllustration = () => {
    const totalBars = 38
    const filledBars = Math.round(totalBars * 0.75)

    return (
        <div
            aria-hidden
            className="bg-illustration ring-border-illustration space-y-2.5 rounded-2xl p-4 shadow shadow-black/10 ring-1">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-foreground">75%</span>
            </div>
            <div className="flex justify-between gap-px">
                {Array.from({ length: totalBars }).map((_, index) => (
                    <div
                        key={index}
                        className={`h-7 w-1 rounded ${index < filledBars ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                    />
                ))}
            </div>
        </div>
    )
}