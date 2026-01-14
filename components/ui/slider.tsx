"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
    className,
    defaultValue,
    value,
    min = 0,
    max = 100,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    const _values = value ?? defaultValue ?? [min];

    return (
        <SliderPrimitive.Root
            data-slot="slider"
            defaultValue={defaultValue}
            value={value}
            min={min}
            max={max}
            className={cn(
                "relative flex w-full touch-none items-center select-none",
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="bg-primary absolute h-full"
                />
            </SliderPrimitive.Track>
            {_values.map((_, i) => (
                <SliderPrimitive.Thumb
                    key={i}
                    data-slot="slider-thumb"
                    className="border-primary/50 bg-background focus-visible:ring-ring block size-4 rounded-full border shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                />
            ))}
        </SliderPrimitive.Root>
    );
}

export { Slider };
