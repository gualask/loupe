import { count, desc, eq } from 'drizzle-orm';
import { VIEWER_COLORS } from '../../shared/api/reviews.ts';
import type { Db } from './client.ts';
import { viewers } from './schema.ts';

export type ViewerRow = typeof viewers.$inferSelect;

/** Registers a viewer; colors are handed out in order of arrival. */
export function insertViewer(
    db: Db,
    viewer: { mockupId: string; keyHash: string; displayName: string },
) {
    return db.transaction((tx) => {
        const arrived =
            tx
                .select({ n: count() })
                .from(viewers)
                .where(eq(viewers.mockupId, viewer.mockupId))
                .get()?.n ?? 0;
        return tx
            .insert(viewers)
            .values({
                id: crypto.randomUUID(),
                ...viewer,
                colorIndex: arrived % VIEWER_COLORS,
                lastSeenAt: new Date(),
            })
            .returning()
            .get();
    });
}

export function findViewerByKey(db: Db, keyHash: string) {
    return db.select().from(viewers).where(eq(viewers.keyHash, keyHash)).get();
}

export function touchViewer(db: Db, id: string) {
    db.update(viewers).set({ lastSeenAt: new Date() }).where(eq(viewers.id, id)).run();
}

export function listViewers(db: Db, mockupId: string) {
    return db
        .select()
        .from(viewers)
        .where(eq(viewers.mockupId, mockupId))
        .orderBy(desc(viewers.lastSeenAt))
        .all();
}
