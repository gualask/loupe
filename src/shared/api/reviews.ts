import { z } from 'zod';
import { type PinAnchor, pinAnchorSchema } from '../anchor.ts';

/** Header carrying the secret viewer key stored by the browser (docs/SPEC.md §4.3). */
export const VIEWER_KEY_HEADER = 'x-loupe-viewer';

/**
 * Header carrying the number of the version a review space shows. Requests about another
 * version than the current one are refused with `version_changed` (docs/SPEC.md §5.3).
 */
export const VERSION_HEADER = 'x-loupe-version';

/** Size of the viewer color palette; viewers get colors in order of arrival. */
export const VIEWER_COLORS = 12;

const displayNameSchema = z.string().trim().max(60, 'At most 60 characters');

const bodySchema = z.string().trim().min(1, 'Required').max(5000, 'At most 5000 characters');

export const registerViewerRequestSchema = z.object({
    /** Empty for a generated name such as "Anonymous Fox". */
    displayName: displayNameSchema.default(''),
});

export const renameViewerRequestSchema = z.object({
    displayName: displayNameSchema.min(1, 'Required'),
});

// Clients generate thread and comment ids, so optimistic updates, retries and real-time events
// all refer to the same id.
export const createThreadRequestSchema = z.discriminatedUnion('kind', [
    z.object({ id: z.uuid(), kind: z.literal('pin'), anchor: pinAnchorSchema, body: bodySchema }),
    z.object({ id: z.uuid(), kind: z.literal('general'), body: bodySchema }),
]);

export const createCommentRequestSchema = z.object({ id: z.uuid(), body: bodySchema });

export const updateCommentRequestSchema = z.object({ body: bodySchema });

export const updateThreadRequestSchema = z.object({ status: z.enum(['open', 'resolved']) });

export const submitReviewRequestSchema = z.object({
    verdict: z.enum(['approved', 'changes_requested']),
    summary: z.string().trim().max(5000).default(''),
});

/** Who wrote something, or who is present. Editors have no color. */
export type Author =
    | { kind: 'viewer'; id: string; displayName: string; colorIndex: number }
    | { kind: 'editor'; id: string; displayName: string };

export type Comment = {
    id: string;
    threadId: string;
    author: Author;
    /** Empty once deleted. */
    body: string;
    createdAt: string;
    editedAt: string | null;
    deleted: boolean;
};

export type Thread = {
    id: string;
    kind: 'pin' | 'general';
    /** Pins only: their number on this version, kept when other pins are deleted. */
    number: number | null;
    anchor: PinAnchor | null;
    status: 'open' | 'resolved';
    resolvedAt: string | null;
    author: Author;
    createdAt: string;
    comments: Comment[];
};

export type Review = {
    viewerId: string;
    status: 'in_progress' | 'submitted';
    verdict: 'approved' | 'changes_requested' | null;
    summary: string;
    submittedAt: string | null;
};

export type RegisteredViewer = { key: string; viewer: Author };

/** A viewer of a mockup as listed to its editors. */
export type ReviewerSummary = {
    viewer: Extract<Author, { kind: 'viewer' }>;
    review: Review | null;
    threads: { open: number; resolved: number };
    lastSeenAt: string;
};

/** Payload of each message on the share-link event stream. */
export type ShareEvent =
    | { type: 'thread'; thread: Thread }
    | { type: 'thread-deleted'; id: string }
    | { type: 'review'; review: Review }
    | { type: 'presence'; participants: Author[] };
