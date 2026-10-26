import { IconCheck, IconPencil, IconRotate, IconTrash, IconX } from '@tabler/icons-preact';
import { useState } from 'preact/hooks';
import { type Comment, sameAuthor, type Thread } from '../../shared/api/reviews.ts';
import { AuthorName, Avatar } from '../components/Avatar.tsx';
import { formatRelative } from '../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { Composer } from './Composer.tsx';
import { replyDraft } from './drafts.ts';
import { NewVersionNotice } from './NewVersionNotice.tsx';
import type { ReviewSession } from './session.ts';

function CommentItem({ comment, session }: { comment: Comment; session: ReviewSession }) {
    // The text being edited, or null when not editing.
    const [editing, setEditing] = useState<string | null>(null);
    const me = session.me.value;
    const own = !!me && sameAuthor(me, comment.author);
    const canEdit = own && session.canWrite.value && !comment.deleted;
    const canDelete =
        !comment.deleted && session.canWrite.value && (own || session.shared.value.canModerate);

    return (
        <li class="group flex gap-2.5">
            <Avatar author={comment.author} />
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 text-sm">
                    <AuthorName author={comment.author} />
                    <span class="text-stone-400 text-xs" title={comment.createdAt}>
                        {formatRelative(comment.createdAt)}
                        {comment.editedAt ? ' · edited' : ''}
                    </span>
                    {/* Revealed on hover; always shown on touch screens, which cannot hover. */}
                    <span class="ml-auto flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                        {canEdit ? (
                            <IconButton label="Edit" onClick={() => setEditing(comment.body)}>
                                <IconPencil size={15} />
                            </IconButton>
                        ) : null}
                        {canDelete ? (
                            <IconButton
                                label="Delete"
                                onClick={() => {
                                    if (confirm('Delete this comment?')) session.remove(comment);
                                }}
                            >
                                <IconTrash size={15} />
                            </IconButton>
                        ) : null}
                    </span>
                </div>
                {editing !== null && !comment.deleted ? (
                    <div class="mt-1">
                        <Composer
                            placeholder="Edit comment"
                            initial={editing}
                            submitLabel="Save"
                            onSubmit={(body) => {
                                setEditing(null);
                                const saved = session.edit(comment, body);
                                void saved.then((ok) => {
                                    if (!ok) setEditing((current) => current ?? body);
                                });
                                return saved;
                            }}
                            onCancel={() => setEditing(null)}
                        />
                    </div>
                ) : comment.deleted ? (
                    <p class="text-sm text-stone-400 italic">Comment deleted</p>
                ) : (
                    <p class="whitespace-pre-wrap break-words text-sm text-stone-800">
                        {comment.body}
                    </p>
                )}
            </div>
        </li>
    );
}

/** A thread with its comments, moderation actions and a reply box. */
export function ThreadView({
    thread,
    label,
    hint,
    session,
    onClose,
}: {
    thread: Thread;
    label: string;
    /** Shown above the comments, e.g. a viewport mismatch. */
    hint?: string;
    session: ReviewSession;
    onClose: () => void;
}) {
    const { canModerate, mockupId } = session.shared.value;
    const resolved = thread.status === 'resolved';

    return (
        <div class="flex max-h-[min(32rem,70vh)] flex-col">
            <header class="flex items-center gap-2 border-stone-100 border-b px-3 py-2 text-sm">
                <span class="font-semibold">{label}</span>
                {resolved ? <Badge tone="good">Resolved</Badge> : null}
                <span class="ml-auto flex">
                    {canModerate ? (
                        <IconButton
                            label={resolved ? 'Reopen' : 'Resolve'}
                            onClick={() =>
                                session.setStatus(thread.id, resolved ? 'open' : 'resolved')
                            }
                        >
                            {resolved ? <IconRotate size={16} /> : <IconCheck size={16} />}
                        </IconButton>
                    ) : null}
                    <IconButton label="Close (Esc)" onClick={onClose}>
                        <IconX size={16} />
                    </IconButton>
                </span>
            </header>
            {hint ? <p class="bg-amber-50 px-3 py-1.5 text-amber-800 text-xs">{hint}</p> : null}
            <ol class="flex flex-col gap-3 overflow-y-auto px-3 py-3">
                {thread.comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} session={session} />
                ))}
            </ol>
            <footer class="border-stone-100 border-t px-3 py-2.5">
                {session.outdated.value ? (
                    <NewVersionNotice class="text-stone-500 text-xs" />
                ) : session.mayWrite.value ? (
                    <Composer
                        placeholder="Reply…"
                        draftKey={replyDraft(mockupId, thread.id)}
                        // A first reply joins the review, like a first pin.
                        onSubmit={async (body) =>
                            (await session.identity.join()) && session.reply(thread.id, body)
                        }
                        onCancel={onClose}
                    />
                ) : (
                    <p class="text-stone-500 text-xs">This mockup is read-only.</p>
                )}
            </footer>
        </div>
    );
}
