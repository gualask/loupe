import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

const WIDTH = 320;
const GAP = 16;
// Pin markers are 28px wide and drawn up and to the right of their anchor point.
const MARKER = 28;
const MARGIN = 8;

/**
 * Floating card in viewport coordinates: beside a pin (`side`), flipping to the left when it
 * would overflow, or centered above a point (`above`), e.g. the toolbar.
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
        left = right + width > innerWidth - MARGIN ? x - MARGIN - width : right;
        top = y - MARKER - MARGIN;
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
