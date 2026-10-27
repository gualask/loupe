import { IconAlertTriangle, IconArchiveOff, IconMessages, IconUpload } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { type Mockup, NAME_MAX_LENGTH } from '../../shared/api/projects.ts';
import { AppShell } from '../components/AppShell.tsx';
import { HtmlFileButton } from '../components/HtmlFileButton.tsx';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { MockupMenu } from '../components/MockupMenu.tsx';
import { ReviewsPanel } from '../components/ReviewsPanel.tsx';
import { SharePanel } from '../components/SharePanel.tsx';
import { api } from '../lib/api.ts';
import { useAction } from '../lib/form.ts';
import { formatDate } from '../lib/format.ts';
import { deleteMockup, renameMockup, setArchived, uploadVersion } from '../lib/mockups.ts';
import { useResource } from '../lib/resource.ts';
import { mockupContentSrc, reviewSpaceHref } from '../lib/share.ts';
import { Button } from '../ui/Button.tsx';
import { FormCard } from '../ui/FormCard.tsx';
import { FormError } from '../ui/FormError.tsx';
import { LoadStatus } from '../ui/LoadStatus.tsx';
import { Notice } from '../ui/Notice.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { buttonClass, CARD_CLASS } from '../ui/styles.ts';
import { TextField } from '../ui/TextField.tsx';

function RenameForm({ mockup, onDone }: { mockup: Mockup; onDone: (mockup?: Mockup) => void }) {
    const [name, setName] = useState(mockup.name);

    return (
        <FormCard
            submitLabel="Save"
            onSubmit={async () => onDone(await renameMockup(mockup, name))}
            onCancel={() => onDone()}
        >
            <TextField
                label="Mockup name"
                required
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
            />
        </FormCard>
    );
}

export function MockupPage() {
    const { params } = useRoute();
    const { route } = useLocation();
    const resource = useResource(`/mockups/${params.id}`, api.get<Mockup>);
    const [renaming, setRenaming] = useState(false);
    const upload = useAction();
    // Archiving and deleting, one at a time.
    const change = useAction();

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
        upload.run(async () => {
            const updated = await uploadVersion(mockup, file);
            if (updated) replaceMockup(updated);
        });

    const archive = (value: boolean) =>
        change.run(async () => replaceMockup(await setArchived(mockup, value)));

    const remove = () =>
        change.run(async () => {
            if (await deleteMockup(mockup)) route(projectHref);
        });

    return (
        <AppShell
            fitScreen
            workspace={mockup.project.owner}
            trail={[{ href: projectHref, label: mockup.project.name }]}
        >
            <div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
                {/* Frequent actions in sight; managing the mockup behind the menu, away from
                    them, with Delete last. While renaming, the form replaces the actions. */}
                <PageHeader
                    title={mockup.name}
                    actions={
                        renaming ? null : (
                            <>
                                {mockup.archivedAt ? null : (
                                    <HtmlFileButton
                                        variant="ghost"
                                        disabled={upload.pending}
                                        title="Same link and reviewers; the new version starts without comments."
                                        onFile={uploadFile}
                                    >
                                        <IconUpload size={16} />
                                        {upload.pending ? (
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
                                    <IconMessages size={16} />
                                    Open review space
                                </a>
                                <MockupMenu
                                    mockup={mockup}
                                    size="lg"
                                    disabled={change.pending}
                                    onRename={() => setRenaming(true)}
                                    onSetArchived={archive}
                                    onDelete={remove}
                                />
                            </>
                        )
                    }
                />
                {renaming ? (
                    <RenameForm
                        mockup={mockup}
                        onDone={(updated) => {
                            if (updated) replaceMockup(updated);
                            setRenaming(false);
                        }}
                    />
                ) : null}
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
                                disabled={change.pending}
                                onClick={() => archive(false)}
                            >
                                <IconArchiveOff size={16} />
                                Unarchive
                            </Button>
                        </div>
                    </Notice>
                ) : null}
                <FormError message={upload.error ?? change.error} />
                {mockup.version.externalRefs.length ? (
                    <Notice tone="warning">
                        <p class="flex items-center gap-1.5 font-medium">
                            <IconAlertTriangle size={16} />
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
                    reviews scroll, each on its own, so sharing stays in reach. Columns may shrink
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
                            <ReviewsPanel key={mockup.version.number} mockup={mockup} />
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
