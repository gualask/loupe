import type { ComponentChildren } from 'preact';
import { type IconButtonSize, type IconButtonVariant, iconButtonClass } from './styles.ts';

/**
 * A square button showing only an icon; `label` names it for screen readers and tooltips, with
 * its keyboard `shortcut` in the tooltip. `pressed` makes it a toggle.
 */
export function IconButton({
    label,
    shortcut,
    variant,
    size,
    pressed,
    disabled,
    onClick,
    children,
}: {
    label: string;
    shortcut?: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    pressed?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ComponentChildren;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={pressed}
            title={shortcut ? `${label} (${shortcut})` : label}
            class={iconButtonClass(variant, size)}
        >
            {children}
        </button>
    );
}
