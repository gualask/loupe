import { and, desc, eq, max } from 'drizzle-orm';
import type { Db } from './client.ts';
import { mockups, mockupVersions, projects } from './schema.ts';

export type MockupRow = typeof mockups.$inferSelect;
export type MockupVersionRow = typeof mockupVersions.$inferSelect;

/** A mockup with its current version. */
export type MockupWithVersion = { mockup: MockupRow; version: MockupVersionRow };

const withCurrentVersion = (db: Db) =>
    db
        .select({ mockup: mockups, version: mockupVersions })
        .from(mockups)
        .innerJoin(mockupVersions, eq(mockupVersions.id, mockups.currentVersionId));

export function listMockups(db: Db, projectId: string) {
    return withCurrentVersion(db)
        .where(eq(mockups.projectId, projectId))
        .orderBy(desc(mockups.createdAt))
        .all();
}

export function findMockup(db: Db, id: string) {
    return withCurrentVersion(db).where(eq(mockups.id, id)).get();
}

export function findMockupByShareToken(db: Db, shareToken: string) {
    return db
        .select({ mockup: mockups, version: mockupVersions, ownerId: projects.ownerId })
        .from(mockups)
        .innerJoin(mockupVersions, eq(mockupVersions.id, mockups.currentVersionId))
        .innerJoin(projects, eq(projects.id, mockups.projectId))
        .where(eq(mockups.shareToken, shareToken))
        .get();
}

/** Creates a mockup together with its first version. */
export function insertMockup(
    db: Db,
    mockup: { projectId: string; name: string; shareToken: string; createdBy: string },
    version: Pick<MockupVersionRow, 'sha256' | 'sizeBytes' | 'originalFilename' | 'externalRefs'>,
) {
    const mockupId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    db.transaction((tx) => {
        tx.insert(mockups)
            .values({ id: mockupId, ...mockup })
            .run();
        tx.insert(mockupVersions)
            .values({
                id: versionId,
                mockupId,
                number: 1,
                uploadedBy: mockup.createdBy,
                ...version,
            })
            .run();
        tx.update(mockups)
            .set({ currentVersionId: versionId })
            .where(eq(mockups.id, mockupId))
            .run();
    });
    return mockupId;
}

export function findVersion(db: Db, mockupId: string, number: number) {
    return db
        .select()
        .from(mockupVersions)
        .where(and(eq(mockupVersions.mockupId, mockupId), eq(mockupVersions.number, number)))
        .get();
}

/**
 * Adds a version after the latest one and makes it current. Adds nothing to an archived mockup,
 * nor when the file is the current version's: uploading it again would only hide its threads.
 */
export function insertVersion(
    db: Db,
    mockupId: string,
    version: Pick<
        MockupVersionRow,
        'sha256' | 'sizeBytes' | 'originalFilename' | 'externalRefs' | 'uploadedBy'
    >,
) {
    const versionId = crypto.randomUUID();
    return db.transaction((tx) => {
        const current = tx
            .select({ sha256: mockupVersions.sha256, archivedAt: mockups.archivedAt })
            .from(mockups)
            .innerJoin(mockupVersions, eq(mockupVersions.id, mockups.currentVersionId))
            .where(eq(mockups.id, mockupId))
            .get();
        // Checked here too, as the mockup may be archived while the file uploads.
        if (current?.archivedAt) return 'archived';
        if (current?.sha256 === version.sha256) return 'same_file';
        const latest =
            tx
                .select({ n: max(mockupVersions.number) })
                .from(mockupVersions)
                .where(eq(mockupVersions.mockupId, mockupId))
                .get()?.n ?? 0;
        tx.insert(mockupVersions)
            .values({ id: versionId, mockupId, number: latest + 1, ...version })
            .run();
        tx.update(mockups)
            .set({ currentVersionId: versionId })
            .where(eq(mockups.id, mockupId))
            .run();
        return 'added';
    });
}

export function updateMockup(
    db: Db,
    id: string,
    changes: Partial<Pick<MockupRow, 'name' | 'shareToken' | 'archivedAt'>>,
) {
    db.update(mockups).set(changes).where(eq(mockups.id, id)).run();
}

export function deleteMockup(db: Db, id: string) {
    db.delete(mockups).where(eq(mockups.id, id)).run();
}

/** SHA-256 of every stored file still referenced by a version. */
export function referencedFileHashes(db: Db) {
    return new Set(
        db
            .selectDistinct({ sha256: mockupVersions.sha256 })
            .from(mockupVersions)
            .all()
            .map((r) => r.sha256),
    );
}
