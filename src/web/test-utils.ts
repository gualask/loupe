import { vi } from 'vitest';
import type { SharedMockup } from '../shared/api/projects.ts';
import type { Author, Comment, Thread } from '../shared/api/reviews.ts';
import { PIN_ANCHOR } from '../shared/test-fixtures.ts';

/** Stands in for the browser's localStorage, holding `stored`; returns its items. */
export function fakeStorage(stored: Record<string, string> = {}) {
    const items = new Map(Object.entries(stored));
    vi.stubGlobal('localStorage', {
        get length() {
            return items.size;
        },
        key: (index: number) => [...items.keys()][index] ?? null,
        getItem: (name: string) => items.get(name) ?? null,
        setItem: (name: string, value: string) => items.set(name, value),
        removeItem: (name: string) => items.delete(name),
    });
    return items;
}

export const ANN: Extract<Author, { kind: 'viewer' }> = {
    kind: 'viewer',
    id: 'v1',
    displayName: 'Ann',
    colorIndex: 0,
};

export const BOB: Extract<Author, { kind: 'viewer' }> = {
    kind: 'viewer',
    id: 'v2',
    displayName: 'Bob',
    colorIndex: 1,
};

/** A share link as Ann, a viewer who joined it, loads it. */
export const SHARED: SharedMockup = {
    mockupId: 'm1',
    name: 'Checkout',
    archived: false,
    version: 1,
    contentUrl: '/s/tok/content',
    me: ANN,
    canModerate: false,
    review: null,
};

/** A comment by Ann on `threadId`. */
export function comment(threadId: string, body: string, changes: Partial<Comment> = {}): Comment {
    return {
        id: crypto.randomUUID(),
        threadId,
        author: ANN,
        body,
        createdAt: '2026-01-01T00:00:00.000Z',
        editedAt: null,
        deleted: false,
        ...changes,
    };
}

/** An open pin by Ann, unless `changes` say otherwise. */
export function thread(id: string, changes: Partial<Thread> = {}): Thread {
    return {
        id,
        kind: 'pin',
        number: null,
        anchor: PIN_ANCHOR,
        status: 'open',
        resolvedAt: null,
        author: ANN,
        createdAt: '2026-01-01T00:00:00.000Z',
        comments: [],
        ...changes,
    };
}
