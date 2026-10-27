import {
    IconAlertTriangle,
    IconChevronRight,
    IconFileTypeHtml,
    IconMessage,
} from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Mockup, type MockupActivity, NAME_MAX_LENGTH } from '../../shared/api/projects.ts';
import { useFormSubmit } from '../lib/form.ts';
import { formatBytes, formatDate, formatRelative, plural } from '../lib/format.ts';
import { renameMockup } from '../lib/mockups.ts';
import { formatThreadCounts } from '../lib/review.ts';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';
import { Input } from '../ui/Input.tsx';
import { CARD_CLASS, ROW_HOVER_CLASS } from '../ui/styles.ts';
import { MockupMenu } from './MockupMenu.tsx';

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

// Columns of the mockup list, shared by its header and its rows; the last one fits the menu.
const MOCKUP_COLUMNS = 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_1.75rem]';

/** The mockup name in an inline form: Enter saves, Escape cancels. */
function RenameRow({ mockup, onDone }: { mockup: Mockup; onDone: (mockup?: Mockup) => void }) {
    const [name, setName] = useState(mockup.name);
    const input = useRef<HTMLInputElement>(null);
    const { error, pending, submit } = useFormSubmit(async () => {
        onDone(await renameMockup(mockup, name));
    });

    useEffect(() => input.current?.focus(), []);

    return (
        <li class="px-5 py-3">
            <form class="flex flex-wrap items-center gap-3" onSubmit={submit}>
                <IconFileTypeHtml size={22} class="shrink-0 text-stone-400" />
                <Input
                    aria-label="Mockup name"
                    required
                    maxLength={NAME_MAX_LENGTH}
                    value={name}
                    ref={input}
                    onInput={(e) => setName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') onDone();
                    }}
                    class="w-full max-w-md"
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
    onSetArchived,
    onDelete,
}: {
    mockup: Mockup;
    onRename: () => void;
    onSetArchived: (archived: boolean) => void;
    onDelete: () => void;
}) {
    const external = mockup.version.externalRefs.length;
    return (
        // The link covers the whole row; the actions sit above it.
        <li
            class={`relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${ROW_HOVER_CLASS} ${MOCKUP_COLUMNS}`}
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
                    {external ? (
                        <p
                            class="flex items-center gap-1 text-amber-700 text-xs"
                            title="This file loads external resources"
                        >
                            <IconAlertTriangle size={14} />
                            {plural(external, 'external resource')}
                        </p>
                    ) : null}
                </div>
            </div>
            <Activity activity={mockup.activity} />
            <span class="text-stone-500 text-xs md:text-right">
                {formatDate(mockup.version.createdAt)}
            </span>
            <div class="relative ml-auto">
                <MockupMenu
                    mockup={mockup}
                    onRename={onRename}
                    onSetArchived={onSetArchived}
                    onDelete={onDelete}
                />
            </div>
        </li>
    );
}

type RowActions = {
    onRenamed: (mockup: Mockup) => void;
    onSetArchived: (mockup: Mockup, archived: boolean) => void;
    onDelete: (mockup: Mockup) => void;
};

/** A table of mockups, each renamed inline, archived, restored or deleted from its row. */
function MockupTable({
    mockups,
    onRenamed,
    onSetArchived,
    onDelete,
}: RowActions & { mockups: Mockup[] }) {
    const [renamingId, setRenamingId] = useState<string>();
    return (
        <div class={`overflow-hidden ${CARD_CLASS}`}>
            <div
                class={`hidden gap-x-4 border-stone-200 border-b bg-stone-50 px-5 py-2 font-medium text-stone-500 text-xs ${MOCKUP_COLUMNS}`}
            >
                <span>Mockup</span>
                <span>Comments</span>
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
                            onSetArchived={(archived) => onSetArchived(mockup, archived)}
                            onDelete={() => onDelete(mockup)}
                        />
                    ),
                )}
            </ul>
        </div>
    );
}

const newestFirst = (a: Mockup, b: Mockup) => b.createdAt.localeCompare(a.createdAt);

/** The mockups of a project; archived ones in a section of their own, closed by default. */
export function MockupList({ mockups, ...actions }: RowActions & { mockups: Mockup[] }) {
    const [showArchived, setShowArchived] = useState(false);
    const active = mockups.filter((m) => !m.archivedAt).sort(newestFirst);
    const archived = mockups.filter((m) => m.archivedAt).sort(newestFirst);

    return (
        <>
            {active.length ? <MockupTable mockups={active} {...actions} /> : null}
            {archived.length ? (
                <section class="flex flex-col gap-3">
                    <button
                        type="button"
                        aria-expanded={showArchived}
                        onClick={() => setShowArchived((shown) => !shown)}
                        class="-ml-1 flex w-fit items-center gap-1 rounded-md px-1 py-0.5 font-medium text-sm text-stone-600 hover:text-stone-900"
                    >
                        <IconChevronRight
                            size={16}
                            class={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
                        />
                        Archived ({archived.length})
                    </button>
                    {showArchived ? <MockupTable mockups={archived} {...actions} /> : null}
                </section>
            ) : null}
        </>
    );
}
