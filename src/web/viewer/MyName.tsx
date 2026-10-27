import { IconUserCircle, IconX } from '@tabler/icons-preact';
import type { Author } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { IconButton } from '../ui/IconButton.tsx';

/**
 * The viewer's own avatar, which opens the name dialog, with a one-time hint when they still have
 * a generated name.
 */
export function MyName({
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
        // Below md the hint spans the header, below its second row, instead of hanging
        // off the avatar.
        <div class="md:relative">
            <IconButton
                label={me ? `${me.displayName}: change your name` : 'Add your name'}
                variant={me ? 'avatar' : 'ghost'}
                size="md"
                onClick={onName}
            >
                {me ? <Avatar author={me} size={26} /> : <IconUserCircle size={20} />}
            </IconButton>
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
