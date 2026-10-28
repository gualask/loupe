import { useRef, useState } from 'preact/hooks';
import { errorMessage } from './api.ts';

/**
 * Runs one request at a time, so a double click does not send it twice, and keeps the error
 * the last one failed with. One instance serves all the actions of a page, which then shows
 * the outcome of the latest; `running` is the name the running one was given, if any, so its
 * control can say what is happening.
 */
export function useAction() {
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState(false);
    const [running, setRunning] = useState<string>();
    const busy = useRef(false);

    async function run(action: () => Promise<unknown>, name?: string) {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setRunning(name);
        setError(undefined);
        try {
            await action();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            busy.current = false;
            setPending(false);
            setRunning(undefined);
        }
    }

    return {
        error,
        pending,
        running,
        run: (action: () => Promise<unknown>, name?: string) => void run(action, name),
    };
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
