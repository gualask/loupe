import { IconUserCircle, IconX } from '@tabler/icons-preact';
import type { Author } from '../../shared/api/reviews.ts';
import { Avatar } from '../components/Avatar.tsx';
import { HEADER_BUTTON } from './styles.ts';

/**
 * The viewer's own name, which they can change, with a one-time hint when they still have a
 * generated one.
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
