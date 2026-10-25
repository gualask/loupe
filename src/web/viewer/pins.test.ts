import { describe, expect, it } from 'vitest';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { Author, Thread } from '../../shared/api/reviews.ts';
import { authorColor } from '../lib/colors.ts';
import { bridgePins, DRAFT_PIN, pinLabels } from './pins.ts';

const ANN: Author = { kind: 'viewer', id: 'v1', displayName: 'Ann', colorIndex: 0 };

const ANCHOR: PinAnchor = {
    selector: '#buy',
    offset: { x: 0.5, y: 0.5 },
    point: { x: 10, y: 20 },
    viewport: { width: 1280, height: 800 },
};

function thread(id: string, changes: Partial<Thread> = {}): Thread {
    return {
        id,
        kind: 'pin',
        number: null,
        anchor: ANCHOR,
        status: 'open',
        resolvedAt: null,
        author: ANN,
        createdAt: '2026-01-01T00:00:00.000Z',
        comments: [],
        ...changes,
    };
}

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
            draft: null,
        });
        expect(pins).toEqual([
            {
                id: 'open',
                anchor: ANCHOR,
                label: '1',
                color: authorColor(ANN),
                muted: false,
                active: false,
            },
            {
                id: 'resolved',
                anchor: ANCHOR,
                label: '2',
                color: authorColor(ANN),
                muted: true,
                active: true,
            },
        ]);
    });

    it('adds the pin being placed', () => {
        const pins = bridgePins({
            threads: [],
            listed: [],
            labels,
            openId: null,
            draft: { anchor: ANCHOR, author: ANN },
        });
        expect(pins).toEqual([
            {
                id: DRAFT_PIN,
                anchor: ANCHOR,
                label: '+',
                color: authorColor(ANN),
                muted: false,
                active: true,
            },
        ]);
    });
});
