import { IconUpload } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, ProjectDetail } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { HtmlFileButton } from '../components/HtmlFileButton.tsx';
import { MockupList } from '../components/MockupList.tsx';
import { ProjectDialog } from '../components/ProjectDialog.tsx';
import { ProjectMenu } from '../components/ProjectMenu.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { deleteMockup, setArchived, uploadMockup } from '../lib/mockups.ts';
import { deleteProject } from '../lib/projects.ts';
import { useResource } from '../lib/resource.ts';
import { signedInUser } from '../lib/session.ts';
import { workspaceHref } from '../lib/workspaces.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { ICON } from '../ui/styles.ts';

export function ProjectPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const me = signedInUser();
    const resource = useResource(`/projects/${params.id}`, api.get<ProjectDetail>);
    const [editing, setEditing] = useState(false);
    // Uploads and the changes made from the page or its rows, one at a time.
    const action = useAction();

    if (resource.status !== 'ready') {
        return (
            <AppShell>
                <LoadStatus resource={resource} missing="Project not found." />
            </AppShell>
        );
    }
    const project = resource.data;

    const uploadFile = (file: File) =>
        action.run(async () => {
            const mockup = await uploadMockup(project.id, file);
            route(`/mockups/${mockup.id}`);
        }, 'upload');

    const remove = () =>
        action.run(async () => {
            if (await deleteProject(project, project.mockups.length)) {
                route(workspaceHref(project.owner.id, me.id));
            }
        });

    const updateMockups = (edit: (mockups: Mockup[]) => Mockup[]) =>
        resource.update((p) => ({ ...p, mockups: edit(p.mockups) }));

    const replaceMockup = (updated: Mockup) =>
        updateMockups((list) => list.map((m) => (m.id === updated.id ? updated : m)));

    const archiveMockup = (mockup: Mockup, archived: boolean) =>
        action.run(async () => replaceMockup(await setArchived(mockup, archived)));

    const removeMockup = (mockup: Mockup) =>
        action.run(async () => {
            if (await deleteMockup(mockup)) {
                updateMockups((list) => list.filter((m) => m.id !== mockup.id));
            }
        });

    return (
        <AppShell workspace={project.owner}>
            <div class="flex flex-col gap-6">
                {/* The primary action, then the menu of secondary ones, as on a mockup page. */}
                <PageHeader
                    title={project.name}
                    description={project.description}
                    actions={
                        <>
                            <HtmlFileButton
                                disabled={action.pending}
                                title="A single self-contained .html file"
                                onFile={uploadFile}
                            >
                                <IconUpload size={ICON.md} />
                                {action.running === 'upload' ? 'Uploading…' : 'Upload mockup'}
                            </HtmlFileButton>
                            <ProjectMenu
                                project={project}
                                size="lg"
                                disabled={action.pending}
                                onEdit={() => setEditing(true)}
                                onDelete={remove}
                            />
                        </>
                    }
                />
                <FormError message={action.error} />
                {project.mockups.length ? (
                    <MockupList
                        mockups={project.mockups}
                        disabled={action.pending}
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
            {editing ? (
                <ProjectDialog
                    project={project}
                    onSaved={(updated) => {
                        resource.update((p) => ({ ...p, ...updated }));
                        setEditing(false);
                    }}
                    onClose={() => setEditing(false)}
                />
            ) : null}
        </AppShell>
    );
}
