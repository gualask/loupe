import { type ReadonlySignal, signal } from '@preact/signals';

export type Confirmation = {
    title: string;
    message?: string;
    /** What the main button does, such as "Delete project". */
    confirmLabel: string;
    /** Irreversible: the main button shows in red. */
    danger?: boolean;
};

type Question = Confirmation & { id: number; resolve: (confirmed: boolean) => void };

const asked = signal<Question | null>(null);
let lastId = 0;

/** The confirmation waiting for an answer, shown by `ConfirmDialogHost`. */
export const askedConfirmation: ReadonlySignal<Question | null> = asked;

/**
 * Asks the user to confirm an action in a dialog, in place of the browser's `confirm()`: resolves
 * to true when they do, false when they cancel.
 */
export function confirmDialog(confirmation: Confirmation) {
    // A new question replaces one left unanswered.
    answerConfirmation(false);
    return new Promise<boolean>((resolve) => {
        asked.value = { ...confirmation, id: ++lastId, resolve };
    });
}

/** Answers the confirmation waiting, if any, and closes it. */
export function answerConfirmation(confirmed: boolean) {
    const question = asked.value;
    asked.value = null;
    question?.resolve(confirmed);
}
