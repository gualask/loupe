import type { PinAnchor } from './anchor.ts';

/** A pin anchor as the bridge records it, for tests. */
export const PIN_ANCHOR: PinAnchor = {
    selector: 'main > button.cta',
    offset: { x: 0.5, y: 0.25 },
    text: 'Get started',
    point: { x: 640, y: 380 },
    viewport: { width: 1440, height: 900 },
};
