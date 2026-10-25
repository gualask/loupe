import { IconMessage, IconX } from '@tabler/icons-preact';
import type { Thread } from '../../shared/api/reviews.ts';
import { authorColor } from '../lib/colors.ts';
import { formatRelative, plural } from '../lib/format.ts';

export type ThreadFilter = 'open' | 'mine' | 'resolved' | 'all';

const FILTERS: { value: ThreadFilter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'mine', label: 'Mine' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
];

function ThreadItem({
    thread,
    label,
    orphaned,
    active,
    onSelect,
}: {
    thread: Thread;
    label: string;
    orphaned: boolean;
    active: boolean;
    onSelect: () => void;
}) {
    const first = thread.comments.find((c) => !c.deleted);
    const replies = thread.comments.filter((c) => !c.deleted).length - 1;
    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                class={`flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50 ${active ? 'bg-stone-100' : ''}`}
            >
                <span
                    class={`grid size-6 shrink-0 place-items-center rounded-full font-semibold text-[11px] text-white ${thread.status === 'resolved' ? 'opacity-50' : ''}`}
                    style={{ background: authorColor(thread.author) }}
                >
                    {thread.kind === 'pin' ? label : <IconMessage size={13} />}
                </span>
                <span class="min-w-0 flex-1">
                    <span class="flex items-baseline gap-2 text-sm">
                        <span class="truncate font-medium">{thread.author.displayName}</span>
                        <span class="shrink-0 text-stone-400 text-xs">
                            {formatRelative(thread.createdAt)}
                        </span>
                    </span>
                    <span class="line-clamp-2 text-sm text-stone-600">{first?.body}</span>
                    <span class="mt-1 flex gap-2 text-stone-500 text-xs empty:hidden">
                        {replies > 0 ? <span>{plural(replies, 'reply', 'replies')}</span> : null}
                        {thread.status === 'resolved' ? (
                            <span class="text-emerald-700">Resolved</span>
                        ) : null}
                        {orphaned ? (
                            <span class="text-amber-700" title="Its element is no longer found">
                                Orphaned
                            </span>
                        ) : null}
                    </span>
                </span>
            </button>
        </li>
    );
}

/** Side panel listing the threads that match the current filter. */
export function ThreadPanel({
    threads,
    labels,
    orphaned,
    filter,
    canFilterMine,
    viewerName,
    activeId,
    onFilter,
    onClearViewer,
    onSelect,
}: {
    threads: Thread[];
    labels: Map<string, string>;
    orphaned: Set<string>;
    filter: ThreadFilter;
    canFilterMine: boolean;
    /** Set when an editor opened the space filtered to one viewer. */
    viewerName: string | undefined;
    activeId: string | null;
    onFilter: (filter: ThreadFilter) => void;
    onClearViewer: () => void;
    onSelect: (thread: Thread) => void;
}) {
    return (
        // A full-width layer over the mockup on narrow screens, a column beside it otherwise.
        <aside class="fixed inset-x-0 top-12 bottom-0 z-30 flex flex-col border-stone-200 bg-white md:static md:z-auto md:w-80 md:shrink-0 md:border-l">
            <div class="flex gap-1 border-stone-100 border-b p-2">
                {FILTERS.filter((f) => f.value !== 'mine' || canFilterMine).map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        aria-pressed={filter === f.value}
                        onClick={() => onFilter(f.value)}
                        class={`rounded-md px-2.5 py-1 text-sm ${filter === f.value ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
            {viewerName ? (
                <div class="flex items-center gap-2 border-stone-100 border-b bg-stone-50 px-4 py-2 text-sm">
                    Comments by <span class="font-medium">{viewerName}</span>
                    <button
                        type="button"
                        onClick={onClearViewer}
                        aria-label="Show everyone's comments"
                        class="ml-auto rounded p-0.5 text-stone-500 hover:bg-stone-200"
                    >
                        <IconX size={14} />
                    </button>
                </div>
            ) : null}
            {threads.length ? (
                <ol class="flex-1 divide-y divide-stone-100 overflow-y-auto">
                    {threads.map((thread) => (
                        <ThreadItem
                            key={thread.id}
                            thread={thread}
                            label={labels.get(thread.id) ?? ''}
                            orphaned={orphaned.has(thread.id)}
                            active={thread.id === activeId}
                            onSelect={() => onSelect(thread)}
                        />
                    ))}
                </ol>
            ) : (
                <p class="p-6 text-center text-sm text-stone-500">
                    {filter === 'open' ? 'No open comments yet.' : 'Nothing here.'}
                </p>
            )}
        </aside>
    );
}
