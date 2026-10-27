import { IconKeyboard, IconPencil, IconUserCircle, IconX } from '@tabler/icons-preact';
import type { Author } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Menu, type MenuItem } from '../ui/Menu.tsx';
import { ICON } from '../ui/styles.ts';
import { SHORTCUTS } from './shortcuts.ts';

// Touch screens usually have no keyboard to use the shortcuts with.
const hasShortcuts = () => !matchMedia('(pointer: coarse)').matches;

/**
 * The avatar of whoever is reviewing, opening who they are here, changing a viewer's name and the
 * shortcuts help; with nothing to offer, the avatar alone, or nothing for a viewer who has not
 * joined. A viewer who still has a generated name gets a one-time hint below it.
 */
export function ProfileMenu({
    me,
    canRename,
    hint,
    onName,
    onHelp,
    onDismissHint,
}: {
    /** Null for a viewer who has not joined yet. */
    me: Author | null;
    canRename: boolean;
    hint: boolean;
    onName: () => void;
    onHelp: () => void;
    onDismissHint: () => void;
}) {
    const items: MenuItem[] = [];
    if (canRename) {
        items.push({
            label: me ? 'Change your name' : 'Add your name',
            icon: <IconPencil size={ICON.md} />,
            onSelect: onName,
        });
    }
    if (hasShortcuts()) {
        items.push({
            label: 'Keyboard shortcuts',
            icon: <IconKeyboard size={ICON.md} />,
            shortcut: SHORTCUTS['?'].label,
            separate: true,
            onSelect: onHelp,
        });
    }

    let avatar = null;
    if (items.length) {
        avatar = (
            <Menu
                label={me ? `You: ${me.displayName}` : 'You'}
                variant={me ? 'avatar' : 'ghost'}
                size="md"
                icon={me ? <Avatar author={me} size="lg" /> : <IconUserCircle size={ICON.xl} />}
                header={
                    me ? (
                        <div class="flex items-center gap-2">
                            <p class="truncate font-medium text-sm text-stone-900">
                                {me.displayName}
                            </p>
                            <Badge>{me.kind === 'editor' ? 'Editor' : 'Guest'}</Badge>
                        </div>
                    ) : (
                        <>
                            <p class="font-medium text-sm text-stone-900">Guest</p>
                            <p class="text-stone-500 text-xs">Not commenting yet</p>
                        </>
                    )
                }
                items={items}
            />
        );
    } else if (me) {
        avatar = <Avatar author={me} size="lg" />;
    }
    if (!avatar) return null;

    return (
        // Below md the hint spans the header, below its second row, instead of hanging
        // off the avatar.
        <div class="md:relative">
            {avatar}
            {hint && me ? (
                <div
                    role="status"
                    class="absolute inset-x-2 top-full z-30 mt-2 rounded-lg bg-stone-900 p-3 text-white text-xs shadow-lg md:inset-x-auto md:right-0 md:w-64"
                >
                    <span class="absolute -top-1 right-3 hidden size-2 rotate-45 bg-stone-900 md:block" />
                    <div class="flex items-start gap-2">
                        <p class="flex-1">
                            You are commenting as <strong>{me.displayName}</strong>. Add your name
                            so others recognize you in comments and pins.
                        </p>
                        <button type="button" aria-label="Dismiss" onClick={onDismissHint}>
                            <IconX size={ICON.sm} />
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
