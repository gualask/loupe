import { IconX } from '@tabler/icons-preact';
import { IconButton } from '../ui/IconButton.tsx';
import { ICON } from '../ui/styles.ts';
import { Composer } from './Composer.tsx';
import { generalDraft, setAside } from './drafts.ts';
import { PopoverHeader } from './Popover.tsx';
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
        <div>
            <PopoverHeader
                title={
                    <span class="font-semibold">
                        {target.kind === 'pin' ? 'New pin' : 'General comment'}
                    </span>
                }
            >
                <IconButton label="Cancel" shortcut="Esc" onClick={onClose}>
                    <IconX size={ICON.md} />
                </IconButton>
            </PopoverHeader>
            <div class="flex flex-col gap-2 px-3 py-2.5">
                {thread.notice ? <p class="text-amber-800 text-xs">{thread.notice}</p> : null}
                <Composer
                    placeholder="Add a comment…"
                    initial={thread.body}
                    draftKey={target.kind === 'general' ? generalDraft(mockupId) : undefined}
                    onSubmit={submit}
                    onCancel={onClose}
                />
            </div>
        </div>
    );
}
