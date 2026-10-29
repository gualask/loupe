import { h, type LooseInputHTMLAttributes, type TextareaHTMLAttributes } from 'preact';
import { INPUT_CLASS } from './styles.ts';

/** A text input; `class` adds layout (width, flex) to the shared look. */
export function Input({ class: className, ...props }: LooseInputHTMLAttributes<HTMLInputElement>) {
    // JSX types <input> as a union per `type`, which a pass-through cannot satisfy.
    return h('input', { ...props, class: `${INPUT_CLASS} ${className ?? ''}` });
}

export function Textarea({
    class: className,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} class={`${INPUT_CLASS} ${className ?? ''}`} />;
}
