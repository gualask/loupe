import type { Context } from 'hono';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
    createCommentRequestSchema,
    createThreadRequestSchema,
    submitReviewRequestSchema,
    updateCommentRequestSchema,
    updateThreadRequestSchema,
} from '../../shared/api/reviews.ts';
import { deleteComment, findComment, insertComment, updateCommentBody } from '../db/comments.ts';
import { reopenReview, submitReview } from '../db/reviews.ts';
import {
    findThread,
    findThreadWithComments,
    insertThread,
    listThreads,
    updateThreadStatus,
} from '../db/threads.ts';
import { apiError, parseJson } from '../http.ts';
import {
    authorIds,
    isAuthor,
    type ShareActor,
    type SharedMockupRow,
    shareActor,
    sharedMockup,
} from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import { toReview, toThread } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

// Keeps idle connections open through proxies that drop silent ones.
const HEARTBEAT_MS = 25_000;

/** Threads, comments, reviews and the event stream of a share link, mounted under /api/s. */
export function threadRoutes({ db, hub }: AppDeps & { hub: Hub }) {
    /** The mockup and actor for a change; read-only mockups accept changes from editors only. */
    function writer(c: Context<AppEnv>) {
        const row = sharedMockup(db, c);
        const actor = shareActor(db, c, row);
        if (!actor) throw apiError(401, 'viewer_required', 'Choose a name before commenting.');
        if (actor.kind === 'viewer' && row.mockup.readOnly) {
            throw apiError(403, 'read_only', 'This mockup is read-only.');
        }
        return { row, actor };
    }

    function threadOf(row: SharedMockupRow, id: string) {
        const thread = findThread(db, id);
        if (!thread || thread.versionId !== row.version.id) throw apiError(404, 'not_found');
        return thread;
    }

    function loadThread(id: string) {
        const found = findThreadWithComments(db, id);
        if (!found) throw apiError(404, 'not_found');
        return toThread(found);
    }

    /** Broadcasts the current state of a thread and returns it. */
    function publishThread(row: SharedMockupRow, id: string) {
        const thread = loadThread(id);
        hub.publish(row.version.id, { type: 'thread', thread });
        return thread;
    }

    /** Feedback from a viewer starts their review, or reopens a submitted one. */
    function noteFeedback(row: SharedMockupRow, actor: ShareActor) {
        if (actor.kind !== 'viewer') return;
        const review = reopenReview(db, row.version.id, actor.viewer.id);
        if (review) hub.publish(row.version.id, { type: 'review', review: toReview(review) });
    }

    return new Hono<AppEnv>()
        .get('/:token/threads', (c) => {
            const row = sharedMockup(db, c);
            return c.json(listThreads(db, row.version.id).map(toThread));
        })
        .post('/:token/threads', async (c) => {
            const { row, actor } = writer(c);
            const input = await parseJson(c, createThreadRequestSchema);
            const existing = findThread(db, input.id);
            if (existing) {
                // A retried request: answer with the thread it already created.
                if (existing.versionId !== row.version.id || !isAuthor(actor, existing)) {
                    throw apiError(409, 'conflict');
                }
                return c.json(loadThread(existing.id));
            }
            insertThread(
                db,
                {
                    id: input.id,
                    versionId: row.version.id,
                    kind: input.kind,
                    anchor: input.kind === 'pin' ? input.anchor : null,
                },
                { id: crypto.randomUUID(), body: input.body },
                authorIds(actor),
            );
            noteFeedback(row, actor);
            return c.json(publishThread(row, input.id), 201);
        })
        .patch('/:token/threads/:id', async (c) => {
            const { row, actor } = writer(c);
            if (actor.kind !== 'editor') {
                throw apiError(403, 'forbidden', 'Only editors resolve threads.');
            }
            const thread = threadOf(row, c.req.param('id'));
            const { status } = await parseJson(c, updateThreadRequestSchema);
            if (status !== thread.status) updateThreadStatus(db, thread.id, status, actor.user.id);
            return c.json(publishThread(row, thread.id));
        })
        .post('/:token/threads/:id/comments', async (c) => {
            const { row, actor } = writer(c);
            const thread = threadOf(row, c.req.param('id'));
            const input = await parseJson(c, createCommentRequestSchema);
            const existing = findComment(db, input.id);
            if (existing) {
                if (existing.comment.threadId !== thread.id || !isAuthor(actor, existing.comment)) {
                    throw apiError(409, 'conflict');
                }
                return c.json(loadThread(thread.id));
            }
            insertComment(db, { ...input, threadId: thread.id, ...authorIds(actor) });
            noteFeedback(row, actor);
            return c.json(publishThread(row, thread.id), 201);
        })
        .patch('/:token/comments/:id', async (c) => {
            const { row, actor } = writer(c);
            const found = findComment(db, c.req.param('id'));
            if (!found || found.versionId !== row.version.id || found.comment.deletedAt) {
                throw apiError(404, 'not_found');
            }
            if (!isAuthor(actor, found.comment)) {
                throw apiError(403, 'forbidden', 'You can only edit your own comments.');
            }
            const { body } = await parseJson(c, updateCommentRequestSchema);
            updateCommentBody(db, found.comment.id, body);
            return c.json(publishThread(row, found.comment.threadId));
        })
        .delete('/:token/comments/:id', (c) => {
            const { row, actor } = writer(c);
            const found = findComment(db, c.req.param('id'));
            if (!found || found.versionId !== row.version.id || found.comment.deletedAt) {
                throw apiError(404, 'not_found');
            }
            if (actor.kind !== 'editor' && !isAuthor(actor, found.comment)) {
                throw apiError(403, 'forbidden', 'You can only delete your own comments.');
            }
            const { threadId } = found.comment;
            if (deleteComment(db, found.comment.id, threadId)) {
                hub.publish(row.version.id, { type: 'thread-deleted', id: threadId });
            } else {
                publishThread(row, threadId);
            }
            return c.body(null, 204);
        })
        .put('/:token/review', async (c) => {
            const { row, actor } = writer(c);
            if (actor.kind !== 'viewer') {
                throw apiError(403, 'forbidden', 'Only viewers submit reviews.');
            }
            const input = await parseJson(c, submitReviewRequestSchema);
            const review = submitReview(db, row.version.id, actor.viewer.id, input);
            if (!review) throw apiError(500, 'internal_error');
            const body = toReview(review);
            hub.publish(row.version.id, { type: 'review', review: body });
            return c.json(body);
        })
        .get('/:token/events', (c) => {
            const row = sharedMockup(db, c);
            const participant = shareActor(db, c, row)?.author ?? null;
            return streamSSE(c, async (stream) => {
                const leave = hub.join(row.version.id, participant, (event) => {
                    stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);
                });
                const heartbeat = setInterval(() => {
                    stream.write(': heartbeat\n\n').catch(() => undefined);
                }, HEARTBEAT_MS);
                await new Promise<void>((resolve) => stream.onAbort(resolve));
                clearInterval(heartbeat);
                leave();
            });
        });
}
