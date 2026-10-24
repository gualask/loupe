import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
    children: ComponentChildren;
};

const VARIANTS = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
};

export function Button({
    variant = 'primary',
    class: className,
    type = 'button',
    ...props
}: Props) {
    return (
        <button
            type={type}
            class={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className ?? ''}`}
            {...props}
        />
    );
}
