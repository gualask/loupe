import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { sameAuthor, type Thread } from '../../shared/api/reviews.ts';
import type { BridgeMessage, PinPosition, ShortcutKey } from '../../shared/bridge-protocol.ts';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { MockupNotices } from '../components/MockupNotices.tsx';
import { useBridge } from '../lib/bridge.ts';
import { isReport, useMockupReports } from '../lib/mockup-reports.ts';
import { logout } from '../lib/session.ts';
import { Badge } from '../ui/Badge.tsx';
import { ComparePane } from './ComparePane.tsx';
import { HelpDialog, NameDialog } from './dialogs.tsx';
import { useDraftRecovery } from './drafts.ts';
import { ErrorToast } from './ErrorToast.tsx';
import { filterThreads, type ThreadFilter } from './filters.ts';
import { NewComment, type NewThread } from './NewComment.tsx';
import { NewVersionNotice } from './NewVersionNotice.tsx';
import { Popover, type PopoverPoint } from './Popover.tsx';
import { PaneBar, Preview } from './Preview.tsx';
import { ProfileMenu } from './ProfileMenu.tsx';
import { bridgePins, DRAFT_PIN, pinLabels } from './pins.ts';
import { ReviewHeader } from './ReviewHeader.tsx';
import { ReviewTools, SaveStatus } from './ReviewTools.tsx';
import { useReviewSession } from './session.ts';
import { useShortcuts } from './shortcuts.ts';
import { ThreadPanel } from './ThreadPanel.tsx';
import { ThreadView } from './ThreadView.tsx';

// Below this width the side panel covers the mockup instead of sitting beside it (Tailwind md).
const OVERLAY_PANEL_QUERY = '(max-width: 767.98px)';

type DialogName = 'name' | 'help';

const panelCoversMockup = () => matchMedia(OVERLAY_PANEL_QUERY).matches;

/** The shared review space behind a share link: mockup, pins, threads and presence. */
export function ReviewSpace({
    token,
    shared: initial,
    viewerKey,
    onUnavailable,
}: {
    token: string;
    shared: SharedMockup;
    viewerKey: string | null;
    /** The link stopped giving access while open. */
    onUnavailable: () => void;
}) {
    const session = useReviewSession(token, initial, viewerKey, onUnavailable);

    const { path, query, route } = useLocation();
    const commentButton = useRef<HTMLButtonElement>(null);

    const shared = session.shared.value;
    const me = session.me.value;
    const isEditor = me?.kind === 'editor';
    const threads = session.threads.value;
    const mayWrite = session.mayWrite.value;
    const canRename = mayWrite && !isEditor;

    const [inspecting, setInspecting] = useState(false);
    const [composing, setComposing] = useState<NewThread | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [pinsHidden, setPinsHidden] = useState(false);
    const [filter, setFilter] = useState<ThreadFilter>('open');
    // Null fills the window.
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    // The earlier version shown beside the current one, by number; null without comparison.
    const [compared, setCompared] = useState<number | null>(null);
    const [stacked, setStacked] = useState(false);
    const [panelOpen, setPanelOpen] = useState(() => !panelCoversMockup());
    const [dialog, setDialog] = useState<DialogName | null>(null);
    const [positions, setPositions] = useState(new Map<string, PinPosition>());
    const reports = useMockupReports();

    const labels = useMemo(() => pinLabels(threads), [threads]);
    // Gone once an editor deletes it, which closes the comparison.
    const comparedVersion = shared.earlierVersions.find((v) => v.number === compared);
    const latestEarlier = shared.earlierVersions[0];

    // Once the space closes to changes, archived or replaced, placing a pin stops.
    const outdated = session.outdated.value;
    useEffect(() => {
        if (!mayWrite) setInspecting(false);
    }, [mayWrite]);

    useDraftRecovery(session, () => {
        if (!session.canWrite.value) return;
        setComposing({
            target: { kind: 'general' },
            notice: 'Comments you had not sent yet. Send, edit or discard them.',
        });
    });

    const viewerFilter = query.viewer;
    const listed = filterThreads(threads, { filter, viewerId: viewerFilter, me });
    const openThread = threads.find((t) => t.id === openId);

    const pins = bridgePins({
        threads,
        listed,
        labels,
        openId,
        hidden: pinsHidden,
        draft:
            composing?.target.kind === 'pin' && me
                ? { anchor: composing.target.anchor, author: me }
                : null,
    });

    /** On narrow screens the panel hides the mockup, so it makes way for pins and popovers. */
    function revealMockup() {
        if (panelCoversMockup()) setPanelOpen(false);
    }

    /** Signs out and stays on the link, which reloads as a guest, or as the viewer they were. */
    async function signOut() {
        await logout();
        location.reload();
    }

    /** Runs an action that needs an identity, joining under a generated name if necessary. */
    function withIdentity(action: () => void) {
        void session.identity.join().then((joined) => joined && action());
    }

    function startPin() {
        withIdentity(() => {
            revealMockup();
            setComposing(null);
            setOpenId(null);
            setInspecting((on) => !on);
        });
    }

    function startComment() {
        withIdentity(() => {
            revealMockup();
            setInspecting(false);
            setOpenId(null);
            setComposing({ target: { kind: 'general' } });
        });
    }

    function select(thread: Thread) {
        revealMockup();
        setInspecting(false);
        setComposing(null);
        setOpenId(thread.id);
        if (thread.kind === 'pin') {
            setPinsHidden(false);
            send({ type: 'loupe:scroll-to', id: thread.id });
        }
    }

    /** Hiding pins also closes the open pin's thread, which would have nothing to point at. */
    function togglePins() {
        if (!pinsHidden && openThread?.kind === 'pin') setOpenId(null);
        setPinsHidden(!pinsHidden);
    }

    function shortcut(key: ShortcutKey) {
        // Any dialog, its own or a confirmation, holds the keys until it closes.
        if (document.querySelector('dialog[open]')) return;
        if (key === 'Escape') {
            if (inspecting) setInspecting(false);
            else if (composing) setComposing(null);
            else setOpenId(null);
        } else if (key === 'p') startPin();
        else if (key === 'c') startComment();
        else if (key === 'h') togglePins();
        else setDialog('help');
    }

    function onBridgeMessage(message: BridgeMessage) {
        if (message.type === 'loupe:picked') {
            setInspecting(false);
            setOpenId(null);
            setComposing({ target: { kind: 'pin', anchor: message.anchor } });
        } else if (message.type === 'loupe:inspect-cancelled') {
            setInspecting(false);
        } else if (message.type === 'loupe:pin-clicked' && message.id !== DRAFT_PIN) {
            setComposing(null);
            setOpenId((id) => (id === message.id ? null : message.id));
        } else if (message.type === 'loupe:positions') {
            setPositions(new Map(message.positions.map((p) => [p.id, p])));
        } else if (message.type === 'loupe:key') {
            shortcut(message.key);
        } else if (isReport(message)) {
            reports.handle(message);
        }
    }

    const bridge = useBridge(onBridgeMessage);
    const { connection, send } = bridge;
    // The earlier version takes no pins: only shortcuts typed inside it are heard, and what it
    // reports about the mockup.
    const compareBridge = useBridge((message) => {
        if (message.type === 'loupe:key') shortcut(message.key);
        else if (isReport(message)) reports.handle(message);
    });

    // Pins are rebuilt on every render; comparing them as JSON sends them to the mockup only
    // when they actually change, or when a new bridge started.
    const pinsMessage = JSON.stringify(pins);
    useEffect(() => {
        if (connection) send({ type: 'loupe:pins', pins: JSON.parse(pinsMessage) });
    }, [connection, send, pinsMessage]);
    useEffect(() => {
        if (connection) send({ type: 'loupe:inspect', enabled: inspecting });
    }, [connection, send, inspecting]);

    useShortcuts(shortcut);

    /** Where a popover goes: next to its pin, or below the comment button. */
    function popoverPoint(pinId: string | null): PopoverPoint {
        const position = pinId ? positions.get(pinId) : undefined;
        const frameRect = bridge.frame.current?.getBoundingClientRect();
        if (position && frameRect) {
            return {
                x: frameRect.left + position.x,
                y: frameRect.top + position.y,
                placement: 'side' as const,
            };
        }
        const button = commentButton.current?.getBoundingClientRect();
        return {
            x: button ? button.left + button.width / 2 : innerWidth / 2,
            y: button ? button.bottom : 0,
            placement: 'below' as const,
        };
    }

    let popover = null;
    if (composing) {
        popover = (
            <Popover
                locate={() => popoverPoint(composing.target.kind === 'pin' ? DRAFT_PIN : null)}
            >
                <NewComment
                    thread={composing}
                    session={session}
                    onReopen={(thread) => setComposing((current) => current ?? thread)}
                    onClose={() => setComposing(null)}
                />
            </Popover>
        );
    } else if (openThread) {
        const pinId = openThread.kind === 'pin' ? openThread.id : null;
        popover = (
            <Popover key={openThread.id} locate={() => popoverPoint(pinId)}>
                <ThreadView
                    thread={openThread}
                    label={
                        openThread.kind === 'pin'
                            ? `Pin ${labels.get(openThread.id) ?? ''}`
                            : 'General comment'
                    }
                    session={session}
                    onClose={() => setOpenId(null)}
                />
            </Popover>
        );
    }

    const viewerName = viewerFilter
        ? (threads.find((t) => t.author.id === viewerFilter)?.author.displayName ?? 'one viewer')
        : undefined;
    const orphaned = new Set([...positions.values()].filter((p) => p.orphaned).map((p) => p.id));
    const error = session.error.value;

    return (
        <div class="flex h-dvh flex-col bg-stone-100">
            <ReviewHeader
                name={shared.name}
                archived={shared.archived}
                backHref={isEditor ? `/mockups/${shared.mockupId}` : undefined}
                status={<SaveStatus state={session.saveState.value} />}
                tools={
                    <ReviewTools
                        commentRef={commentButton}
                        inspecting={inspecting}
                        mayWrite={mayWrite}
                        onPin={startPin}
                        onComment={startComment}
                    />
                }
                viewportWidth={viewportWidth}
                comparing={!!comparedVersion}
                pinsHidden={pinsHidden}
                me={
                    <ProfileMenu
                        me={me}
                        canRename={canRename}
                        hint={session.identity.nameHint.value}
                        onName={() => setDialog('name')}
                        onHelp={() => setDialog('help')}
                        onSignOut={isEditor ? () => void signOut() : undefined}
                        onDismissHint={session.identity.dismissNameHint}
                    />
                }
                others={
                    // Their own avatar is the profile menu, not one of the others.
                    me
                        ? session.presence.value.filter((author) => !sameAuthor(author, me))
                        : session.presence.value
                }
                openCount={threads.filter((t) => t.status === 'open').length}
                panelOpen={panelOpen}
                onViewport={setViewportWidth}
                onToggleCompare={
                    latestEarlier
                        ? () => setCompared(comparedVersion ? null : latestEarlier.number)
                        : undefined
                }
                onTogglePins={togglePins}
                onTogglePanel={() => setPanelOpen((open) => !open)}
            />
            {outdated ? (
                <NewVersionNotice class="shrink-0 bg-amber-100 px-4 py-2 text-center text-amber-900 text-sm" />
            ) : null}
            <div class="shrink-0 px-4 py-3 empty:hidden">
                <MockupNotices
                    reports={reports}
                    permissions={shared.permissions}
                    showSettings={isEditor}
                />
            </div>
            <div class="relative flex min-h-0 flex-1">
                {/* The current version keeps its place in the tree as a comparison opens and
                    closes, so its frame does not reload. */}
                <main class={`flex min-w-0 flex-1 ${stacked ? 'flex-col' : ''}`}>
                    {comparedVersion ? (
                        <ComparePane
                            name={shared.name}
                            versions={shared.earlierVersions}
                            shown={comparedVersion}
                            stacked={stacked}
                            viewportWidth={viewportWidth}
                            permissions={shared.permissions}
                            bridge={compareBridge}
                            onShow={setCompared}
                            onToggleLayout={() => setStacked(!stacked)}
                            onClose={() => setCompared(null)}
                        />
                    ) : null}
                    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                        {comparedVersion ? (
                            <PaneBar>
                                <span class="font-medium text-sm text-stone-900">
                                    Version {shared.version}
                                </span>
                                <Badge tone="good">Current</Badge>
                            </PaneBar>
                        ) : null}
                        <Preview width={viewportWidth}>
                            <MockupFrame
                                bridge={bridge}
                                src={shared.contentUrl}
                                permissions={shared.permissions}
                                title={shared.name}
                                class="h-full w-full"
                            />
                        </Preview>
                    </div>
                </main>
                {panelOpen ? (
                    <ThreadPanel
                        threads={listed}
                        labels={labels}
                        orphaned={orphaned}
                        filter={filter}
                        canFilterMine={!!me}
                        // Not where no reply can be written: archived mockups, older versions.
                        markAwaiting={shared.canModerate && mayWrite}
                        viewerName={viewerName}
                        activeId={openId}
                        onFilter={setFilter}
                        onClearViewer={() => route(path)}
                        onSelect={select}
                    />
                ) : null}
            </div>
            {popover}
            {error ? (
                <ErrorToast
                    message={error}
                    onDismiss={() => {
                        session.error.value = undefined;
                    }}
                />
            ) : null}
            {dialog === 'name' ? (
                <NameDialog
                    current={me?.displayName ?? ''}
                    onSubmit={async (name) => {
                        await session.identity.setName(name);
                        setDialog(null);
                    }}
                    onClose={() => setDialog(null)}
                />
            ) : null}
            {dialog === 'help' ? <HelpDialog onClose={() => setDialog(null)} /> : null}
        </div>
    );
}
