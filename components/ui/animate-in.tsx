"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface AnimateInProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
    as?: "div" | "section" | "article" | "li";
}

const variants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
};

export function AnimateIn({
    children,
    delay = 0,
    duration = 0.4,
    className,
    as = "div",
}: AnimateInProps) {
    const Component = motion[as];

    return (
        <Component
            initial="hidden"
            animate="visible"
            variants={variants}
            transition={{
                duration,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={className}
        >
            {children}
        </Component>
    );
}

interface StaggerContainerProps {
    children: ReactNode;
    staggerDelay?: number;
    className?: string;
    as?: "div" | "section" | "ul";
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
};

export function StaggerContainer({
    children,
    staggerDelay = 0.08,
    className,
    as = "div",
}: StaggerContainerProps) {
    const Component = motion[as];

    return (
        <Component
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        staggerChildren: staggerDelay,
                    },
                },
            }}
            className={className}
        >
            {children}
        </Component>
    );
}

export function StaggerItem({
    children,
    className,
    as = "div",
}: Omit<AnimateInProps, "delay" | "duration">) {
    const Component = motion[as];

    return (
        <Component variants={itemVariants} className={className}>
            {children}
        </Component>
    );
}
