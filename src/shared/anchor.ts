import { z } from 'zod';

const point = z.object({ x: z.number(), y: z.number() });

/** Where a pin is attached inside a mockup document. See docs/SPEC.md §4.4. */
const pinAnchorSchema = z.object({
    selector: z.string().min(1).max(2000),
    /** Position inside the element's bounding box, 0..1 on each axis. */
    offset: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    /** Trimmed text snippet of the element, used to re-match it after DOM changes. */
    text: z.string().max(200).optional(),
    /** Document coordinates, used when neither selector nor text resolves. */
    point,
    viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
});

export type PinAnchor = z.infer<typeof pinAnchorSchema>;
