import { describe, expect, it } from 'vitest';
import { type Author, awaitsReply, type Comment, type Thread } from './reviews.ts';

const alice: Author = { kind: 'viewer', id: 'v1', displayName: 'Alice', colorIndex: 0 };
const eddie: Author = { kind: 'editor', id: 'u1', displayName: 'Eddie' };

const comment = (author: Author, deleted = false): Comment => ({
    id: crypto.randomUUID(),
    threadId: 't1',
    author,
    body: deleted ? '' : 'Hi',
    createdAt: '2026-01-01T00:00:00.000Z',
    editedAt: null,
    deleted,
});

const thread = (comments: Comment[], status: Thread['status'] = 'open'): Thread => ({
    id: 't1',
    kind: 'general',
    number: null,
    anchor: null,
    status,
    resolvedAt: null,
    author: comments[0]?.author ?? alice,
    createdAt: '2026-01-01T00:00:00.000Z',
    comments,
});

describe('awaitsReply', () => {
    it('waits for an editor while the latest visible comment is a reviewer’s', () => {
        expect(awaitsReply(thread([comment(alice)]))).toBe(true);
        expect(awaitsReply(thread([comment(eddie)]))).toBe(false);
        expect(awaitsReply(thread([comment(eddie), comment(alice)]))).toBe(true);
        expect(awaitsReply(thread([comment(alice), comment(eddie)]))).toBe(false);
        expect(awaitsReply(thread([comment(eddie), comment(alice, true)]))).toBe(false);
    });

    it('never waits once resolved', () => {
        expect(awaitsReply(thread([comment(alice)], 'resolved'))).toBe(false);
    });
});
