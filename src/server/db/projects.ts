import { countDistinct, desc, eq, type SQL, sql } from 'drizzle-orm';
import type { Db } from './client.ts';
import { comments, mockups, mockupVersions, projects, threads, users } from './schema.ts';

export type ProjectRow = typeof projects.$inferSelect;

/** Ids of the joined threads with a status, for counting them once each. */
const threadsWith = (status: 'open' | 'resolved') =>
    countDistinct(sql`case when ${threads.status} = ${status} then ${threads.id} end`);

/**
 * When a project was last updated: the latest of its creation, an upload and a comment. Uploads
 * and comments are read on current versions only, as a current version is the latest upload of
 * its mockup and comments go to current versions alone.
 */
const updatedAt = sql`max(
    ${projects.createdAt},
    coalesce(max(${mockupVersions.createdAt}), 0),
    coalesce(max(${comments.createdAt}), 0)
)`.mapWith(projects.createdAt);

/** Projects with owner, mockup count, threads on current versions and last update. */
function selectProjects(db: Db, where: SQL | undefined) {
    return db
        .select({
            project: projects,
            ownerName: users.displayName,
            mockupCount: countDistinct(mockups.id),
            openThreads: threadsWith('open'),
            resolvedThreads: threadsWith('resolved'),
            updatedAt,
        })
        .from(projects)
        .innerJoin(users, eq(users.id, projects.ownerId))
        .leftJoin(mockups, eq(mockups.projectId, projects.id))
        .leftJoin(mockupVersions, eq(mockupVersions.id, mockups.currentVersionId))
        .leftJoin(threads, eq(threads.versionId, mockupVersions.id))
        .leftJoin(comments, eq(comments.threadId, threads.id))
        .where(where)
        .groupBy(projects.id);
}

/** The latest updated first; all projects when `ownerId` is omitted. */
export function listProjects(db: Db, ownerId?: string) {
    return selectProjects(db, ownerId ? eq(projects.ownerId, ownerId) : undefined)
        .orderBy(desc(updatedAt))
        .all();
}

export function findProject(db: Db, id: string) {
    return selectProjects(db, eq(projects.id, id)).get();
}

export function insertProject(
    db: Db,
    project: { ownerId: string; name: string; description: string },
) {
    const id = crypto.randomUUID();
    db.insert(projects)
        .values({ id, ...project })
        .run();
    return id;
}

export function updateProject(
    db: Db,
    id: string,
    changes: { name?: string; description?: string },
) {
    db.update(projects).set(changes).where(eq(projects.id, id)).run();
}

export function deleteProject(db: Db, id: string) {
    db.delete(projects).where(eq(projects.id, id)).run();
}
