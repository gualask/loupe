import { describe, expect, it } from 'vitest';
import { type PopoverPoint, placePopover } from './placement.ts';

// A 1440 × 900 window whose header and notices end at 56 px.
const BAND = { top: 56, bottom: 900 };
const at = (point: Partial<PopoverPoint>): PopoverPoint => ({
    x: 600,
    y: 400,
    placement: 'side',
    ...BAND,
    ...point,
});

describe('placePopover', () => {
    it('goes to the right of its pin, level with the marker', () => {
        expect(placePopover(at({}), 200, 1440)).toEqual({ left: 636, top: 364, width: 320 });
    });

    it('flips to the left of a pin near the right edge', () => {
        expect(placePopover(at({ x: 1300 }), 200, 1440)).toEqual({
            left: 972,
            top: 364,
            width: 320,
        });
    });

    it('goes below a pin when neither side fits', () => {
        expect(placePopover(at({ x: 180 }), 200, 390)).toEqual({ left: 20, top: 408, width: 320 });
    });

    it('stays below the header when its pin is near the top or scrolled above it', () => {
        expect(placePopover(at({ y: 60 }), 200, 1440).top).toBe(64);
        expect(placePopover(at({ y: -300 }), 200, 1440).top).toBe(64);
    });

    it('stays above the bottom of the window', () => {
        expect(placePopover(at({ y: 880 }), 200, 1440).top).toBe(692);
    });

    it('keeps its top in view when taller than the room', () => {
        expect(placePopover(at({ y: 400 }), 1000, 1440).top).toBe(64);
    });

    it('centers below a point, such as the comment button', () => {
        expect(placePopover(at({ placement: 'below', x: 760, y: 56 }), 200, 1440)).toEqual({
            left: 600,
            top: 64,
            width: 320,
        });
    });
});
