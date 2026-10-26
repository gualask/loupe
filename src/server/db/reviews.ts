import { and, count, eq, inArray } from 'drizzle-orm';
import type { Db } from './client.ts';
import { reviews } from './schema.ts';

export type ReviewRow = typeof reviews.$inferSelect;

const byViewer = (versionId: string, viewerId: string) =>
    and(eq(reviews.versionId, versionId), eq(reviews.viewerId, viewerId));

export function findReview(db: Db, versionId: string, viewerId: string) {
    return db.select().from(reviews).where(byViewer(versionId, viewerId)).get();
}

/** Submitted reviews of the given versions, counted per version. */
export function countSubmittedReviews(db: Db, versionIds: string[]) {
    const rows = db
        .select({ versionId: reviews.versionId, n: count() })
        .from(reviews)
        .where(and(inArray(reviews.versionId, versionIds), eq(reviews.status, 'submitted')))
        .groupBy(reviews.versionId)
        .all();
    return (versionId: string) => rows.find((r) => r.versionId === versionId)?.n ?? 0;
}

export function listReviews(db: Db, versionId: string) {
    return db.select().from(reviews).where(eq(reviews.versionId, versionId)).all();
}

/**
 * Called when a viewer adds feedback: starts their review, or moves a submitted one back to
 * in progress. Returns the review only when its status changed.
 */
export function reopenReview(db: Db, versionId: string, viewerId: string) {
    const existing = findReview(db, versionId, viewerId);
    if (existing?.status === 'in_progress') return undefined;
    if (existing) {
        db.update(reviews).set({ status: 'in_progress' }).where(eq(reviews.id, existing.id)).run();
    } else {
        db.insert(reviews).values({ id: crypto.randomUUID(), versionId, viewerId }).run();
    }
    return findReview(db, versionId, viewerId);
}

export function submitReview(
    db: Db,
    versionId: string,
    viewerId: string,
    input: { verdict: 'approved' | 'changes_requested'; summary: string },
) {
    const submitted = { status: 'submitted' as const, ...input, submittedAt: new Date() };
    db.insert(reviews)
        .values({ id: crypto.randomUUID(), versionId, viewerId, ...submitted })
        .onConflictDoUpdate({ target: [reviews.versionId, reviews.viewerId], set: submitted })
        .run();
    return findReview(db, versionId, viewerId);
}
