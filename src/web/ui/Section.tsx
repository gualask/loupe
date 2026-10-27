import type { ComponentChildren } from 'preact';

/**
 * A titled block of a card or panel, with an optional description and a note on the right. A
 * `flush` section lays its content edge to edge below a divider, for rows whose hover spans the
 * card; on wide screens that content scrolls when the card is too short, below a fixed header.
 */
export function Section({
    title,
    description,
    aside,
    flush = false,
    children,
}: {
    title: string;
    description?: string;
    aside?: ComponentChildren;
    flush?: boolean;
    children: ComponentChildren;
}) {
    const header = (
        <div>
            <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">{title}</h2>
                {aside}
            </div>
            {description ? <p class="mt-1 text-sm text-stone-500">{description}</p> : null}
        </div>
    );
    if (!flush) {
        return (
            <section class="flex flex-col gap-4 p-5">
                {header}
                {children}
            </section>
        );
    }
    return (
        <section class="flex flex-col gap-4 pt-5 lg:min-h-0">
            <div class="px-5">{header}</div>
            <div class="border-stone-100 border-t lg:min-h-0 lg:overflow-y-auto">{children}</div>
        </section>
    );
}
