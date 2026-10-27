import type { ComponentChildren } from 'preact';
import { useFormSubmit } from '../lib/form.ts';
import { Button } from './Button.tsx';
import { Dialog, DialogActions } from './Dialog.tsx';
import { FormError } from './FormError.tsx';

/**
 * A form in a dialog: runs `onSubmit` and shows the error it fails with. Its first field takes
 * focus. The caller closes it once `onSubmit` succeeds.
 */
export function FormDialog({
    title,
    submitLabel,
    canSubmit = true,
    onSubmit,
    onClose,
    children,
}: {
    title: string;
    submitLabel: string;
    canSubmit?: boolean;
    onSubmit: () => Promise<unknown>;
    onClose: () => void;
    children: ComponentChildren;
}) {
    const { error, pending, submit } = useFormSubmit(onSubmit);

    return (
        <Dialog title={title} busy={pending} onClose={onClose}>
            <form onSubmit={submit}>
                <div class="flex flex-col gap-4">
                    {children}
                    <FormError message={error} />
                </div>
                <DialogActions>
                    <Button variant="ghost" disabled={pending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={pending || !canSubmit}>
                        {submitLabel}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
