import { IconCheck, IconDots } from '@tabler/icons-preact';
import { type ComponentChildren, Fragment } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type IconButtonSize, type IconButtonVariant, iconButtonClass } from './styles.ts';

export type MenuItem = {
    label: string;
    /** Tells apart items with the same label, such as two people sharing a name. */
    id?: string;
    icon?: ComponentChildren;
    onSelect: () => void;
    /** One of a set of choices: whether it is the current one, marked with a check. */
    checked?: boolean;
    /** Starts a group, set apart from the items above by a divider. */
    separate?: boolean;
    /** Irreversible. Listed last by the caller; it shows in red, apart from the others. */
    danger?: boolean;
};

// Between the button and the menu.
const GAP = 4;

const itemsOf = (menu: HTMLElement | null) => [
    ...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []),
];

/**
 * A button opening a list of actions, "⋯" unless `icon` says otherwise, following the WAI-ARIA
 * menu button pattern: arrows, Home and End move between items, Escape closes and returns to the
 * button, and clicking elsewhere, scrolling or resizing closes it. The menu is fixed to the
 * window, so lists that clip their overflow do not cut it; it lines up with the button's `align`
 * edge and opens upwards when there is no room below. `header` shows above the items, for what
 * they act on.
 */
export function Menu({
    label,
    icon = <IconDots size={18} />,
    variant,
    size,
    align = 'end',
    disabled,
    header,
    items,
}: {
    label: string;
    icon?: ComponentChildren;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    align?: 'start' | 'end';
    disabled?: boolean;
    header?: ComponentChildren;
    items: MenuItem[];
}) {
    // When open, the item that takes focus first.
    const [open, setOpen] = useState<'first' | 'last' | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();

    function close(refocus = true) {
        setOpen(null);
        if (refocus) button.current?.focus();
    }

    useLayoutEffect(() => {
        const list = menu.current;
        const anchor = button.current?.getBoundingClientRect();
        if (!open || !list || !anchor) return;
        const fitsBelow = anchor.bottom + GAP + list.offsetHeight <= innerHeight;
        list.style.top = `${fitsBelow ? anchor.bottom + GAP : anchor.top - GAP - list.offsetHeight}px`;
        const width = document.documentElement.clientWidth;
        if (align === 'end') list.style.right = `${width - anchor.right}px`;
        else list.style.left = `${Math.min(anchor.left, width - list.offsetWidth - GAP)}px`;
        const all = itemsOf(list);
        all[open === 'first' ? 0 : all.length - 1]?.focus({ preventScroll: true });
    }, [open, align]);

    useEffect(() => {
        if (!open) return;
        // Scrolling a long menu itself keeps it open.
        const outside = (e: Event) => {
            if (!root.current?.contains(e.target as Node)) setOpen(null);
        };
        const dismiss = () => setOpen(null);
        document.addEventListener('pointerdown', outside, true);
        // Clicks inside a mockup frame reach the frame, not this document.
        addEventListener('blur', dismiss);
        addEventListener('scroll', outside, true);
        addEventListener('resize', dismiss);
        return () => {
            document.removeEventListener('pointerdown', outside, true);
            removeEventListener('blur', dismiss);
            removeEventListener('scroll', outside, true);
            removeEventListener('resize', dismiss);
        };
    }, [open]);

    function onMenuKey(e: KeyboardEvent) {
        const all = itemsOf(menu.current);
        const at = all.indexOf(document.activeElement as HTMLElement);
        const target = {
            ArrowDown: (at + 1) % all.length,
            ArrowUp: (at - 1 + all.length) % all.length,
            Home: 0,
            End: all.length - 1,
        }[e.key];
        if (target !== undefined) {
            e.preventDefault();
            all[target]?.focus();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Tab') {
            // From the button, Tab goes on to whatever follows it.
            close();
        }
    }

    function select(item: MenuItem) {
        close();
        item.onSelect();
    }

    return (
        <div ref={root}>
            <button
                ref={button}
                type="button"
                id={id}
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={!!open}
                aria-controls={open ? `${id}-menu` : undefined}
                disabled={disabled}
                onClick={() => (open ? close() : setOpen('first'))}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setOpen(e.key === 'ArrowDown' ? 'first' : 'last');
                    }
                }}
                class={iconButtonClass(variant, size)}
            >
                {icon}
            </button>
            {open ? (
                // The header sits outside the menu role, which holds only items, and describes it.
                <div
                    ref={menu}
                    onKeyDown={onMenuKey}
                    class="fixed z-30 flex max-h-[min(24rem,70vh)] max-w-72 min-w-44 flex-col overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg"
                >
                    {header ? (
                        <div
                            id={`${id}-header`}
                            class="mb-1 border-stone-200 border-b px-2.5 pt-1.5 pb-2.5"
                        >
                            {header}
                        </div>
                    ) : null}
                    <div
                        id={`${id}-menu`}
                        role="menu"
                        aria-labelledby={id}
                        aria-describedby={header ? `${id}-header` : undefined}
                        class="flex flex-col"
                    >
                        {items.map((item, i) => (
                            <Fragment key={item.id ?? item.label}>
                                {i > 0 &&
                                (item.separate || (item.danger && !items[i - 1]?.danger)) ? (
                                    <hr class="my-1 border-stone-200" />
                                ) : null}
                                <button
                                    type="button"
                                    {...(item.checked === undefined
                                        ? { role: 'menuitem' }
                                        : { role: 'menuitemradio', 'aria-checked': item.checked })}
                                    tabIndex={-1}
                                    onClick={() => select(item)}
                                    // Hover for the pointer, focus-visible for the keyboard.
                                    class={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm outline-none ${
                                        item.danger
                                            ? 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50'
                                            : 'text-stone-700 hover:bg-stone-100 focus-visible:bg-stone-100'
                                    }`}
                                >
                                    {item.checked === undefined ? (
                                        item.icon
                                    ) : (
                                        <IconCheck
                                            size={16}
                                            class={item.checked ? '' : 'invisible'}
                                        />
                                    )}
                                    <span class="truncate">{item.label}</span>
                                </button>
                            </Fragment>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
