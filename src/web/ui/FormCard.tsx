import type { ComponentChildren } from 'preact';
import { useFormSubmit } from '../lib/form.ts';
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
    const { error, submit } = useFormSubmit(onSubmit);

    return (
        <form
            class="flex max-w-xl flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5"
            onSubmit={submit}
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
