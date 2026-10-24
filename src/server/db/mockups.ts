import { desc, eq } from 'drizzle-orm';
import type { Db } from './client.ts';
import { mockups, mockupVersions, projects } from './schema.ts';

export type MockupRow = typeof mockups.$inferSelect;
export type MockupVersionRow = typeof mockupVersions.$inferSelect;

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

export function updateMockup(
    db: Db,
    id: string,
    changes: Partial<
        Pick<MockupRow, 'name' | 'shareToken' | 'shareEnabled' | 'shareExpiresAt' | 'readOnly'>
    >,
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
