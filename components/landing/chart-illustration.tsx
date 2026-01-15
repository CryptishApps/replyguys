'use client'
import { Area, AreaChart, XAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const chartConfig = {
    qualified: {
        label: 'Qualified',
        color: 'var(--color-emerald-500)',
    },
    total: {
        label: 'Total Replies',
        color: 'var(--color-indigo-400)',
    },
} satisfies ChartConfig

const chartData = [
    { hour: '6 AM', qualified: 12, total: 45 },
    { hour: '9 AM', qualified: 28, total: 95 },
    { hour: '12 PM', qualified: 47, total: 180 },
    { hour: '3 PM', qualified: 68, total: 290 },
    { hour: '6 PM', qualified: 89, total: 420 },
    { hour: '9 PM', qualified: 112, total: 580 },
]

export const ChartIllustration = () => {
    return (
        <ChartContainer
            className="aspect-auto h-72"
            config={chartConfig}>
            <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                    left: 0,
                    right: 0,
                }}>
                <defs>
                    <linearGradient
                        id="fillQualified"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-qualified)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-qualified)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillTotal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-total)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-total)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                </defs>
                <ChartTooltip
                    active
                    content={<ChartTooltipContent className="dark:bg-muted" />}
                />
                <XAxis
                    dataKey="hour"
                    stroke="var(--color-muted)"
                />
                <Area
                    strokeWidth={1}
                    dataKey="total"
                    type="natural"
                    fill="url(#fillTotal)"
                    fillOpacity={0.1}
                    stroke="var(--color-total)"
                    stackId="a"
                />
                <Area
                    strokeWidth={1}
                    dataKey="qualified"
                    type="natural"
                    fill="url(#fillQualified)"
                    fillOpacity={0.1}
                    stroke="var(--color-qualified)"
                    stackId="a"
                />
            </AreaChart>
        </ChartContainer>
    )
}