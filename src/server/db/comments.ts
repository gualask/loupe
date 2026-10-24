import { and, count, eq, isNull } from 'drizzle-orm';
import type { Db } from './client.ts';
import { comments, threads } from './schema.ts';

export function findComment(db: Db, id: string) {
    return db
        .select({ comment: comments, versionId: threads.versionId })
        .from(comments)
        .innerJoin(threads, eq(threads.id, comments.threadId))
        .where(eq(comments.id, id))
        .get();
}

export function insertComment(
    db: Db,
    comment: {
        id: string;
        threadId: string;
        body: string;
        authorViewerId: string | null;
        authorUserId: string | null;
    },
) {
    db.insert(comments).values(comment).run();
}

export function updateCommentBody(db: Db, id: string, body: string) {
    db.update(comments).set({ body, editedAt: new Date() }).where(eq(comments.id, id)).run();
}

/**
 * Blanks a comment but keeps its place in the conversation. A thread left without any visible
 * comment is deleted; returns whether that happened.
 */
export function deleteComment(db: Db, id: string, threadId: string) {
    return db.transaction((tx) => {
        tx.update(comments)
            .set({ body: '', deletedAt: new Date() })
            .where(eq(comments.id, id))
            .run();
        const remaining =
            tx
                .select({ n: count() })
                .from(comments)
                .where(and(eq(comments.threadId, threadId), isNull(comments.deletedAt)))
                .get()?.n ?? 0;
        if (remaining) return false;
        tx.delete(threads).where(eq(threads.id, threadId)).run();
        return true;
    });
}
