import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

const WIDTH = 320;
const GAP = 16;
// Pin markers are 28px wide and drawn up and to the right of their anchor point.
const MARKER = 28;
const MARGIN = 8;

/**
 * Floating card in viewport coordinates: beside a pin (`side`), flipping to the left when it
 * would overflow and going below it when neither side fits, or centered above a point
 * (`above`), e.g. the toolbar.
 */
export function Popover({
    x,
    y,
    placement,
    children,
}: {
    x: number;
    y: number;
    placement: 'side' | 'above';
    children: ComponentChildren;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const width = Math.min(WIDTH, innerWidth - 2 * MARGIN);
    let left: number;
    let top: number;
    if (placement === 'side') {
        const right = x + MARKER + MARGIN;
        const leftOfPin = x - MARGIN - width;
        if (right + width <= innerWidth - MARGIN || leftOfPin >= MARGIN) {
            left = right + width <= innerWidth - MARGIN ? right : leftOfPin;
            top = y - MARKER - MARGIN;
        } else {
            // Too narrow for either side (phones): below the pin, which is drawn above its point.
            left = x - width / 2;
            top = y + MARGIN;
        }
    } else {
        left = x - width / 2;
        top = y - GAP - height;
    }
    left = Math.min(Math.max(left, MARGIN), innerWidth - width - MARGIN);
    top = Math.min(Math.max(top, MARGIN), innerHeight - height - MARGIN);

    return (
        <div
            ref={ref}
            class="fixed z-30 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
            style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
        >
            {children}
        </div>
    );
}
