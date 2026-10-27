// Class strings shared by components and by elements styled like them. Each one sets every
// property it needs exactly once, so callers only add layout (width, flex, margins) on top.

/** Colors of a state, shared by badges and notices. */
export const TONES = {
    neutral: 'bg-stone-100 text-stone-600',
    good: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-700',
};

export type Tone = keyof typeof TONES;

/** The white surface of cards, lists and panels. */
export const CARD_CLASS = 'rounded-xl border border-stone-200 bg-white';

// Hover and open (menu triggers) tint of ghost controls; visible on white and on the page.
const GHOST_TINT = 'hover:bg-stone-200/70 aria-expanded:bg-stone-200/70';

const BUTTON_VARIANTS = {
    primary: 'border-transparent bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-100',
    ghost: `border-transparent text-stone-600 hover:text-stone-900 ${GHOST_TINT}`,
};

// md matches the height of inputs; sm fits toolbars and dense rows.
const BUTTON_SIZES = {
    md: 'h-9.5 gap-2 px-3',
    sm: 'h-8 gap-1.5 px-2.5',
};

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

/** The classes of a button, also for links that look like one. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
    return `inline-flex shrink-0 items-center justify-center rounded-md border font-medium text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]}`;
}

const ICON_BUTTON_VARIANTS = {
    ghost: `rounded-md text-stone-500 hover:text-stone-900 aria-expanded:text-stone-900 ${GHOST_TINT}`,
    primary: 'rounded-md bg-stone-900 text-white hover:bg-stone-700',
    // Around an avatar, which would hide a background: a halo.
    avatar: 'rounded-full ring-stone-300 hover:ring-2 aria-expanded:ring-2 aria-expanded:ring-stone-400',
};

// sm for dense rows and popovers, md beside sm buttons, lg beside md buttons and inputs.
const ICON_BUTTON_SIZES = { sm: 'size-7', md: 'size-8', lg: 'size-9.5' };

export type IconButtonVariant = keyof typeof ICON_BUTTON_VARIANTS;
export type IconButtonSize = keyof typeof ICON_BUTTON_SIZES;

/** The classes of a square button showing only an icon. */
export function iconButtonClass(variant: IconButtonVariant = 'ghost', size: IconButtonSize = 'sm') {
    return `grid shrink-0 place-items-center transition disabled:pointer-events-none disabled:opacity-40 ${ICON_BUTTON_SIZES[size]} ${ICON_BUTTON_VARIANTS[variant]}`;
}

/** Hover of rows and items that open something, on white surfaces. */
export const ROW_HOVER_CLASS = 'transition-colors hover:bg-stone-100';

/** Border, padding and focus ring of form controls, without color or horizontal padding. */
export const FIELD_CLASS =
    'rounded-md border border-stone-300 py-2 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:opacity-50';

export const INPUT_CLASS = `${FIELD_CLASS} bg-white px-3 text-sm`;
