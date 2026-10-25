import { useState } from 'preact/hooks';
import { errorMessage } from './api.ts';

/** Submit handler for a form running `onSubmit`, with the error it fails with. */
export function useFormSubmit(onSubmit: () => Promise<void>) {
    const [error, setError] = useState<string>();

    async function submit(e: Event) {
        e.preventDefault();
        setError(undefined);
        try {
            await onSubmit();
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    return { error, submit: (e: Event) => void submit(e) };
}
