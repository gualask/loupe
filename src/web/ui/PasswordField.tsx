import { IconEye, IconEyeOff } from '@tabler/icons-preact';
import { h, type LooseInputHTMLAttributes } from 'preact';
import { useState } from 'preact/hooks';
import { Field } from './Field.tsx';
import { IconButton } from './IconButton.tsx';
import { FIELD_CLASS, ICON } from './styles.ts';

type Props = Pick<
    LooseInputHTMLAttributes<HTMLInputElement>,
    'value' | 'onInput' | 'required' | 'autocomplete' | 'minLength'
> & {
    label: string;
    hint?: string;
};

/** A password input with a toggle that shows what is typed, kept inside its padding. */
export function PasswordField({ label, hint, ...input }: Props) {
    const [visible, setVisible] = useState(false);
    return (
        <Field label={label} hint={hint}>
            {(control) => (
                <div class="relative grid">
                    {/* JSX types <input> as a union per `type`, which a toggled type cannot
                        satisfy. Edge draws its own reveal button, which would sit beside ours. */}
                    {h('input', {
                        ...control,
                        ...input,
                        type: visible ? 'text' : 'password',
                        class: `${FIELD_CLASS} bg-white pr-10 pl-3 text-sm [&::-ms-reveal]:hidden`,
                    })}
                    <div class="absolute inset-y-0 right-1 flex items-center">
                        <IconButton
                            label="Show password"
                            pressed={visible}
                            onClick={() => setVisible(!visible)}
                        >
                            {visible ? <IconEyeOff size={ICON.md} /> : <IconEye size={ICON.md} />}
                        </IconButton>
                    </div>
                </div>
            )}
        </Field>
    );
}
