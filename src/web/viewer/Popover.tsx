import type { ComponentChildren } from 'preact';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CARD_CLASS } from '../ui/styles.ts';

const WIDTH = 320;
// Pin markers are 28px wide and drawn up and to the right of their anchor point.
const MARKER = 28;
const MARGIN = 8;

/** Where a popover points, in viewport coordinates. */
export type PopoverPoint = { x: number; y: number; placement: 'side' | 'below' };

const samePoint = (a: PopoverPoint, b: PopoverPoint) =>
    a.x === b.x && a.y === b.y && a.placement === b.placement;

/**
 * Floating card beside a pin (`side`), flipping to the left when it would overflow and going
 * below it when neither side fits, or centered below a point (`below`), e.g. the comment button.
 * `locate` tells where it points; it is asked again after every render, scroll and resize,
 * since the layout can move what it points at, e.g. the mockup re-centered as the side panel
 * closes.
 */
export function Popover({
    locate,
    children,
}: {
    locate: () => PopoverPoint;
    children: ComponentChildren;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);
    const [{ x, y, placement }, setPoint] = useState(locate);
    const latest = useRef(locate);
    latest.current = locate;
    const relocate = useCallback(() => {
        const point = latest.current();
        setPoint((current) => (samePoint(current, point) ? current : point));
    }, []);

    // After every render, once the layout it measures is in place.
    useLayoutEffect(relocate);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
        observer.observe(el);
        // The room around it changes too, so it renders again even if its point does not move.
        const resize = () => setPoint(latest.current());
        addEventListener('scroll', relocate, { capture: true, passive: true });
        addEventListener('resize', resize);
        return () => {
            observer.disconnect();
            removeEventListener('scroll', relocate, { capture: true });
            removeEventListener('resize', resize);
        };
    }, [relocate]);

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
        top = y + MARGIN;
    }
    left = Math.min(Math.max(left, MARGIN), innerWidth - width - MARGIN);
    top = Math.min(Math.max(top, MARGIN), innerHeight - height - MARGIN);

    return (
        <div
            ref={ref}
            class={`fixed z-30 overflow-hidden shadow-lg ${CARD_CLASS}`}
            style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
        >
            {children}
        </div>
    );
}

/** Title row of a popover, with its actions on the right. */
export function PopoverHeader({
    title,
    children,
}: {
    title: ComponentChildren;
    children: ComponentChildren;
}) {
    return (
        <header class="flex items-center gap-2 border-stone-100 border-b py-1.5 pr-1.5 pl-3 text-sm">
            {title}
            <span class="ml-auto flex items-center gap-2">{children}</span>
        </header>
    );
}
