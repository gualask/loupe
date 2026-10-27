import {
    IconCheck,
    IconChecklist,
    IconCloudOff,
    IconEye,
    IconEyeOff,
    IconLoader2,
    IconMapPin,
    IconMessage,
} from '@tabler/icons-preact';
import type { ComponentChildren, Ref } from 'preact';
import type { Review } from '../../shared/api/reviews.ts';
import { VERDICT_LABELS } from '../lib/review.ts';
import { buttonClass } from '../ui/styles.ts';
import type { SaveState } from './changes.ts';
import { SHORTCUTS } from './shortcuts.ts';

/** A header action with an icon, labelled on wide screens and named by its tooltip otherwise. */
function ToolButton({
    label,
    shortcut,
    text,
    active = false,
    disabled = false,
    buttonRef,
    onClick,
    children,
}: {
    label: string;
    shortcut: string;
    /** Shown next to the icon on wide screens. */
    text?: string;
    active?: boolean;
    disabled?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    onClick: () => void;
    children: ComponentChildren;
}) {
    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            aria-label={label}
            title={`${label} (${shortcut})`}
            class={buttonClass(active ? 'primary' : 'ghost', 'sm')}
        >
            {children}
            {text ? <span class="hidden lg:inline">{text}</span> : null}
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
            {/* Icon only on narrow screens, where the header has no room for words. */}
            <span class="sr-only sm:not-sr-only">{label}</span>
        </span>
    );
}

/** The review actions of the header (docs/SPEC.md §5): pin, comment, pins shown, save status. */
export function ReviewTools({
    commentRef,
    inspecting,
    pinsHidden,
    mayWrite,
    saveState,
    onPin,
    onComment,
    onTogglePins,
}: {
    /** The comment button, which general comments open below. */
    commentRef: Ref<HTMLButtonElement>;
    inspecting: boolean;
    pinsHidden: boolean;
    /** Writing is open; the actions ask a viewer for a name first if needed. */
    mayWrite: boolean;
    saveState: SaveState;
    onPin: () => void;
    onComment: () => void;
    onTogglePins: () => void;
}) {
    return (
        <>
            <ToolButton
                label="Place a pin"
                shortcut={SHORTCUTS.p.label}
                text="Pin"
                active={inspecting}
                disabled={!mayWrite}
                onClick={onPin}
            >
                <IconMapPin size={18} />
            </ToolButton>
            <ToolButton
                label="General comment"
                shortcut={SHORTCUTS.c.label}
                text="Comment"
                disabled={!mayWrite}
                buttonRef={commentRef}
                onClick={onComment}
            >
                <IconMessage size={18} />
            </ToolButton>
            <ToolButton
                label={pinsHidden ? 'Show pins' : 'Hide pins'}
                shortcut={SHORTCUTS.h.label}
                onClick={onTogglePins}
            >
                {pinsHidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </ToolButton>
            <SaveStatus state={saveState} />
        </>
    );
}

/** Opens the review dialog; once submitted, it shows the verdict. */
export function FinishButton({
    review,
    disabled,
    onClick,
}: {
    review: Review | null;
    disabled: boolean;
    onClick: () => void;
}) {
    const verdict = review?.status === 'submitted' ? review.verdict : null;
    const label = verdict ? VERDICT_LABELS[verdict] : 'Finish review';
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            class={buttonClass(verdict ? 'secondary' : 'primary', 'sm')}
        >
            {verdict ? (
                <IconCheck size={16} class="text-emerald-600" />
            ) : (
                <IconChecklist size={16} />
            )}
            <span class="hidden sm:inline">{label}</span>
        </button>
    );
}
