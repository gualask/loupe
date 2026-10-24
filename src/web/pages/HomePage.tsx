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
    const showOwner = project.owner.id !== currentUser.value?.id;
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

/** Admins see every workspace; they pick one, or all, through `?owner=`. */
function WorkspacePicker({
    projects,
    value,
    onChange,
}: {
    projects: Project[];
    value: string;
    onChange: (owner: string) => void;
}) {
    const me = currentUser.value?.id;
    const others = new Map(
        projects.filter((p) => p.owner.id !== me).map((p) => [p.owner.id, p.owner.displayName]),
    );
    return (
        <select
            aria-label="Workspace"
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            class="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
        >
            <option value="">My workspace</option>
            <option value="all">All workspaces</option>
            {[...others].map(([id, name]) => (
                <option key={id} value={id}>
                    {name}
                </option>
            ))}
        </select>
    );
}

export function HomePage() {
    const { path, query, route } = useLocation();
    const user = currentUser.value;
    const [projects, setProjects] = useState<Project[]>();
    const [error, setError] = useState<string>();
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        api.get<Project[]>('/projects').then(setProjects, (err) => setError(errorMessage(err)));
    }, []);

    const owner = user?.role === 'admin' ? (query.owner ?? '') : '';
    const shown = projects?.filter((p) =>
        owner === 'all' ? true : p.owner.id === (owner || user?.id),
    );

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <div class="flex flex-wrap items-center gap-4">
                    <h1 class="font-semibold text-2xl tracking-tight">Workspace</h1>
                    {user?.role === 'admin' && projects ? (
                        <WorkspacePicker
                            projects={projects}
                            value={owner}
                            onChange={(value) => route(value ? `${path}?owner=${value}` : path)}
                        />
                    ) : null}
                    <span class="flex-1" />
                    {creating ? null : (
                        <Button onClick={() => setCreating(true)}>
                            <IconPlus size={16} />
                            New project
                        </Button>
                    )}
                </div>
                {creating ? <NewProjectForm onCancel={() => setCreating(false)} /> : null}
                <FormError message={error} />
                {shown?.length === 0 && !creating ? (
                    <div class="rounded-xl border border-stone-300 border-dashed p-10 text-center">
                        <p class="font-medium">No projects yet</p>
                        <p class="mt-1 text-sm text-stone-500">
                            Create a project, then upload HTML mockups into it.
                        </p>
                    </div>
                ) : null}
                {shown?.length ? (
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
