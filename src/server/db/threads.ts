import { count, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type { PinAnchor } from '../../shared/anchor.ts';
import type { Db } from './client.ts';
import { comments, threads, users, viewers } from './schema.ts';

type ThreadRow = typeof threads.$inferSelect;
type CommentRow = typeof comments.$inferSelect;
type ViewerRow = typeof viewers.$inferSelect;
type UserRef = { id: string; displayName: string };

/** A thread or comment with whichever of its two possible authors is set. */
export type Authored<T> = { row: T; viewer: ViewerRow | null; user: UserRef | null };
export type ThreadWithComments = Authored<ThreadRow> & { comments: Authored<CommentRow>[] };

const userRef = { id: users.id, displayName: users.displayName };
// Insertion order: timestamps can tie within a millisecond, rowids cannot.
const byInsertion = (table: typeof threads | typeof comments) => sql`${table}.rowid`;

function loadThreads(db: Db, where: SQL | undefined): ThreadWithComments[] {
    const rows = db
        .select({ row: threads, viewer: viewers, user: userRef })
        .from(threads)
        .leftJoin(viewers, eq(viewers.id, threads.authorViewerId))
        .leftJoin(users, eq(users.id, threads.authorUserId))
        .where(where)
        .orderBy(byInsertion(threads))
        .all();
    if (!rows.length) return [];
    const commentRows = db
        .select({ row: comments, viewer: viewers, user: userRef })
        .from(comments)
        .leftJoin(viewers, eq(viewers.id, comments.authorViewerId))
        .leftJoin(users, eq(users.id, comments.authorUserId))
        .where(
            inArray(
                comments.threadId,
                rows.map((r) => r.row.id),
            ),
        )
        .orderBy(byInsertion(comments))
        .all();
    const byThread = Map.groupBy(commentRows, (c) => c.row.threadId);
    return rows.map((r) => ({ ...r, comments: byThread.get(r.row.id) ?? [] }));
}

export function listThreads(db: Db, versionId: string) {
    return loadThreads(db, eq(threads.versionId, versionId));
}

export function findThreadWithComments(db: Db, id: string) {
    return loadThreads(db, eq(threads.id, id))[0];
}

export function findThread(db: Db, id: string) {
    return db.select().from(threads).where(eq(threads.id, id)).get();
}

type AuthorIds = { authorViewerId: string | null; authorUserId: string | null };

/** Creates a thread together with its first comment. */
export function insertThread(
    db: Db,
    thread: { id: string; versionId: string; kind: 'pin' | 'general'; anchor: PinAnchor | null },
    comment: { id: string; body: string },
    author: AuthorIds,
) {
    db.transaction((tx) => {
        tx.insert(threads)
            .values({ ...thread, ...author })
            .run();
        tx.insert(comments)
            .values({ ...comment, threadId: thread.id, ...author })
            .run();
    });
}

export function updateThreadStatus(
    db: Db,
    id: string,
    status: 'open' | 'resolved',
    userId: string,
) {
    const resolved = status === 'resolved';
    db.update(threads)
        .set({
            status,
            resolvedBy: resolved ? userId : null,
            resolvedAt: resolved ? new Date() : null,
        })
        .where(eq(threads.id, id))
        .run();
}

/** Open and resolved thread counts per viewer on a version. */
export function countThreadsByViewer(db: Db, versionId: string) {
    return db
        .select({ viewerId: threads.authorViewerId, status: threads.status, n: count() })
        .from(threads)
        .where(eq(threads.versionId, versionId))
        .groupBy(threads.authorViewerId, threads.status)
        .all();
}
