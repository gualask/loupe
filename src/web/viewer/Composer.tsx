import { IconSend2 } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { storage } from '../lib/storage.ts';
import { INPUT_CLASS } from '../ui/styles.ts';

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
            <textarea
                ref={ref}
                rows={Math.min(6, Math.max(2, text.split('\n').length))}
                maxLength={5000}
                placeholder={placeholder}
                value={text}
                onInput={(e) => update(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                class={`min-w-0 flex-1 resize-none ${INPUT_CLASS}`}
            />
            <button
                type="button"
                onClick={submit}
                disabled={!text.trim()}
                aria-label={submitLabel}
                title={`${submitLabel} (Enter)`}
                class="grid size-9 shrink-0 place-items-center rounded-md bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40"
            >
                <IconSend2 size={18} />
            </button>
        </div>
    );
}
