import { describe, expect, it } from 'vitest';
import { answerConfirmation, askedConfirmation, confirmDialog } from './confirm.ts';

const DELETE = { title: 'Delete "Demo"?', confirmLabel: 'Delete project', danger: true };

describe('confirmDialog', () => {
    it('shows the question until it is answered, then resolves to the answer', async () => {
        const confirmed = confirmDialog(DELETE);
        expect(askedConfirmation.value).toMatchObject(DELETE);

        answerConfirmation(true);
        expect(askedConfirmation.value).toBeNull();
        await expect(confirmed).resolves.toBe(true);
    });

    it('resolves to false when cancelled', async () => {
        const confirmed = confirmDialog(DELETE);
        answerConfirmation(false);
        await expect(confirmed).resolves.toBe(false);
    });

    it('cancels a question left unanswered when another one is asked', async () => {
        const first = confirmDialog(DELETE);
        const second = confirmDialog({ title: 'Create a new link?', confirmLabel: 'Create' });
        await expect(first).resolves.toBe(false);
        expect(askedConfirmation.value?.title).toBe('Create a new link?');

        answerConfirmation(true);
        await expect(second).resolves.toBe(true);
    });

    it('ignores an answer when nothing is asked', () => {
        expect(() => answerConfirmation(true)).not.toThrow();
        expect(askedConfirmation.value).toBeNull();
    });
});
