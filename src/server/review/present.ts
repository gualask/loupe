import type { Author, Comment, Review, ReviewerSummary, Thread } from '../../shared/api/reviews.ts';
import type { ReviewRow } from '../db/reviews.ts';
import type { Authored, countThreadsByViewer, ThreadWithComments } from '../db/threads.ts';
import type { ViewerRow } from '../db/viewers.ts';

export function viewerAuthor(viewer: ViewerRow): Extract<Author, { kind: 'viewer' }> {
    return {
        kind: 'viewer',
        id: viewer.id,
        displayName: viewer.displayName,
        colorIndex: viewer.colorIndex,
    };
}

function toAuthor({ viewer, user }: Authored<unknown>): Author {
    if (viewer) return viewerAuthor(viewer);
    // Editors are disabled rather than deleted, so a missing user is only a safety net.
    return { kind: 'editor', id: user?.id ?? '', displayName: user?.displayName ?? 'Unknown' };
}

export function toThread(thread: ThreadWithComments): Thread {
    const { row } = thread;
    return {
        id: row.id,
        kind: row.kind,
        anchor: row.anchor,
        status: row.status,
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        author: toAuthor(thread),
        createdAt: row.createdAt.toISOString(),
        comments: thread.comments.map(
            (comment): Comment => ({
                id: comment.row.id,
                threadId: row.id,
                author: toAuthor(comment),
                body: comment.row.body,
                createdAt: comment.row.createdAt.toISOString(),
                editedAt: comment.row.editedAt?.toISOString() ?? null,
                deleted: !!comment.row.deletedAt,
            }),
        ),
    };
}

export function toReview(row: ReviewRow): Review {
    return {
        viewerId: row.viewerId,
        status: row.status,
        verdict: row.verdict,
        summary: row.summary,
        submittedAt: row.submittedAt?.toISOString() ?? null,
    };
}

/** Every viewer of a mockup with their review and thread counts on the current version. */
export function toReviewerSummaries(
    viewers: ViewerRow[],
    threadCounts: ReturnType<typeof countThreadsByViewer>,
    reviews: ReviewRow[],
): ReviewerSummary[] {
    const reviewByViewer = new Map(reviews.map((r) => [r.viewerId, r]));
    return viewers.map((viewer) => {
        const review = reviewByViewer.get(viewer.id);
        const counts = threadCounts.filter((t) => t.viewerId === viewer.id);
        const countOf = (status: string) => counts.find((t) => t.status === status)?.n ?? 0;
        return {
            viewer: viewerAuthor(viewer),
            review: review ? toReview(review) : null,
            threads: { open: countOf('open'), resolved: countOf('resolved') },
            lastSeenAt: viewer.lastSeenAt.toISOString(),
        };
    });
}
