const TONES = {
    neutral: 'bg-stone-100 text-stone-600',
    good: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-800',
};

/** A small rounded label for a state: shared, read-only, resolved, a verdict. */
export function Badge({
    tone = 'neutral',
    children,
}: {
    tone?: keyof typeof TONES;
    children: string;
}) {
    return (
        <span class={`shrink-0 rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>{children}</span>
    );
}
