import { z } from 'zod';
import type { Author } from './reviews.ts';
import { updateSchema } from './update.ts';

/** Longest name of a project or mockup, also set on the inputs. */
export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;

const nameSchema = z
    .string()
    .trim()
    .min(1, 'Required')
    .max(NAME_MAX_LENGTH, `At most ${NAME_MAX_LENGTH} characters`);
const descriptionSchema = z.string().trim().max(DESCRIPTION_MAX_LENGTH);

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
    archived: z.boolean(),
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
    /** Time of the latest comment, or null without any. */
    lastActivityAt: string | null;
};

export type Mockup = {
    id: string;
    /** The project it belongs to, with its owner, for breadcrumbs. */
    project: Pick<Project, 'id' | 'name' | 'owner'>;
    name: string;
    shareUrl: string;
    /** When the work on it was concluded; archived mockups accept no review changes. */
    archivedAt: string | null;
    version: MockupVersion;
    activity: MockupActivity;
    createdAt: string;
};

export type ProjectDetail = Project & { mockups: Mockup[] };

/** What a share link exposes before anything else is loaded. */
export type SharedMockup = {
    mockupId: string;
    name: string;
    /** Concluded: the comments can be read, nothing can be added or changed. */
    archived: boolean;
    /** Number of the current version, the one the link shows. */
    version: number;
    contentUrl: string;
    /** An editor who manages the mockup, the viewer owning the viewer key, or null. */
    me: Author | null;
    /** Whether `me` may resolve threads and delete any comment. */
    canModerate: boolean;
};
