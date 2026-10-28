import { IconSend2 } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IconButton } from '../ui/IconButton.tsx';
import { Textarea } from '../ui/Input.tsx';
import { ICON } from '../ui/styles.ts';
import { joinText, readDraft, saveDraft, sendDraft } from './drafts.ts';

/**
 * Comment box: Enter sends, Shift+Enter adds a line, Esc cancels. With `draftKey`, unsent text
 * survives a reload. `onSubmit` resolves to whether the server saved the text: the text is kept
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
    const [text, setText] = useState(() => (draftKey && readDraft(draftKey)) || initial);
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    function update(value: string) {
        setText(value);
        if (draftKey) saveDraft(draftKey, value);
    }

    function submit() {
        const body = text.trim();
        if (!body) return;
        setText('');
        const settle = draftKey ? sendDraft(draftKey, body) : undefined;
        void onSubmit(body).then((ok) => {
            settle?.(ok);
            if (!ok) setText((current) => joinText(current, body));
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
