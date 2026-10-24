import { and, eq, isNull } from 'drizzle-orm';
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
        createdBy?: string;
        expiresAt: Date;
    },
) {
    db.insert(accountTokens)
        .values({ id: crypto.randomUUID(), ...token })
        .run();
}

/** Returns the token only while it is unused and not expired. */
export function findUsableAccountToken(db: Db, tokenHash: string) {
    const row = db
        .select()
        .from(accountTokens)
        .where(and(eq(accountTokens.tokenHash, tokenHash), isNull(accountTokens.usedAt)))
        .get();
    return row && row.expiresAt.getTime() > Date.now() ? row : undefined;
}

export function markAccountTokenUsed(db: Db, id: string) {
    db.update(accountTokens).set({ usedAt: new Date() }).where(eq(accountTokens.id, id)).run();
}

/** Invalidates unused tokens of one kind, e.g. older setup links when a new one is issued. */
export function expireUnusedAccountTokens(db: Db, kind: AccountTokenRow['kind']) {
    db.update(accountTokens)
        .set({ expiresAt: new Date() })
        .where(and(eq(accountTokens.kind, kind), isNull(accountTokens.usedAt)))
        .run();
}
