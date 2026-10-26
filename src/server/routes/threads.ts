import type { Context } from 'hono';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
    createCommentRequestSchema,
    createThreadRequestSchema,
    type Review,
    renameViewerRequestSchema,
    submitReviewRequestSchema,
    updateCommentRequestSchema,
    updateThreadRequestSchema,
} from '../../shared/api/reviews.ts';
import { deleteComment, findComment, insertComment, updateCommentBody } from '../db/comments.ts';
import { findVersion } from '../db/mockups.ts';
import { reopenReview, submitReview } from '../db/reviews.ts';
import {
    findThread,
    findThreadWithComments,
    insertThread,
    listThreads,
    updateThreadStatus,
} from '../db/threads.ts';
import { renameViewer } from '../db/viewers.ts';
import { apiError, notFound, parseJson } from '../http.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import {
    authorIds,
    checkVersion,
    findSharedMockup,
    isAuthor,
    olderVersionShown,
    type ShareActor,
    type SharedMockupRow,
    shareActor,
    sharedMockup,
} from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import { toReview, toThread, viewerAuthor } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

// A retried creation reusing an id that belongs to something else.
const CONFLICT = 'This conflicts with something that already exists. Reload and retry.';

// Keeps idle connections open through proxies that drop silent ones, and is when an open stream
// notices that its link was disabled, regenerated or has expired.
const HEARTBEAT_MS = 25_000;

/** Threads, comments, reviews and the event stream of a share link, mounted under /api/s. */
export function threadRoutes({ db, hub }: AppDeps & { hub: Hub }) {
    // Far above a person typing comments; stops scripts flooding a mockup.
    const viewerChanges = createWindowLimiter({ max: 30, windowMs: 60 * 1000 });

    /** The mockup behind the link, if the request is about its current version. */
    function currentVersion(c: Context<AppEnv>) {
        const row = sharedMockup(db, c);
        checkVersion(c, row);
        return row;
    }

    /**
     * The mockup and actor for a change; read-only mockups accept changes from editors only.
     * Viewers are rate limited, editors are trusted.
     */
    function writer(c: Context<AppEnv>) {
        const row = currentVersion(c);
        const actor = shareActor(db, c, row);
        if (!actor) throw apiError(401, 'viewer_required', 'Choose a name before commenting.');
        if (actor.kind === 'viewer') {
            if (row.mockup.readOnly) throw apiError(403, 'read_only', 'This mockup is read-only.');
            if (!viewerChanges.take(actor.viewer.id)) {
                throw apiError(429, 'too_many_requests', 'Too many changes, retry in a minute.');
            }
        }
        return { row, actor };
    }

    function threadOf(row: SharedMockupRow, id: string) {
        const thread = findThread(db, id);
        if (!thread || thread.versionId !== row.version.id) throw notFound();
        return thread;
    }

    function loadThread(id: string) {
        const found = findThreadWithComments(db, id);
        if (!found) throw notFound();
        return toThread(found);
    }

    /** Broadcasts the current state of a thread and returns it. */
    function publishThread(row: SharedMockupRow, id: string) {
        const thread = loadThread(id);
        hub.publish(row.version.id, { type: 'thread', thread });
        return thread;
    }

    /** A review is private to its viewer: only their own connections (e.g. other tabs) hear of it. */
    function publishReview(row: SharedMockupRow, review: Review) {
        hub.publish(
            row.version.id,
            { type: 'review', review },
            (participant) => participant?.kind === 'viewer' && participant.id === review.viewerId,
        );
    }

    /** Feedback from a viewer starts their review, or reopens a submitted one. */
    function noteFeedback(row: SharedMockupRow, actor: ShareActor) {
        if (actor.kind !== 'viewer') return;
        const review = reopenReview(db, row.version.id, actor.viewer.id);
        if (review) publishReview(row, toReview(review));
    }

    return new Hono<AppEnv>()
        .get('/:token/threads', (c) => {
            const row = sharedMockup(db, c);
            // A review space left open on an older version keeps reading its threads.
            const older = olderVersionShown(c, row);
            const versionId =
                older === undefined ? row.version.id : findVersion(db, row.mockup.id, older)?.id;
            if (!versionId) throw notFound();
            return c.json(listThreads(db, versionId).map(toThread));
        })
        .post('/:token/threads', async (c) => {
            const { row, actor } = writer(c);
            const input = await parseJson(c, createThreadRequestSchema);
            const existing = findThread(db, input.id);
            if (existing) {
                // A retried request: answer with the thread it already created.
                if (existing.versionId !== row.version.id || !isAuthor(actor, existing)) {
                    throw apiError(409, 'conflict', CONFLICT);
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
                    throw apiError(409, 'conflict', CONFLICT);
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
                throw notFound();
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
                throw notFound();
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
            if (!review) throw apiError(500, 'internal_error', 'The review could not be saved.');
            const body = toReview(review);
            publishReview(row, body);
            return c.json(body);
        })
        .patch('/:token/viewers/me', async (c) => {
            const { row, actor } = writer(c);
            if (actor.kind !== 'viewer') {
                throw apiError(403, 'forbidden', 'Editors use the name of their account.');
            }
            const { displayName } = await parseJson(c, renameViewerRequestSchema);
            const renamed = renameViewer(db, actor.viewer.id, displayName);
            if (!renamed) throw notFound();
            const viewer = viewerAuthor(renamed);
            hub.rename(row.version.id, viewer);
            // The name is shown on every thread and comment of the viewer.
            for (const thread of listThreads(db, row.version.id).map(toThread)) {
                const authors = [
                    thread.author,
                    ...thread.comments.map((comment) => comment.author),
                ];
                if (authors.some((a) => a.kind === 'viewer' && a.id === viewer.id)) {
                    hub.publish(row.version.id, { type: 'thread', thread });
                }
            }
            return c.json(viewer);
        })
        .get('/:token/events', (c) => {
            const row = currentVersion(c);
            const participant = shareActor(db, c, row)?.author ?? null;
            // Reverse proxies such as nginx would otherwise hold events back in their buffer.
            c.header('X-Accel-Buffering', 'no');
            return streamSSE(c, async (stream) => {
                const leave = hub.join(row.version.id, participant, (event) => {
                    stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);
                });
                let heartbeat: ReturnType<typeof setInterval> | undefined;
                // Until the client leaves, or the link stops giving access to this version: the
                // stream then ends, and the client finds the link unavailable when reconnecting.
                await new Promise<void>((resolve) => {
                    stream.onAbort(resolve);
                    heartbeat = setInterval(() => {
                        if (findSharedMockup(db, c)?.version.id !== row.version.id) resolve();
                        else stream.write(': heartbeat\n\n').catch(() => undefined);
                    }, HEARTBEAT_MS);
                });
                clearInterval(heartbeat);
                leave();
            });
        });
}
