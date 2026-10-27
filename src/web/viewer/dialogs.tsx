import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import type { Review } from '../../shared/api/reviews.ts';
import { useAction, useFormSubmit } from '../lib/form.ts';
import { VERDICT_LABELS } from '../lib/review.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { Field } from '../ui/Field.tsx';
import { FormError } from '../ui/FormError.tsx';
import { Textarea } from '../ui/Input.tsx';
import { Notice } from '../ui/Notice.tsx';
import { TextField } from '../ui/TextField.tsx';
import { NewVersionNotice } from './NewVersionNotice.tsx';
import { SHORTCUTS } from './shortcuts.ts';

/** The viewer's display name, shown next to their comments; the parent closes it on success. */
export function NameDialog({
    current,
    onSubmit,
    onClose,
}: {
    current: string;
    onSubmit: (displayName: string) => Promise<void>;
    onClose: () => void;
}) {
    const [name, setName] = useState(current);
    const { error, pending, run } = useAction();

    return (
        <Dialog title="Your name" onClose={onClose}>
            <form
                class="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    run(() => onSubmit(name));
                }}
            >
                <TextField
                    label="Name"
                    hint="Shown next to your comments and pins to everyone with this link. It is not verified."
                    maxLength={60}
                    value={name}
                    onInput={(e) => setName(e.currentTarget.value)}
                    // Typing replaces the current name, often a generated one.
                    onFocus={(e) => e.currentTarget.select()}
                />
                <FormError message={error} />
                <div class="flex justify-end gap-2">
                    <Button variant="ghost" disabled={pending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={pending || !name.trim()}>
                        Save
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

const VERDICTS = [
    { value: 'approved', hint: 'Good to go as it is.' },
    { value: 'changes_requested', hint: 'See my comments.' },
] as const;

export function ReviewDialog({
    review,
    outdated,
    onSubmit,
    onClose,
}: {
    review: Review | null;
    /** A newer version was uploaded: the review goes to that one, after a reload. */
    outdated: boolean;
    onSubmit: (input: { verdict: Review['verdict']; summary: string }) => Promise<boolean>;
    onClose: () => void;
}) {
    const [verdict, setVerdict] = useState(review?.verdict ?? null);
    const [summary, setSummary] = useState(review?.summary ?? '');
    // Rejections are reported by the review space, so the dialog only closes on success.
    const { pending, submit } = useFormSubmit(async () => {
        if (await onSubmit({ verdict, summary })) onClose();
    });

    return (
        <Dialog title="Finish your review" onClose={onClose}>
            <form class="flex flex-col gap-4" onSubmit={submit}>
                <fieldset class="flex flex-col gap-2">
                    <legend class="sr-only">Verdict</legend>
                    {VERDICTS.map((option) => (
                        <label
                            key={option.value}
                            class={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${verdict === option.value ? 'border-stone-900 bg-stone-50' : 'border-stone-200'}`}
                        >
                            <input
                                type="radio"
                                name="verdict"
                                class="mt-0.5"
                                checked={verdict === option.value}
                                onChange={() => setVerdict(option.value)}
                            />
                            <span>
                                <span class="block font-medium">
                                    {VERDICT_LABELS[option.value]}
                                </span>
                                <span class="text-stone-500">{option.hint}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                <Field label="Summary (optional)">
                    {(control) => (
                        <Textarea
                            {...control}
                            rows={3}
                            maxLength={5000}
                            value={summary}
                            onInput={(e) => setSummary(e.currentTarget.value)}
                        />
                    )}
                </Field>
                {outdated ? (
                    <Notice tone="warning">
                        <NewVersionNotice />
                    </Notice>
                ) : null}
                <div class="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={pending || !verdict || outdated}>
                        Submit review
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
    return (
        <Dialog title="Keyboard shortcuts" onClose={onClose}>
            <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                {Object.values(SHORTCUTS).map(({ label, action }) => (
                    <Fragment key={label}>
                        <dt>
                            <kbd class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs">
                                {label}
                            </kbd>
                        </dt>
                        <dd class="text-stone-700">{action}</dd>
                    </Fragment>
                ))}
            </dl>
            <div class="mt-6 flex justify-end">
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </div>
        </Dialog>
    );
}
