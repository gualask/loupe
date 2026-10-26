import { IconX } from '@tabler/icons-preact';
import { Composer } from './Composer.tsx';
import { generalDraft, setAside } from './drafts.ts';
import type { ReviewSession, ThreadTarget } from './session.ts';

/**
 * A new thread being written. `body` refills the box after the server rejected it, `notice`
 * explains text already in it.
 */
export type NewThread = { target: ThreadTarget; body?: string; notice?: string };

/**
 * The box of a new pin or general comment; it closes as it sends. A rejected text comes back
 * through `onReopen`, except on a replaced version, which accepts nothing more: a pin's text is
 * set aside for after the reload, a general comment's stays in its draft.
 */
export function NewComment({
    thread,
    session,
    onReopen,
    onClose,
}: {
    thread: NewThread;
    session: ReviewSession;
    onReopen: (thread: NewThread) => void;
    onClose: () => void;
}) {
    const { mockupId } = session.shared.value;
    const { target } = thread;

    function submit(body: string) {
        onClose();
        const saved = session.createThread(target, body);
        void saved.then((ok) => {
            if (ok) return;
            if (!session.outdated.value) onReopen({ target, body });
            else if (target.kind === 'pin') setAside(mockupId, body);
        });
        return saved;
    }

    return (
        <div class="flex flex-col gap-2 p-3">
            <div class="flex items-center justify-between text-sm">
                <span class="font-semibold">
                    {target.kind === 'pin' ? 'New pin' : 'General comment'}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cancel (Esc)"
                    class="rounded p-1 text-stone-500 hover:bg-stone-100"
                >
                    <IconX size={16} />
                </button>
            </div>
            {thread.notice ? <p class="max-w-72 text-amber-800 text-xs">{thread.notice}</p> : null}
            <Composer
                placeholder="Add a comment…"
                initial={thread.body}
                draftKey={target.kind === 'general' ? generalDraft(mockupId) : undefined}
                onSubmit={submit}
                onCancel={onClose}
            />
        </div>
    );
}
