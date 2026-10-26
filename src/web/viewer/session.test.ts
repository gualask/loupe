import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedMockup } from '../../shared/api/projects.ts';
import type { Author, Thread } from '../../shared/api/reviews.ts';
import { createReviewSession } from './session.ts';

const ME: Author = { kind: 'viewer', id: 'v1', displayName: 'Ann', colorIndex: 0 };

const SHARED: SharedMockup = {
    mockupId: 'm1',
    name: 'Checkout',
    readOnly: false,
    version: 1,
    contentUrl: '/s/tok/content',
    me: ME,
    canModerate: false,
    review: null,
};

/** A fake API server: records requests and answers like Loupe, or fails like a lost network. */
function fakeServer() {
    const threads = new Map<string, Thread>();
    const requests: string[] = [];
    const state = { online: true, rejectNext: 0, versionChanged: false };

    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit = {}) => {
            const method = init.method ?? 'GET';
            if (!state.online) throw new TypeError('Failed to fetch');
            requests.push(`${method} ${url}`);
            if (state.versionChanged && method !== 'GET') {
                return Response.json(
                    { error: 'version_changed', message: 'A new version is available.' },
                    { status: 409 },
                );
            }
            if (state.rejectNext > 0) {
                state.rejectNext--;
                return Response.json(
                    { error: 'too_many_requests', message: 'Slow down.' },
                    { status: 429 },
                );
            }
            const body = init.body ? JSON.parse(String(init.body)) : undefined;
            if (method === 'GET') return Response.json([...threads.values()]);
            const [, threadId] = /threads\/([^/]+)\/comments$/.exec(url) ?? [];
            if (threadId) {
                const thread = threads.get(threadId);
                if (!thread) return Response.json({ error: 'not_found' }, { status: 404 });
                thread.comments.push({
                    id: body.id,
                    threadId,
                    author: ME,
                    body: body.body,
                    createdAt: new Date().toISOString(),
                    editedAt: null,
                    deleted: false,
                });
                return Response.json(thread, { status: 201 });
            }
            const thread: Thread = {
                id: body.id,
                kind: body.kind,
                number: null,
                anchor: null,
                status: 'open',
                resolvedAt: null,
                author: ME,
                createdAt: new Date().toISOString(),
                comments: [
                    {
                        id: crypto.randomUUID(),
                        threadId: body.id,
                        author: ME,
                        body: body.body,
                        createdAt: new Date().toISOString(),
                        editedAt: null,
                        deleted: false,
                    },
                ],
            };
            threads.set(thread.id, thread);
            return Response.json(thread, { status: 201 });
        }),
    );
    return { threads, requests, state };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('review session changes', () => {
    it('sends changes in order, also after retrying while offline', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        server.state.online = false;

        const created = session.createThread({ kind: 'general' }, 'First');
        // Let the creation fail and start backing off.
        await vi.advanceTimersByTimeAsync(2500);
        const threadId = session.threads.value[0]?.id ?? '';
        const replied = session.reply(threadId, 'Second');
        expect(session.saveState.value).toBe('offline');

        server.state.online = true;
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await created).toBe(true);
        expect(await replied).toBe(true);
        expect(server.requests).toEqual([
            'POST /api/s/tok/threads',
            `POST /api/s/tok/threads/${threadId}/comments`,
        ]);
        expect(session.threads.value[0]?.comments.map((c) => c.body)).toEqual(['First', 'Second']);
        expect(session.saveState.value).toBe('saved');
    });

    it('reports rejected changes and reloads the threads once the queue is empty', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        server.state.rejectNext = 1;

        const first = session.createThread({ kind: 'general' }, 'One');
        const second = session.createThread({ kind: 'general' }, 'Two');
        expect(session.threads.value).toHaveLength(2);

        expect(await first).toBe(false);
        expect(await second).toBe(true);
        expect(session.error.value).toBe('Slow down.');
        // The reload comes after the second creation, so it keeps the saved thread.
        expect(server.requests).toEqual([
            'POST /api/s/tok/threads',
            'POST /api/s/tok/threads',
            'GET /api/s/tok/threads',
        ]);
        expect(session.threads.value.map((t) => t.comments[0]?.body)).toEqual(['Two']);
    });
});

describe('versions', () => {
    it('turns a newer version into a notice to reload instead of an error', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        server.state.versionChanged = true;

        expect(await session.createThread({ kind: 'general' }, 'Late')).toBe(false);
        expect(session.outdated.value).toBe(true);
        expect(session.mayWrite.value).toBe(false);
        expect(session.error.value).toBeUndefined();
        expect(session.saveState.value).toBe('idle');
        // Reloaded as the server has them, for the version still shown: without the rejected one.
        expect(server.requests).toEqual(['POST /api/s/tok/threads', 'GET /api/s/tok/threads']);
        expect(session.threads.value).toEqual([]);
    });
});

describe('viewer identity', () => {
    /** A browser that has not commented yet, with its own storage and a server that names it. */
    function newcomer(stored: Record<string, string> = {}) {
        const items = new Map(Object.entries(stored));
        vi.stubGlobal('localStorage', {
            getItem: (name: string) => items.get(name) ?? null,
            setItem: (name: string, value: string) => items.set(name, value),
            removeItem: (name: string) => items.delete(name),
        });
        const registered: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: RequestInit = {}) => {
                if (url.endsWith('/events')) return new Response(new ReadableStream());
                if (url.endsWith('/viewers')) {
                    const { displayName } = JSON.parse(String(init.body));
                    registered.push(displayName);
                    const viewer = { ...ME, displayName: displayName || 'Anonymous Fox' };
                    return Response.json({ key: 'k', viewer }, { status: 201 });
                }
                return Response.json([]);
            }),
        );
        const session = createReviewSession('tok', { ...SHARED, me: null }, null);
        return { items, registered, session };
    }

    it('joins under a generated name once, and invites the viewer to choose one', async () => {
        const { items, registered, session } = newcomer();
        const joins = await Promise.all([session.join(), session.join()]);
        expect(joins).toEqual([true, true]);
        expect(registered).toEqual(['']);
        expect(session.me.value?.displayName).toBe('Anonymous Fox');
        expect(items.get('loupe:viewer:m1')).toBe('k');
        expect(session.nameHint.value).toBe(true);

        session.dismissNameHint();
        expect(session.nameHint.value).toBe(false);
        expect(items.get('loupe:name-hint')).toBe('dismissed');
        session.disconnect();
    });

    it('joins under the name chosen on an earlier mockup, without the invitation', async () => {
        const { registered, session } = newcomer({ 'loupe:name': 'Gino' });
        await session.join();
        expect(registered).toEqual(['Gino']);
        expect(session.me.value?.displayName).toBe('Gino');
        expect(session.nameHint.value).toBe(false);
        session.disconnect();
    });

    it('does not invite again a viewer who dismissed the invitation', async () => {
        const { session } = newcomer({ 'loupe:name-hint': 'dismissed' });
        await session.join();
        expect(session.nameHint.value).toBe(false);
        session.disconnect();
    });

    it('remembers a chosen name for the next mockups', async () => {
        const { items, registered, session } = newcomer();
        await session.setName('Gino');
        expect(registered).toEqual(['Gino']);
        expect(items.get('loupe:name')).toBe('Gino');
        expect(items.get('loupe:name-hint')).toBe('dismissed');
        session.disconnect();
    });
});
