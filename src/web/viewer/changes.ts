import { signal } from '@preact/signals';
import { ApiError } from '../lib/api.ts';

const MAX_RETRY_MS = 30_000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

/**
 * Sends changes one at a time, in order, retrying network failures with backoff (docs/SPEC.md
 * §5.1): a reply must not reach the server before its thread, even when both were retried while
 * offline. A change the server rejects resolves to undefined after `onRejected`; once nothing
 * else is pending, `resync` reloads the server state, so the reload does not drop changes that
 * are still queued.
 */
export function createChangeQueue({
    onRejected,
    resync,
}: {
    onRejected: (err: ApiError) => void;
    resync: () => Promise<void>;
}) {
    const saveState = signal<SaveState>('idle');
    let pending = 0;
    let queue: Promise<unknown> = Promise.resolve();
    // Set by a change the server rejected since the queue last emptied.
    let rejected = false;

    /** Sends one change, retrying network failures; undefined when the server rejects it. */
    async function attempt<T>(send: () => Promise<T>): Promise<T | undefined> {
        let delay = 1000;
        for (;;) {
            try {
                return await send();
            } catch (err) {
                if (err instanceof ApiError) {
                    rejected = true;
                    onRejected(err);
                    return undefined;
                }
                saveState.value = 'offline';
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, MAX_RETRY_MS);
                saveState.value = 'saving';
            }
        }
    }

    return {
        saveState,

        /** Queues a change after the pending ones. */
        perform<T>(send: () => Promise<T>): Promise<T | undefined> {
            pending++;
            // Queued behind a change that is waiting for the network: still offline.
            if (saveState.value !== 'offline') saveState.value = 'saving';
            const result = queue.then(() => attempt(send));
            queue = result;
            return result.finally(async () => {
                pending--;
                if (pending) return;
                const failed = rejected;
                rejected = false;
                if (failed) await resync().catch(() => undefined);
                saveState.value = failed ? 'idle' : 'saved';
            });
        },
    };
}
