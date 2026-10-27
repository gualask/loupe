import type { ComponentChildren } from 'preact';
import { TEXT } from './styles.ts';

/** Takes the place of a list that has nothing in it yet, saying what to do first. */
export function EmptyState({ title, children }: { title: string; children: ComponentChildren }) {
    return (
        <div class="rounded-xl border border-stone-300 border-dashed p-10 text-center">
            <p class="font-medium">{title}</p>
            <p class={`mt-1 ${TEXT.secondary}`}>{children}</p>
        </div>
    );
}
