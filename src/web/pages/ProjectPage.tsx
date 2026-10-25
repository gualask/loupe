import { IconFileTypeHtml, IconMessage, IconPencil, IconTrash } from '@tabler/icons-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, MockupActivity, Project, ProjectDetail } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { MockupBadges } from '../components/MockupBadges.tsx';
import { UploadDropzone } from '../components/UploadDropzone.tsx';
import { api } from '../lib/api.ts';
import { useAction, useFormSubmit } from '../lib/form.ts';
import { formatBytes, formatDate, formatRelative, plural } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { Button } from '../ui/Button.tsx';
import { FormCard } from '../ui/FormCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { INPUT_CLASS } from '../ui/styles.ts';
import { TextField } from '../ui/TextField.tsx';

function EditProjectForm({
    project,
    onDone,
}: {
    project: Project;
    onDone: (project?: Project) => void;
}) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description);

    async function save() {
        onDone(await api.patch<Project>(`/projects/${project.id}`, { name, description }));
    }

    return (
        <FormCard submitLabel="Save" onSubmit={save} onCancel={() => onDone()}>
            <TextField
                label="Project name"
                required
                maxLength={120}
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
            />
            <TextField
                label="Description"
                maxLength={500}
                value={description}
                onInput={(e) => setDescription(e.currentTarget.value)}
            />
        </FormCard>
    );
}

function Activity({ activity }: { activity: MockupActivity }) {
    if (!activity.lastActivityAt)
        return <span class="text-stone-400 text-xs">No comments yet</span>;
    return (
        <span class="flex flex-col text-xs">
            <span class="flex items-center gap-1.5 text-stone-700">
                <IconMessage size={14} class="text-stone-400" />
                {activity.openThreads} open · {activity.resolvedThreads} resolved
            </span>
            <span class="text-stone-500">last {formatRelative(activity.lastActivityAt)}</span>
        </span>
    );
}

// Columns of the mockup list, shared by its header and its rows.
const MOCKUP_COLUMNS =
    'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_4.5rem]';

type MockupItem = ProjectDetail['mockups'][number];

/** The mockup name in an inline form: Enter saves, Escape cancels. */
function RenameRow({ mockup, onDone }: { mockup: MockupItem; onDone: (mockup?: Mockup) => void }) {
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
    mockup: MockupItem;
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

export function ProjectPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const resource = useResource(`/projects/${params.id}`, api.get<ProjectDetail>);
    const [editing, setEditing] = useState(false);
    const [renamingId, setRenamingId] = useState<string>();
    const upload = useAction();
    const deletion = useAction();

    if (resource.status !== 'ready') {
        return (
            <AppShell>
                <LoadStatus resource={resource} missing="Project not found." />
            </AppShell>
        );
    }
    const project = resource.data;

    const uploadFile = (file: File) =>
        upload.run(async () => {
            const form = new FormData();
            form.set('file', file);
            const mockup = await api.post<Mockup>(`/projects/${project.id}/mockups`, form);
            route(`/mockups/${mockup.id}`);
        });

    function remove() {
        const count = project.mockups.length;
        const warning = count
            ? ` Its ${plural(count, 'mockup')} and all their comments will be lost.`
            : '';
        if (!confirm(`Delete "${project.name}"?${warning}`)) return;
        deletion.run(async () => {
            await api.delete(`/projects/${project.id}`);
            route('/');
        });
    }

    const updateMockups = (change: (mockups: MockupItem[]) => MockupItem[]) =>
        resource.update((p) => ({ ...p, mockups: change(p.mockups) }));

    function removeMockup(mockup: MockupItem) {
        if (!confirm(`Delete "${mockup.name}" and all its comments?`)) return;
        deletion.run(async () => {
            await api.delete(`/mockups/${mockup.id}`);
            updateMockups((list) => list.filter((m) => m.id !== mockup.id));
        });
    }

    const renamed = (updated: Mockup) =>
        updateMockups((list) => list.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                {/* While editing, the form replaces the actions and the description. */}
                <PageHeader
                    trail={[{ href: '/', label: 'Workspace' }]}
                    title={project.name}
                    description={editing ? undefined : project.description}
                    actions={
                        editing ? null : (
                            <>
                                <Button variant="ghost" onClick={() => setEditing(true)}>
                                    <IconPencil size={16} />
                                    Edit
                                </Button>
                                <Button variant="ghost" onClick={remove}>
                                    <IconTrash size={16} />
                                    Delete
                                </Button>
                            </>
                        )
                    }
                />
                {editing ? (
                    <EditProjectForm
                        project={project}
                        onDone={(updated) => {
                            if (updated) resource.update((p) => ({ ...p, ...updated }));
                            setEditing(false);
                        }}
                    />
                ) : null}
                <UploadDropzone
                    busy={upload.pending}
                    compact={project.mockups.length > 0}
                    onFile={uploadFile}
                />
                <FormError message={upload.error ?? deletion.error} />
                {project.mockups.length ? (
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
                            {project.mockups.map((mockup) =>
                                mockup.id === renamingId ? (
                                    <RenameRow
                                        key={mockup.id}
                                        mockup={mockup}
                                        onDone={(updated) => {
                                            if (updated) renamed(updated);
                                            setRenamingId(undefined);
                                        }}
                                    />
                                ) : (
                                    <MockupRow
                                        key={mockup.id}
                                        mockup={mockup}
                                        onRename={() => setRenamingId(mockup.id)}
                                        onDelete={() => removeMockup(mockup)}
                                    />
                                ),
                            )}
                        </ul>
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
