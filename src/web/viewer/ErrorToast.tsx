import { IconX } from '@tabler/icons-preact';
import { ICON } from '../ui/styles.ts';

/** A change the server rejected, shown over the review space until dismissed. */
export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div
            role="alert"
            class="fixed top-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
        >
            {message}
            <button type="button" aria-label="Dismiss" onClick={onDismiss}>
                <IconX size={ICON.md} />
            </button>
        </div>
    );
}
