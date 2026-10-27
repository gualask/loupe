import { IconSend2 } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { storage } from '../lib/storage.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { Textarea } from '../ui/Input.tsx';
import { ICON } from '../ui/styles.ts';

/**
 * Comment box: Enter sends, Shift+Enter adds a line, Esc cancels. With `draftKey`, unsent text
 * survives a reload. `onSubmit` resolves to whether the server saved the text: the draft is kept
 * until it has, and put back in the box if it was rejected.
 */
export function Composer({
    placeholder,
    draftKey,
    initial = '',
    submitLabel = 'Send',
    onSubmit,
    onCancel,
}: {
    placeholder: string;
    draftKey?: string;
    initial?: string;
    submitLabel?: string;
    onSubmit: (body: string) => Promise<boolean>;
    onCancel?: () => void;
}) {
    const [text, setText] = useState(() => (draftKey && storage.get(draftKey)) || initial);
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    function update(value: string) {
        setText(value);
        if (!draftKey) return;
        if (value.trim()) storage.set(draftKey, value);
        else storage.remove(draftKey);
    }

    function submit() {
        const body = text.trim();
        if (!body) return;
        setText('');
        void onSubmit(body).then((ok) => {
            if (!ok) {
                setText((current) => current || body);
                return;
            }
            // Unless something new was typed in the meantime.
            if (draftKey && storage.get(draftKey)?.trim() === body) storage.remove(draftKey);
        });
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            submit();
        } else if (event.key === 'Escape' && onCancel) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        }
    }

    return (
        <div class="flex items-end gap-2">
            <Textarea
                ref={ref}
                rows={Math.min(6, Math.max(2, text.split('\n').length))}
                maxLength={5000}
                placeholder={placeholder}
                value={text}
                onInput={(e) => update(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                class="min-w-0 flex-1 resize-none"
            />
            <IconButton
                label={submitLabel}
                shortcut="Enter"
                variant="primary"
                size="lg"
                disabled={!text.trim()}
                onClick={submit}
            >
                <IconSend2 size={ICON.lg} />
            </IconButton>
        </div>
    );
}
