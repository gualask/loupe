import { and, eq, gt, lt } from 'drizzle-orm';
import type { Role } from '../../shared/api/auth.ts';
import type { Db } from './client.ts';
import { accountTokens } from './schema.ts';

export type AccountTokenRow = typeof accountTokens.$inferSelect;

export function insertAccountToken(
    db: Db,
    token: {
        tokenHash: string;
        kind: AccountTokenRow['kind'];
        role?: Role;
        userId?: string;
        expiresAt: Date;
    },
) {
    db.insert(accountTokens)
        .values({ id: crypto.randomUUID(), ...token })
        .run();
}

/** Returns the token only while it is not expired; used tokens are deleted. */
export function findUsableAccountToken(db: Db, tokenHash: string) {
    return db
        .select()
        .from(accountTokens)
        .where(and(eq(accountTokens.tokenHash, tokenHash), gt(accountTokens.expiresAt, new Date())))
        .get();
}

/** Consumes a token: links are single-use. */
export function deleteAccountToken(db: Db, id: string) {
    db.delete(accountTokens).where(eq(accountTokens.id, id)).run();
}

/** Deletes every token of one kind, e.g. older setup links when a new one is issued. */
export function deleteAccountTokensOfKind(db: Db, kind: AccountTokenRow['kind']) {
    db.delete(accountTokens).where(eq(accountTokens.kind, kind)).run();
}

export function deleteExpiredAccountTokens(db: Db) {
    db.delete(accountTokens).where(lt(accountTokens.expiresAt, new Date())).run();
}
