import { ProductIllustration } from "@/components/landing/product-illustration"
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function HeroSection() {
    return (

        <section className="bg-background relative">
            <div className="mask-b-from-55% mask-b-to-75% mask-t-from-35% mask-t-to-55% absolute inset-0">
                <img
                    src="https://images.unsplash.com/photo-1655823855230-7f3b6bdd72fb?q=80&w=3115&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                    alt="gradient background"
                    className="size-full object-cover object-bottom"
                />
            </div>
            <div className="pb-20 pt-24 md:pt-32 lg:pt-40">
                <div className="relative z-10 mx-auto grid max-w-5xl items-end gap-4 px-6">
                    <div>
                        <h1 className="text-balance text-4xl font-semibold sm:text-5xl md:max-w-4xl lg:text-6xl">Turn X Replies Into Audience Intelligence</h1>
                    </div>
                    <div className="max-w-xl">
                        <p className="text-muted-foreground mb-6 text-balance text-lg lg:text-xl">Paste any X post URL. We'll monitor replies for 24 hours, use AI to evaluate quality, and surface the insights that matter most.</p>
                        <Button asChild>
                            <Link href="/new">Get Started</Link>
                        </Button>
                    </div>
                </div>
                <ProductIllustration />
            </div>
        </section>
    )
}