"use client";

import { useActionState, useState, useCallback } from "react";
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
import { IconLoader2, IconSettings, IconAdjustments, IconFilter } from "@tabler/icons-react";
import { WEIGHT_PRESETS, type PresetName, type Weights } from "@/lib/ai/schemas";

type PresetOption = PresetName | "custom";

const PRESET_OPTIONS: { value: PresetOption; label: string; description: string }[] = [
    { value: "balanced", label: "Balanced", description: "Equal weight to all metrics" },
    { value: "research", label: "Research", description: "Focus on actionable specifics" },
    { value: "ideas", label: "Ideas", description: "Prioritize original thinking" },
    { value: "feedback", label: "Feedback", description: "Constructive and actionable" },
    { value: "custom", label: "Custom", description: "Configure your own weights" },
];

export function ReportForm() {
    const [preset, setPreset] = useState<PresetOption>("balanced");
    const [weights, setWeights] = useState<Weights>(WEIGHT_PRESETS.balanced);

    const handleWeightsChange = useCallback((newWeights: Weights) => {
        setWeights(newWeights);
    }, []);

    const [state, formAction, isPending] = useActionState(
        async (_: unknown, formData: FormData) => {
            // Add weights to form data
            formData.set("weights", JSON.stringify(weights));
            formData.set("preset", preset);
            return createReport(formData);
        },
        null
    );

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
                            disabled={isPending}
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
                            disabled={isPending}
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
                            disabled={isPending}
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
                            disabled={isPending}
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
                                        disabled={isPending}
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
                                    disabled={isPending}
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
                                        disabled={isPending}
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
                                    <Switch id="blueOnly" name="blueOnly" disabled={isPending} />
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
                                        disabled={isPending}
                                    />
                                    <FieldDescription>
                                        Only include replies from accounts with at least this many
                                        followers
                                    </FieldDescription>
                                </Field>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    {state && !state.success && (
                        <p className="text-sm text-destructive">{state.error}</p>
                    )}

                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending ? (
                            <>
                                <IconLoader2 className="size-4 animate-spin" />
                                Creating Report...
                            </>
                        ) : (
                            "Create Report"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
