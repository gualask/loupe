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
import { useRef, useState } from 'preact/hooks';
import type { Review } from '../../shared/api/reviews.ts';
import type { SaveState } from './session.ts';

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
    const content = {
        saving: [<IconLoader2 key="i" size={14} class="animate-spin" />, 'Saving…'],
        saved: [<IconCheck key="i" size={14} />, 'Saved'],
        offline: [<IconCloudOff key="i" size={14} />, 'Offline — retrying'],
    }[state];
    return (
        <span
            role="status"
            class={`flex items-center gap-1 px-1 text-xs ${state === 'offline' ? 'text-amber-700' : 'text-stone-500'}`}
        >
            {content}
        </span>
    );
}

function reviewLabel(review: Review | null) {
    if (review?.status !== 'submitted') return 'Finish review';
    return review.verdict === 'approved' ? 'Approved' : 'Changes requested';
}

/** Floating, draggable toolbar with the review actions (docs/SPEC.md §5). */
export function Toolbar({
    toolbarRef,
    inspecting,
    pinsHidden,
    canWrite,
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
    canWrite: boolean;
    saveState: SaveState;
    /** The viewer's review; undefined for editors, who do not submit one. */
    review: Review | null | undefined;
    onPin: () => void;
    onComment: () => void;
    onTogglePins: () => void;
    onFinish: () => void;
    onHelp: () => void;
}) {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number } | null>(null);

    function onPointerDown(event: PointerEvent) {
        drag.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
        if (drag.current) {
            setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y });
        }
    }

    return (
        <div
            ref={toolbarRef}
            class="fixed bottom-5 left-1/2 z-20 flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
        >
            <span
                class="cursor-grab touch-none px-0.5 text-stone-400 active:cursor-grabbing"
                title="Drag to move"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => {
                    drag.current = null;
                }}
            >
                <IconGripVertical size={16} />
            </span>
            <ToolButton
                label="Place a pin"
                shortcut="P"
                active={inspecting}
                disabled={!canWrite}
                onClick={onPin}
            >
                <IconMapPin size={18} />
                Pin
            </ToolButton>
            <ToolButton
                label="General comment"
                shortcut="C"
                disabled={!canWrite}
                onClick={onComment}
            >
                <IconMessage size={18} />
                Comment
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
                    disabled={!canWrite}
                    class={`ml-1 flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-sm disabled:opacity-40 ${review?.status === 'submitted' ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-stone-900 text-white hover:bg-stone-700'}`}
                >
                    {review?.status === 'submitted' ? <IconCheck size={16} /> : null}
                    {reviewLabel(review)}
                </button>
            ) : null}
            <ToolButton label="Keyboard shortcuts" shortcut="?" onClick={onHelp}>
                <IconHelp size={18} />
            </ToolButton>
        </div>
    );
}
