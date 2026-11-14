// Where the review space's popovers go: beside their pin or below a point, off the header.

const WIDTH = 320;
// Pin markers are 28px wide and drawn up and to the right of their anchor point.
const MARKER = 28;
const MARGIN = 8;

/**
 * Where a popover points, in viewport coordinates, and the band of the window it stays in:
 * `top` and `bottom` keep it off the header above the mockup.
 */
export type PopoverPoint = {
    x: number;
    y: number;
    placement: 'side' | 'below';
    top: number;
    bottom: number;
};

/**
 * Where a popover of `height` goes in a window `windowWidth` wide: beside its pin (`side`),
 * flipping to the left when it would overflow and going below it when neither side fits, or
 * centered below a point (`below`), e.g. the comment button. It stays within its band, its top
 * first: when the band is too short, its header and actions are what stays in view.
 */
export function placePopover(point: PopoverPoint, height: number, windowWidth: number) {
    const { x, y, placement } = point;
    const width = Math.min(WIDTH, windowWidth - 2 * MARGIN);
    let left: number;
    let top: number;
    if (placement === 'side') {
        const right = x + MARKER + MARGIN;
        const leftOfPin = x - MARGIN - width;
        if (right + width <= windowWidth - MARGIN || leftOfPin >= MARGIN) {
            left = right + width <= windowWidth - MARGIN ? right : leftOfPin;
            top = y - MARKER - MARGIN;
        } else {
            // Too narrow for either side (phones): below the pin, which is drawn above its point.
            left = x - width / 2;
            top = y + MARGIN;
        }
    } else {
        left = x - width / 2;
        top = y + MARGIN;
    }
    left = Math.min(Math.max(left, MARGIN), windowWidth - width - MARGIN);
    top = Math.max(Math.min(top, point.bottom - height - MARGIN), point.top + MARGIN);
    return { left, top, width };
}
