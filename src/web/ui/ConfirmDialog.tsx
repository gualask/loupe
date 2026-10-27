import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { answerConfirmation, askedConfirmation } from '../lib/confirm.ts';
import { Button } from './Button.tsx';
import { Dialog, DialogActions } from './Dialog.tsx';
import { TEXT } from './styles.ts';

/** Shows the confirmation `confirmDialog` asks for, if any; rendered once, around the whole app. */
export function ConfirmDialogHost() {
    const { url } = useLocation();
    // Leaving the page cancels what it asked, so nothing is confirmed over another page.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `url` cancels on navigation
    useEffect(() => () => answerConfirmation(false), [url]);

    const current = askedConfirmation.value;
    if (!current) return null;

    // Cancel comes first, so it takes focus: Enter does not confirm by accident.
    return (
        <Dialog key={current.id} title={current.title} onClose={() => answerConfirmation(false)}>
            {current.message ? <p class={TEXT.secondary}>{current.message}</p> : null}
            <DialogActions>
                <Button variant="ghost" onClick={() => answerConfirmation(false)}>
                    Cancel
                </Button>
                <Button
                    variant={current.danger ? 'danger' : 'primary'}
                    onClick={() => answerConfirmation(true)}
                >
                    {current.confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
