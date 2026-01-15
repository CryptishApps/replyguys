import { Logo, LogoIcon } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export function FooterSection() {
    return (
        <>
            <section className="bg-linear-to-b from-background to-muted relative from-50% to-50% pt-12 md:pt-24">
                <div className="mx-auto max-w-5xl px-6">
                    <Card className="relative overflow-hidden p-12 shadow-lg md:px-32 md:py-20">
                        <LogoIcon
                            uniColor
                            aria-hidden
                            className="text-muted pointer-events-none absolute inset-0 size-full translate-y-3/4"
                        />
                        <div className="relative text-center">
                            <h2 className="text-balance text-3xl font-semibold md:text-4xl">Stop Missing the Signal</h2>
                            <p className="text-muted-foreground mb-6 mt-4 text-balance">Your next viral insight is buried in your replies. Let AI surface it for you.</p>

                            <Button asChild size="lg">
                                <Link href="/new">Create Your First Report</Link>
                            </Button>
                            <p className="text-muted-foreground mt-4 text-sm">Free to start · No credit card required</p>
                        </div>
                    </Card>
                </div>
            </section>
            <footer
                role="contentinfo"
                className="bg-muted py-12 sm:py-20">
                <div className="mx-auto max-w-5xl space-y-8 px-6">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <Link
                            href="/"
                            aria-label="go home"
                            className="block size-fit">
                            <Logo />
                        </Link>

                        <div className="flex items-center gap-4">
                            <Link
                                href="https://x.com/replyguys"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="X/Twitter"
                                className="text-muted-foreground hover:text-primary block">
                                <svg
                                    className="size-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="1em"
                                    height="1em"
                                    viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M10.488 14.651L15.25 21h7l-7.858-10.478L20.93 3h-2.65l-5.117 5.886L8.75 3h-7l7.51 10.015L2.32 21h2.65zM16.25 19L5.75 5h2l10.5 14z"></path>
                                </svg>
                            </Link>
                        </div>
                    </div>

                    <div
                        aria-hidden
                        className="h-px bg-[length:6px_1px] bg-repeat-x opacity-25 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)]"
                    />

                    <div className="flex flex-wrap justify-between gap-4">
                        <span className="text-muted-foreground text-sm">© {new Date().getFullYear()} ReplyGuys</span>
                        <span className="text-muted-foreground text-sm">Built by <a href="https://x.com/andylower_" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@andylower_</a></span>
                    </div>
                </div>
            </footer>
        </>
    )
}
