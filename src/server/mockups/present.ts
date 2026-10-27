import type { Mockup, Project } from '../../shared/api/projects.ts';
import type { Config } from '../config.ts';
import type { MockupWithVersion } from '../db/mockups.ts';
import type { ProjectRow } from '../db/projects.ts';

/** A project with its owner's name, as the project queries return it. */
type ProjectWithOwner = { project: ProjectRow; ownerName: string };

const ownerOf = ({ project, ownerName }: ProjectWithOwner) => ({
    id: project.ownerId,
    displayName: ownerName,
});

type ProjectWithActivity = ProjectWithOwner & {
    mockupCount: number;
    openThreads: number;
    resolvedThreads: number;
    updatedAt: Date;
};

export function toProject(row: ProjectWithActivity): Project {
    return {
        id: row.project.id,
        name: row.project.name,
        description: row.project.description,
        owner: ownerOf(row),
        mockupCount: row.mockupCount,
        activity: { openThreads: row.openThreads, resolvedThreads: row.resolvedThreads },
        createdAt: row.project.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

/** Feedback on a mockup's current version, as the database reports it. */
export type ActivityRow = {
    openThreads: number;
    resolvedThreads: number;
    lastActivityAt: Date | null;
};

export function toMockup(
    config: Config,
    { mockup, version }: MockupWithVersion,
    project: ProjectWithOwner,
    activity: ActivityRow,
): Mockup {
    return {
        id: mockup.id,
        project: { id: project.project.id, name: project.project.name, owner: ownerOf(project) },
        name: mockup.name,
        shareUrl: `${config.publicUrl}/s/${mockup.shareToken}`,
        archivedAt: mockup.archivedAt?.toISOString() ?? null,
        version: {
            number: version.number,
            originalFilename: version.originalFilename,
            sizeBytes: version.sizeBytes,
            externalRefs: version.externalRefs,
            createdAt: version.createdAt.toISOString(),
        },
        activity: {
            ...activity,
            lastActivityAt: activity.lastActivityAt?.toISOString() ?? null,
        },
        createdAt: mockup.createdAt.toISOString(),
    };
}
