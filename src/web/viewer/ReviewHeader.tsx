import {
    IconArrowLeft,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
    IconLayoutSidebarRight,
    IconZoomScan,
} from '@tabler/icons-preact';
import type { ComponentChildren } from 'preact';
import type { Author } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { HEADER_BUTTON } from './styles.ts';

/** Widths the mockup can be previewed at; null fills the window. */
const VIEWPORTS = [
    { label: 'Desktop', width: null, Icon: IconDeviceDesktop },
    { label: 'Tablet', width: 768, Icon: IconDeviceTablet },
    { label: 'Mobile', width: 390, Icon: IconDeviceMobile },
] as const;

const MAX_AVATARS = 5;

/**
 * Top bar of the review space: mockup name, preview width, the viewer's own name, who is here
 * and the panel toggle.
 */
export function ReviewHeader({
    name,
    readOnly,
    backHref,
    viewportWidth,
    myName,
    presence,
    openCount,
    panelOpen,
    onViewport,
    onTogglePanel,
}: {
    name: string;
    readOnly: boolean;
    /** Editors only: the mockup page they came from. */
    backHref: string | undefined;
    viewportWidth: number | null;
    /** The viewer's own name, where they may change it. */
    myName: ComponentChildren;
    presence: Author[];
    openCount: number;
    panelOpen: boolean;
    onViewport: (width: number | null) => void;
    onTogglePanel: () => void;
}) {
    return (
        <header class="flex h-12 shrink-0 items-center gap-3 border-stone-200 border-b bg-white px-4 text-sm">
            {backHref ? (
                <a
                    href={backHref}
                    title="Back to the mockup page"
                    class={`-ml-2 shrink-0 ${HEADER_BUTTON}`}
                >
                    <IconArrowLeft size={18} />
                    <span class="hidden sm:inline">Back</span>
                </a>
            ) : null}
            <IconZoomScan size={18} stroke={1.75} class="shrink-0" />
            <span class="truncate font-medium">{name}</span>
            {readOnly ? <Badge>Read-only</Badge> : null}
            <div class="ml-auto flex items-center gap-3">
                <div class="hidden rounded-lg bg-stone-100 p-0.5 sm:flex">
                    {VIEWPORTS.map(({ label, width, Icon }) => (
                        <button
                            key={label}
                            type="button"
                            title={label}
                            aria-label={label}
                            aria-pressed={viewportWidth === width}
                            onClick={() => onViewport(width)}
                            class={`rounded-md p-1.5 ${viewportWidth === width ? 'bg-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                        >
                            <Icon size={16} />
                        </button>
                    ))}
                </div>
                {myName}
                <div class="flex -space-x-1.5" title="People here now">
                    {presence.slice(0, MAX_AVATARS).map((author) => (
                        <Avatar key={`${author.kind}:${author.id}`} author={author} size={26} />
                    ))}
                    {presence.length > MAX_AVATARS ? (
                        <span class="grid size-[26px] place-items-center rounded-full bg-stone-200 text-[11px] ring-2 ring-white">
                            +{presence.length - MAX_AVATARS}
                        </span>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={onTogglePanel}
                    aria-pressed={panelOpen}
                    title="Comments panel"
                    class={HEADER_BUTTON}
                >
                    <IconLayoutSidebarRight size={18} />
                    <span class="tabular-nums">{openCount}</span>
                </button>
            </div>
        </header>
    );
}
