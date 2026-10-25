import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ApiError, errorMessage } from './api.ts';

type State<T> =
    | { status: 'loading' }
    | { status: 'ready'; data: T }
    /** The server answered 404: deleted, never existed, or not visible to this user. */
    | { status: 'missing' }
    /** Anything else, e.g. offline or a server error: worth retrying. */
    | { status: 'failed'; message: string };

export type Resource<T> = State<T> & {
    retry: () => void;
    /** Changes the loaded data in place, e.g. after a saved edit. */
    update: (change: (data: T) => T) => void;
};

/**
 * Loads `load(key)`, again whenever `key` changes; a null key waits. A response that arrives
 * after the key changed is dropped.
 */
export function useResource<T>(key: string | null, load: (key: string) => Promise<T>): Resource<T> {
    const [state, setState] = useState<State<T>>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const loader = useRef(load);
    loader.current = load;

    // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load
    useEffect(() => {
        setState((s) => (s.status === 'loading' ? s : { status: 'loading' }));
        if (key === null) return;
        let current = true;
        loader.current(key).then(
            (data) => current && setState({ status: 'ready', data }),
            (err) =>
                current &&
                setState(
                    err instanceof ApiError && err.status === 404
                        ? { status: 'missing' }
                        : { status: 'failed', message: errorMessage(err) },
                ),
        );
        return () => {
            current = false;
        };
    }, [key, attempt]);

    const actions = useMemo(
        () => ({
            retry: () => setAttempt((n) => n + 1),
            update: (change: (data: T) => T) =>
                setState((s) => (s.status === 'ready' ? { ...s, data: change(s.data) } : s)),
        }),
        [],
    );
    return { ...state, ...actions };
}
