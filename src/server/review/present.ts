import type { Author, Comment, ReviewerSummary, Thread } from '../../shared/api/reviews.ts';
import type {
    Authored,
    countThreadsByViewer,
    lastCommentsByViewer,
    ThreadWithComments,
} from '../db/threads.ts';
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
        number: row.number,
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

/**
 * Every viewer of a mockup with their thread counts and last activity on the current version, the
 * most recently active first and those without any after them.
 */
export function toReviewerSummaries(
    viewers: ViewerRow[],
    threadCounts: ReturnType<typeof countThreadsByViewer>,
    lastComments: ReturnType<typeof lastCommentsByViewer>,
): ReviewerSummary[] {
    const summaries = viewers.map((viewer) => {
        const counts = threadCounts.filter((t) => t.viewerId === viewer.id);
        const countOf = (status: string) => counts.find((t) => t.status === status)?.n ?? 0;
        const comments = lastComments.find((c) => c.viewerId === viewer.id);
        const times = [comments?.written, comments?.edited]
            .filter((at): at is Date => !!at)
            .map((at) => at.getTime());
        return {
            viewer: viewerAuthor(viewer),
            threads: { open: countOf('open'), resolved: countOf('resolved') },
            lastActivityAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
        };
    });
    // ISO times sort as text; viewers without activity go last.
    return summaries.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
}
