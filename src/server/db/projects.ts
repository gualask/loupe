import { count, desc, eq } from 'drizzle-orm';
import type { Db } from './client.ts';
import { mockups, projects, users } from './schema.ts';

export type ProjectRow = typeof projects.$inferSelect;

/** Projects with owner and mockup count; all projects when `ownerId` is omitted. */
export function listProjects(db: Db, ownerId?: string) {
    return db
        .select({
            project: projects,
            ownerName: users.displayName,
            mockupCount: count(mockups.id),
        })
        .from(projects)
        .innerJoin(users, eq(users.id, projects.ownerId))
        .leftJoin(mockups, eq(mockups.projectId, projects.id))
        .where(ownerId ? eq(projects.ownerId, ownerId) : undefined)
        .groupBy(projects.id)
        .orderBy(desc(projects.createdAt))
        .all();
}

export function findProject(db: Db, id: string) {
    return db
        .select({
            project: projects,
            ownerName: users.displayName,
            mockupCount: count(mockups.id),
        })
        .from(projects)
        .innerJoin(users, eq(users.id, projects.ownerId))
        .leftJoin(mockups, eq(mockups.projectId, projects.id))
        .where(eq(projects.id, id))
        .groupBy(projects.id)
        .get();
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
