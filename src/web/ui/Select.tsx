import { IconChevronDown } from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { FIELD_CLASS } from './styles.ts';

/** A native select with its own chevron, kept inside the padding like the other inputs. */
export function Select({
    label,
    value,
    onChange,
    children,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ComponentChildren;
}) {
    return (
        <div class="relative inline-grid shrink-0">
            <select
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.currentTarget.value)}
                class={`${FIELD_CLASS} appearance-none bg-white pr-9 pl-3 text-sm`}
            >
                {children}
            </select>
            <IconChevronDown
                size={16}
                aria-hidden="true"
                class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-stone-500"
            />
        </div>
    );
}
