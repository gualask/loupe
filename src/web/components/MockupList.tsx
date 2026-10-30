import { IconAlertTriangle, IconChevronRight, IconFileTypeHtml } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import type { Mockup } from '../../shared/api/projects.ts';
import { formatBytes, formatRelative, plural } from '../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { type ItemColumn, ItemList, ItemRow } from '../ui/ItemList.tsx';
import { ICON, TEXT } from '../ui/styles.ts';
import { AwaitingBadge } from './AwaitingBadge.tsx';
import { EarlierVersionsDialog } from './EarlierVersionsDialog.tsx';
import { MockupMenu } from './MockupMenu.tsx';
import { RenameMockupDialog } from './RenameMockupDialog.tsx';
import { ThreadCounts } from './ThreadCounts.tsx';

const COLUMNS: ItemColumn<Mockup>[] = [
    {
        label: 'Comments',
        width: '11rem',
        cell: ({ activity }) => (
            <span class="flex flex-col gap-0.5">
                <ThreadCounts open={activity.openThreads} resolved={activity.resolvedThreads} />
                {activity.lastActivityAt ? (
                    <span class={TEXT.meta}>last {formatRelative(activity.lastActivityAt)}</span>
                ) : null}
            </span>
        ),
    },
    {
        label: 'Size',
        width: '5rem',
        wide: true,
        cell: (m) => (
            <span class={`tabular-nums ${TEXT.meta}`}>{formatBytes(m.version.sizeBytes)}</span>
        ),
    },
    {
        label: 'Uploaded',
        width: '7rem',
        wide: true,
        cell: (m) => <span class={TEXT.meta}>{formatRelative(m.version.createdAt)}</span>,
    },
];

function MockupRow({
    mockup,
    disabled,
    onRename,
    onSetArchived,
    onEarlierVersions,
    onDelete,
}: {
    mockup: Mockup;
    disabled: boolean;
    onRename: () => void;
    onSetArchived: (archived: boolean) => void;
    onEarlierVersions: () => void;
    onDelete: () => void;
}) {
    const external = mockup.version.externalRefs.length;
    return (
        <ItemRow
            item={mockup}
            columns={COLUMNS}
            href={`/mockups/${mockup.id}`}
            icon={<IconFileTypeHtml size={ICON.lg} />}
            name={mockup.name}
            badges={
                <>
                    <Badge>{`v${mockup.version.number}`}</Badge>
                    <AwaitingBadge count={mockup.activity.awaitingThreads} />
                    {external ? (
                        <Badge tone="warning" title="This file loads external resources">
                            <IconAlertTriangle size={ICON.sm} />
                            {plural(external, 'external resource')}
                        </Badge>
                    ) : null}
                </>
            }
            detail={mockup.version.originalFilename}
            menu={
                <MockupMenu
                    mockup={mockup}
                    disabled={disabled}
                    onRename={onRename}
                    onSetArchived={onSetArchived}
                    onEarlierVersions={onEarlierVersions}
                    onDelete={onDelete}
                />
            }
        />
    );
}

type RowActions = {
    /** While one of their changes is running. */
    disabled: boolean;
    onRenamed: (mockup: Mockup) => void;
    onSetArchived: (mockup: Mockup, archived: boolean) => void;
    onDelete: (mockup: Mockup) => void;
};

/**
 * A table of mockups, each renamed, archived, restored, cleared of earlier versions or deleted
 * from its row.
 */
function MockupTable({
    mockups,
    disabled,
    onRenamed,
    onSetArchived,
    onDelete,
}: RowActions & { mockups: Mockup[] }) {
    const [renaming, setRenaming] = useState<Mockup>();
    const [managingVersions, setManagingVersions] = useState<Mockup>();
    return (
        <>
            <ItemList label="Mockup" columns={COLUMNS}>
                {mockups.map((mockup) => (
                    <MockupRow
                        key={mockup.id}
                        mockup={mockup}
                        disabled={disabled}
                        onRename={() => setRenaming(mockup)}
                        onSetArchived={(archived) => onSetArchived(mockup, archived)}
                        onEarlierVersions={() => setManagingVersions(mockup)}
                        onDelete={() => onDelete(mockup)}
                    />
                ))}
            </ItemList>
            {renaming ? (
                <RenameMockupDialog
                    mockup={renaming}
                    onSaved={(updated) => {
                        onRenamed(updated);
                        setRenaming(undefined);
                    }}
                    onClose={() => setRenaming(undefined)}
                />
            ) : null}
            {managingVersions ? (
                <EarlierVersionsDialog
                    mockup={managingVersions}
                    onClose={() => setManagingVersions(undefined)}
                />
            ) : null}
        </>
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
                            size={ICON.md}
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
