import { Hono } from 'hono';
import {
    createCommentRequestSchema,
    createThreadRequestSchema,
    updateCommentRequestSchema,
    updateThreadRequestSchema,
} from '../../shared/api/reviews.ts';
import { deleteComment, findComment, insertComment, updateCommentBody } from '../db/comments.ts';
import { findVersion } from '../db/mockups.ts';
import {
    findThread,
    findThreadWithComments,
    insertThread,
    listThreads,
    updateThreadStatus,
} from '../db/threads.ts';
import { apiError, notFound } from '../http.ts';
import {
    authorIds,
    isAuthor,
    type SharedMockupRow,
    sharedMockup,
    shownVersion,
} from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import { toThread } from '../review/present.ts';
import type { ShareAccess } from '../review/share-access.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** A retried creation reusing an id that belongs to something else. */
const conflict = () =>
    apiError(
        409,
        'conflict',
        'This conflicts with something that already exists. Reload and retry.',
    );

/** Threads and comments of a share link, mounted under /api/s. */
export function threadRoutes({ db, hub, access }: AppDeps & { hub: Hub; access: ShareAccess }) {
    const { writer, writerWith } = access;

    function threadOf(row: SharedMockupRow, id: string) {
        const thread = findThread(db, id);
        if (!thread || thread.versionId !== row.version.id) throw notFound();
        return thread;
    }

    /** A comment of the link's current version, unless deleted. */
    function commentOf(row: SharedMockupRow, id: string) {
        const found = findComment(db, id);
        if (!found || found.versionId !== row.version.id || found.comment.deletedAt) {
            throw notFound();
        }
        return found;
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

    return new Hono<AppEnv>()
        .get('/:token/threads', (c) => {
            const row = sharedMockup(db, c);
            // A review space left open on an older version keeps reading its threads.
            const shown = shownVersion(c, row);
            const version =
                shown === row.version.number ? row.version : findVersion(db, row.mockup.id, shown);
            if (!version) throw notFound();
            return c.json(listThreads(db, version.id).map(toThread));
        })
        .post('/:token/threads', async (c) => {
            const { row, actor, input } = await writerWith(c, createThreadRequestSchema);
            const existing = findThread(db, input.id);
            if (existing) {
                // A retried request: answer with the thread it already created.
                if (existing.versionId !== row.version.id || !isAuthor(actor, existing)) {
                    throw conflict();
                }
                return c.json(loadThread(existing.id));
            }
            if (findComment(db, input.comment.id)) throw conflict();
            insertThread(
                db,
                {
                    id: input.id,
                    versionId: row.version.id,
                    kind: input.kind,
                    anchor: input.kind === 'pin' ? input.anchor : null,
                },
                input.comment,
                authorIds(actor),
            );
            return c.json(publishThread(row, input.id), 201);
        })
        .patch('/:token/threads/:id', async (c) => {
            const { row, actor, input } = await writerWith(c, updateThreadRequestSchema);
            if (actor.kind !== 'editor') {
                throw apiError(403, 'forbidden', 'Only editors resolve threads.');
            }
            const thread = threadOf(row, c.req.param('id'));
            if (input.status !== thread.status) {
                updateThreadStatus(db, thread.id, input.status, actor.user.id);
            }
            return c.json(publishThread(row, thread.id));
        })
        .post('/:token/threads/:id/comments', async (c) => {
            const { row, actor, input } = await writerWith(c, createCommentRequestSchema);
            const thread = threadOf(row, c.req.param('id'));
            const existing = findComment(db, input.id);
            if (existing) {
                if (existing.comment.threadId !== thread.id || !isAuthor(actor, existing.comment)) {
                    throw conflict();
                }
                return c.json(loadThread(thread.id));
            }
            insertComment(db, { ...input, threadId: thread.id, ...authorIds(actor) });
            return c.json(publishThread(row, thread.id), 201);
        })
        .patch('/:token/comments/:id', async (c) => {
            const { row, actor, input } = await writerWith(c, updateCommentRequestSchema);
            const found = commentOf(row, c.req.param('id'));
            if (!isAuthor(actor, found.comment)) {
                throw apiError(403, 'forbidden', 'You can only edit your own comments.');
            }
            updateCommentBody(db, found.comment.id, input.body);
            return c.json(publishThread(row, found.comment.threadId));
        })
        .delete('/:token/comments/:id', (c) => {
            const { row, actor } = writer(c);
            const found = commentOf(row, c.req.param('id'));
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
        });
}
