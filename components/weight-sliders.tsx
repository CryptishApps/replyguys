"use client";

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { IconLock } from "@tabler/icons-react";
import { WEIGHT_PRESETS, type PresetName, type Weights } from "@/lib/ai/schemas";
import { usePrevious } from "@/hooks/use-previous";

interface WeightSlidersProps {
    preset: PresetName | "custom";
    onWeightsChange: (weights: Weights) => void;
    disabled?: boolean;
}

const METRIC_LABELS: Record<keyof Weights, { label: string; description: string }> = {
    actionability: {
        label: "Actionability",
        description: "Specific steps or suggestions toward your goal",
    },
    specificity: {
        label: "Specificity",
        description: "Concrete details that inform your goal",
    },
    substantiveness: {
        label: "Substantiveness",
        description: "Goes beyond surface reactions with reasoning",
    },
    constructiveness: {
        label: "Constructiveness",
        description: "Advances understanding of your objective",
    },
};

export function WeightSliders({
    preset,
    onWeightsChange,
    disabled = false,
}: WeightSlidersProps) {
    const isCustom = preset === "custom";
    const [customWeights, setCustomWeights] = useState<Weights>(WEIGHT_PRESETS.balanced);
    const prevPreset = usePrevious(preset);

    // Display weights based on preset or custom
    const displayWeights = isCustom ? customWeights : WEIGHT_PRESETS[preset];

    // Only sync weights when preset actually changes (not on mount)
    useEffect(() => {
        if (prevPreset !== undefined && prevPreset !== preset) {
            onWeightsChange(displayWeights);
        }
    }, [preset, prevPreset, displayWeights, onWeightsChange]);

    const handleWeightChange = (metric: keyof Weights, value: number[]) => {
        if (!isCustom) return;
        const newWeights = { ...customWeights, [metric]: value[0] };
        setCustomWeights(newWeights);
        onWeightsChange(newWeights);
    };

    return (
        <div className="space-y-4">
            {!isCustom && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    <IconLock className="size-3.5" />
                    <span>Select &quot;Custom&quot; above to adjust weights</span>
                </div>
            )}
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
                            {displayWeights[metric]}
                        </span>
                    </div>
                    <Slider
                        id={metric}
                        value={[displayWeights[metric]]}
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
