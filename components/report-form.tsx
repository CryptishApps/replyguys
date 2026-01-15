"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { createReport } from "@/app/(dashboard)/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WeightSliders } from "@/components/weight-sliders";
import { IconLoader2, IconAdjustments, IconFilter, IconClock } from "@tabler/icons-react";
import { WEIGHT_PRESETS, type PresetName, type Weights } from "@/lib/ai/schemas";

type PresetOption = PresetName | "custom";

const PRESET_OPTIONS: { value: PresetOption; label: string; description: string }[] = [
    { value: "balanced", label: "Balanced", description: "Equal weight to all metrics" },
    { value: "research", label: "Research", description: "Focus on actionable specifics" },
    { value: "ideas", label: "Ideas", description: "Prioritize original thinking" },
    { value: "feedback", label: "Feedback", description: "Constructive and actionable" },
    { value: "custom", label: "Custom", description: "Configure your own weights" },
];

function RateLimitCountdown({ retryAfter, onExpire }: { retryAfter: string; onExpire: () => void }) {
    const [secondsLeft, setSecondsLeft] = useState(() => {
        const diff = new Date(retryAfter).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / 1000));
    });

    useEffect(() => {
        if (secondsLeft <= 0) {
            onExpire();
            return;
        }

        const timer = setInterval(() => {
            const diff = new Date(retryAfter).getTime() - Date.now();
            const remaining = Math.max(0, Math.ceil(diff / 1000));
            setSecondsLeft(remaining);
            if (remaining <= 0) {
                onExpire();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [retryAfter, secondsLeft, onExpire]);

    return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-center size-12 rounded-full bg-amber-500/20 text-amber-500">
                <IconClock className="size-6" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-amber-500">Rate limit reached</p>
                <p className="text-sm text-muted-foreground">
                    You can create another report in{" "}
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                        {secondsLeft}s
                    </span>
                </p>
            </div>
        </div>
    );
}

export function ReportForm() {
    const [preset, setPreset] = useState<PresetOption>("balanced");
    const [weights, setWeights] = useState<Weights>(WEIGHT_PRESETS.balanced);
    const [rateLimitedUntil, setRateLimitedUntil] = useState<string | null>(null);

    const handleWeightsChange = useCallback((newWeights: Weights) => {
        setWeights(newWeights);
    }, []);

    const handleRateLimitExpire = useCallback(() => {
        setRateLimitedUntil(null);
    }, []);

    const [state, formAction, isPending] = useActionState(
        async (_: unknown, formData: FormData) => {
            // Add weights to form data
            formData.set("weights", JSON.stringify(weights));
            formData.set("preset", preset);
            const result = await createReport(formData);
            
            // Handle rate limiting
            if (!result.success && "rateLimited" in result && result.rateLimited) {
                setRateLimitedUntil(result.retryAfter);
            }
            
            return result;
        },
        null
    );

    const isDisabled = isPending || !!rateLimitedUntil;

    return (
        <Card>
            <CardHeader>
                <CardTitle>New Report</CardTitle>
                <CardDescription>
                    Enter the URL of an X post to scrape and analyze its replies
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-4">
                    <Field>
                        <FieldLabel htmlFor="url">Post URL</FieldLabel>
                        <Input
                            id="url"
                            name="url"
                            type="url"
                            placeholder="https://x.com/username/status/1234567890"
                            required
                            disabled={isDisabled}
                            pattern="https?://(www\.|mobile\.)?(x\.com|twitter\.com)/[a-zA-Z0-9_]+/status/\d+.*"
                            title="Enter an X/Twitter post URL (e.g., https://x.com/username/status/1234567890)"
                        />
                        <FieldDescription>
                            Paste the full URL of the X post you want to analyze
                        </FieldDescription>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="goal">Goal</FieldLabel>
                        <Textarea
                            id="goal"
                            name="goal"
                            placeholder="What do you want to learn from these replies? e.g., 'Understand what features users want most' or 'Find common pain points with the current product'"
                            required
                            disabled={isDisabled}
                            className="min-h-20"
                        />
                        <FieldDescription>
                            This helps the AI understand what insights matter most to you
                        </FieldDescription>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="persona">Target Audience (optional)</FieldLabel>
                        <Input
                            id="persona"
                            name="persona"
                            type="text"
                            placeholder="e.g., SaaS founders, indie hackers, marketers"
                            disabled={isDisabled}
                        />
                        <FieldDescription>
                            Who are you trying to reach? This helps prioritize relevant feedback
                        </FieldDescription>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="replyThreshold">Reply Threshold</FieldLabel>
                        <Input
                            id="replyThreshold"
                            name="replyThreshold"
                            type="number"
                            min={1}
                            max={250}
                            defaultValue={100}
                            disabled={isDisabled}
                        />
                        <FieldDescription>
                            Minimum qualified replies before generating summary. May collect more for a richer analysis.
                        </FieldDescription>
                    </Field>

                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="weights" className="border-none">
                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <IconAdjustments className="size-4" />
                                    Evaluation Weights
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <Field>
                                    <FieldLabel htmlFor="preset">Preset</FieldLabel>
                                    <Select
                                        value={preset}
                                        onValueChange={(value) => setPreset(value as PresetOption)}
                                        disabled={isDisabled}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRESET_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        {PRESET_OPTIONS.find((o) => o.value === preset)?.description}
                                    </FieldDescription>
                                </Field>

                                <WeightSliders
                                    preset={preset}
                                    onWeightsChange={handleWeightsChange}
                                    disabled={isDisabled}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="advanced" className="border-none">
                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <IconFilter className="size-4" />
                                    Filter Settings
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <Field>
                                    <FieldLabel htmlFor="minLength">
                                        Minimum Reply Length
                                    </FieldLabel>
                                    <Input
                                        id="minLength"
                                        name="minLength"
                                        type="number"
                                        min={0}
                                        defaultValue={0}
                                        placeholder="0"
                                        disabled={isDisabled}
                                    />
                                    <FieldDescription>
                                        Only include replies with at least this many characters
                                    </FieldDescription>
                                </Field>

                                <div className="flex items-center justify-between py-2">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="blueOnly" className="text-sm font-medium">
                                            Blue Verified Only
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Only include replies from X Premium subscribers
                                        </p>
                                    </div>
                                    <Switch id="blueOnly" name="blueOnly" disabled={isDisabled} />
                                </div>

                                <Field>
                                    <FieldLabel htmlFor="minFollowers">
                                        Minimum Followers
                                    </FieldLabel>
                                    <Input
                                        id="minFollowers"
                                        name="minFollowers"
                                        type="number"
                                        min={0}
                                        placeholder="Optional"
                                        disabled={isDisabled}
                                    />
                                    <FieldDescription>
                                        Only include replies from accounts with at least this many
                                        followers
                                    </FieldDescription>
                                </Field>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    {rateLimitedUntil ? (
                        <RateLimitCountdown
                            retryAfter={rateLimitedUntil}
                            onExpire={handleRateLimitExpire}
                        />
                    ) : (
                        state && !state.success && (
                            <p className="text-sm text-destructive">{state.error}</p>
                        )
                    )}

                    <Button type="submit" disabled={isDisabled} className="w-full">
                        {isPending ? (
                            <>
                                <IconLoader2 className="size-4 animate-spin" />
                                Creating Report...
                            </>
                        ) : rateLimitedUntil ? (
                            "Please wait..."
                        ) : (
                            "Create Report"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
