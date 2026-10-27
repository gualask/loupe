import type { ComponentChildren } from 'preact';

/** Takes the place of a list that has nothing in it yet, saying what to do first. */
export function EmptyState({ title, children }: { title: string; children: ComponentChildren }) {
    return (
        <div class="rounded-xl border border-stone-300 border-dashed p-10 text-center">
            <p class="font-medium">{title}</p>
            <p class="mt-1 text-sm text-stone-500">{children}</p>
        </div>
    );
}
