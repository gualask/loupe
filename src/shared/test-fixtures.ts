import type { PinAnchor } from './anchor.ts';
import type { MockupPermissions } from './mockup-permissions.ts';

/** Mockup permissions as the server grants them by default: none. */
export const BLOCKED: MockupPermissions = {
    external: false,
    forms: false,
    eval: false,
    modals: false,
    downloads: false,
    clipboard: false,
};

/** Mockup permissions with every one granted. */
export const ALLOWED: MockupPermissions = {
    external: true,
    forms: true,
    eval: true,
    modals: true,
    downloads: true,
    clipboard: true,
};

/** A pin anchor as the bridge records it, for tests. */
export const PIN_ANCHOR: PinAnchor = {
    selector: 'main > button.cta',
    offset: { x: 0.5, y: 0.25 },
    text: 'Get started',
    point: { x: 640, y: 380 },
};
