import { IconFileTypeHtml, IconFolder, IconPlus } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { ProjectForm } from '../components/ProjectForm.tsx';
import { ProjectMenu } from '../components/ProjectMenu.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatDate, plural } from '../lib/format.ts';
import { createProject, deleteProject, updateProject } from '../lib/projects.ts';
import { useResource } from '../lib/resource.ts';
import { signedInUser } from '../lib/session.ts';
import { ownerFromQuery, resolveWorkspace, useWorkspaceOwners } from '../lib/workspaces.ts';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { CARD_CLASS, ICON } from '../ui/styles.ts';

function ProjectCard({
    project,
    showOwner,
    disabled,
    onEdit,
    onDelete,
}: {
    project: Project;
    /** When projects of several people are listed together. */
    showOwner: boolean;
    disabled: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        // The link covers the whole card; the menu sits above it.
        <div
            class={`relative flex flex-col gap-2 p-5 transition hover:border-stone-400 hover:shadow-sm ${CARD_CLASS}`}
        >
            <div class="-my-1 -mr-2 flex items-center gap-2">
                <IconFolder size={ICON.lg} class="shrink-0 text-stone-400" />
                <a
                    href={`/projects/${project.id}`}
                    class="min-w-0 flex-1 truncate font-medium after:absolute after:inset-0"
                >
                    {project.name}
                </a>
                <div class="relative">
                    <ProjectMenu
                        project={project}
                        disabled={disabled}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                </div>
            </div>
            {project.description ? (
                <p class="line-clamp-2 text-sm text-stone-600">{project.description}</p>
            ) : null}
            {showOwner ? (
                <p class="flex min-w-0 items-center gap-1.5 text-stone-500 text-xs">
                    <Avatar author={{ kind: 'editor', ...project.owner }} size="sm" />
                    <span class="truncate">{project.owner.displayName}</span>
                </p>
            ) : null}
            <div class="mt-auto flex items-center justify-between gap-3 text-stone-500 text-xs">
                <span class="flex items-center gap-1">
                    <IconFileTypeHtml size={ICON.sm} class="text-stone-400" />
                    {plural(project.mockupCount, 'mockup')}
                </span>
                <span>Created {formatDate(project.createdAt)}</span>
            </div>
        </div>
    );
}

export function HomePage() {
    const { query, route } = useLocation();
    const user = signedInUser();
    const accounts = useWorkspaceOwners(user.role === 'admin');
    const resource = useResource('/projects', api.get<Project[]>);
    const projects = resource.status === 'ready' ? resource.data : undefined;
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string>();
    // Deletions from the cards.
    const change = useAction();

    const owner = ownerFromQuery(query.owner, user);
    // New projects go to the signed-in user's workspace, so another user's offers none.
    const someoneElses = owner !== 'all' && owner !== user.id;
    const shown = projects?.filter((p) => owner === 'all' || p.owner.id === owner);
    const workspace = resolveWorkspace(owner, user, { projects, accounts });

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
                        creating || someoneElses ? null : (
                            <Button onClick={() => setCreating(true)}>
                                <IconPlus size={ICON.md} />
                                New project
                            </Button>
                        )
                    }
                />
                {creating ? (
                    <ProjectForm
                        submitLabel="Create project"
                        onSubmit={async (fields) => {
                            const project = await createProject(fields);
                            route(`/projects/${project.id}`);
                        }}
                        onCancel={() => setCreating(false)}
                    />
                ) : null}
                <LoadStatus resource={resource} />
                {shown?.length === 0 && !creating ? (
                    <EmptyState title="No projects yet">
                        {someoneElses
                            ? 'Projects created by this person will show up here.'
                            : 'Create a project, then upload HTML mockups into it.'}
                    </EmptyState>
                ) : null}
                <FormError message={change.error} />
                {shown?.length ? (
                    <div class="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
                        {shown.map((project) =>
                            project.id === editingId ? (
                                <ProjectForm
                                    key={project.id}
                                    initial={project}
                                    submitLabel="Save"
                                    onSubmit={async (fields) => {
                                        replaceProject(await updateProject(project, fields));
                                        setEditingId(undefined);
                                    }}
                                    onCancel={() => setEditingId(undefined)}
                                />
                            ) : (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    showOwner={owner === 'all'}
                                    disabled={change.pending}
                                    onEdit={() => setEditingId(project.id)}
                                    onDelete={() => removeProject(project)}
                                />
                            ),
                        )}
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
