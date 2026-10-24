// Runs inside the sandboxed mockup iframe and talks to the app only via postMessage.
// See docs/SPEC.md §4.2.
import type { BridgeMessage } from '../shared/bridge-protocol.ts';

function post(message: BridgeMessage) {
    // The iframe has an opaque origin, so the parent validates event.source instead.
    window.parent.postMessage(message, '*');
}

post({ type: 'loupe:ready' });
