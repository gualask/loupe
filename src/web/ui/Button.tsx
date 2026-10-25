import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { type ButtonVariant, buttonClass } from './styles.ts';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    children: ComponentChildren;
};

export function Button({
    variant = 'primary',
    class: className,
    type = 'button',
    ...props
}: Props) {
    return <button type={type} class={`${buttonClass(variant)} ${className ?? ''}`} {...props} />;
}
