"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ViewTransition } from "react";
import { Button } from "@/components/ui/button";
import { IconBrandX } from "@tabler/icons-react";

interface AuthButtonProps {
    size?: "sm" | "lg" | "default";
    children: React.ReactNode;
}

export function AuthButton({ size = "default", children }: AuthButtonProps) {
    const router = useRouter();
    const [shouldAnimate, setShouldAnimate] = useState(false);

    useEffect(() => {
        if (shouldAnimate) {
            // Navigate after the ViewTransition name is applied
            router.push("/login");
        }
    }, [shouldAnimate, router]);

    const handleClick = () => {
        setShouldAnimate(true);
    };

    const button = (
        <Button size={size} onClick={handleClick}>
            <IconBrandX className={size === "lg" ? "size-5" : "size-4"} />
            {children}
        </Button>
    );

    // Only wrap with ViewTransition when this button was clicked
    if (shouldAnimate) {
        return <ViewTransition name="auth-button">{button}</ViewTransition>;
    }

    return button;
}
