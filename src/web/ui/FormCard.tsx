import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { errorMessage } from '../lib/api.ts';
import { Button } from './Button.tsx';
import { FormError } from './FormError.tsx';

/** A form in a card: runs `onSubmit`, shows the error it fails with, and offers to cancel. */
export function FormCard({
    submitLabel,
    onSubmit,
    onCancel,
    children,
}: {
    submitLabel: string;
    onSubmit: () => Promise<void>;
    onCancel: () => void;
    children: ComponentChildren;
}) {
    const [error, setError] = useState<string>();

    async function submit(e: Event) {
        e.preventDefault();
        setError(undefined);
        try {
            await onSubmit();
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    return (
        <form
            class="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5"
            onSubmit={(e) => void submit(e)}
        >
            {children}
            <FormError message={error} />
            <div class="flex gap-2">
                <Button type="submit">{submitLabel}</Button>
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
