import { useEffect, useRef } from 'preact/hooks';

/** Keyboard shortcuts of the review space, as the help lists them. */
export const SHORTCUTS = [
    ['P', 'Place a pin'],
    ['C', 'Write a general comment'],
    ['H', 'Show or hide pins'],
    ['Esc', 'Cancel or close'],
    ['?', 'Show this help'],
] as const;

function isTyping(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(input|textarea|select)$/.test(target.localName))
    );
}

/**
 * Calls `onKey` with the keys pressed without modifiers outside text fields. Inside the mockup the
 * bridge forwards them in the same way (`loupe:key`).
 */
export function useShortcuts(onKey: (key: string) => void) {
    const handler = useRef(onKey);
    handler.current = onKey;
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            handler.current(event.key);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
