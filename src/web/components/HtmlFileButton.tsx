import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { Button } from '../ui/Button.tsx';
import type { ButtonVariant } from '../ui/styles.ts';

/** A button picking an HTML mockup file from the device. */
export function HtmlFileButton({
    variant,
    disabled,
    title,
    onFile,
    children,
}: {
    variant?: ButtonVariant;
    disabled?: boolean;
    title?: string;
    onFile: (file: File) => void;
    children: ComponentChildren;
}) {
    const input = useRef<HTMLInputElement>(null);
    return (
        <>
            <Button
                variant={variant}
                disabled={disabled}
                title={title}
                onClick={() => input.current?.click()}
            >
                {children}
            </Button>
            <input
                ref={input}
                type="file"
                accept=".html,.htm,text/html"
                class="hidden"
                onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) onFile(file);
                    // Picking the same file again must fire onChange again.
                    e.currentTarget.value = '';
                }}
            />
        </>
    );
}
