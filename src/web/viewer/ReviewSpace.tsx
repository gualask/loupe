import {
    IconArrowLeft,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
    IconLayoutSidebarRight,
    IconX,
    IconZoomScan,
} from '@tabler/icons-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { SharedMockup } from '../../shared/api/projects.ts';
import type { Thread } from '../../shared/api/reviews.ts';
import type { BridgeMessage, BridgePin, PinPosition } from '../../shared/bridge-protocol.ts';
import { MockupFrame } from '../components/MockupFrame.tsx';
import { authorColor } from '../lib/colors.ts';
import { Avatar } from './Avatar.tsx';
import { useBridge } from './bridge.ts';
import { Composer } from './Composer.tsx';
import { HelpDialog, IdentityDialog, ReviewDialog } from './dialogs.tsx';
import { Popover } from './Popover.tsx';
import { createReviewSession } from './session.ts';
import { type ThreadFilter, ThreadPanel } from './ThreadPanel.tsx';
import { ThreadView } from './ThreadView.tsx';
import { Toolbar } from './Toolbar.tsx';

const VIEWPORTS = [
    { value: 'desktop', label: 'Desktop', width: null, Icon: IconDeviceDesktop },
    { value: 'tablet', label: 'Tablet', width: 768, Icon: IconDeviceTablet },
    { value: 'mobile', label: 'Mobile', width: 390, Icon: IconDeviceMobile },
] as const;

// Pins placed at a width this different from the current one may point elsewhere.
const VIEWPORT_HINT_PX = 100;
// Below this width the side panel covers the mockup instead of sitting beside it (Tailwind md).
const OVERLAY_PANEL_QUERY = '(max-width: 767.98px)';
const DRAFT_PIN = 'draft';
const HEADER_BUTTON =
    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900';

/** What is being written; `body` refills the box after the server rejected it. */
type Composing = ({ kind: 'pin'; anchor: PinAnchor } | { kind: 'general' }) & { body?: string };
type DialogName = 'identity' | 'review' | 'help';

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
    const afterIdentity = useRef<(() => void) | null>(null);

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
    const [viewport, setViewport] = useState<(typeof VIEWPORTS)[number]>(VIEWPORTS[0]);
    const [panelOpen, setPanelOpen] = useState(() => !panelCoversMockup());
    const [dialog, setDialog] = useState<DialogName | null>(
        initial.me || initial.readOnly ? null : 'identity',
    );
    const [positions, setPositions] = useState(new Map<string, PinPosition>());

    const labels = useMemo(() => {
        // A pin not saved yet shows the next number, which the server normally confirms.
        let next = Math.max(0, ...threads.map((t) => t.number ?? 0));
        const pins = threads.filter((t) => t.kind === 'pin');
        return new Map(pins.map((t) => [t.id, String(t.number ?? ++next)]));
    }, [threads]);

    const viewerFilter = query.viewer;
    const listed = threads.filter((t) => {
        if (viewerFilter && t.author.id !== viewerFilter) return false;
        if (filter === 'open') return t.status === 'open';
        if (filter === 'resolved') return t.status === 'resolved';
        if (filter === 'mine') return !!me && t.author.kind === me.kind && t.author.id === me.id;
        return true;
    });
    const openThread = threads.find((t) => t.id === openId);

    const pins: BridgePin[] = pinsHidden
        ? []
        : threads
              // The open thread stays visible even when it no longer matches the filter.
              .filter(
                  (t) => t.kind === 'pin' && t.anchor && (listed.includes(t) || t.id === openId),
              )
              .map((t) => ({
                  id: t.id,
                  anchor: t.anchor as PinAnchor,
                  label: labels.get(t.id) ?? '',
                  color: authorColor(t.author),
                  muted: t.status === 'resolved',
                  active: t.id === openId,
              }));
    if (composing?.kind === 'pin' && me) {
        pins.push({
            id: DRAFT_PIN,
            anchor: composing.anchor,
            label: '+',
            color: authorColor(me),
            muted: false,
            active: true,
        });
    }

    /** On narrow screens the panel hides the mockup, so it makes way for pins and popovers. */
    function revealMockup() {
        if (panelCoversMockup()) setPanelOpen(false);
    }

    /** Runs an action that needs an identity, asking for a name first if necessary. */
    function withIdentity(action: () => void) {
        if (!mayWrite) return;
        if (me) {
            action();
            return;
        }
        afterIdentity.current = action;
        setDialog('identity');
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
                    <Composer
                        placeholder="Add a comment…"
                        initial={composing.body}
                        draftKey={
                            composing.kind === 'general'
                                ? `loupe:draft:${shared.mockupId}:general`
                                : undefined
                        }
                        onSubmit={(body) => {
                            const draft = composing;
                            setComposing(null);
                            const saved = session.createThread(draft, body);
                            // Rejected (e.g. rate limited): reopen it rather than lose the text.
                            void saved.then((ok) => {
                                if (!ok) setComposing((current) => current ?? { ...draft, body });
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
                    onNeedIdentity={() => withIdentity(() => undefined)}
                />
            </Popover>
        );
    }

    const presence = session.presence.value;
    const viewerName = viewerFilter
        ? (threads.find((t) => t.author.id === viewerFilter)?.author.displayName ?? 'one viewer')
        : undefined;
    const orphaned = new Set([...positions.values()].filter((p) => p.orphaned).map((p) => p.id));
    const error = session.error.value;

    return (
        <div class="flex h-dvh flex-col bg-stone-100 text-stone-900">
            <header class="flex h-12 shrink-0 items-center gap-3 border-stone-200 border-b bg-white px-4 text-sm">
                {isEditor ? (
                    <a
                        href={`/mockups/${shared.mockupId}`}
                        title="Back to the mockup page"
                        class={`-ml-2 shrink-0 ${HEADER_BUTTON}`}
                    >
                        <IconArrowLeft size={18} />
                        <span class="hidden sm:inline">Back</span>
                    </a>
                ) : null}
                <IconZoomScan size={18} stroke={1.75} class="shrink-0" />
                <span class="truncate font-medium">{shared.name}</span>
                {shared.readOnly ? (
                    <span class="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600 text-xs">
                        Read-only
                    </span>
                ) : null}
                <div class="ml-auto flex items-center gap-3">
                    <div class="hidden rounded-lg bg-stone-100 p-0.5 sm:flex">
                        {VIEWPORTS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                title={option.label}
                                aria-label={option.label}
                                aria-pressed={viewport.value === option.value}
                                onClick={() => setViewport(option)}
                                class={`rounded-md p-1.5 ${viewport.value === option.value ? 'bg-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                            >
                                <option.Icon size={16} />
                            </button>
                        ))}
                    </div>
                    <div class="flex -space-x-1.5" title="People here now">
                        {presence.slice(0, 5).map((author) => (
                            <Avatar key={`${author.kind}:${author.id}`} author={author} size={26} />
                        ))}
                        {presence.length > 5 ? (
                            <span class="grid size-[26px] place-items-center rounded-full bg-stone-200 text-[11px] ring-2 ring-white">
                                +{presence.length - 5}
                            </span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setPanelOpen((open) => !open)}
                        aria-pressed={panelOpen}
                        title="Comments panel"
                        class={HEADER_BUTTON}
                    >
                        <IconLayoutSidebarRight size={18} />
                        <span class="tabular-nums">
                            {threads.filter((t) => t.status === 'open').length}
                        </span>
                    </button>
                </div>
            </header>
            <div class="flex min-h-0 flex-1">
                <main class="flex min-w-0 flex-1 justify-center overflow-auto">
                    <div
                        class="h-full bg-white shadow-sm"
                        style={{ width: viewport.width ? `${viewport.width}px` : '100%' }}
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
                <div
                    role="alert"
                    class="fixed top-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
                >
                    {error}
                    <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => {
                            session.error.value = undefined;
                        }}
                    >
                        <IconX size={16} />
                    </button>
                </div>
            ) : null}
            {dialog === 'identity' ? (
                <IdentityDialog
                    onSubmit={async (name) => {
                        await session.register(name);
                        setDialog(null);
                        const action = afterIdentity.current;
                        afterIdentity.current = null;
                        action?.();
                    }}
                    onClose={() => {
                        afterIdentity.current = null;
                        setDialog(null);
                    }}
                />
            ) : null}
            {dialog === 'review' ? (
                <ReviewDialog
                    review={shared.review}
                    onSubmit={session.submitReview}
                    onClose={() => setDialog(null)}
                />
            ) : null}
            {dialog === 'help' ? <HelpDialog onClose={() => setDialog(null)} /> : null}
        </div>
    );
}
