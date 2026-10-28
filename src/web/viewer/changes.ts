import { signal } from '@preact/signals';
import { ApiError } from '../lib/api.ts';

const MAX_RETRY_MS = 30_000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

/**
 * Sends changes one at a time, in order, retrying while the server cannot be reached
 * (docs/SPEC.md §5.1): a reply must not reach the server before its thread, even when both were
 * retried while offline. A change the server rejects resolves to undefined after `onRejected`.
 *
 * Reloads of the server `State` (`load`, then `show`) wait until nothing is pending, and a state
 * loaded while a change was made is not shown, as it misses that change: it is loaded again once
 * the change is saved. One follows every rejection.
 */
export function createChangeQueue<State>({
    onRejected,
    load,
    show,
}: {
    onRejected: (err: ApiError) => void;
    load: () => Promise<State>;
    show: (state: State) => void;
}) {
    const saveState = signal<SaveState>('idle');
    let pending = 0;
    // Changes queued so far, so a reload knows whether one was made while it loaded.
    let queued = 0;
    let queue: Promise<unknown> = Promise.resolve();
    // Set by a change the server rejected since the queue last emptied.
    let rejected = false;
    // Set when the server state must be reloaded once nothing is pending.
    let stale = false;

    async function reloadIfStale() {
        if (pending || !stale) return;
        stale = false;
        const before = queued;
        let state: State;
        try {
            state = await load();
        } catch {
            return;
        }
        if (queued === before) {
            show(state);
        } else {
            stale = true;
            await reloadIfStale();
        }
    }

    /**
     * Sends one change, retrying network failures and server errors, such as a proxy's 502 while
     * Loupe restarts; undefined when the server rejects it.
     */
    async function attempt<T>(send: () => Promise<T>): Promise<T | undefined> {
        let delay = 1000;
        for (;;) {
            try {
                return await send();
            } catch (err) {
                if (err instanceof ApiError && err.status < 500) {
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
            queued++;
            // Queued behind a change that is waiting for the network: still offline.
            if (saveState.value !== 'offline') saveState.value = 'saving';
            const result = queue.then(() => attempt(send));
            queue = result;
            return result.finally(async () => {
                pending--;
                if (pending) return;
                const failed = rejected;
                rejected = false;
                if (failed) stale = true;
                await reloadIfStale();
                saveState.value = failed ? 'idle' : 'saved';
            });
        },

        /** Reloads the server state now, or once the pending changes are sent. */
        resync() {
            stale = true;
            void reloadIfStale();
        },
    };
}
