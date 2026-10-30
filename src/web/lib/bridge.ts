import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
    type AppMessage,
    type BridgeMessage,
    bridgeMessageSchema,
} from '../../shared/bridge-protocol.ts';

/**
 * Connects to the bridge running inside a mockup iframe: pass the result to that iframe's
 * `MockupFrame`, which loads it into `frame`. Only messages from the iframe's window are
 * accepted, and they are validated: mockup code can post them too.
 *
 * `connection` changes whenever a bridge says it is running, 0 before the first: the mockup can
 * reload its frame, which starts a new bridge that knows nothing yet, so state sent to the bridge
 * is sent again then. `ping` asks it to say so, on every load of the frame, which also covers a
 * `loupe:ready` posted before this hook started listening.
 */
export function useBridge(onMessage: (message: BridgeMessage) => void) {
    const frame = useRef<HTMLIFrameElement>(null);
    const [connection, setConnection] = useState(0);
    const handler = useRef(onMessage);
    handler.current = onMessage;

    useEffect(() => {
        function listen(event: MessageEvent) {
            if (!frame.current || event.source !== frame.current.contentWindow) return;
            const parsed = bridgeMessageSchema.safeParse(event.data);
            if (!parsed.success) return;
            if (parsed.data.type === 'loupe:ready') setConnection((n) => n + 1);
            handler.current(parsed.data);
        }
        window.addEventListener('message', listen);
        return () => window.removeEventListener('message', listen);
    }, []);

    const send = useCallback((message: AppMessage) => {
        // The iframe has an opaque origin, so there is no target origin to name.
        frame.current?.contentWindow?.postMessage(message, '*');
    }, []);

    const ping = useCallback(() => send({ type: 'loupe:ping' }), [send]);

    return { frame, connection, send, ping };
}

export type Bridge = ReturnType<typeof useBridge>;
