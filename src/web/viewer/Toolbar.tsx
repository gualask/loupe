import {
    IconCheck,
    IconCloudOff,
    IconEye,
    IconEyeOff,
    IconGripVertical,
    IconHelp,
    IconLoader2,
    IconMapPin,
    IconMessage,
} from '@tabler/icons-preact';
import type { ComponentChildren, RefObject } from 'preact';
import type { Review } from '../../shared/api/reviews.ts';
import { VERDICT_LABELS } from '../lib/review.ts';
import type { SaveState } from './changes.ts';
import { useDragOffset } from './drag.ts';

function ToolButton({
    label,
    shortcut,
    active = false,
    disabled = false,
    onClick,
    children,
}: {
    label: string;
    shortcut: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ComponentChildren;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            title={`${label} (${shortcut})`}
            class={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-medium text-sm transition-colors disabled:opacity-40 ${active ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'}`}
        >
            {children}
        </button>
    );
}

function SaveStatus({ state }: { state: SaveState }) {
    if (state === 'idle') return null;
    const { icon, label } = {
        saving: { icon: <IconLoader2 size={14} class="animate-spin" />, label: 'Saving…' },
        saved: { icon: <IconCheck size={14} />, label: 'Saved' },
        offline: { icon: <IconCloudOff size={14} />, label: 'Offline — retrying' },
    }[state];
    return (
        <span
            role="status"
            class={`flex items-center gap-1 px-1 text-xs ${state === 'offline' ? 'text-amber-700' : 'text-stone-500'}`}
        >
            {icon}
            {/* Icon only on narrow screens, where the toolbar has no room for words. */}
            <span class="sr-only sm:not-sr-only">{label}</span>
        </span>
    );
}

function reviewLabel(review: Review | null) {
    if (review?.status !== 'submitted' || !review.verdict) return 'Finish review';
    return VERDICT_LABELS[review.verdict];
}

/** Floating, draggable toolbar with the review actions (docs/SPEC.md §5). */
export function Toolbar({
    toolbarRef,
    inspecting,
    pinsHidden,
    mayWrite,
    saveState,
    review,
    onPin,
    onComment,
    onTogglePins,
    onFinish,
    onHelp,
}: {
    toolbarRef: RefObject<HTMLDivElement | null>;
    inspecting: boolean;
    pinsHidden: boolean;
    /** Writing is open; the actions ask a viewer for a name first if needed. */
    mayWrite: boolean;
    saveState: SaveState;
    /** The viewer's review; undefined for editors, who do not submit one. */
    review: Review | null | undefined;
    onPin: () => void;
    onComment: () => void;
    onTogglePins: () => void;
    onFinish: () => void;
    onHelp: () => void;
}) {
    const { offset, handle } = useDragOffset(toolbarRef);

    return (
        <div
            ref={toolbarRef}
            class="fixed bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
        >
            <span
                class="cursor-grab touch-none px-0.5 text-stone-400 active:cursor-grabbing"
                title="Drag to move"
                {...handle}
            >
                <IconGripVertical size={16} />
            </span>
            <ToolButton
                label="Place a pin"
                shortcut="P"
                active={inspecting}
                disabled={!mayWrite}
                onClick={onPin}
            >
                <IconMapPin size={18} />
                <span class="hidden sm:inline">Pin</span>
            </ToolButton>
            <ToolButton
                label="General comment"
                shortcut="C"
                disabled={!mayWrite}
                onClick={onComment}
            >
                <IconMessage size={18} />
                <span class="hidden sm:inline">Comment</span>
            </ToolButton>
            <ToolButton
                label={pinsHidden ? 'Show pins' : 'Hide pins'}
                shortcut="H"
                onClick={onTogglePins}
            >
                {pinsHidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </ToolButton>
            <SaveStatus state={saveState} />
            {review !== undefined ? (
                <button
                    type="button"
                    onClick={onFinish}
                    disabled={!mayWrite}
                    class={`ml-1 flex min-w-0 items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-sm disabled:opacity-40 ${review?.status === 'submitted' ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-stone-900 text-white hover:bg-stone-700'}`}
                >
                    {review?.status === 'submitted' ? (
                        <IconCheck size={16} class="shrink-0" />
                    ) : null}
                    <span class="truncate">{reviewLabel(review)}</span>
                </button>
            ) : null}
            <ToolButton label="Keyboard shortcuts" shortcut="?" onClick={onHelp}>
                <IconHelp size={18} />
            </ToolButton>
        </div>
    );
}
