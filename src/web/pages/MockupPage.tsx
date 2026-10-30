import { IconAlertTriangle, IconArchiveOff, IconMessages, IconUpload } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Mockup } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { EarlierVersionsDialog } from '../components/EarlierVersionsDialog.tsx';
import { HtmlFileButton } from '../components/HtmlFileButton.tsx';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { MockupMenu } from '../components/MockupMenu.tsx';
import { RenameMockupDialog } from '../components/RenameMockupDialog.tsx';
import { ReviewersPanel } from '../components/ReviewersPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatDate, uploadedFrom } from '../lib/format.ts';
import { deleteMockup, setArchived, uploadVersion } from '../lib/mockups.ts';
import { useResource } from '../lib/resource.ts';
import { mockupContentSrc, reviewSpaceHref } from '../lib/share.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { Notice } from '../ui/Notice.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { buttonClass, CARD_CLASS, ICON } from '../ui/styles.ts';

export function MockupPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const resource = useResource(`/mockups/${params.id}`, api.get<Mockup>);
    const [renaming, setRenaming] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    // Uploads, archiving and deleting, one at a time.
    const action = useAction();

    if (resource.status !== 'ready') {
        return (
            <AppShell>
                <LoadStatus resource={resource} missing="Mockup not found." />
            </AppShell>
        );
    }

    const mockup = resource.data;
    const replaceMockup = (updated: Mockup) => resource.update(() => updated);
    const projectHref = `/projects/${mockup.project.id}`;

    const uploadFile = (file: File) =>
        action.run(async () => {
            const updated = await uploadVersion(mockup, file);
            if (updated) replaceMockup(updated);
        }, 'upload');

    const archive = (value: boolean) =>
        action.run(async () => replaceMockup(await setArchived(mockup, value)));

    const remove = () =>
        action.run(async () => {
            if (await deleteMockup(mockup)) route(projectHref);
        });

    // Where and when the current version came from, on hover of its badge.
    const uploaded = uploadedFrom(mockup.version);

    return (
        <AppShell
            fitScreen
            workspace={mockup.project.owner}
            trail={[{ href: projectHref, label: mockup.project.name }]}
        >
            <div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
                {/* Frequent actions in sight; managing the mockup behind the menu, away from
                    them, with Delete last. */}
                <PageHeader
                    title={mockup.name}
                    // Which version the link shows, since its comments start from zero.
                    badges={<Badge title={uploaded}>{`v${mockup.version.number}`}</Badge>}
                    actions={
                        <>
                            {mockup.archivedAt ? null : (
                                <HtmlFileButton
                                    variant="ghost"
                                    disabled={action.pending}
                                    title="Same link and reviewers; the new version starts without comments."
                                    onFile={uploadFile}
                                >
                                    <IconUpload size={ICON.md} />
                                    {action.running === 'upload' ? (
                                        'Uploading…'
                                    ) : (
                                        // Short on phones, so the actions fit on one row.
                                        <span>
                                            Upload
                                            <span class="hidden sm:inline"> new version</span>
                                        </span>
                                    )}
                                </HtmlFileButton>
                            )}
                            <a href={reviewSpaceHref(mockup)} class={buttonClass()}>
                                <IconMessages size={ICON.md} />
                                Open review space
                            </a>
                            <MockupMenu
                                mockup={mockup}
                                size="lg"
                                disabled={action.pending}
                                onRename={() => setRenaming(true)}
                                onSetArchived={archive}
                                onEarlierVersions={() => setVersionsOpen(true)}
                                onDelete={remove}
                            />
                        </>
                    }
                />
                {/* Right below the header, so a mistaken archiving is undone in place. */}
                {mockup.archivedAt ? (
                    <Notice tone="neutral">
                        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <p>
                                Archived on {formatDate(mockup.archivedAt)}. The comments stay
                                readable through the link; nothing can be added or changed.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={action.pending}
                                onClick={() => archive(false)}
                            >
                                <IconArchiveOff size={ICON.md} />
                                Unarchive
                            </Button>
                        </div>
                    </Notice>
                ) : null}
                <FormError message={action.error} />
                {mockup.version.externalRefs.length ? (
                    <Notice tone="warning">
                        <p class="flex items-center gap-1.5 font-medium">
                            <IconAlertTriangle size={ICON.md} />
                            Not self-contained
                        </p>
                        <p class="mt-1 text-xs">
                            These resources are blocked unless the server allows external resources:
                        </p>
                        <ul class="mt-2 flex flex-col gap-0.5 font-mono text-xs">
                            {mockup.version.externalRefs.map((ref) => (
                                <li key={ref} class="truncate" title={ref}>
                                    {ref}
                                </li>
                            ))}
                        </ul>
                    </Notice>
                ) : null}
                {/* Side by side on wide screens, within the window: only the preview and the
                    reviewers scroll, each on its own, so sharing stays in reach. Columns may shrink
                    below their content, so long names truncate instead of widening the page. */}
                <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div class={`overflow-hidden ${CARD_CLASS}`}>
                        {/* Keyed by version, so a new upload replaces the preview. */}
                        <MockupFrame
                            key={mockup.version.number}
                            src={mockupContentSrc(mockup)}
                            title={`Preview of ${mockup.name}`}
                            class="h-[70vh] w-full lg:h-full"
                        />
                    </div>
                    <div class="flex flex-col gap-6 lg:min-h-0">
                        <div class={CARD_CLASS}>
                            <SharePanel mockup={mockup} onChange={replaceMockup} />
                        </div>
                        <div class={`flex flex-col overflow-hidden lg:min-h-0 ${CARD_CLASS}`}>
                            <ReviewersPanel key={mockup.version.number} mockup={mockup} />
                        </div>
                    </div>
                </div>
            </div>
            {renaming ? (
                <RenameMockupDialog
                    mockup={mockup}
                    onSaved={(updated) => {
                        replaceMockup(updated);
                        setRenaming(false);
                    }}
                    onClose={() => setRenaming(false)}
                />
            ) : null}
            {versionsOpen ? (
                <EarlierVersionsDialog mockup={mockup} onClose={() => setVersionsOpen(false)} />
            ) : null}
        </AppShell>
    );
}
