import { IconUpload } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, ProjectDetail } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { HtmlFileButton } from '../components/HtmlFileButton.tsx';
import { MockupList } from '../components/MockupList.tsx';
import { ProjectForm } from '../components/ProjectForm.tsx';
import { ProjectMenu } from '../components/ProjectMenu.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { deleteMockup, setArchived, uploadMockup } from '../lib/mockups.ts';
import { deleteProject, updateProject } from '../lib/projects.ts';
import { useResource } from '../lib/resource.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { ICON } from '../ui/styles.ts';

export function ProjectPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const resource = useResource(`/projects/${params.id}`, api.get<ProjectDetail>);
    const [editing, setEditing] = useState(false);
    const upload = useAction();
    // Deletions and other changes made from the page or its rows.
    const change = useAction();

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
            const mockup = await uploadMockup(project.id, file);
            route(`/mockups/${mockup.id}`);
        });

    const remove = () =>
        change.run(async () => {
            if (await deleteProject(project, project.mockups.length)) route('/');
        });

    const updateMockups = (edit: (mockups: Mockup[]) => Mockup[]) =>
        resource.update((p) => ({ ...p, mockups: edit(p.mockups) }));

    const replaceMockup = (updated: Mockup) =>
        updateMockups((list) => list.map((m) => (m.id === updated.id ? updated : m)));

    const archiveMockup = (mockup: Mockup, archived: boolean) =>
        change.run(async () => replaceMockup(await setArchived(mockup, archived)));

    const removeMockup = (mockup: Mockup) =>
        change.run(async () => {
            if (await deleteMockup(mockup)) {
                updateMockups((list) => list.filter((m) => m.id !== mockup.id));
            }
        });

    return (
        <AppShell workspace={project.owner}>
            <div class="flex flex-col gap-6">
                {/* The primary action, then the menu of secondary ones, as on a mockup page.
                    While editing, the form replaces the actions and the description. */}
                <PageHeader
                    title={project.name}
                    description={editing ? undefined : project.description}
                    actions={
                        editing ? null : (
                            <>
                                <HtmlFileButton
                                    disabled={upload.pending}
                                    title="A single self-contained .html file"
                                    onFile={uploadFile}
                                >
                                    <IconUpload size={ICON.md} />
                                    {upload.pending ? 'Uploading…' : 'Upload mockup'}
                                </HtmlFileButton>
                                <ProjectMenu
                                    project={project}
                                    size="lg"
                                    disabled={change.pending}
                                    onEdit={() => setEditing(true)}
                                    onDelete={remove}
                                />
                            </>
                        )
                    }
                />
                {editing ? (
                    <ProjectForm
                        initial={project}
                        submitLabel="Save"
                        onSubmit={async (fields) => {
                            const updated = await updateProject(project, fields);
                            resource.update((p) => ({ ...p, ...updated }));
                            setEditing(false);
                        }}
                        onCancel={() => setEditing(false)}
                    />
                ) : null}
                <FormError message={upload.error ?? change.error} />
                {project.mockups.length ? (
                    <MockupList
                        mockups={project.mockups}
                        onRenamed={replaceMockup}
                        onSetArchived={archiveMockup}
                        onDelete={removeMockup}
                    />
                ) : (
                    <EmptyState title="No mockups yet">
                        Upload a self-contained HTML file, then share its link for review.
                    </EmptyState>
                )}
            </div>
        </AppShell>
    );
}
