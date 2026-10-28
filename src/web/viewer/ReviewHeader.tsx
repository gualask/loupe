import {
    IconArrowLeft,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
    IconEye,
    IconEyeOff,
    IconLayoutSidebarRight,
} from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { type Author, authorKey } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { useDocumentTitle } from '../lib/document-title.ts';
import { Badge } from '../ui/Badge.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { LogoMark } from '../ui/Logo.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { buttonClass, ICON, TEXT, TOP_BAR_CLASS } from '../ui/styles.ts';
import { SHORTCUTS } from './shortcuts.ts';

/** Widths the mockup can be previewed at; null fills the window. */
const VIEWPORTS = [
    { label: 'Desktop', value: null, icon: <IconDeviceDesktop size={ICON.md} /> },
    { label: 'Tablet', value: 768, icon: <IconDeviceTablet size={ICON.md} /> },
    { label: 'Mobile', value: 390, icon: <IconDeviceMobile size={ICON.md} /> },
];

const MAX_AVATARS = 5;

/**
 * Top bar of the review space: mockup name and save status, the review actions (`tools`, on a row
 * of their own on narrow screens), the others here, what shows (preview width, pins, the panel)
 * and, last, the profile menu.
 */
export function ReviewHeader({
    name,
    archived,
    backHref,
    status,
    tools,
    viewportWidth,
    pinsHidden,
    me,
    others,
    openCount,
    panelOpen,
    onViewport,
    onTogglePins,
    onTogglePanel,
}: {
    name: string;
    archived: boolean;
    /** Editors only: the mockup page they came from. */
    backHref: string | undefined;
    /** Whether changes were saved; by the name, so the tools stay put as it comes and goes. */
    status: ComponentChildren;
    tools: ComponentChildren;
    viewportWidth: number | null;
    pinsHidden: boolean;
    /** The profile menu: who is reviewing, their name and the shortcuts help. */
    me: ComponentChildren;
    /** Everyone else here now. */
    others: Author[];
    openCount: number;
    panelOpen: boolean;
    onViewport: (width: number | null) => void;
    onTogglePins: () => void;
    onTogglePanel: () => void;
}) {
    useDocumentTitle(`Review of ${name}`);
    return (
        // Above the side panel, which covers the mockup on narrow screens: the profile menu and
        // the name hint open over it. From md, equal side columns keep the tools centered whatever
        // the sides hold (save status, counts, people here).
        <header
            class={`relative z-40 flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm md:grid md:grid-cols-[1fr_auto_1fr] ${TOP_BAR_CLASS}`}
        >
            <div class="flex min-w-0 flex-1 items-center gap-2">
                {backHref ? (
                    <a
                        href={backHref}
                        aria-label="Back to the mockup page"
                        title="Back to the mockup page"
                        class={`-ml-2.5 ${buttonClass('ghost', 'sm')}`}
                    >
                        <IconArrowLeft size={ICON.lg} />
                        <span class="hidden sm:inline">Back</span>
                    </a>
                ) : (
                    <LogoMark />
                )}
                <span class={`truncate ${TEXT.heading}`}>{name}</span>
                {archived ? <Badge>Archived</Badge> : null}
                {status}
            </div>
            <div class="order-last flex w-full shrink-0 items-center justify-center gap-1 md:order-none md:w-auto">
                {tools}
            </div>
            <div class="flex shrink-0 items-center justify-end gap-2">
                {others.length ? (
                    <div class="flex -space-x-1.5" title="Also here now">
                        {others.slice(0, MAX_AVATARS).map((author) => (
                            <Avatar key={authorKey(author)} author={author} size="lg" />
                        ))}
                        {others.length > MAX_AVATARS ? (
                            <span class="grid size-6.5 place-items-center rounded-full bg-stone-200 text-xs ring-2 ring-white">
                                +{others.length - MAX_AVATARS}
                            </span>
                        ) : null}
                    </div>
                ) : null}
                <div class="hidden lg:block">
                    <Segmented
                        label="Preview width"
                        options={VIEWPORTS}
                        value={viewportWidth}
                        onChange={onViewport}
                    />
                </div>
                <IconButton
                    label={pinsHidden ? 'Show pins' : 'Hide pins'}
                    shortcut={SHORTCUTS.h.label}
                    size="md"
                    onClick={onTogglePins}
                >
                    {pinsHidden ? <IconEyeOff size={ICON.lg} /> : <IconEye size={ICON.lg} />}
                </IconButton>
                <button
                    type="button"
                    onClick={onTogglePanel}
                    aria-pressed={panelOpen}
                    aria-label={`Comments panel, ${openCount} open`}
                    title="Comments panel"
                    class={buttonClass('ghost', 'sm')}
                >
                    <IconLayoutSidebarRight size={ICON.lg} />
                    <span class="tabular-nums">{openCount}</span>
                </button>
                {/* Last, where the account menu sits in the rest of the app, and set apart from
                    the controls: who is reviewing, not what they do. Gone with nothing in it. */}
                <div class="flex items-center gap-2 before:h-5 before:w-px before:bg-stone-200 empty:hidden">
                    {me}
                </div>
            </div>
        </header>
    );
}
