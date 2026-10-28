import { describe, expect, it } from 'vitest';
import { PIN_ANCHOR } from '../../shared/test-fixtures.ts';
import { authorColor } from '../lib/colors.ts';
import { ANN, thread } from '../test-utils.ts';
import { bridgePins, DRAFT_PIN, pinLabels } from './pins.ts';

describe('pinLabels', () => {
    it('keeps server numbers and numbers unsaved pins after the highest one', () => {
        const threads = [
            thread('a', { number: 2 }),
            thread('general', { kind: 'general', anchor: null, number: 3 }),
            thread('b', { number: 5 }),
            thread('unsaved'),
        ];
        expect(pinLabels(threads)).toEqual(
            new Map([
                ['a', '2'],
                ['b', '5'],
                ['unsaved', '6'],
            ]),
        );
    });
});

describe('bridgePins', () => {
    const open = thread('open', { number: 1 });
    const resolved = thread('resolved', { number: 2, status: 'resolved' });
    const threads = [open, resolved];
    const labels = pinLabels(threads);

    it('draws the listed pins, plus the open one even when filtered out', () => {
        const pins = bridgePins({
            threads,
            listed: [open],
            labels,
            openId: 'resolved',
            hidden: false,
            draft: null,
        });
        expect(pins).toEqual([
            {
                id: 'open',
                anchor: PIN_ANCHOR,
                label: '1',
                color: authorColor(ANN),
                muted: false,
                active: false,
                hidden: false,
            },
            {
                id: 'resolved',
                anchor: PIN_ANCHOR,
                label: '2',
                color: authorColor(ANN),
                muted: true,
                active: true,
                hidden: false,
            },
        ]);
    });

    it('adds the pin being placed, drawn even when the others are hidden', () => {
        const pins = bridgePins({
            threads,
            listed: [open],
            labels,
            openId: null,
            hidden: true,
            draft: { anchor: PIN_ANCHOR, author: ANN },
        });
        expect(pins.map(({ id, hidden }) => ({ id, hidden }))).toEqual([
            { id: 'open', hidden: true },
            { id: DRAFT_PIN, hidden: false },
        ]);
        expect(pins[1]).toEqual({
            id: DRAFT_PIN,
            anchor: PIN_ANCHOR,
            label: '+',
            color: authorColor(ANN),
            muted: false,
            active: true,
            hidden: false,
        });
    });
});
