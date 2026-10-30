import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedMockup } from '../../shared/api/projects.ts';
import type { ShareEvent, Thread } from '../../shared/api/reviews.ts';
import { ANN, comment, SHARED, thread } from '../test-utils.ts';
import { createReviewSession } from './session.ts';

/** A fake API server: records requests and answers like Loupe, or fails like a lost network. */
function fakeServer() {
    const threads = new Map<string, Thread>();
    const requests: string[] = [];
    const state = {
        online: true,
        rejectNext: 0,
        /** Changes answered 503, as by a proxy while Loupe restarts. */
        unavailableNext: 0,
        versionChanged: false,
        /** Sent on the event stream, which then stays open. */
        events: [] as ShareEvent[],
        /** Holds the answers listing the threads until it resolves. */
        listHeld: undefined as Promise<void> | undefined,
    };

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
            if (state.unavailableNext > 0 && method !== 'GET') {
                state.unavailableNext--;
                return new Response('Bad gateway', { status: 503 });
            }
            if (state.rejectNext > 0) {
                state.rejectNext--;
                return Response.json(
                    { error: 'too_many_requests', message: 'Slow down.' },
                    { status: 429 },
                );
            }
            const body = init.body ? JSON.parse(String(init.body)) : undefined;
            if (url.endsWith('/events')) {
                const messages = state.events.map((e) => `data: ${JSON.stringify(e)}\n\n`);
                return new Response(
                    new ReadableStream({
                        start: (controller) => {
                            for (const message of messages) {
                                controller.enqueue(new TextEncoder().encode(message));
                            }
                        },
                    }),
                );
            }
            if (method === 'GET') {
                const listed = [...threads.values()];
                await state.listHeld;
                return Response.json(listed);
            }
            const [, threadId] = /threads\/([^/]+)\/comments$/.exec(url) ?? [];
            if (threadId) {
                const existing = threads.get(threadId);
                if (!existing) return Response.json({ error: 'not_found' }, { status: 404 });
                existing.comments.push(comment(threadId, body.body, { id: body.id }));
                return Response.json(existing, { status: 201 });
            }
            const created = thread(body.id, {
                kind: body.kind,
                anchor: body.anchor ?? null,
                comments: [comment(body.id, body.comment.body, { id: body.comment.id })],
            });
            threads.set(created.id, created);
            return Response.json(created, { status: 201 });
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

    it('keeps the ids it generated, so a new thread can be changed before it is saved', async () => {
        fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        const created = session.createThread({ kind: 'general' }, 'Hi');
        const [optimistic] = session.threads.value;

        expect(await created).toBe(true);
        expect(session.threads.value).toMatchObject([
            { id: optimistic?.id, comments: [{ id: optimistic?.comments[0]?.id }] },
        ]);
    });

    it('retries changes while the server is unavailable', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        server.state.unavailableNext = 1;

        const created = session.createThread({ kind: 'general' }, 'Hi');
        await vi.advanceTimersByTimeAsync(0);
        expect(session.saveState.value).toBe('offline');
        await vi.advanceTimersByTimeAsync(1000);
        expect(await created).toBe(true);
        expect(session.error.value).toBeUndefined();
        expect(session.saveState.value).toBe('saved');
    });

    it('reloads the threads on reconnection only once the pending changes are saved', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        server.state.unavailableNext = 1;
        const created = session.createThread({ kind: 'general' }, 'Hi');

        session.connect();
        await vi.advanceTimersByTimeAsync(0);
        // The server does not have the thread yet; reloading now would hide it.
        expect(session.threads.value).toHaveLength(1);
        expect(session.loaded.value).toBe(false);

        await vi.advanceTimersByTimeAsync(1000);
        expect(await created).toBe(true);
        session.disconnect();
        // No reload while the creation was retried: only after it.
        expect(server.requests).toEqual([
            'GET /api/s/tok/events',
            'POST /api/s/tok/threads',
            'POST /api/s/tok/threads',
            'GET /api/s/tok/threads',
        ]);
        expect(session.threads.value).toHaveLength(1);
        expect(session.loaded.value).toBe(true);
    });

    it('does not show threads loaded while a change was made, but loads them again', async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        let release = () => {};
        server.state.listHeld = new Promise((resolve) => {
            release = resolve;
        });
        session.connect();
        await vi.advanceTimersByTimeAsync(0);

        // The list was read before this thread existed.
        const created = session.createThread({ kind: 'general' }, 'Hi');
        expect(await created).toBe(true);
        release();
        await vi.advanceTimersByTimeAsync(0);
        session.disconnect();
        expect(session.threads.value.map((t) => t.comments[0]?.body)).toEqual(['Hi']);
        expect(server.requests.filter((r) => r === 'GET /api/s/tok/threads')).toHaveLength(2);
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
        // The threads of the current version never loaded here.
        expect(session.loaded.value).toBe(false);
    });
});

describe('events', () => {
    it("shows a viewer's new name on their threads, comments and presence", async () => {
        const server = fakeServer();
        const session = createReviewSession('tok', SHARED, 'key');
        await session.createThread({ kind: 'general' }, 'Hi');
        const renamed = { ...ANN, displayName: 'Annie' };
        server.state.events = [
            { type: 'presence', participants: [ANN] },
            { type: 'viewer', viewer: renamed },
        ];

        session.connect();
        await vi.advanceTimersByTimeAsync(0);
        session.disconnect();
        expect(session.loaded.value).toBe(true);
        expect(session.threads.value).toMatchObject([
            { author: renamed, comments: [{ author: renamed }] },
        ]);
        expect(session.presence.value).toEqual([renamed]);
        expect(session.me.value).toEqual(renamed);
    });

    it('stops offering an earlier version once it is deleted', async () => {
        const server = fakeServer();
        const version = (number: number) => ({
            number,
            createdAt: '2026-10-01T00:00:00.000Z',
            contentUrl: `/s/tok/versions/${number}/content`,
        });
        const session = createReviewSession(
            'tok',
            { ...SHARED, version: 3, earlierVersions: [version(2), version(1)] },
            'key',
        );
        server.state.events = [{ type: 'version-deleted', number: 2 }];

        session.connect();
        await vi.advanceTimersByTimeAsync(0);
        session.disconnect();
        expect(session.shared.value.earlierVersions).toEqual([version(1)]);
    });
});

describe('checkIdentity', () => {
    const EDITOR = { kind: 'editor' as const, id: 'u1', displayName: 'Andrea' };

    /** Checks the identity while the server sees `me`; resolves to whether the page reloaded. */
    async function check(shown: SharedMockup['me'], me: SharedMockup['me']) {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ ...SHARED, me })),
        );
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        await createReviewSession('tok', { ...SHARED, me: shown }, null).checkIdentity();
        return reload.mock.calls.length > 0;
    }

    it('reloads once another tab signed in or out', async () => {
        expect(await check(null, EDITOR)).toBe(true);
        expect(await check(ANN, EDITOR)).toBe(true);
        expect(await check(EDITOR, ANN)).toBe(true);
        expect(await check(EDITOR, null)).toBe(true);
    });

    it('stays when the server sees the identity shown', async () => {
        expect(await check(null, null)).toBe(false);
        expect(await check(ANN, { ...ANN, displayName: 'Ann B.' })).toBe(false);
        expect(await check(EDITOR, EDITOR)).toBe(false);
    });
});
