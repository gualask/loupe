import { eq, lt } from 'drizzle-orm';
import type { Db } from './client.ts';
import { sessions, users } from './schema.ts';

export function insertSession(
    db: Db,
    session: { idHash: string; userId: string; expiresAt: Date },
) {
    db.insert(sessions)
        .values({ ...session, lastSeenAt: new Date() })
        .run();
}

export function findSessionWithUser(db: Db, idHash: string) {
    return db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.idHash, idHash))
        .get();
}

/** Extends a session in use; `last_seen_at` is informative, for debugging. */
export function touchSession(db: Db, idHash: string, expiresAt: Date) {
    db.update(sessions)
        .set({ lastSeenAt: new Date(), expiresAt })
        .where(eq(sessions.idHash, idHash))
        .run();
}

export function deleteSession(db: Db, idHash: string) {
    db.delete(sessions).where(eq(sessions.idHash, idHash)).run();
}

export function deleteUserSessions(db: Db, userId: string) {
    db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function deleteExpiredSessions(db: Db) {
    db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}
