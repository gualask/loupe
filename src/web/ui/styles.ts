// Class strings shared by components and by elements styled like them.

const BUTTON_VARIANTS = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
};

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

/** The classes of a button, also for links that look like one. */
export function buttonClass(variant: ButtonVariant = 'primary') {
    return `inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${BUTTON_VARIANTS[variant]}`;
}

export const INPUT_CLASS =
    'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200';
