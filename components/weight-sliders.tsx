"use client";

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { WEIGHT_PRESETS, type PresetName, type Weights } from "@/lib/ai/schemas";

interface WeightSlidersProps {
    preset: PresetName | "custom";
    onWeightsChange: (weights: Weights) => void;
    disabled?: boolean;
}

const METRIC_LABELS: Record<keyof Weights, { label: string; description: string }> = {
    actionability: {
        label: "Actionability",
        description: "Specific steps or suggestions",
    },
    specificity: {
        label: "Specificity",
        description: "Details, examples, or data",
    },
    originality: {
        label: "Originality",
        description: "Unique perspectives or fresh insights",
    },
    constructiveness: {
        label: "Constructiveness",
        description: "Adds value to the conversation",
    },
};

export function WeightSliders({
    preset,
    onWeightsChange,
    disabled = false,
}: WeightSlidersProps) {
    const initialWeights =
        preset === "custom"
            ? WEIGHT_PRESETS.balanced
            : WEIGHT_PRESETS[preset];

    const [weights, setWeights] = useState<Weights>(initialWeights);

    useEffect(() => {
        if (preset !== "custom") {
            const presetWeights = WEIGHT_PRESETS[preset];
            setWeights(presetWeights);
            onWeightsChange(presetWeights);
        }
    }, [preset, onWeightsChange]);

    const handleWeightChange = (metric: keyof Weights, value: number[]) => {
        const newWeights = { ...weights, [metric]: value[0] };
        setWeights(newWeights);
        onWeightsChange(newWeights);
    };

    const isCustom = preset === "custom";

    return (
        <div className="space-y-4">
            {(Object.keys(METRIC_LABELS) as Array<keyof Weights>).map((metric) => (
                <div key={metric} className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label
                            htmlFor={metric}
                            className={!isCustom ? "text-muted-foreground" : ""}
                        >
                            {METRIC_LABELS[metric].label}
                        </Label>
                        <span className="text-sm tabular-nums text-muted-foreground">
                            {weights[metric]}
                        </span>
                    </div>
                    <Slider
                        id={metric}
                        value={[weights[metric]]}
                        onValueChange={(value) => handleWeightChange(metric, value)}
                        min={0}
                        max={100}
                        step={5}
                        disabled={disabled || !isCustom}
                        className={!isCustom ? "opacity-50" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                        {METRIC_LABELS[metric].description}
                    </p>
                </div>
            ))}
        </div>
    );
}
