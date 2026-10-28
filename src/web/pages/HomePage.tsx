import { IconFolder, IconPlus } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { AwaitingBadge } from '../components/AwaitingBadge.tsx';
import { ProjectDialog } from '../components/ProjectDialog.tsx';
import { ProjectMenu } from '../components/ProjectMenu.tsx';
import { ThreadCounts } from '../components/ThreadCounts.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatRelative } from '../lib/format.ts';
import { deleteProject } from '../lib/projects.ts';
import { useResource } from '../lib/resource.ts';
import { signedInUser } from '../lib/session.ts';
import { ownerFromQuery, resolveWorkspace, useWorkspaceOwners } from '../lib/workspaces.ts';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { FormError } from '../ui/FormError.tsx';
import { type ItemColumn, ItemList, ItemRow } from '../ui/ItemList.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { ICON, TEXT } from '../ui/styles.ts';

const commentsColumn: ItemColumn<Project> = {
    label: 'Comments',
    width: '11rem',
    cell: (p) => (
        <ThreadCounts open={p.activity.openThreads} resolved={p.activity.resolvedThreads} />
    ),
};
const mockupsColumn: ItemColumn<Project> = {
    label: 'Mockups',
    width: '5rem',
    wide: true,
    cell: (p) => <span class={`tabular-nums ${TEXT.meta}`}>{p.mockupCount}</span>,
};
const ownerColumn: ItemColumn<Project> = {
    label: 'Owner',
    width: '9rem',
    wide: true,
    cell: (p) => (
        <span class={`flex min-w-0 items-center gap-1.5 ${TEXT.meta}`}>
            <Avatar author={{ kind: 'editor', ...p.owner }} size="sm" />
            <span class="truncate">{p.owner.displayName}</span>
        </span>
    ),
};
const updatedColumn: ItemColumn<Project> = {
    label: 'Updated',
    width: '7rem',
    wide: true,
    cell: (p) => <span class={TEXT.meta}>{formatRelative(p.updatedAt)}</span>,
};

const COLUMNS = [commentsColumn, mockupsColumn, updatedColumn];
// When projects of several people are listed together.
const COLUMNS_WITH_OWNER = [commentsColumn, mockupsColumn, ownerColumn, updatedColumn];

function ProjectRow({
    project,
    columns,
    disabled,
    onEdit,
    onDelete,
}: {
    project: Project;
    columns: ItemColumn<Project>[];
    disabled: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <ItemRow
            item={project}
            columns={columns}
            href={`/projects/${project.id}`}
            icon={<IconFolder size={ICON.lg} />}
            name={project.name}
            badges={<AwaitingBadge count={project.activity.awaitingThreads} />}
            detail={project.description}
            menu={
                <ProjectMenu
                    project={project}
                    disabled={disabled}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            }
        />
    );
}

export function HomePage() {
    const { query, route } = useLocation();
    const user = signedInUser();
    const accounts = useWorkspaceOwners(user.role === 'admin');
    const resource = useResource('/projects', api.get<Project[]>);
    const projects = resource.status === 'ready' ? resource.data : undefined;
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<Project>();
    // Deletions from the rows.
    const change = useAction();

    const owner = ownerFromQuery(query.owner, user);
    // New projects go to the signed-in user's workspace, so another user's offers none.
    const someoneElses = owner !== 'all' && owner !== user.id;
    const shown = projects?.filter((p) => owner === 'all' || p.owner.id === owner);
    const workspace = resolveWorkspace(owner, user, { projects, accounts });
    const columns = owner === 'all' ? COLUMNS_WITH_OWNER : COLUMNS;

    const replaceProject = (updated: Project) =>
        resource.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));

    const removeProject = (project: Project) =>
        change.run(async () => {
            if (await deleteProject(project, project.mockupCount)) {
                resource.update((list) => list.filter((p) => p.id !== project.id));
            }
        });

    return (
        <AppShell workspace={workspace}>
            <div class="flex flex-col gap-6">
                <PageHeader
                    title="Projects"
                    actions={
                        someoneElses ? null : (
                            <Button onClick={() => setCreating(true)}>
                                <IconPlus size={ICON.md} />
                                New project
                            </Button>
                        )
                    }
                />
                <LoadStatus resource={resource} />
                {shown?.length === 0 ? (
                    <EmptyState title="No projects yet">
                        {someoneElses
                            ? 'Projects created by this person will show up here.'
                            : 'Create a project, then upload HTML mockups into it.'}
                    </EmptyState>
                ) : null}
                <FormError message={change.error} />
                {shown?.length ? (
                    <ItemList label="Project" columns={columns}>
                        {shown.map((project) => (
                            <ProjectRow
                                key={project.id}
                                project={project}
                                columns={columns}
                                disabled={change.pending}
                                onEdit={() => setEditing(project)}
                                onDelete={() => removeProject(project)}
                            />
                        ))}
                    </ItemList>
                ) : null}
            </div>
            {creating ? (
                <ProjectDialog
                    onSaved={(project) => route(`/projects/${project.id}`)}
                    onClose={() => setCreating(false)}
                />
            ) : null}
            {editing ? (
                <ProjectDialog
                    project={editing}
                    onSaved={(project) => {
                        replaceProject(project);
                        setEditing(undefined);
                    }}
                    onClose={() => setEditing(undefined)}
                />
            ) : null}
        </AppShell>
    );
}
