import type { ComponentChildren } from 'preact';

/**
 * A choice of one among a few options, shown side by side; options with an icon show only the
 * icon and use their label as its name. With `fill`, it spans its container, the options sharing
 * the width equally.
 */
export function Segmented<T extends string | number | null>({
    label,
    options,
    value,
    onChange,
    fill = false,
}: {
    label: string;
    options: { value: T; label: string; icon?: ComponentChildren }[];
    value: T;
    onChange: (value: T) => void;
    fill?: boolean;
}) {
    return (
        <fieldset
            class={`flex shrink-0 rounded-lg bg-stone-100 p-0.5 ${fill ? 'w-full' : 'w-fit'}`}
        >
            <legend class="sr-only">{label}</legend>
            {options.map((option) => (
                <button
                    key={option.label}
                    type="button"
                    aria-pressed={option.value === value}
                    aria-label={option.icon ? option.label : undefined}
                    title={option.icon ? option.label : undefined}
                    onClick={() => onChange(option.value)}
                    class={`flex h-7 items-center justify-center rounded-md text-sm transition-colors ${fill ? 'flex-1' : ''} ${option.icon ? 'px-1.5' : 'px-2.5'} ${
                        option.value === value
                            ? 'bg-white font-medium text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-900'
                    }`}
                >
                    {option.icon ?? option.label}
                </button>
            ))}
        </fieldset>
    );
}
