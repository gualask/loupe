import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

type Offset = { x: number; y: number };

// Space kept between the element and the edges of the window.
const EDGE = 8;

/** `next`, limited so that the element, now at `rect` with offset `current`, stays on screen. */
function clampOffset(next: Offset, current: Offset, rect: DOMRect): Offset {
    // Where the element would be without any offset.
    const left = rect.left - current.x;
    const top = rect.top - current.y;
    return {
        x: Math.min(Math.max(next.x, EDGE - left), innerWidth - EDGE - rect.width - left),
        y: Math.min(Math.max(next.y, EDGE - top), innerHeight - EDGE - rect.height - top),
    };
}

/**
 * Offset of an element moved by dragging a handle; the element stays on screen while dragged
 * and when the window gets smaller. Spread `handle` on the handle.
 */
export function useDragOffset(ref: RefObject<HTMLElement | null>) {
    const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
    const drag = useRef<Offset | null>(null);

    /** Moves the element to `next`, or as close as it can get while staying on screen. */
    function moveTo(next: (current: Offset) => Offset) {
        setOffset((current) => {
            const rect = ref.current?.getBoundingClientRect();
            return rect ? clampOffset(next(current), current, rect) : current;
        });
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: moveTo only reads the ref
    useEffect(() => {
        const keepOnScreen = () => moveTo((current) => current);
        window.addEventListener('resize', keepOnScreen);
        return () => window.removeEventListener('resize', keepOnScreen);
    }, []);

    const handle = {
        onPointerDown(event: PointerEvent) {
            drag.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        },
        onPointerMove(event: PointerEvent) {
            const start = drag.current;
            if (start) moveTo(() => ({ x: event.clientX - start.x, y: event.clientY - start.y }));
        },
        onPointerUp() {
            drag.current = null;
        },
    };

    return { offset, handle };
}
