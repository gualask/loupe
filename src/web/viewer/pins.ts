import type { PinAnchor } from '../../shared/anchor.ts';
import type { Author, Thread } from '../../shared/api/reviews.ts';
import type { BridgePin } from '../../shared/bridge-protocol.ts';
import { authorColor } from '../lib/colors.ts';

/** Id of the pin being placed, before its thread exists. */
export const DRAFT_PIN = 'draft';

/** The number shown on each pin thread. */
export function pinLabels(threads: Thread[]) {
    // A pin not saved yet shows the next number, which the server normally confirms.
    let next = Math.max(0, ...threads.map((t) => t.number ?? 0));
    const pins = threads.filter((t) => t.kind === 'pin');
    return new Map(pins.map((t) => [t.id, String(t.number ?? ++next)]));
}

/** The pins to draw in the mockup: those of the listed threads, the open one and the draft. */
export function bridgePins({
    threads,
    listed,
    labels,
    openId,
    draft,
}: {
    threads: Thread[];
    listed: Thread[];
    labels: Map<string, string>;
    openId: string | null;
    draft: { anchor: PinAnchor; author: Author } | null;
}): BridgePin[] {
    const pins: BridgePin[] = threads
        // The open thread stays visible even when it no longer matches the filter.
        .filter((t) => t.kind === 'pin' && t.anchor && (listed.includes(t) || t.id === openId))
        .map((t) => ({
            id: t.id,
            anchor: t.anchor as PinAnchor,
            label: labels.get(t.id) ?? '',
            color: authorColor(t.author),
            muted: t.status === 'resolved',
            active: t.id === openId,
        }));
    if (draft) {
        pins.push({
            id: DRAFT_PIN,
            anchor: draft.anchor,
            label: '+',
            color: authorColor(draft.author),
            muted: false,
            active: true,
        });
    }
    return pins;
}
