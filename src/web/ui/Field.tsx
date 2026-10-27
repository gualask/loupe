import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { TEXT } from './styles.ts';

/** What a Field's control spreads on itself: its id, and the hint that describes it. */
type ControlProps = { id: string; 'aria-describedby'?: string };

/** A labelled form control with an optional hint; `children` renders the control. */
export function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: (control: ControlProps) => ComponentChildren;
}) {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    return (
        <div class="flex flex-col gap-1.5">
            <label for={id} class="font-medium text-sm text-stone-900">
                {label}
            </label>
            {children({ id, 'aria-describedby': hintId })}
            {hint ? (
                <p id={hintId} class={TEXT.meta}>
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
