import { IconMessages } from '@tabler/icons-preact';
import { useEffect, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import type { Mockup, Project } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { FilePanel } from '../components/FilePanel.tsx';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { ReviewsPanel } from '../components/ReviewsPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { api } from '../lib/api.ts';
import { shareToken } from '../lib/share.ts';
import { PageHeader } from '../ui/PageHeader.tsx';
import { buttonClass } from '../ui/styles.ts';

export function MockupPage() {
    const { params } = useRoute();
    const [mockup, setMockup] = useState<Mockup | null>();
    const [project, setProject] = useState<Project>();

    useEffect(() => {
        api.get<Mockup>(`/mockups/${params.id}`).then(
            (m) => {
                setMockup(m);
                api.get<Project>(`/projects/${m.projectId}`).then(setProject, () => undefined);
            },
            () => setMockup(null),
        );
    }, [params.id]);

    if (mockup === undefined) return <AppShell>{null}</AppShell>;
    if (mockup === null) {
        return (
            <AppShell>
                <p class="text-stone-500">Mockup not found.</p>
            </AppShell>
        );
    }

    const token = shareToken(mockup);

    return (
        <AppShell fitScreen>
            <div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
                <PageHeader
                    trail={[
                        { href: '/', label: 'Workspace' },
                        {
                            href: `/projects/${mockup.projectId}`,
                            label: project?.name ?? 'Project',
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
                        <MockupFrame
                            src={`/s/${token}/content`}
                            title={`Preview of ${mockup.name}`}
                            class="h-[70vh] w-full lg:h-full"
                        />
                    </div>
                    <div class="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white lg:min-h-0 lg:overflow-y-auto">
                        <SharePanel mockup={mockup} onChange={setMockup} />
                        <ReviewsPanel mockupId={mockup.id} token={token} />
                        <FilePanel mockup={mockup} />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
