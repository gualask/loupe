import {
    IconCheck,
    IconCloudOff,
    IconLoader2,
    IconMapPin,
    IconMessage,
} from '@tabler/icons-preact';
import type { ComponentChildren, Ref } from 'preact';
import { buttonClass, ICON } from '../ui/styles.ts';
import type { SaveState } from './changes.ts';
import { SHORTCUTS } from './shortcuts.ts';

/**
 * A header action with an icon, labelled on wide screens and named by its tooltip otherwise; a
 * `tool` is one of the main review tools, at full strength.
 */
function ToolButton({
    label,
    shortcut,
    text,
    tool = false,
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
    tool?: boolean;
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
            class={buttonClass(active ? 'primary' : tool ? 'tool' : 'ghost', 'sm')}
        >
            {children}
            {text ? <span class="hidden lg:inline">{text}</span> : null}
        </button>
    );
}

/** Whether the viewer's changes reached the server, shown by the mockup name. */
export function SaveStatus({ state }: { state: SaveState }) {
    if (state === 'idle') return null;
    const { icon, label } = {
        saving: { icon: <IconLoader2 size={ICON.sm} class="animate-spin" />, label: 'Saving…' },
        saved: { icon: <IconCheck size={ICON.sm} />, label: 'Saved' },
        offline: { icon: <IconCloudOff size={ICON.sm} />, label: 'Offline — retrying' },
    }[state];
    return (
        <span
            role="status"
            class={`flex shrink-0 items-center gap-1 text-xs ${state === 'offline' ? 'text-amber-700' : 'text-stone-500'}`}
        >
            {icon}
            {/* Icon only on narrow screens, where the header has no room for words. */}
            <span class="sr-only sm:not-sr-only">{label}</span>
        </span>
    );
}

/**
 * The review actions of the header (docs/SPEC.md §5): the pin and comment tools.
 */
export function ReviewTools({
    commentRef,
    inspecting,
    mayWrite,
    onPin,
    onComment,
}: {
    /** The comment button, which general comments open below. */
    commentRef: Ref<HTMLButtonElement>;
    inspecting: boolean;
    /** Writing is open; the actions ask a viewer for a name first if needed. */
    mayWrite: boolean;
    onPin: () => void;
    onComment: () => void;
}) {
    return (
        <>
            <ToolButton
                label="Place a pin"
                shortcut={SHORTCUTS.p.label}
                text="Pin"
                tool
                active={inspecting}
                disabled={!mayWrite}
                onClick={onPin}
            >
                <IconMapPin size={ICON.lg} />
            </ToolButton>
            <ToolButton
                label="General comment"
                shortcut={SHORTCUTS.c.label}
                text="Comment"
                tool
                disabled={!mayWrite}
                buttonRef={commentRef}
                onClick={onComment}
            >
                <IconMessage size={ICON.lg} />
            </ToolButton>
        </>
    );
}
