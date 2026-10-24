import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import type { Review } from '../../shared/api/reviews.ts';
import { errorMessage } from '../lib/api.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { FormError } from '../ui/FormError.tsx';
import { TextField } from '../ui/TextField.tsx';

/**
 * First visit: the viewer picks a display name, or skips to get a generated one. The parent
 * closes the dialog once `onSubmit` succeeds.
 */
export function IdentityDialog({
    onSubmit,
    onClose,
}: {
    onSubmit: (displayName: string) => Promise<void>;
    onClose: () => void;
}) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    async function submit(displayName: string) {
        setBusy(true);
        try {
            await onSubmit(displayName);
        } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
        }
    }

    return (
        <Dialog title="Welcome to the review" onClose={onClose}>
            <form
                class="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit(name);
                }}
            >
                <TextField
                    label="Your name"
                    hint="Shown next to your comments to everyone with this link. It is not verified."
                    maxLength={60}
                    value={name}
                    onInput={(e) => setName(e.currentTarget.value)}
                />
                <FormError message={error} />
                <div class="flex justify-end gap-2">
                    <Button variant="ghost" disabled={busy} onClick={() => void submit('')}>
                        Skip
                    </Button>
                    <Button type="submit" disabled={busy || !name.trim()}>
                        Continue
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

const VERDICTS = [
    { value: 'approved', label: 'Approved', hint: 'Good to go as it is.' },
    { value: 'changes_requested', label: 'Changes requested', hint: 'See my comments.' },
] as const;

export function ReviewDialog({
    review,
    onSubmit,
    onClose,
}: {
    review: Review | null;
    onSubmit: (input: { verdict: Review['verdict']; summary: string }) => Promise<boolean>;
    onClose: () => void;
}) {
    const [verdict, setVerdict] = useState(review?.verdict ?? null);
    const [summary, setSummary] = useState(review?.summary ?? '');
    const [busy, setBusy] = useState(false);

    async function submit(e: Event) {
        e.preventDefault();
        setBusy(true);
        if (await onSubmit({ verdict, summary })) onClose();
        else setBusy(false);
    }

    return (
        <Dialog title="Finish your review" onClose={onClose}>
            <form class="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
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
                                <span class="block font-medium">{option.label}</span>
                                <span class="text-stone-500">{option.hint}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                <label class="flex flex-col gap-1.5 font-medium text-sm text-stone-700">
                    Summary (optional)
                    <textarea
                        rows={3}
                        maxLength={5000}
                        value={summary}
                        onInput={(e) => setSummary(e.currentTarget.value)}
                        class="rounded-md border border-stone-300 px-3 py-2 font-normal outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                    />
                </label>
                <div class="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={busy || !verdict}>
                        Submit review
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

const SHORTCUTS = [
    ['P', 'Place a pin'],
    ['C', 'Write a general comment'],
    ['H', 'Show or hide pins'],
    ['Esc', 'Cancel or close'],
    ['?', 'Show this help'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
    return (
        <Dialog title="Keyboard shortcuts" onClose={onClose}>
            <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                {SHORTCUTS.map(([key, action]) => (
                    <Fragment key={key}>
                        <dt>
                            <kbd class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs">
                                {key}
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
