import { z } from 'zod';
import type { MockupPermissions } from '../mockup-permissions.ts';
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
    /** Threads on the current versions of its mockups. */
    activity: ThreadTotals;
    createdAt: string;
    /** Latest of its creation, a version upload and a comment in any of its mockups. */
    updatedAt: string;
};

export type MockupVersion = {
    number: number;
    originalFilename: string;
    sizeBytes: number;
    /** External URLs referenced by the file; empty when it is self-contained. */
    externalRefs: string[];
    createdAt: string;
};

/**
 * Open and resolved threads, and those among the open ones waiting for an editor, of a mockup's
 * current version or summed over a project.
 */
export type ThreadTotals = {
    openThreads: number;
    resolvedThreads: number;
    /** Open threads whose latest comment is a reviewer's: they wait for an editor. */
    awaitingThreads: number;
};

/** Feedback on a mockup's current version. */
type MockupActivity = ThreadTotals & {
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
    /** What the server lets its document do, which its preview is embedded with. */
    permissions: MockupPermissions;
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
    /** What the server lets the document do, which the review space embeds it with. */
    permissions: MockupPermissions;
    /** Earlier versions still stored, the latest first: they can be shown beside the current. */
    earlierVersions: SharedVersion[];
    /** An editor who manages the mockup, the viewer owning the viewer key, or null. */
    me: Author | null;
    /** Whether `me` may resolve threads and delete any comment. */
    canModerate: boolean;
};

/** An earlier version of a shared mockup, shown read-only for comparison. */
export type SharedVersion = { number: number; createdAt: string; contentUrl: string };
