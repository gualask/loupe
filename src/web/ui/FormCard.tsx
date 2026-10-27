import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useFormSubmit } from '../lib/form.ts';
import { Button } from './Button.tsx';
import { FormError } from './FormError.tsx';
import { CARD_CLASS } from './styles.ts';

/**
 * A form in a card: runs `onSubmit`, shows the error it fails with, and offers to cancel. Its
 * first field takes focus, as the form usually replaces the button that opened it.
 */
export function FormCard({
    submitLabel,
    onSubmit,
    onCancel,
    children,
}: {
    submitLabel: string;
    onSubmit: () => Promise<unknown>;
    onCancel: () => void;
    children: ComponentChildren;
}) {
    const { error, pending, submit } = useFormSubmit(onSubmit);
    const form = useRef<HTMLFormElement>(null);

    useEffect(
        () => form.current?.querySelector<HTMLElement>('input, textarea, select')?.focus(),
        [],
    );

    return (
        <form ref={form} class={`flex max-w-xl flex-col gap-4 p-5 ${CARD_CLASS}`} onSubmit={submit}>
            {children}
            <FormError message={error} />
            <div class="flex gap-2">
                <Button type="submit" disabled={pending}>
                    {submitLabel}
                </Button>
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
