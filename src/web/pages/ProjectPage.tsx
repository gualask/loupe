import { IconFileTypeHtml, IconPencil, IconTrash } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, Project, ProjectDetail } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { MockupBadges } from '../components/MockupBadges.tsx';
import { UploadDropzone } from '../components/UploadDropzone.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { formatBytes, formatDate } from '../lib/format.ts';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';
import { TextField } from '../ui/TextField.tsx';

function RenameForm({
    project,
    onDone,
}: {
    project: Project;
    onDone: (project?: Project) => void;
}) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description);
    const [error, setError] = useState<string>();

    async function submit(e: Event) {
        e.preventDefault();
        try {
            onDone(await api.patch<Project>(`/projects/${project.id}`, { name, description }));
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    return (
        <form
            class="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5"
            onSubmit={(e) => void submit(e)}
        >
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
            <FormError message={error} />
            <div class="flex gap-2">
                <Button type="submit">Save</Button>
                <Button variant="ghost" onClick={() => onDone()}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function MockupRow({ mockup }: { mockup: Mockup }) {
    return (
        <li>
            <a
                href={`/mockups/${mockup.id}`}
                class="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-stone-50"
            >
                <IconFileTypeHtml size={22} class="shrink-0 text-stone-400" />
                <div class="min-w-48 flex-1">
                    <p class="font-medium">{mockup.name}</p>
                    <p class="text-stone-500 text-xs">
                        {mockup.version.originalFilename} · {formatBytes(mockup.version.sizeBytes)}{' '}
                        · uploaded {formatDate(mockup.version.createdAt)}
                    </p>
                </div>
                <MockupBadges mockup={mockup} />
            </a>
        </li>
    );
}

export function ProjectPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const [project, setProject] = useState<ProjectDetail | null>();
    const [editing, setEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        api.get<ProjectDetail>(`/projects/${params.id}`).then(setProject, () => setProject(null));
    }, [params.id]);

    async function upload(file: File) {
        if (!project) return;
        setUploading(true);
        setError(undefined);
        try {
            const form = new FormData();
            form.set('file', file);
            const mockup = await api.post<Mockup>(`/projects/${project.id}/mockups`, form);
            route(`/mockups/${mockup.id}`);
        } catch (err) {
            setError(errorMessage(err));
            setUploading(false);
        }
    }

    async function remove() {
        if (!project) return;
        const count = project.mockups.length;
        const warning = count ? ` Its ${count} mockup(s) and all their comments will be lost.` : '';
        if (!confirm(`Delete "${project.name}"?${warning}`)) return;
        try {
            await api.delete(`/projects/${project.id}`);
            route('/');
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    if (project === undefined) return <AppShell>{null}</AppShell>;
    if (project === null) {
        return (
            <AppShell>
                <p class="text-stone-500">Project not found.</p>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <nav class="text-sm text-stone-500">
                    <a href="/" class="hover:text-stone-900">
                        Workspace
                    </a>{' '}
                    / {project.name}
                </nav>
                {editing ? (
                    <RenameForm
                        project={project}
                        onDone={(updated) => {
                            if (updated) setProject({ ...project, ...updated });
                            setEditing(false);
                        }}
                    />
                ) : (
                    <div class="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 class="font-semibold text-2xl tracking-tight">{project.name}</h1>
                            {project.description ? (
                                <p class="mt-1 text-stone-600">{project.description}</p>
                            ) : null}
                        </div>
                        <div class="flex gap-1">
                            <Button variant="ghost" onClick={() => setEditing(true)}>
                                <IconPencil size={16} />
                                Edit
                            </Button>
                            <Button variant="ghost" onClick={() => void remove()}>
                                <IconTrash size={16} />
                                Delete
                            </Button>
                        </div>
                    </div>
                )}
                <UploadDropzone busy={uploading} onFile={(file) => void upload(file)} />
                <FormError message={error} />
                {project.mockups.length ? (
                    <ul class="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
                        {project.mockups.map((mockup) => (
                            <MockupRow key={mockup.id} mockup={mockup} />
                        ))}
                    </ul>
                ) : null}
            </div>
        </AppShell>
    );
}
