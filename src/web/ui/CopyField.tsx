import { IconCheck, IconCopy } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { FIELD_CLASS } from './styles.ts';

/**
 * Copies `text`. The Clipboard API exists only in secure contexts, and a self-hosted Loupe may be
 * reached over plain HTTP, so without it a hidden selection is copied instead.
 */
async function copyText(text: string) {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Copy failed');
}

/** A link that cannot be edited, shown as a field that copies it when clicked. */
export function CopyField({ value }: { value: string }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

    useEffect(() => {
        if (state === 'idle') return;
        const reset = setTimeout(() => setState('idle'), 2000);
        return () => clearTimeout(reset);
    }, [state]);

    return (
        <button
            type="button"
            title="Copy link"
            aria-label={`Copy link ${value}`}
            onClick={() =>
                copyText(value).then(
                    () => setState('copied'),
                    () => setState('failed'),
                )
            }
            class={`${FIELD_CLASS} flex w-full items-center gap-2 bg-stone-50 px-3 text-left transition-colors hover:border-stone-400 hover:bg-white`}
        >
            {/* No width of its own, so a long link never widens the page. */}
            <span class="w-0 flex-1 truncate font-mono text-xs">{value}</span>
            {/* Announced to screen readers as well. */}
            <span
                role="status"
                class={`flex shrink-0 items-center gap-1 font-medium text-xs ${
                    state === 'copied'
                        ? 'text-emerald-700'
                        : state === 'failed'
                          ? 'text-red-700'
                          : 'text-stone-500'
                }`}
            >
                {state === 'copied' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
            </span>
        </button>
    );
}
