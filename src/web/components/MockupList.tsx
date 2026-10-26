import { IconFileTypeHtml, IconMessage, IconPencil, IconTrash } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Mockup, MockupActivity } from '../../shared/api/projects.ts';
import { api } from '../lib/api.ts';
import { useFormSubmit } from '../lib/form.ts';
import { formatBytes, formatDate, formatRelative } from '../lib/format.ts';
import { formatThreadCounts } from '../lib/review.ts';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { INPUT_CLASS } from '../ui/styles.ts';
import { MockupBadges } from './MockupBadges.tsx';

function Activity({ activity }: { activity: MockupActivity }) {
    if (!activity.lastActivityAt)
        return <span class="text-stone-400 text-xs">No comments yet</span>;
    return (
        <span class="flex flex-col text-xs">
            <span class="flex items-center gap-1.5 text-stone-700">
                <IconMessage size={14} class="text-stone-400" />
                {formatThreadCounts(activity.openThreads, activity.resolvedThreads)}
            </span>
            <span class="text-stone-500">last {formatRelative(activity.lastActivityAt)}</span>
        </span>
    );
}

// Columns of the mockup list, shared by its header and its rows.
const MOCKUP_COLUMNS =
    'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_4.5rem]';

/** The mockup name in an inline form: Enter saves, Escape cancels. */
function RenameRow({ mockup, onDone }: { mockup: Mockup; onDone: (mockup?: Mockup) => void }) {
    const [name, setName] = useState(mockup.name);
    const input = useRef<HTMLInputElement>(null);
    const { error, pending, submit } = useFormSubmit(async () => {
        onDone(await api.patch<Mockup>(`/mockups/${mockup.id}`, { name }));
    });

    useEffect(() => input.current?.focus(), []);

    return (
        <li class="px-5 py-3">
            <form class="flex flex-wrap items-center gap-3" onSubmit={submit}>
                <IconFileTypeHtml size={22} class="shrink-0 text-stone-400" />
                <input
                    aria-label="Mockup name"
                    required
                    maxLength={120}
                    value={name}
                    ref={input}
                    onInput={(e) => setName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') onDone();
                    }}
                    class={`w-full max-w-md ${INPUT_CLASS}`}
                />
                <Button type="submit" disabled={pending}>
                    Save
                </Button>
                <Button variant="ghost" onClick={() => onDone()}>
                    Cancel
                </Button>
            </form>
            {error ? (
                <div class="mt-2">
                    <FormError message={error} />
                </div>
            ) : null}
        </li>
    );
}

function MockupRow({
    mockup,
    onRename,
    onDelete,
}: {
    mockup: Mockup;
    onRename: () => void;
    onDelete: () => void;
}) {
    return (
        // The link covers the whole row; the actions sit above it.
        <li
            class={`relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-stone-50 ${MOCKUP_COLUMNS}`}
        >
            <div class="flex min-w-48 flex-1 items-center gap-3">
                <IconFileTypeHtml size={22} class="shrink-0 text-stone-400" />
                <div class="min-w-0">
                    <a
                        href={`/mockups/${mockup.id}`}
                        class="block truncate font-medium after:absolute after:inset-0"
                    >
                        {mockup.name}
                    </a>
                    <p class="truncate text-stone-500 text-xs">
                        {mockup.version.number > 1 ? `v${mockup.version.number} · ` : ''}
                        {mockup.version.originalFilename} · {formatBytes(mockup.version.sizeBytes)}
                    </p>
                </div>
            </div>
            <Activity activity={mockup.activity} />
            <MockupBadges mockup={mockup} />
            <span class="text-stone-500 text-xs md:text-right">
                {formatDate(mockup.version.createdAt)}
            </span>
            <div class="relative ml-auto flex gap-0.5 md:justify-end">
                <IconButton label={`Rename ${mockup.name}`} onClick={onRename}>
                    <IconPencil size={16} />
                </IconButton>
                <IconButton label={`Delete ${mockup.name}`} onClick={onDelete}>
                    <IconTrash size={16} />
                </IconButton>
            </div>
        </li>
    );
}

/** The mockups of a project, each renamed inline or deleted from its row. */
export function MockupList({
    mockups,
    onRenamed,
    onDelete,
}: {
    mockups: Mockup[];
    onRenamed: (mockup: Mockup) => void;
    onDelete: (mockup: Mockup) => void;
}) {
    const [renamingId, setRenamingId] = useState<string>();
    if (!mockups.length) return null;
    return (
        <div class="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div
                class={`hidden gap-x-4 border-stone-200 border-b bg-stone-50 px-5 py-2 font-medium text-stone-500 text-xs ${MOCKUP_COLUMNS}`}
            >
                <span>Mockup</span>
                <span>Comments</span>
                <span>Sharing</span>
                <span class="text-right">Uploaded</span>
                <span class="sr-only">Actions</span>
            </div>
            <ul class="divide-y divide-stone-200">
                {mockups.map((mockup) =>
                    mockup.id === renamingId ? (
                        <RenameRow
                            key={mockup.id}
                            mockup={mockup}
                            onDone={(updated) => {
                                if (updated) onRenamed(updated);
                                setRenamingId(undefined);
                            }}
                        />
                    ) : (
                        <MockupRow
                            key={mockup.id}
                            mockup={mockup}
                            onRename={() => setRenamingId(mockup.id)}
                            onDelete={() => onDelete(mockup)}
                        />
                    ),
                )}
            </ul>
        </div>
    );
}
