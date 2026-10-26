import { IconX } from '@tabler/icons-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { SharedMockup } from '../../shared/api/projects.ts';
import type { Thread } from '../../shared/api/reviews.ts';
import type { BridgeMessage, PinPosition } from '../../shared/bridge-protocol.ts';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { useBridge } from './bridge.ts';
import { Composer } from './Composer.tsx';
import { HelpDialog, NameDialog, ReviewDialog } from './dialogs.tsx';
import { ErrorToast } from './ErrorToast.tsx';
import { Popover } from './Popover.tsx';
import { bridgePins, DRAFT_PIN, pinLabels } from './pins.ts';
import { ReviewHeader } from './ReviewHeader.tsx';
import { createReviewSession, draftName } from './session.ts';
import { type ThreadFilter, ThreadPanel } from './ThreadPanel.tsx';
import { ThreadView } from './ThreadView.tsx';
import { Toolbar } from './Toolbar.tsx';

// Pins placed at a width this different from the current one may point elsewhere.
const VIEWPORT_HINT_PX = 100;
// Below this width the side panel covers the mockup instead of sitting beside it (Tailwind md).
const OVERLAY_PANEL_QUERY = '(max-width: 767.98px)';

/**
 * What is being written; `body` refills the box after the server rejected it, `notice` explains
 * text already in it.
 */
type Composing = ({ kind: 'pin'; anchor: PinAnchor } | { kind: 'general' }) & {
    body?: string;
    notice?: string;
};
type DialogName = 'name' | 'review' | 'help';

const panelCoversMockup = () => matchMedia(OVERLAY_PANEL_QUERY).matches;

function isTyping(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(input|textarea|select)$/.test(target.localName))
    );
}

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
    // The session is created once per link; later changes arrive through it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: initial values only
    const session = useMemo(() => createReviewSession(token, initial, viewerKey), [token]);
    useEffect(() => {
        session.connect();
        return session.disconnect;
    }, [session]);
    const unavailable = session.unavailable.value;
    useEffect(() => {
        if (unavailable) onUnavailable();
    }, [unavailable, onUnavailable]);

    const { path, query, route } = useLocation();
    const frame = useRef<HTMLIFrameElement>(null);
    const toolbar = useRef<HTMLDivElement>(null);

    const shared = session.shared.value;
    const me = session.me.value;
    const isEditor = me?.kind === 'editor';
    const threads = session.threads.value;
    const mayWrite = session.mayWrite.value;

    const [inspecting, setInspecting] = useState(false);
    const [composing, setComposing] = useState<Composing | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [pinsHidden, setPinsHidden] = useState(false);
    const [filter, setFilter] = useState<ThreadFilter>('open');
    // Null fills the window.
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const [panelOpen, setPanelOpen] = useState(() => !panelCoversMockup());
    const [dialog, setDialog] = useState<DialogName | null>(null);
    const [positions, setPositions] = useState(new Map<string, PinPosition>());

    const labels = useMemo(() => pinLabels(threads), [threads]);

    // Comments that could not be sent before the reload wait in the general comment box.
    const keptText = session.keptText.value;
    useEffect(() => {
        if (!keptText) return;
        session.keptText.value = false;
        if (me && mayWrite) {
            setComposing({
                kind: 'general',
                notice: 'Unsent comments from the previous version. Send, edit or discard them.',
            });
        }
    }, [keptText, me, mayWrite, session]);

    const viewerFilter = query.viewer;
    const listed = threads.filter((t) => {
        if (viewerFilter && t.author.id !== viewerFilter) return false;
        if (filter === 'open') return t.status === 'open';
        if (filter === 'resolved') return t.status === 'resolved';
        if (filter === 'mine') return !!me && t.author.kind === me.kind && t.author.id === me.id;
        return true;
    });
    const openThread = threads.find((t) => t.id === openId);

    const pins = bridgePins({
        threads: pinsHidden ? [] : threads,
        listed,
        labels,
        openId,
        draft: composing?.kind === 'pin' && me ? { anchor: composing.anchor, author: me } : null,
    });

    /** On narrow screens the panel hides the mockup, so it makes way for pins and popovers. */
    function revealMockup() {
        if (panelCoversMockup()) setPanelOpen(false);
    }

    /** Runs an action that needs an identity, joining under a generated name if necessary. */
    function withIdentity(action: () => void) {
        if (!mayWrite) return;
        if (me) action();
        else void session.join().then((joined) => joined && action());
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
            setComposing({ kind: 'general' });
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

    function shortcut(key: string) {
        if (dialog) return;
        if (key === 'Escape') {
            if (inspecting) setInspecting(false);
            else if (composing) setComposing(null);
            else setOpenId(null);
        } else if (key === 'p') startPin();
        else if (key === 'c') startComment();
        else if (key === 'h') setPinsHidden((hidden) => !hidden);
        else if (key === '?') setDialog('help');
    }

    function onBridgeMessage(message: BridgeMessage) {
        if (message.type === 'loupe:picked') {
            setInspecting(false);
            setOpenId(null);
            setComposing({ kind: 'pin', anchor: message.anchor });
        } else if (message.type === 'loupe:inspect-cancelled') {
            setInspecting(false);
        } else if (message.type === 'loupe:pin-clicked' && message.id !== DRAFT_PIN) {
            setComposing(null);
            setOpenId((id) => (id === message.id ? null : message.id));
        } else if (message.type === 'loupe:positions') {
            setPositions(new Map(message.positions.map((p) => [p.id, p])));
        } else if (message.type === 'loupe:key') {
            shortcut(message.key);
        }
    }

    const { ready, send, onFrameLoad } = useBridge(frame, onBridgeMessage);

    // Pins are rebuilt on every render; comparing them as JSON sends them to the mockup only
    // when they actually change.
    const pinsMessage = JSON.stringify(pins);
    useEffect(() => {
        if (ready) send({ type: 'loupe:pins', pins: JSON.parse(pinsMessage) });
    }, [ready, send, pinsMessage]);
    useEffect(() => {
        if (ready) send({ type: 'loupe:inspect', enabled: inspecting });
    }, [ready, send, inspecting]);

    const shortcutRef = useRef(shortcut);
    shortcutRef.current = shortcut;
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            shortcutRef.current(event.key);
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    /** Where a popover goes: next to its pin, or above the toolbar. */
    function popoverPoint(pinId: string | null) {
        const position = pinId ? positions.get(pinId) : undefined;
        const frameRect = frame.current?.getBoundingClientRect();
        if (position && frameRect) {
            return {
                x: frameRect.left + position.x,
                y: frameRect.top + position.y,
                placement: 'side' as const,
            };
        }
        const bar = toolbar.current?.getBoundingClientRect();
        return {
            x: bar ? bar.left + bar.width / 2 : innerWidth / 2,
            y: bar ? bar.top : innerHeight - 80,
            placement: 'above' as const,
        };
    }

    function viewportHint(thread: Thread) {
        const placed = thread.anchor?.viewport.width;
        const current = frame.current?.clientWidth;
        if (!placed || !current || Math.abs(placed - current) < VIEWPORT_HINT_PX) return undefined;
        return `Placed on a ${placed}px wide screen; at this width it may point elsewhere.`;
    }

    let popover = null;
    if (composing) {
        const point = popoverPoint(composing.kind === 'pin' ? DRAFT_PIN : null);
        popover = (
            <Popover {...point}>
                <div class="flex flex-col gap-2 p-3">
                    <div class="flex items-center justify-between text-sm">
                        <span class="font-semibold">
                            {composing.kind === 'pin' ? 'New pin' : 'General comment'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setComposing(null)}
                            aria-label="Cancel (Esc)"
                            class="rounded p-1 text-stone-500 hover:bg-stone-100"
                        >
                            <IconX size={16} />
                        </button>
                    </div>
                    {composing.notice ? (
                        <p class="max-w-72 text-amber-800 text-xs">{composing.notice}</p>
                    ) : null}
                    <Composer
                        placeholder="Add a comment…"
                        initial={composing.body}
                        draftKey={
                            composing.kind === 'general'
                                ? draftName(shared.mockupId, 'general')
                                : undefined
                        }
                        onSubmit={(body) => {
                            const draft = composing;
                            setComposing(null);
                            const saved = session.createThread(draft, body);
                            // Rejected (e.g. rate limited): reopen it rather than lose the text.
                            // On a newer version the session keeps it for after the reload.
                            void saved.then((ok) => {
                                if (!ok && !session.outdated.value) {
                                    setComposing((current) => current ?? { ...draft, body });
                                }
                            });
                            return saved;
                        }}
                        onCancel={() => setComposing(null)}
                    />
                </div>
            </Popover>
        );
    } else if (openThread) {
        const point = popoverPoint(openThread.kind === 'pin' && !pinsHidden ? openThread.id : null);
        popover = (
            <Popover key={openThread.id} {...point}>
                <ThreadView
                    thread={openThread}
                    label={
                        openThread.kind === 'pin'
                            ? `Pin ${labels.get(openThread.id) ?? ''}`
                            : 'General comment'
                    }
                    hint={viewportHint(openThread)}
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
        <div class="flex h-dvh flex-col bg-stone-100 text-stone-900">
            <ReviewHeader
                name={shared.name}
                readOnly={shared.readOnly}
                backHref={isEditor ? `/mockups/${shared.mockupId}` : undefined}
                viewportWidth={viewportWidth}
                me={me}
                canName={mayWrite && me?.kind !== 'editor'}
                nameHint={session.nameHint.value}
                onName={() => setDialog('name')}
                onDismissNameHint={session.dismissNameHint}
                presence={session.presence.value}
                openCount={threads.filter((t) => t.status === 'open').length}
                panelOpen={panelOpen}
                onViewport={setViewportWidth}
                onTogglePanel={() => setPanelOpen((open) => !open)}
            />
            {session.outdated.value ? (
                <div
                    role="status"
                    class="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-amber-900 text-sm"
                >
                    A new version of this mockup is available. Unsent comments are kept.
                    <button
                        type="button"
                        onClick={() => location.reload()}
                        class="font-semibold underline underline-offset-2"
                    >
                        Reload
                    </button>
                </div>
            ) : null}
            <div class="flex min-h-0 flex-1">
                <main class="flex min-w-0 flex-1 justify-center overflow-auto">
                    <div
                        class="h-full bg-white shadow-sm"
                        style={{ width: viewportWidth ? `${viewportWidth}px` : '100%' }}
                    >
                        <MockupFrame
                            frameRef={frame}
                            onLoad={onFrameLoad}
                            src={shared.contentUrl}
                            title={shared.name}
                            class="h-full w-full"
                        />
                    </div>
                </main>
                {panelOpen ? (
                    <ThreadPanel
                        threads={listed}
                        labels={labels}
                        orphaned={orphaned}
                        filter={filter}
                        canFilterMine={!!me}
                        viewerName={viewerName}
                        activeId={openId}
                        onFilter={setFilter}
                        onClearViewer={() => route(path)}
                        onSelect={select}
                    />
                ) : null}
            </div>
            <Toolbar
                toolbarRef={toolbar}
                inspecting={inspecting}
                pinsHidden={pinsHidden}
                mayWrite={mayWrite}
                saveState={session.saveState.value}
                review={isEditor ? undefined : shared.review}
                onPin={startPin}
                onComment={startComment}
                onTogglePins={() => setPinsHidden((hidden) => !hidden)}
                onFinish={() => withIdentity(() => setDialog('review'))}
                onHelp={() => setDialog('help')}
            />
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
                        await session.setName(name);
                        setDialog(null);
                    }}
                    onClose={() => setDialog(null)}
                />
            ) : null}
            {dialog === 'review' ? (
                <ReviewDialog
                    review={shared.review}
                    outdated={session.outdated.value}
                    onSubmit={session.submitReview}
                    onClose={() => setDialog(null)}
                />
            ) : null}
            {dialog === 'help' ? <HelpDialog onClose={() => setDialog(null)} /> : null}
        </div>
    );
}
