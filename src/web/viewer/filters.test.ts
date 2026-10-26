import { describe, expect, it } from 'vitest';
import type { Thread } from '../../shared/api/reviews.ts';
import { ANN, BOB, thread } from '../test-utils.ts';
import { filterThreads } from './filters.ts';

const THREADS = [thread('a'), thread('b', { author: BOB }), thread('c', { status: 'resolved' })];
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
