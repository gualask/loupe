import { IconFolder, IconPlus } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { currentUser } from '../lib/session.ts';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';
import { TextField } from '../ui/TextField.tsx';

function NewProjectForm({ onCancel }: { onCancel: () => void }) {
    const { route } = useLocation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string>();

    async function submit(e: Event) {
        e.preventDefault();
        setError(undefined);
        try {
            const project = await api.post<Project>('/projects', { name, description });
            route(`/projects/${project.id}`);
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
                label="Description (optional)"
                maxLength={500}
                value={description}
                onInput={(e) => setDescription(e.currentTarget.value)}
            />
            <FormError message={error} />
            <div class="flex gap-2">
                <Button type="submit">Create project</Button>
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const showOwner = currentUser.value?.role === 'admin';
    return (
        <a
            href={`/projects/${project.id}`}
            class="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-stone-400"
        >
            <div class="flex items-center gap-2 font-medium">
                <IconFolder size={18} class="text-stone-400" />
                {project.name}
            </div>
            {project.description ? (
                <p class="line-clamp-2 text-sm text-stone-600">{project.description}</p>
            ) : null}
            <p class="mt-auto text-stone-500 text-xs">
                {project.mockupCount} {project.mockupCount === 1 ? 'mockup' : 'mockups'} · created{' '}
                {formatDate(project.createdAt)}
                {showOwner ? ` · ${project.owner.displayName}` : ''}
            </p>
        </a>
    );
}

export function HomePage() {
    const [projects, setProjects] = useState<Project[]>();
    const [error, setError] = useState<string>();
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        api.get<Project[]>('/projects').then(setProjects, (err) => setError(errorMessage(err)));
    }, []);

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <div class="flex items-center justify-between gap-4">
                    <h1 class="font-semibold text-2xl tracking-tight">Workspace</h1>
                    {creating ? null : (
                        <Button onClick={() => setCreating(true)}>
                            <IconPlus size={16} />
                            New project
                        </Button>
                    )}
                </div>
                {creating ? <NewProjectForm onCancel={() => setCreating(false)} /> : null}
                <FormError message={error} />
                {projects?.length === 0 && !creating ? (
                    <div class="rounded-xl border border-stone-300 border-dashed p-10 text-center">
                        <p class="font-medium">No projects yet</p>
                        <p class="mt-1 text-sm text-stone-500">
                            Create a project, then upload HTML mockups into it.
                        </p>
                    </div>
                ) : null}
                {projects?.length ? (
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
