import type { ComponentChildren } from 'preact';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CARD_CLASS } from '../ui/styles.ts';
import { type PopoverPoint, placePopover } from './placement.ts';

const samePoint = (a: PopoverPoint, b: PopoverPoint) =>
    a.x === b.x &&
    a.y === b.y &&
    a.placement === b.placement &&
    a.top === b.top &&
    a.bottom === b.bottom;

/**
 * Floating card placed by `placePopover`. `locate` tells where it points; it is asked again
 * after every render, scroll and resize, since the layout can move what it points at, e.g. the
 * mockup re-centered as the side panel closes.
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
    const [point, setPoint] = useState(locate);
    const latest = useRef(locate);
    latest.current = locate;
    const relocate = useCallback(() => {
        const next = latest.current();
        setPoint((current) => (samePoint(current, next) ? current : next));
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

    const { left, top, width } = placePopover(point, height, innerWidth);

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
