import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/**
 * Modal dialog on the native <dialog> element: focus trap, Esc and backdrop for free. The browser
 * styles dialogs with their own colors, hence the explicit text color.
 */
export function Dialog({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ComponentChildren;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => ref.current?.showModal(), []);
    return (
        <dialog
            ref={ref}
            onClose={onClose}
            class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-900/30"
        >
            <h2 class="mb-4 font-semibold text-lg tracking-tight">{title}</h2>
            {children}
        </dialog>
    );
}
