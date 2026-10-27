import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { useAction } from '../lib/form.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { FormError } from '../ui/FormError.tsx';
import { Kbd } from '../ui/Kbd.tsx';
import { TextField } from '../ui/TextField.tsx';
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

export function HelpDialog({ onClose }: { onClose: () => void }) {
    return (
        <Dialog title="Keyboard shortcuts" onClose={onClose}>
            <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                {Object.values(SHORTCUTS).map(({ label, action }) => (
                    <Fragment key={label}>
                        <dt>
                            <Kbd>{label}</Kbd>
                        </dt>
                        <dd>{action}</dd>
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
