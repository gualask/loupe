import { IconMessage, IconX } from '@tabler/icons-preact';
import { awaitsReply, type Thread } from '../../shared/api/reviews.ts';
import { authorColor } from '../lib/colors.ts';
import { formatRelative, plural } from '../lib/format.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { ICON, ROW_HOVER_CLASS } from '../ui/styles.ts';
import type { ThreadFilter } from './filters.ts';

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
    markAwaiting,
    active,
    onSelect,
}: {
    thread: Thread;
    label: string;
    orphaned: boolean;
    markAwaiting: boolean;
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
                class={`flex w-full gap-3 px-4 py-3 text-left ${active ? 'bg-stone-100' : ROW_HOVER_CLASS}`}
            >
                <span
                    class={`grid size-6 shrink-0 place-items-center rounded-full font-semibold text-white text-xs ${thread.status === 'resolved' ? 'opacity-50' : ''}`}
                    style={{ background: authorColor(thread.author) }}
                >
                    {thread.kind === 'pin' ? label : <IconMessage size={ICON.sm} />}
                </span>
                <span class="min-w-0 flex-1">
                    <span class="flex items-baseline gap-2 text-sm">
                        <span class="truncate font-medium">{thread.author.displayName}</span>
                        <span class="shrink-0 text-stone-500 text-xs">
                            {formatRelative(thread.createdAt)}
                        </span>
                    </span>
                    <span class="line-clamp-2 text-sm text-stone-600">{first?.body}</span>
                    <span class="mt-1 flex gap-2 text-stone-500 text-xs empty:hidden">
                        {markAwaiting && awaitsReply(thread) ? (
                            <span
                                class="font-medium text-amber-700"
                                title="The latest comment is a reviewer's"
                            >
                                Awaiting reply
                            </span>
                        ) : null}
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
    markAwaiting,
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
    /** Editors only: marks the threads waiting for their reply. */
    markAwaiting: boolean;
    /** Set when an editor opened the space filtered to one viewer. */
    viewerName: string | undefined;
    activeId: string | null;
    onFilter: (filter: ThreadFilter) => void;
    onClearViewer: () => void;
    onSelect: (thread: Thread) => void;
}) {
    return (
        // A layer over the mockup on narrow screens, a column beside it otherwise.
        <aside class="absolute inset-0 z-30 flex flex-col border-stone-200 bg-white md:static md:z-auto md:w-80 md:shrink-0 md:border-l">
            <div class="border-stone-100 border-b p-2">
                <Segmented
                    label="Show"
                    fill
                    options={FILTERS.filter((f) => f.value !== 'mine' || canFilterMine)}
                    value={filter}
                    onChange={onFilter}
                />
            </div>
            {viewerName ? (
                <div class="flex items-center gap-2 border-stone-100 border-b bg-stone-50 py-1.5 pr-2 pl-4 text-sm">
                    Comments by <span class="font-medium">{viewerName}</span>
                    <span class="ml-auto">
                        <IconButton label="Show everyone's comments" onClick={onClearViewer}>
                            <IconX size={ICON.sm} />
                        </IconButton>
                    </span>
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
                            markAwaiting={markAwaiting}
                            active={thread.id === activeId}
                            onSelect={() => onSelect(thread)}
                        />
                    ))}
                </ol>
            ) : (
                <p class="p-6 text-center text-sm text-stone-600">
                    {filter === 'open' ? 'No open comments yet.' : 'Nothing here.'}
                </p>
            )}
        </aside>
    );
}
