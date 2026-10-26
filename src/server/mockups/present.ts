import type { Mockup, Project } from '../../shared/api/projects.ts';
import type { Config } from '../config.ts';
import type { MockupWithVersion } from '../db/mockups.ts';
import type { ProjectRow } from '../db/projects.ts';

export function toProject(row: {
    project: ProjectRow;
    ownerName: string;
    mockupCount: number;
}): Project {
    return {
        id: row.project.id,
        name: row.project.name,
        description: row.project.description,
        owner: { id: row.project.ownerId, displayName: row.ownerName },
        mockupCount: row.mockupCount,
        createdAt: row.project.createdAt.toISOString(),
    };
}

/** Feedback on a mockup's current version, as the database reports it. */
export type ActivityRow = {
    openThreads: number;
    resolvedThreads: number;
    submittedReviews: number;
    lastActivityAt: Date | null;
};

export function toMockup(
    config: Config,
    { mockup, version }: MockupWithVersion,
    activity: ActivityRow,
): Mockup {
    return {
        id: mockup.id,
        projectId: mockup.projectId,
        name: mockup.name,
        shareUrl: `${config.publicUrl}/s/${mockup.shareToken}`,
        shareEnabled: mockup.shareEnabled,
        shareExpiresAt: mockup.shareExpiresAt?.toISOString() ?? null,
        readOnly: mockup.readOnly,
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
