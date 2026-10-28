// postMessage protocol between the app and the bridge inside the mockup iframe
// (docs/SPEC.md §4.2). The bridge imports types only, so its bundle stays free of Zod.
import { z } from 'zod';
import { type PinAnchor, pinAnchorSchema } from './anchor.ts';

/** Keys the review space handles as shortcuts, also when pressed inside the mockup. */
export const SHORTCUT_KEYS = ['p', 'c', 'h', '?', 'Escape'] as const;
export type ShortcutKey = (typeof SHORTCUT_KEYS)[number];

/** Where a pin marker currently is, in the iframe's viewport coordinates. */
const pinPositionSchema = z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    /** False when the anchor resolves to a hidden element or lies outside the viewport. */
    visible: z.boolean(),
    /** True when neither selector nor text matched and the stored point was used. */
    orphaned: z.boolean(),
});

/**
 * Messages from the bridge to the app. Mockup code shares the bridge's window and can post
 * the same messages, so the app validates them and treats them as untrusted input.
 */
export const bridgeMessageSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('loupe:ready') }),
    /** An element was clicked in inspect mode. */
    z.object({ type: z.literal('loupe:picked'), anchor: pinAnchorSchema }),
    /** Inspect mode was cancelled from inside the mockup (Esc). */
    z.object({ type: z.literal('loupe:inspect-cancelled') }),
    z.object({ type: z.literal('loupe:pin-clicked'), id: z.string() }),
    z.object({ type: z.literal('loupe:positions'), positions: z.array(pinPositionSchema) }),
    /** A shortcut key pressed while the mockup had focus. */
    z.object({ type: z.literal('loupe:key'), key: z.enum(SHORTCUT_KEYS) }),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;
export type PinPosition = z.infer<typeof pinPositionSchema>;

/** A pin marker the bridge draws inside the mockup. */
export type BridgePin = {
    id: string;
    anchor: PinAnchor;
    label: string;
    color: string;
    /** Drawn faded, e.g. resolved threads. */
    muted: boolean;
    /** The pin whose thread is open. */
    active: boolean;
    /** Placed, and reported in positions, but not drawn: the reviewer hid pins. */
    hidden: boolean;
};

/** Messages from the app to the bridge. */
export type AppMessage =
    | { type: 'loupe:inspect'; enabled: boolean }
    | { type: 'loupe:pins'; pins: BridgePin[] }
    | { type: 'loupe:scroll-to'; id: string };
