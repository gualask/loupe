import { useRef, useState } from 'preact/hooks';
import { errorMessage } from './api.ts';

/**
 * Runs one request at a time, so a double click does not send it twice, and keeps the error
 * the last one failed with.
 */
export function useAction() {
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState(false);
    const running = useRef(false);

    async function run(action: () => Promise<unknown>) {
        if (running.current) return;
        running.current = true;
        setPending(true);
        setError(undefined);
        try {
            await action();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            running.current = false;
            setPending(false);
        }
    }

    return { error, pending, run: (action: () => Promise<unknown>) => void run(action) };
}

/** Submit handler for a form running `onSubmit`, with its pending state and error. */
export function useFormSubmit(onSubmit: () => Promise<unknown>) {
    const action = useAction();
    return {
        ...action,
        submit: (e: Event) => {
            e.preventDefault();
            action.run(onSubmit);
        },
    };
}
