import { cn } from "@/lib/utils";
import Image from "next/image";

import logoBlack from '@/assets/images/logo-black.webp';
import logoWhite from '@/assets/images/logo-white.webp';

export function Logo({ includeText = true, size = "default" }: { includeText?: boolean, size?: "default" | "sm" | "lg" }) {
    const imageSize = size === "default" ? 24 : size === "sm" ? 16 : 32;
    return (
        <div className="flex items-center gap-2 font-medium">
            <div className={cn("flex items-center justify-center rounded-md", size === "default" ? "size-6" : size === "sm" ? "size-4" : "size-8")}>
                <Image src={logoBlack} alt="ReplyGuys" width={imageSize} height={imageSize} className="block dark:hidden" />
                <Image src={logoWhite} alt="ReplyGuys" width={imageSize} height={imageSize} className="hidden dark:block" />
            </div>
            {includeText && <span className="hidden md:inline text-lg font-bold">ReplyGuys</span>}
        </div>
    )
}

export function LogoIcon({ uniColor, className, ...props }: { uniColor?: boolean; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex items-center justify-center", className)} {...props}>
            <Image 
                src={uniColor ? logoWhite : logoBlack} 
                alt="" 
                width={512} 
                height={512} 
                className={cn("opacity-5", uniColor ? "block" : "block dark:hidden")}
            />
            {!uniColor && (
                <Image 
                    src={logoWhite} 
                    alt="" 
                    width={512} 
                    height={512} 
                    className="hidden dark:block opacity-5"
                />
            )}
        </div>
    )
}