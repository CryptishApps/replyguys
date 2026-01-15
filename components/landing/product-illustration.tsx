'use client'
import Image from 'next/image'
import { ChartBar, Globe, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'motion/react'

type Preview = 'task-management' | 'analytics' | 'ai-copilot'

type PreviewItem = {
    name: Preview
    label: string
    image: string
    icon: React.ReactNode
}

const previews: PreviewItem[] = [
    {
        name: 'task-management',
        label: 'Create Report',
        image: '/screenshots/new-report.webp',
        icon: <Globe />,
    },
    {
        name: 'analytics',
        label: 'Track Replies',
        image: '/screenshots/progress.webp',
        icon: <ChartBar />,
    },
    {
        name: 'ai-copilot',
        label: 'View Insights',
        image: '/screenshots/report.webp',
        icon: <Sparkles />,
    },
]

export const ProductIllustration = () => {
    const [active, setActive] = useState<Preview>('task-management')
    const currentPreview = previews.find((p) => p.name === active)!
    return (
        <div className="@container relative z-10 border-b pt-12 [mask-image:radial-gradient(ellipse_80%_95%_at_50%_0%,#000_80%,transparent_100%)] lg:pt-20">
            <div className="border-border-illustration border-y pb-2">
                <div className="mx-auto max-w-3xl px-11">
                    <div className="divide-border-illustration border-border-illustration relative z-20 grid grid-cols-3 items-center justify-center gap-px divide-x border-x *:h-16">
                        {previews.map((preview) => (
                            <button
                                key={preview.name}
                                onClick={() => setActive(preview.name)}
                                className={cn("group flex cursor-pointer items-center justify-center px-2", active === preview.name ? 'bg-foreground/5 shadow-xl shadow-black/10' : 'group-hover:bg-foreground/5')}>
                                
                                <div className={cn('ring-border-illustration group-active:scale-99 flex h-10 items-center gap-2 rounded px-4 transition-all duration-150 [&>svg]:size-4', active === preview.name ? 'bg-foreground/5 shadow-xl shadow-black/10' : 'group-hover:bg-foreground/5')}>
                                    {preview.icon}
                                    <span className="@max-md:hidden">{preview.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="relative mx-auto -mt-2 max-w-6xl max-md:mx-1 lg:px-10">
                <div className="bg-card ring-foreground/10 sm:aspect-3/2 aspect-square rounded-2xl p-1 shadow-2xl shadow-black/25 ring-1 backdrop-blur">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, scale: 0.995 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.995 }}
                            transition={{ duration: 0.2 }}
                            className="bg-background ring-foreground/5 sm:aspect-3/2 relative aspect-square origin-top overflow-hidden rounded-xl border-4 border-l-8 border-transparent shadow ring-1">
                            <Image
                                className="object-top-left size-full object-contain"
                                src={currentPreview.image}
                                alt={currentPreview.name}
                                width={2880}
                                height={1920}
                                sizes="(max-width: 640px) 768px, (max-width: 768px) 1024px, (max-width: 1024px) 1280px, 1280px"
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}