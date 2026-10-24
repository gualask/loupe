import { IconAlertTriangle, IconTrash } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup, Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { ReviewsPanel } from '../components/ReviewsPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { api, errorMessage } from '../lib/api.ts';
import { formatBytes, formatDateTime } from '../lib/format.ts';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';

function FilePanel({ mockup }: { mockup: Mockup }) {
    const { version } = mockup;
    return (
        <section class="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h2 class="font-semibold">File</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt class="text-stone-500">Name</dt>
                <dd class="truncate">{version.originalFilename}</dd>
                <dt class="text-stone-500">Size</dt>
                <dd>{formatBytes(version.sizeBytes)}</dd>
                <dt class="text-stone-500">Uploaded</dt>
                <dd>{formatDateTime(version.createdAt)}</dd>
            </dl>
            {version.externalRefs.length ? (
                <div class="rounded-md bg-amber-50 p-3 text-amber-800">
                    <p class="flex items-center gap-1.5 font-medium">
                        <IconAlertTriangle size={16} />
                        Not self-contained
                    </p>
                    <p class="mt-1 text-xs">
                        These resources are blocked unless the server allows external resources:
                    </p>
                    <ul class="mt-2 flex flex-col gap-0.5 font-mono text-xs">
                        {version.externalRefs.map((ref) => (
                            <li key={ref} class="truncate" title={ref}>
                                {ref}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    );
}

export function MockupPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const [mockup, setMockup] = useState<Mockup | null>();
    const [project, setProject] = useState<Project>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        api.get<Mockup>(`/mockups/${params.id}`).then(
            (m) => {
                setMockup(m);
                api.get<Project>(`/projects/${m.projectId}`).then(setProject, () => undefined);
            },
            () => setMockup(null),
        );
    }, [params.id]);

    async function remove() {
        if (!mockup || !confirm(`Delete "${mockup.name}" and all its comments?`)) return;
        try {
            await api.delete(`/mockups/${mockup.id}`);
            route(`/projects/${mockup.projectId}`);
        } catch (err) {
            setError(errorMessage(err));
        }
    }

    if (mockup === undefined) return <AppShell>{null}</AppShell>;
    if (mockup === null) {
        return (
            <AppShell>
                <p class="text-stone-500">Mockup not found.</p>
            </AppShell>
        );
    }

    const token = mockup.shareUrl.slice(mockup.shareUrl.lastIndexOf('/') + 1);

    return (
        <AppShell>
            <div class="flex flex-col gap-6">
                <nav class="text-sm text-stone-500">
                    <a href="/" class="hover:text-stone-900">
                        Workspace
                    </a>{' '}
                    /{' '}
                    <a href={`/projects/${mockup.projectId}`} class="hover:text-stone-900">
                        {project?.name ?? 'Project'}
                    </a>{' '}
                    / {mockup.name}
                </nav>
                <div class="flex items-start justify-between gap-4">
                    <h1 class="font-semibold text-2xl tracking-tight">{mockup.name}</h1>
                    <Button variant="ghost" onClick={() => void remove()}>
                        <IconTrash size={16} />
                        Delete
                    </Button>
                </div>
                <FormError message={error} />
                <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
                    <div class="flex min-w-0 flex-col gap-6">
                        <div class="overflow-hidden rounded-xl border border-stone-200 bg-white">
                            <MockupFrame
                                src={`/s/${token}/content`}
                                title={`Preview of ${mockup.name}`}
                                class="h-[70vh] w-full"
                            />
                        </div>
                        <ReviewsPanel mockupId={mockup.id} token={token} />
                    </div>
                    <div class="flex flex-col gap-6">
                        <SharePanel mockup={mockup} onChange={setMockup} />
                        <FilePanel mockup={mockup} />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
