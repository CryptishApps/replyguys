'use client'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { CardTitle, CardDescription } from '@/components/ui/card'

export function Pricing() {
    return (
        <section id="pricing" className="scroll-mt-16">
            <div className="relative py-16 md:py-32">
                <div className="mx-auto max-w-5xl px-6">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl lg:tracking-tight">Simple, Transparent Pricing</h2>
                        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-balance text-lg">Start free and upgrade when you need more power</p>
                    </div>

                    <div className="@container mt-12">
                        <div className="@3xl:max-w-2xl mx-auto max-w-sm">
                            <div className="@3xl:grid-cols-2 grid gap-6 *:p-8">
                                <div className="rounded-(--radius) row-span-4 grid grid-rows-subgrid gap-8 border">
                                    <div className="self-end">
                                        <CardTitle className="text-lg font-medium">Free</CardTitle>
                                        <div className="text-muted-foreground mt-1 text-balance text-sm">Perfect for trying out ReplyGuys</div>
                                    </div>

                                    <div>
                                        <span className="text-3xl font-semibold">$0</span>
                                        <div className="text-muted-foreground text-sm">Forever free</div>
                                    </div>
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="w-full">
                                        <Link href="/new">Get Started</Link>
                                    </Button>

                                    <ul
                                        role="list"
                                        className="space-y-3 text-sm">
                                        {[
                                            '3 reports per month',
                                            'Up to 250 qualified replies',
                                            '24-hour monitoring',
                                            'AI-powered evaluation',
                                            'Basic analytics',
                                        ].map((item, index) => (
                                            <li
                                                key={index}
                                                className="flex items-center gap-2">
                                                <Check
                                                    className="text-muted-foreground size-3"
                                                    strokeWidth={3.5}
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="ring-foreground/10 bg-card rounded-(--radius) row-span-4 grid grid-rows-subgrid gap-8 border-transparent shadow shadow-xl ring-1">
                                    <div className="self-end">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg font-medium">Pro</CardTitle>
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Coming Soon</span>
                                        </div>
                                        <CardDescription className="text-muted-foreground mt-1 text-balance text-sm">For power users who need unlimited insights</CardDescription>
                                    </div>

                                    <div>
                                        <span className="text-3xl font-semibold">$19</span>
                                        <div className="text-muted-foreground text-sm">Per month</div>
                                    </div>
                                    <Button
                                        disabled
                                        className="w-full">
                                        Coming Soon
                                    </Button>

                                    <ul
                                        role="list"
                                        className="space-y-3 text-sm">
                                        {[
                                            'Everything in Free, plus:',
                                            'Unlimited reports',
                                            'Up to 1000 qualified replies',
                                            'Priority processing',
                                            'Advanced analytics',
                                            'Export to CSV',
                                            'Leaderboard features',
                                            'API access',
                                        ].map((item, index) => (
                                            <li
                                                key={index}
                                                className="group flex items-center gap-2 first:font-medium">
                                                <Check
                                                    className="text-muted-foreground size-3 group-first:hidden"
                                                    strokeWidth={3.5}
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
