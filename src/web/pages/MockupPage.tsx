import { IconMessages } from '@tabler/icons-preact';
import { useRoute } from 'preact-iso';
import type { Mockup, Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { FilePanel } from '../components/FilePanel.tsx';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { ReviewsPanel } from '../components/ReviewsPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { api } from '../lib/api.ts';
import { useResource } from '../lib/resource.ts';
import { shareToken } from '../lib/share.ts';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { buttonClass } from '../ui/styles.ts';

export function MockupPage() {
    const { params } = useRoute();
    const resource = useResource(`/mockups/${params.id}`, api.get<Mockup>);
    // Only for the breadcrumb, which shows a placeholder until (or unless) it loads.
    const project = useResource(
        resource.status === 'ready' ? `/projects/${resource.data.projectId}` : null,
        api.get<Project>,
    );

    if (resource.status !== 'ready') {
        return (
            <AppShell>
                <LoadStatus resource={resource} missing="Mockup not found." />
            </AppShell>
        );
    }

    const mockup = resource.data;
    const token = shareToken(mockup);

    return (
        <AppShell fitScreen>
            <div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
                <PageHeader
                    trail={[
                        { href: '/', label: 'Workspace' },
                        {
                            href: `/projects/${mockup.projectId}`,
                            label: project.status === 'ready' ? project.data.name : 'Project',
                        },
                    ]}
                    title={mockup.name}
                    actions={
                        <a href={`/s/${token}`} class={buttonClass()}>
                            <IconMessages size={16} />
                            Open review space
                        </a>
                    }
                />
                {/* Side by side on wide screens, within the window: only the preview and the
                    side panel scroll, each on its own. */}
                <div class="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div class="overflow-hidden rounded-xl border border-stone-200 bg-white">
                        {/* Keyed by version, so a new upload replaces the preview. */}
                        <MockupFrame
                            key={mockup.version.number}
                            src={`/s/${token}/content`}
                            title={`Preview of ${mockup.name}`}
                            class="h-[70vh] w-full lg:h-full"
                        />
                    </div>
                    <div class="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white lg:min-h-0 lg:overflow-y-auto">
                        <SharePanel mockup={mockup} onChange={(m) => resource.update(() => m)} />
                        <ReviewsPanel
                            key={mockup.version.number}
                            mockupId={mockup.id}
                            token={token}
                        />
                        <FilePanel mockup={mockup} onChange={(m) => resource.update(() => m)} />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
