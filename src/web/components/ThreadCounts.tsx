import { IconCircleCheck, IconMessage } from '@tabler/icons-preact';
import { ICON } from '../ui/styles.ts';

/** Open and resolved threads, spelled out beside their icons, the resolved ones fainter; or that there are none. */
export function ThreadCounts({ open, resolved }: { open: number; resolved: number }) {
    if (!open && !resolved) return <span class="text-stone-500 text-xs">No comments</span>;
    return (
        <span class="flex items-center gap-3 text-xs tabular-nums">
            <span class="flex items-center gap-1 text-stone-900">
                <IconMessage size={ICON.sm} class="text-stone-400" />
                {open} open
            </span>
            <span class="flex items-center gap-1 text-stone-500">
                <IconCircleCheck size={ICON.sm} class="text-stone-400" />
                {resolved} resolved
            </span>
        </span>
    );
}
