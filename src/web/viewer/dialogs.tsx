import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogActions } from '../ui/Dialog.tsx';
import { FormDialog } from '../ui/FormDialog.tsx';
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

    return (
        <FormDialog
            title="Your name"
            submitLabel="Save"
            canSubmit={name.trim() !== ''}
            onSubmit={() => onSubmit(name)}
            onClose={onClose}
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
        </FormDialog>
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
            <DialogActions>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
