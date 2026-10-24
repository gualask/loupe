import type { InputHTMLAttributes } from 'preact';
import { useId } from 'preact/hooks';

type Props = Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onInput' | 'required' | 'autocomplete' | 'pattern' | 'minLength' | 'maxLength'
> & {
    label: string;
    hint?: string;
    type?: 'text' | 'password';
};

export function TextField({ label, hint, type = 'text', ...input }: Props) {
    const id = useId();
    const props = {
        ...input,
        id,
        class: 'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200',
    };
    return (
        <div class="flex flex-col gap-1.5">
            <label for={id} class="font-medium text-sm text-stone-700">
                {label}
            </label>
            {/* Preact's input types are a union per `type`, so each variant is spelled out. */}
            {type === 'password' ? (
                <input type="password" {...props} />
            ) : (
                <input type="text" {...props} />
            )}
            {hint ? <p class="text-stone-500 text-xs">{hint}</p> : null}
        </div>
    );
}
