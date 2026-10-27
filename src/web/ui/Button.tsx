import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { type ButtonSize, type ButtonVariant, buttonClass } from './styles.ts';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class'> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: ComponentChildren;
};

export function Button({ variant = 'primary', size = 'md', type = 'button', ...props }: Props) {
    return <button type={type} class={buttonClass(variant, size)} {...props} />;
}
