import type { ComponentChildren } from 'preact';

/** A square button showing only an icon; `label` names it for screen readers and tooltips. */
export function IconButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ComponentChildren;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            class="grid size-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
            {children}
        </button>
    );
}
