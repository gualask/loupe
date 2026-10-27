import {
    IconArrowLeft,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
    IconHelp,
    IconLayoutSidebarRight,
    IconZoomScan,
} from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import { type Author, authorKey } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { buttonClass } from '../ui/styles.ts';
import { SHORTCUTS } from './shortcuts.ts';

/** Widths the mockup can be previewed at; null fills the window. */
const VIEWPORTS = [
    { label: 'Desktop', value: null, icon: <IconDeviceDesktop size={16} /> },
    { label: 'Tablet', value: 768, icon: <IconDeviceTablet size={16} /> },
    { label: 'Mobile', value: 390, icon: <IconDeviceMobile size={16} /> },
];

const MAX_AVATARS = 5;

/**
 * Top bar of the review space: mockup name, the review actions (`tools`, on a row of their own on
 * narrow screens), preview width, the viewer's own avatar, the others here, finishing the review,
 * help and the panel toggle.
 */
export function ReviewHeader({
    name,
    archived,
    backHref,
    tools,
    viewportWidth,
    me,
    others,
    finish,
    openCount,
    panelOpen,
    onViewport,
    onHelp,
    onTogglePanel,
}: {
    name: string;
    archived: boolean;
    /** Editors only: the mockup page they came from. */
    backHref: string | undefined;
    tools: ComponentChildren;
    viewportWidth: number | null;
    /** The viewer's own avatar, where they may change their name. */
    me: ComponentChildren;
    /** Everyone else here now. */
    others: Author[];
    /** Viewers only: the review button. */
    finish: ComponentChildren;
    openCount: number;
    panelOpen: boolean;
    onViewport: (width: number | null) => void;
    onHelp: () => void;
    onTogglePanel: () => void;
}) {
    return (
        <header class="relative flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-stone-200 border-b bg-white px-4 py-2 text-sm">
            <div class="flex min-w-0 flex-1 items-center gap-2">
                {backHref ? (
                    <a
                        href={backHref}
                        aria-label="Back to the mockup page"
                        title="Back to the mockup page"
                        class={`-ml-2.5 ${buttonClass('ghost', 'sm')}`}
                    >
                        <IconArrowLeft size={18} />
                        <span class="hidden sm:inline">Back</span>
                    </a>
                ) : (
                    <IconZoomScan size={18} stroke={1.75} class="shrink-0" />
                )}
                <span class="truncate font-medium">{name}</span>
                {archived ? <Badge>Archived</Badge> : null}
            </div>
            <div class="order-last flex w-full shrink-0 items-center justify-center gap-1 md:order-none md:w-auto">
                {tools}
            </div>
            <div class="flex shrink-0 items-center justify-end gap-2 md:grow">
                <div class="hidden lg:block">
                    <Segmented
                        label="Preview width"
                        options={VIEWPORTS}
                        value={viewportWidth}
                        onChange={onViewport}
                    />
                </div>
                {me}
                {others.length ? (
                    <div class="flex -space-x-1.5" title="Also here now">
                        {others.slice(0, MAX_AVATARS).map((author) => (
                            <Avatar key={authorKey(author)} author={author} size={26} />
                        ))}
                        {others.length > MAX_AVATARS ? (
                            <span class="grid size-6.5 place-items-center rounded-full bg-stone-200 text-[11px] ring-2 ring-white">
                                +{others.length - MAX_AVATARS}
                            </span>
                        ) : null}
                    </div>
                ) : null}
                {finish}
                <span class="hidden sm:contents">
                    <IconButton
                        label="Keyboard shortcuts"
                        shortcut={SHORTCUTS['?'].label}
                        size="md"
                        onClick={onHelp}
                    >
                        <IconHelp size={18} />
                    </IconButton>
                </span>
                <button
                    type="button"
                    onClick={onTogglePanel}
                    aria-pressed={panelOpen}
                    aria-label={`Comments panel, ${openCount} open`}
                    title="Comments panel"
                    class={`-mr-2.5 ${buttonClass('ghost', 'sm')}`}
                >
                    <IconLayoutSidebarRight size={18} />
                    <span class="tabular-nums">{openCount}</span>
                </button>
            </div>
        </header>
    );
}
