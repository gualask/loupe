import type { RefObject } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
    type AppMessage,
    type BridgeMessage,
    bridgeMessageSchema,
} from '../../shared/bridge-protocol.ts';

/**
 * Connects to the bridge running inside the mockup iframe. Only messages from that iframe's
 * window are accepted, and they are validated: mockup code can post them too.
 *
 * Pass `onFrameLoad` to the iframe's load event: the bridge starts before the document loads,
 * so this also covers a `loupe:ready` posted before this hook started listening.
 */
export function useBridge(
    frame: RefObject<HTMLIFrameElement | null>,
    onMessage: (message: BridgeMessage) => void,
) {
    const [ready, setReady] = useState(false);
    const handler = useRef(onMessage);
    handler.current = onMessage;

    useEffect(() => {
        function listen(event: MessageEvent) {
            if (!frame.current || event.source !== frame.current.contentWindow) return;
            const parsed = bridgeMessageSchema.safeParse(event.data);
            if (!parsed.success) return;
            if (parsed.data.type === 'loupe:ready') setReady(true);
            handler.current(parsed.data);
        }
        window.addEventListener('message', listen);
        return () => window.removeEventListener('message', listen);
    }, [frame]);

    const send = useCallback(
        (message: AppMessage) => {
            // The iframe has an opaque origin, so there is no target origin to name.
            frame.current?.contentWindow?.postMessage(message, '*');
        },
        [frame],
    );

    const onFrameLoad = useCallback(() => setReady(true), []);

    return { ready, send, onFrameLoad };
}
