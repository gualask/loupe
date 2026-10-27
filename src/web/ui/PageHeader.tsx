import type { ComponentChildren } from 'preact';
import { TEXT } from './styles.ts';

/** The page title with the page actions on the same row, and a description. */
export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ComponentChildren;
}) {
    return (
        <div class="flex flex-col gap-1">
            <div class="flex min-h-9.5 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h1 class={`min-w-0 truncate ${TEXT.title}`}>{title}</h1>
                {actions ? <div class="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {description ? <p class={TEXT.secondary}>{description}</p> : null}
        </div>
    );
}
