import {
    IconArrowLeft,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
    IconLayoutSidebarRight,
    IconUserCircle,
    IconX,
    IconZoomScan,
} from '@tabler/icons-preact';
import type { Author } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Badge } from '../ui/Badge.tsx';

/** Widths the mockup can be previewed at; null fills the window. */
const VIEWPORTS = [
    { label: 'Desktop', width: null, Icon: IconDeviceDesktop },
    { label: 'Tablet', width: 768, Icon: IconDeviceTablet },
    { label: 'Mobile', width: 390, Icon: IconDeviceMobile },
] as const;

const MAX_AVATARS = 5;
const HEADER_BUTTON =
    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900';

/**
 * The viewer's own name, which they can change, with a one-time hint when they still have a
 * generated one.
 */
function MyName({
    me,
    hint,
    onName,
    onDismissHint,
}: {
    me: Author | null;
    hint: boolean;
    onName: () => void;
    onDismissHint: () => void;
}) {
    return (
        <div class="relative">
            <button
                type="button"
                onClick={onName}
                title={me ? 'Change your name' : 'Add your name'}
                class={HEADER_BUTTON}
            >
                {me ? <Avatar author={me} size={22} /> : <IconUserCircle size={18} />}
                <span class="hidden max-w-32 truncate md:inline">
                    {me ? me.displayName : 'Add your name'}
                </span>
            </button>
            {hint && me ? (
                <div
                    role="status"
                    class="absolute top-full right-0 z-30 mt-2 w-64 rounded-lg bg-stone-900 p-3 text-white text-xs shadow-lg"
                >
                    <span class="absolute -top-1 right-5 size-2 rotate-45 bg-stone-900" />
                    <div class="flex items-start gap-2">
                        <p class="flex-1">
                            You are commenting as <strong>{me.displayName}</strong>. Add your name
                            so others recognize you in comments and pins.
                        </p>
                        <button type="button" aria-label="Dismiss" onClick={onDismissHint}>
                            <IconX size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onName}
                        class="mt-2 rounded-md bg-white px-2 py-1 font-medium text-stone-900"
                    >
                        Add your name
                    </button>
                </div>
            ) : null}
        </div>
    );
}

/** Top bar of the review space: mockup name, preview width, who is here and the panel toggle. */
export function ReviewHeader({
    name,
    readOnly,
    backHref,
    viewportWidth,
    me,
    canName,
    nameHint,
    onName,
    onDismissNameHint,
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
    me: Author | null;
    /** Whether `me` may choose their name here: viewers, where comments are accepted. */
    canName: boolean;
    nameHint: boolean;
    onName: () => void;
    onDismissNameHint: () => void;
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
                {canName ? (
                    <MyName
                        me={me}
                        hint={nameHint}
                        onName={onName}
                        onDismissHint={onDismissNameHint}
                    />
                ) : null}
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
