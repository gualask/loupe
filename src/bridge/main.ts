// Runs inside the sandboxed mockup iframe and talks to the app only via postMessage.
// See docs/SPEC.md §4.2.
import type {
    AppMessage,
    BridgeMessage,
    BridgePin,
    PinPosition,
    ShortcutKey,
} from '../shared/bridge-protocol.ts';
import { computeAnchor, resolveAnchor } from './anchor.ts';
import { createMarkers } from './markers.ts';
import { createOverlay } from './overlay.ts';

// Every shortcut of the review space, which the type keeps in step with the protocol.
const FORWARDED: Record<ShortcutKey, true> = { p: true, c: true, h: true, '?': true, Escape: true };
const isShortcut = (key: string): key is ShortcutKey => Object.hasOwn(FORWARDED, key);
// Catches layout changes that fire no event, such as CSS animations.
const POLL_MS = 1000;

function post(message: BridgeMessage) {
    // The iframe has an opaque origin, so the parent validates event.source instead.
    window.parent.postMessage(message, '*');
}

function isEditable(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(input|textarea|select)$/.test(target.localName))
    );
}

function start() {
    const overlay = createOverlay();
    overlay.attach();

    let inspecting = false;
    let pins: BridgePin[] = [];
    // Anchors are resolved when pins or the DOM change; scrolling only re-reads positions.
    let resolved = new Map<string, Element | undefined>();
    const markers = createMarkers(overlay.pins, (id) => post({ type: 'loupe:pin-clicked', id }));
    let lastPositions = '';
    let frame = 0;

    function resolveAll() {
        resolved = new Map(pins.map((pin) => [pin.id, resolveAnchor(pin.anchor)]));
    }

    function updatePositions() {
        frame = 0;
        overlay.attach();
        const positions: PinPosition[] = pins.map((pin) => {
            const el = resolved.get(pin.id);
            if (!el?.isConnected) {
                const x = pin.anchor.point.x - scrollX;
                const y = pin.anchor.point.y - scrollY;
                return { id: pin.id, x, y, visible: inViewport(x, y), orphaned: true };
            }
            const rect = el.getBoundingClientRect();
            const x = rect.left + pin.anchor.offset.x * rect.width;
            const y = rect.top + pin.anchor.offset.y * rect.height;
            const shown = rect.width > 0 || rect.height > 0;
            return { id: pin.id, x, y, visible: shown && inViewport(x, y), orphaned: false };
        });
        markers.place(positions);
        const serialized = JSON.stringify(positions);
        if (serialized !== lastPositions) {
            lastPositions = serialized;
            post({ type: 'loupe:positions', positions });
        }
    }

    function schedule() {
        if (!frame) frame = requestAnimationFrame(updatePositions);
    }

    function inViewport(x: number, y: number) {
        return x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    }

    /** The mockup element under the pointer, skipping Loupe's own layer. */
    function elementAt(x: number, y: number) {
        return document.elementsFromPoint(x, y).find((el) => el !== overlay.host);
    }

    function setInspecting(on: boolean) {
        inspecting = on;
        overlay.setInspecting(on);
    }

    overlay.glass.addEventListener('pointermove', (event) => {
        overlay.highlight(elementAt(event.clientX, event.clientY));
    });
    overlay.glass.addEventListener('click', (event) => {
        const el = elementAt(event.clientX, event.clientY);
        if (!el) return;
        setInspecting(false);
        post({ type: 'loupe:picked', anchor: computeAnchor(el, event.clientX, event.clientY) });
    });

    window.addEventListener(
        'keydown',
        (event) => {
            if (inspecting && event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                setInspecting(false);
                post({ type: 'loupe:inspect-cancelled' });
                return;
            }
            const plain = !(event.metaKey || event.ctrlKey || event.altKey);
            if (plain && isShortcut(event.key) && !isEditable(event.target)) {
                post({ type: 'loupe:key', key: event.key });
            }
        },
        true,
    );

    window.addEventListener('message', (event: MessageEvent<AppMessage>) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (message?.type === 'loupe:inspect') {
            setInspecting(message.enabled);
        } else if (message?.type === 'loupe:pins') {
            pins = message.pins;
            resolveAll();
            markers.render(pins);
            schedule();
        } else if (message?.type === 'loupe:scroll-to') {
            const el = resolved.get(message.id);
            const pin = pins.find((p) => p.id === message.id);
            if (el?.isConnected) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            else if (pin)
                scrollTo({ top: pin.anchor.point.y - innerHeight / 2, behavior: 'smooth' });
        }
    });

    let mutationTimer = 0;
    new MutationObserver(() => {
        clearTimeout(mutationTimer);
        mutationTimer = window.setTimeout(() => {
            resolveAll();
            schedule();
        }, 100);
    }).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
    });
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    setInterval(schedule, POLL_MS);

    post({ type: 'loupe:ready' });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
