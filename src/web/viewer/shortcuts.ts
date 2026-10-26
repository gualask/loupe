import { useEffect, useRef } from 'preact/hooks';
import { SHORTCUT_KEYS, type ShortcutKey } from '../../shared/bridge-protocol.ts';

/** What each shortcut does, as the help lists it, with the key as shown. */
export const SHORTCUTS: Record<ShortcutKey, { label: string; action: string }> = {
    p: { label: 'P', action: 'Place a pin' },
    c: { label: 'C', action: 'Write a general comment' },
    h: { label: 'H', action: 'Show or hide pins' },
    Escape: { label: 'Esc', action: 'Cancel or close' },
    '?': { label: '?', action: 'Show this help' },
};

const isShortcut = (key: string): key is ShortcutKey =>
    (SHORTCUT_KEYS as readonly string[]).includes(key);

function isTyping(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(input|textarea|select)$/.test(target.localName))
    );
}

/**
 * Calls `onKey` with the shortcut keys pressed without modifiers outside text fields. Inside the
 * mockup the bridge forwards them in the same way (`loupe:key`).
 */
export function useShortcuts(onKey: (key: ShortcutKey) => void) {
    const handler = useRef(onKey);
    handler.current = onKey;
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            if (isShortcut(event.key)) handler.current(event.key);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
