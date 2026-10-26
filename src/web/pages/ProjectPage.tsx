import { IconPencil, IconTrash } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, Project, ProjectDetail } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { MockupList } from '../components/MockupList.tsx';
import { UploadDropzone } from '../components/UploadDropzone.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { plural } from '../lib/format.ts';
import { useResource } from '../lib/resource.ts';
import { Button } from '../ui/Button.tsx';
import { FormCard } from '../ui/FormCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
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

export function ProjectPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const resource = useResource(`/projects/${params.id}`, api.get<ProjectDetail>);
    const [editing, setEditing] = useState(false);
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
            const mockup = await api.upload<Mockup>(`/projects/${project.id}/mockups`, file);
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

    const updateMockups = (change: (mockups: Mockup[]) => Mockup[]) =>
        resource.update((p) => ({ ...p, mockups: change(p.mockups) }));

    function removeMockup(mockup: Mockup) {
        if (!confirm(`Delete "${mockup.name}" and all its comments?`)) return;
        deletion.run(async () => {
            await api.delete(`/mockups/${mockup.id}`);
            updateMockups((list) => list.filter((m) => m.id !== mockup.id));
        });
    }

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
                <MockupList
                    mockups={project.mockups}
                    onRenamed={(updated) =>
                        updateMockups((list) =>
                            list.map((m) => (m.id === updated.id ? updated : m)),
                        )
                    }
                    onDelete={removeMockup}
                />
            </div>
        </AppShell>
    );
}
