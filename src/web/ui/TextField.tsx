import type { LooseInputHTMLAttributes } from 'preact';
import { Field } from './Field.tsx';
import { Input } from './Input.tsx';

type Props = Pick<
    LooseInputHTMLAttributes<HTMLInputElement>,
    | 'value'
    | 'onInput'
    | 'onFocus'
    | 'required'
    | 'autocomplete'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
> & {
    label: string;
    hint?: string;
};

export function TextField({ label, hint, ...input }: Props) {
    return (
        <Field label={label} hint={hint}>
            {(control) => <Input {...control} {...input} />}
        </Field>
    );
}
