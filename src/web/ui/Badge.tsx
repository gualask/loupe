import { TONES, type Tone } from './styles.ts';

/** A small rounded label for a state: a role, archived, resolved, a verdict. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: string }) {
    return (
        <span class={`shrink-0 rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>{children}</span>
    );
}
