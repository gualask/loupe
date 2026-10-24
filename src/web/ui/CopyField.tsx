import { IconCheck, IconCopy } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { Button } from './Button.tsx';

/** A read-only value with a copy button, used for one-time links. */
export function CopyField({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div class="flex gap-2">
            <input
                readOnly
                value={value}
                aria-label="Link"
                onFocus={(e) => e.currentTarget.select()}
                class="min-w-0 flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-xs"
            />
            <Button variant="secondary" onClick={() => void copy()}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                {copied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    );
}
