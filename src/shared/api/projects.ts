import { z } from 'zod';
import type { Author, Review } from './reviews.ts';
import { updateSchema } from './update.ts';

const nameSchema = z.string().trim().min(1, 'Required').max(120, 'At most 120 characters');
const descriptionSchema = z.string().trim().max(500);

export const createProjectRequestSchema = z.object({
    name: nameSchema,
    description: descriptionSchema.default(''),
});

export const updateProjectRequestSchema = updateSchema({
    name: nameSchema,
    description: descriptionSchema,
});

export const updateMockupRequestSchema = updateSchema({
    name: nameSchema,
    shareEnabled: z.boolean(),
    /** ISO date-time, or null for no expiry. */
    shareExpiresAt: z.iso.datetime({ offset: true }).nullable(),
    readOnly: z.boolean(),
});

export type Project = {
    id: string;
    name: string;
    description: string;
    owner: { id: string; displayName: string };
    mockupCount: number;
    createdAt: string;
};

type MockupVersion = {
    number: number;
    originalFilename: string;
    sizeBytes: number;
    /** External URLs referenced by the file; empty when it is self-contained. */
    externalRefs: string[];
    createdAt: string;
};

/** Feedback on a mockup's current version. */
export type MockupActivity = {
    openThreads: number;
    resolvedThreads: number;
    submittedReviews: number;
    /** Time of the latest comment, or null without any. */
    lastActivityAt: string | null;
};

export type Mockup = {
    id: string;
    projectId: string;
    name: string;
    shareUrl: string;
    shareEnabled: boolean;
    shareExpiresAt: string | null;
    readOnly: boolean;
    version: MockupVersion;
    activity: MockupActivity;
    createdAt: string;
};

export type ProjectDetail = Project & { mockups: Mockup[] };

/** What a share link exposes before anything else is loaded. */
export type SharedMockup = {
    mockupId: string;
    name: string;
    readOnly: boolean;
    /** Number of the current version, the one the link shows. */
    version: number;
    contentUrl: string;
    /** An editor who manages the mockup, the viewer owning the viewer key, or null. */
    me: Author | null;
    /** Whether `me` may resolve threads and delete any comment. */
    canModerate: boolean;
    /** The viewer's own review of the current version. */
    review: Review | null;
};
