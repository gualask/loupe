import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { TEXT } from './styles.ts';

/**
 * Modal dialog on the native <dialog> element: the page behind it is inert, focus moves to its
 * first control and Escape closes it, unless it is `busy` with a request. Once the parent removes
 * it, focus returns to what had it before. The browser styles dialogs with their own colors,
 * hence the explicit text color.
 */
export function Dialog({
    title,
    busy,
    onClose,
    children,
}: {
    title: string;
    busy?: boolean;
    onClose: () => void;
    children: ComponentChildren;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    // The close event of a dialog the parent removed is not the user's.
    const mounted = useRef(true);
    useEffect(() => {
        const dialog = ref.current;
        // The browser returns focus only when a dialog closes in place, not when it is removed.
        const opener = document.activeElement;
        dialog?.showModal();
        return () => {
            mounted.current = false;
            dialog?.close();
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    return (
        <dialog
            ref={ref}
            onCancel={(e) => {
                e.preventDefault();
                if (!busy) onClose();
            }}
            onClose={() => {
                if (mounted.current) onClose();
            }}
            class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-900/30"
        >
            <h2 class={`mb-4 ${TEXT.heading}`}>{title}</h2>
            {children}
        </dialog>
    );
}

/** The actions closing a dialog, the main one last, at the right. */
export function DialogActions({ children }: { children: ComponentChildren }) {
    return <div class="mt-6 flex justify-end gap-2">{children}</div>;
}
