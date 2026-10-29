import { and, count, eq, isNull } from 'drizzle-orm';
import type { Role } from '../../shared/api/auth.ts';
import type { Db } from './client.ts';
import { users } from './schema.ts';

export type UserRow = typeof users.$inferSelect;

export function countUsers(db: Db) {
    return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

/** Admins whose account is not disabled. */
export function countActiveAdmins(db: Db) {
    return (
        db
            .select({ n: count() })
            .from(users)
            .where(and(eq(users.role, 'admin'), isNull(users.disabledAt)))
            .get()?.n ?? 0
    );
}

export function findUserById(db: Db, id: string) {
    return db.select().from(users).where(eq(users.id, id)).get();
}

export function findUserByUsername(db: Db, username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
}

export function listUsers(db: Db) {
    return db.select().from(users).orderBy(users.username).all();
}

export function insertUser(
    db: Db,
    user: { username: string; displayName: string; passwordHash: string; role: Role },
) {
    return db
        .insert(users)
        .values({ id: crypto.randomUUID(), ...user })
        .returning()
        .get();
}

export function updateUser(
    db: Db,
    id: string,
    changes: Partial<Pick<UserRow, 'passwordHash' | 'role' | 'disabledAt'>>,
) {
    return db.update(users).set(changes).where(eq(users.id, id)).returning().get();
}
