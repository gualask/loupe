/**
 * Messages sent from the bridge (inside the mockup iframe) to the app.
 * Type-only on purpose: the bridge bundle stays free of runtime dependencies, and the app
 * validates incoming messages itself.
 */
export type BridgeMessage = { type: 'loupe:ready' };
