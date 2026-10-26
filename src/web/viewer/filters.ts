import type { Author, Thread } from '../../shared/api/reviews.ts';

export type ThreadFilter = 'open' | 'mine' | 'resolved' | 'all';

/** The threads a filter lists, limited to one viewer's when `viewerId` is set. */
export function filterThreads(
    threads: Thread[],
    { filter, viewerId, me }: { filter: ThreadFilter; viewerId?: string; me: Author | null },
) {
    return threads.filter((t) => {
        if (viewerId && t.author.id !== viewerId) return false;
        if (filter === 'open') return t.status === 'open';
        if (filter === 'resolved') return t.status === 'resolved';
        if (filter === 'mine') return !!me && t.author.kind === me.kind && t.author.id === me.id;
        return true;
    });
}
