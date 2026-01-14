"use client";

import { useActionState } from "react";
import { createReport } from "@/app/(dashboard)/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IconLoader2, IconSettings } from "@tabler/icons-react";

export function ReportForm() {
    const [state, formAction, isPending] = useActionState(
        async (_: unknown, formData: FormData) => {
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
                        />
                        <FieldDescription>
                            Paste the full URL of the X post you want to analyze
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
                            Number of useful replies to collect (max 250)
                        </FieldDescription>
                    </Field>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="advanced" className="border-none">
                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <IconSettings className="size-4" />
                                    Advanced Settings
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
