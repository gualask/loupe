import type { ComponentChildren } from 'preact';
import { TONES, type Tone } from './styles.ts';

/** A boxed message within a page or form: a warning, an error. */
export function Notice({
    tone,
    role,
    children,
}: {
    tone: Tone;
    role?: 'alert' | 'status';
    children: ComponentChildren;
}) {
    return (
        <div role={role} class={`rounded-md px-3 py-2.5 text-sm ${TONES[tone]}`}>
            {children}
        </div>
    );
}
