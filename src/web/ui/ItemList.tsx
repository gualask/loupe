import type { ComponentChildren } from 'preact';
import { CARD_CLASS, ROW_HOVER_CLASS, TEXT } from './styles.ts';

/** A column after the item's own: its header, width and content. */
export type ItemColumn<T> = {
    label: string;
    /** A grid track, e.g. "9rem". */
    width: string;
    cell: (item: T) => ComponentChildren;
    /** Hidden on narrow screens, where only the other columns show under the item. */
    wide?: boolean;
};

// Wide enough to tell short columns apart at a glance.
const COLUMN_GAP = 'gap-x-4 lg:gap-x-8';

// On narrow screens a row is its item and its menu, with the other columns underneath; from lg
// on, header and rows share the list's tracks, set on it as --item-grid.
const ROW_GRID = `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 px-5 lg:grid-cols-(--item-grid) ${COLUMN_GAP}`;

/** A table of items, such as projects or mockups, in a card; its rows are `ItemRow`s. */
export function ItemList<T>({
    label,
    columns,
    children,
}: {
    label: string;
    columns: ItemColumn<T>[];
    children: ComponentChildren;
}) {
    // The item takes the rest of the width; the last track fits the menu.
    const tracks = ['minmax(0,1fr)', ...columns.map((c) => c.width), '1.75rem'].join(' ');
    return (
        <div class={`overflow-hidden ${CARD_CLASS}`} style={{ '--item-grid': tracks }}>
            <div
                class={`hidden border-stone-100 border-b bg-stone-50 px-5 py-2 font-medium text-stone-500 text-xs lg:grid lg:grid-cols-(--item-grid) ${COLUMN_GAP}`}
            >
                <span>{label}</span>
                {columns.map((column) => (
                    <span key={column.label}>{column.label}</span>
                ))}
                <span class="sr-only">Actions</span>
            </div>
            <ul class="divide-y divide-stone-100">{children}</ul>
        </div>
    );
}

/**
 * An item linked as a whole, with an icon, its name and badges, a line about it, a cell per
 * column of its list and its menu, which sits above the link.
 */
export function ItemRow<T>({
    item,
    columns,
    href,
    icon,
    name,
    badges,
    detail,
    menu,
}: {
    item: T;
    /** The columns of the list the row is in. */
    columns: ItemColumn<T>[];
    href: string;
    icon: ComponentChildren;
    name: string;
    badges?: ComponentChildren;
    detail?: ComponentChildren;
    menu: ComponentChildren;
}) {
    return (
        <li class={`relative py-3 ${ROW_GRID} ${ROW_HOVER_CLASS}`}>
            <div class="flex min-w-0 items-center gap-4">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500">
                    {icon}
                </span>
                <div class="min-w-0">
                    <div class="flex min-w-0 items-center gap-2">
                        <a href={href} class="truncate font-medium after:absolute after:inset-0">
                            {name}
                        </a>
                        {badges}
                    </div>
                    {detail ? <div class={`truncate ${TEXT.secondary}`}>{detail}</div> : null}
                </div>
            </div>
            {columns.map((column) => (
                <div
                    key={column.label}
                    // Under the item's name when the columns wrap below it.
                    class={`col-start-1 lg:col-start-auto ${column.wide ? 'hidden lg:block' : 'pl-13 lg:pl-0'}`}
                >
                    {column.cell(item)}
                </div>
            ))}
            <div class="relative col-start-2 row-start-1 -mr-2 lg:col-start-auto lg:row-start-auto">
                {menu}
            </div>
        </li>
    );
}

/** A form in place of a row, such as one editing its item. */
export function ItemFormRow({ children }: { children: ComponentChildren }) {
    return <li class="bg-stone-50 px-5 py-4">{children}</li>;
}
