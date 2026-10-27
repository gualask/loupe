import type { ComponentChildren } from 'preact';
import { TONES, type Tone } from './styles.ts';

/** A small rounded label for a state: a role, archived, resolved. */
export function Badge({
    tone = 'neutral',
    title,
    children,
}: {
    tone?: Tone;
    /** Explains the state on hover. */
    title?: string;
    children: ComponentChildren;
}) {
    return (
        <span
            title={title}
            class={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}
        >
            {children}
        </span>
    );
}
