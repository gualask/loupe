import { describe, expect, it } from 'vitest';
import type { Author, Thread } from '../../shared/api/reviews.ts';
import { filterThreads } from './filters.ts';

const ANN: Author = { kind: 'viewer', id: 'v1', displayName: 'Ann', colorIndex: 0 };
const BOB: Author = { kind: 'viewer', id: 'v2', displayName: 'Bob', colorIndex: 1 };

function thread(id: string, author: Author, status: Thread['status']): Thread {
    return {
        id,
        kind: 'general',
        number: null,
        anchor: null,
        status,
        resolvedAt: null,
        author,
        createdAt: '2026-01-01T00:00:00.000Z',
        comments: [],
    };
}

const THREADS = [thread('a', ANN, 'open'), thread('b', BOB, 'open'), thread('c', ANN, 'resolved')];
const ids = (threads: Thread[]) => threads.map((t) => t.id);

describe('filterThreads', () => {
    it('lists threads by status, or those of the viewer', () => {
        expect(ids(filterThreads(THREADS, { filter: 'open', me: ANN }))).toEqual(['a', 'b']);
        expect(ids(filterThreads(THREADS, { filter: 'resolved', me: ANN }))).toEqual(['c']);
        expect(ids(filterThreads(THREADS, { filter: 'mine', me: ANN }))).toEqual(['a', 'c']);
        expect(ids(filterThreads(THREADS, { filter: 'mine', me: null }))).toEqual([]);
        expect(ids(filterThreads(THREADS, { filter: 'all', me: null }))).toEqual(['a', 'b', 'c']);
    });

    it("keeps one viewer's threads when an editor opened the space for them", () => {
        const filtered = filterThreads(THREADS, { filter: 'all', viewerId: 'v2', me: null });
        expect(ids(filtered)).toEqual(['b']);
    });
});
