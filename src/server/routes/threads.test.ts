import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PinAnchor } from '../../shared/anchor.ts';
import { createTestApp, inviteEditor, setUpAdmin, tokenFromUrl } from '../test-utils.ts';

const ANCHOR: PinAnchor = {
    selector: 'main > button.cta',
    offset: { x: 0.5, y: 0.25 },
    text: 'Get started',
    point: { x: 640, y: 380 },
    viewport: { width: 1440, height: 900 },
};

async function sharedMockup() {
    const t = createTestApp();
    const admin = await setUpAdmin(t);
    const { editor, editorId } = await inviteEditor(t, admin);
    const project = await editor.post('/api/projects', { name: 'Shop' });
    const form = new FormData();
    form.set('file', new File(['<!doctype html><main>Hi</main>'], 'home.html'));
    const mockup = await editor.post(`/api/projects/${project.body.id}/mockups`, form);
    const token = tokenFromUrl(mockup.body.shareUrl);
    const base = `/api/s/${token}`;

    /** A new browser that registers as a viewer and keeps its key. */
    async function viewer(displayName = '') {
        const client = t.client();
        const res = await client.post(`${base}/viewers`, { displayName });
        client.header('x-loupe-viewer', res.body.key);
        return { client, key: res.body.key as string, viewer: res.body.viewer };
    }

    return { t, admin, editor, editorId, mockup: mockup.body, token, base, viewer };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('viewers', () => {
    it('registers viewers with a color in order of arrival', async () => {
        const { base, mockup, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const anonymous = await viewer('  ');

        expect(alice.viewer).toEqual({
            kind: 'viewer',
            id: expect.any(String),
            displayName: 'Alice',
            colorIndex: 0,
        });
        expect(anonymous.viewer).toMatchObject({
            displayName: expect.stringMatching(/^Anonymous \w+$/),
            colorIndex: 1,
        });
        expect((await alice.client.get(base)).body).toEqual({
            mockupId: mockup.id,
            name: 'home',
            readOnly: false,
            contentUrl: expect.stringMatching(/^\/s\/[\w-]{43}\/content$/),
            me: alice.viewer,
            canModerate: false,
            review: null,
        });
    });

    it('identifies editors who manage the mockup and ignores unknown keys', async () => {
        const { t, editor, editorId, base } = await sharedMockup();
        expect((await editor.get(base)).body).toMatchObject({
            me: { kind: 'editor', id: editorId, displayName: 'Eddie' },
            canModerate: true,
        });
        const stranger = t.client();
        stranger.header('x-loupe-viewer', 'not-a-key');
        expect((await stranger.get(base)).body).toMatchObject({ me: null, canModerate: false });
    });

    it('does not accept viewers on read-only mockups', async () => {
        const { t, editor, mockup, base } = await sharedMockup();
        await editor.patch(`/api/mockups/${mockup.id}`, { readOnly: true });
        const res = await t.client().post(`${base}/viewers`, { displayName: 'Alice' });
        expect(res).toMatchObject({ status: 403, body: { error: 'read_only' } });
    });
});

describe('threads', () => {
    it('creates pin and general threads with their first comment', async () => {
        const { t, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const id = crypto.randomUUID();

        const created = await alice.client.post(`${base}/threads`, {
            id,
            kind: 'pin',
            anchor: ANCHOR,
            body: ' Make this bigger ',
        });
        expect(created.status).toBe(201);
        expect(created.body).toEqual({
            id,
            kind: 'pin',
            number: 1,
            anchor: ANCHOR,
            status: 'open',
            resolvedAt: null,
            author: alice.viewer,
            createdAt: expect.any(String),
            comments: [
                {
                    id: expect.any(String),
                    threadId: id,
                    author: alice.viewer,
                    body: 'Make this bigger',
                    createdAt: expect.any(String),
                    editedAt: null,
                    deleted: false,
                },
            ],
        });

        const general = await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'Nice overall',
        });
        expect(general.body).toMatchObject({ kind: 'general', number: null, anchor: null });

        // Anyone with the link reads the threads, even before choosing a name.
        const listed = await t.client().get(`${base}/threads`);
        expect(listed.body).toEqual([created.body, general.body]);
    });

    it('treats a retried creation as success and rejects reused ids', async () => {
        const { base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        const thread = { id: crypto.randomUUID(), kind: 'general', body: 'Hi' };

        const first = await alice.client.post(`${base}/threads`, thread);
        const retry = await alice.client.post(`${base}/threads`, thread);
        expect(retry).toMatchObject({ status: 200, body: first.body });
        expect((await bob.client.post(`${base}/threads`, thread)).status).toBe(409);
        expect((await alice.client.get(`${base}/threads`)).body).toHaveLength(1);
    });

    it('requires a viewer identity and a valid anchor', async () => {
        const { t, base, viewer } = await sharedMockup();
        const anonymous = await t.client().post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'Hi',
        });
        expect(anonymous).toMatchObject({ status: 401, body: { error: 'viewer_required' } });

        const alice = await viewer('Alice');
        const invalid = await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: { ...ANCHOR, offset: { x: 2, y: 0 } },
            body: 'Hi',
        });
        expect(invalid).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    });

    it('numbers pins in order and never reuses the number of a deleted one', async () => {
        const { base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const pin = () =>
            alice.client.post(`${base}/threads`, {
                id: crypto.randomUUID(),
                kind: 'pin',
                anchor: ANCHOR,
                body: 'Here',
            });

        const first = await pin();
        const second = await pin();
        await alice.client.delete(`${base}/comments/${second.body.comments[0].id}`);
        const third = await pin();

        expect([first.body.number, third.body.number]).toEqual([1, 3]);
        const listed = await alice.client.get(`${base}/threads`);
        expect(listed.body.map((t: { number: number }) => t.number)).toEqual([1, 3]);
    });

    it('lets only editors resolve and reopen threads', async () => {
        const { editor, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, { id, kind: 'general', body: 'Hi' });

        const byViewer = await alice.client.patch(`${base}/threads/${id}`, { status: 'resolved' });
        expect(byViewer.status).toBe(403);

        const resolved = await editor.patch(`${base}/threads/${id}`, { status: 'resolved' });
        expect(resolved.body).toMatchObject({ status: 'resolved', resolvedAt: expect.any(String) });
        const reopened = await editor.patch(`${base}/threads/${id}`, { status: 'open' });
        expect(reopened.body).toMatchObject({ status: 'open', resolvedAt: null });
    });

    it('hides threads when the link is disabled, except from its editors', async () => {
        const { t, editor, mockup, base } = await sharedMockup();
        await editor.patch(`/api/mockups/${mockup.id}`, { shareEnabled: false });
        expect((await t.client().get(`${base}/threads`)).status).toBe(404);
        expect((await editor.get(`${base}/threads`)).status).toBe(200);
    });
});

describe('comments', () => {
    async function threadWithReply() {
        const ctx = await sharedMockup();
        const alice = await ctx.viewer('Alice');
        const bob = await ctx.viewer('Bob');
        const threadId = crypto.randomUUID();
        const thread = await alice.client.post(`${ctx.base}/threads`, {
            id: threadId,
            kind: 'general',
            body: 'Hi',
        });
        const replyId = crypto.randomUUID();
        await bob.client.post(`${ctx.base}/threads/${threadId}/comments`, {
            id: replyId,
            body: 'Agreed',
        });
        return { ...ctx, alice, bob, threadId, firstId: thread.body.comments[0].id, replyId };
    }

    it('adds replies from viewers and editors', async () => {
        const { editor, base, bob, threadId, replyId } = await threadWithReply();
        const res = await editor.post(`${base}/threads/${threadId}/comments`, {
            id: crypto.randomUUID(),
            body: 'Fixing it',
        });
        expect(res.status).toBe(201);
        expect(res.body.comments.map((c: { body: string }) => c.body)).toEqual([
            'Hi',
            'Agreed',
            'Fixing it',
        ]);
        expect(res.body.comments[1]).toMatchObject({ id: replyId, author: bob.viewer });
        expect(res.body.comments[2].author).toEqual({
            kind: 'editor',
            id: expect.any(String),
            displayName: 'Eddie',
        });
    });

    it('lets authors edit their own comments only', async () => {
        const { editor, base, alice, bob, replyId } = await threadWithReply();
        expect(
            (await alice.client.patch(`${base}/comments/${replyId}`, { body: 'Nope' })).status,
        ).toBe(403);
        expect((await editor.patch(`${base}/comments/${replyId}`, { body: 'Nope' })).status).toBe(
            403,
        );
        const edited = await bob.client.patch(`${base}/comments/${replyId}`, { body: 'Agreed!' });
        expect(edited.body.comments[1]).toMatchObject({
            body: 'Agreed!',
            editedAt: expect.any(String),
        });
    });

    it('blanks deleted comments and drops threads left empty', async () => {
        const { t, editor, base, alice, bob, threadId, firstId, replyId } = await threadWithReply();
        expect((await alice.client.delete(`${base}/comments/${replyId}`)).status).toBe(403);
        expect((await bob.client.delete(`${base}/comments/${replyId}`)).status).toBe(204);
        expect((await bob.client.delete(`${base}/comments/${replyId}`)).status).toBe(404);

        const [thread] = (await t.client().get(`${base}/threads`)).body;
        expect(thread.comments[1]).toMatchObject({ id: replyId, body: '', deleted: true });

        // Editors moderate any comment; the thread goes once nothing visible is left.
        expect((await editor.delete(`${base}/comments/${firstId}`)).status).toBe(204);
        expect((await t.client().get(`${base}/threads`)).body).toEqual([]);
        expect(
            (
                await alice.client.post(`${base}/threads/${threadId}/comments`, {
                    id: crypto.randomUUID(),
                    body: 'Hello?',
                })
            ).status,
        ).toBe(404);
    });

    it('keeps read-only mockups closed to viewers but not to editors', async () => {
        const { editor, mockup, base, alice, threadId } = await threadWithReply();
        await editor.patch(`/api/mockups/${mockup.id}`, { readOnly: true });
        const reply = { id: crypto.randomUUID(), body: 'Late' };
        expect(
            (await alice.client.post(`${base}/threads/${threadId}/comments`, reply)).status,
        ).toBe(403);
        expect((await editor.post(`${base}/threads/${threadId}/comments`, reply)).status).toBe(201);
    });
});

describe('reviews', () => {
    it('submits a verdict and reopens the review on new feedback', async () => {
        const { editor, mockup, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const verdict = { verdict: 'changes_requested', summary: 'See pins' };

        expect((await editor.put(`${base}/review`, verdict)).status).toBe(403);
        const submitted = await alice.client.put(`${base}/review`, verdict);
        expect(submitted.body).toEqual({
            viewerId: alice.viewer.id,
            status: 'submitted',
            verdict: 'changes_requested',
            summary: 'See pins',
            submittedAt: expect.any(String),
        });
        expect((await alice.client.get(base)).body.review).toEqual(submitted.body);

        await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: ANCHOR,
            body: 'One more',
        });
        expect((await alice.client.get(base)).body.review).toMatchObject({
            status: 'in_progress',
            verdict: 'changes_requested',
        });

        const summaries = await editor.get(`/api/mockups/${mockup.id}/reviews`);
        expect(summaries.body).toEqual([
            {
                viewer: alice.viewer,
                review: expect.objectContaining({ status: 'in_progress' }),
                threads: { open: 1, resolved: 0 },
                lastSeenAt: expect.any(String),
            },
        ]);
    });

    it('lists viewers to the editors of the mockup only', async () => {
        const { t, admin, mockup } = await sharedMockup();
        const { editor: fran } = await inviteEditor(t, admin, 'fran');
        expect((await fran.get(`/api/mockups/${mockup.id}/reviews`)).status).toBe(404);
        expect((await admin.get(`/api/mockups/${mockup.id}/reviews`)).body).toEqual([]);
    });
});

describe('project activity', () => {
    it('counts threads and dates the latest comment per mockup', async () => {
        const { editor, mockup, base, viewer } = await sharedMockup();
        const empty = await editor.get(`/api/projects/${mockup.projectId}`);
        expect(empty.body.mockups[0].activity).toEqual({
            openThreads: 0,
            resolvedThreads: 0,
            lastActivityAt: null,
        });

        const alice = await viewer('Alice');
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, { id, kind: 'general', body: 'Hi' });
        await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: ANCHOR,
            body: 'There',
        });
        await editor.patch(`${base}/threads/${id}`, { status: 'resolved' });

        const listed = await editor.get(`/api/projects/${mockup.projectId}`);
        expect(listed.body.mockups[0].activity).toEqual({
            openThreads: 1,
            resolvedThreads: 1,
            lastActivityAt: expect.any(String),
        });
    });
});

describe('event stream', () => {
    it('streams presence and thread changes', async () => {
        const { t, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        const res = await t.app.request(`${base}/events`, {
            headers: { 'x-loupe-viewer': bob.key },
        });
        expect(res.headers.get('content-type')).toBe('text/event-stream');
        expect(res.headers.get('x-accel-buffering')).toBe('no');
        const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
        if (!reader) throw new Error('expected a stream');
        const next = async () => {
            const { value = '' } = await reader.read();
            return JSON.parse(value.replace(/^data: /, ''));
        };

        expect(await next()).toEqual({ type: 'presence', participants: [bob.viewer] });

        // Alice's review stays private to Alice; her thread is shared with everyone.
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, { id, kind: 'general', body: 'Hi' });
        expect(await next()).toMatchObject({
            type: 'thread',
            thread: { id, author: alice.viewer },
        });

        await bob.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'Yo',
        });
        expect(await next()).toEqual({
            type: 'review',
            review: {
                viewerId: bob.viewer.id,
                status: 'in_progress',
                verdict: null,
                summary: '',
                submittedAt: null,
            },
        });
        expect(await next()).toMatchObject({ type: 'thread', thread: { author: bob.viewer } });

        await reader.cancel();
    });
    it('ends open streams once the link is disabled or regenerated', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const { t, editor, mockup, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const open = async () => {
            const res = await t.app.request(`${base}/events`, {
                headers: { 'x-loupe-viewer': alice.key },
            });
            const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
            if (!reader) throw new Error('expected a stream');
            await reader.read(); // presence
            return reader;
        };
        const heartbeat = async (reader: Awaited<ReturnType<typeof open>>) => {
            await vi.advanceTimersByTimeAsync(25_000);
            return reader.read();
        };

        const first = await open();
        expect(await heartbeat(first)).toEqual({ done: false, value: ': heartbeat\n\n' });
        await editor.patch(`/api/mockups/${mockup.id}`, { shareEnabled: false });
        expect((await heartbeat(first)).done).toBe(true);

        await editor.patch(`/api/mockups/${mockup.id}`, { shareEnabled: true });
        const second = await open();
        await editor.post(`/api/mockups/${mockup.id}/share/regenerate`);
        expect((await heartbeat(second)).done).toBe(true);
        expect((await t.app.request(`${base}/events`)).status).toBe(404);
    });
});

describe('rate limits', () => {
    it('limits how fast a viewer can change things, but not editors', async () => {
        const { editor, base, viewer } = await sharedMockup();
        const alice = await viewer('Alice');
        const comment = () => ({ id: crypto.randomUUID(), kind: 'general', body: 'Spam' });

        for (let i = 0; i < 30; i++) {
            expect((await alice.client.post(`${base}/threads`, comment())).status).toBe(201);
        }
        expect(await alice.client.post(`${base}/threads`, comment())).toMatchObject({
            status: 429,
            body: { error: 'too_many_requests' },
        });
        for (let i = 0; i < 31; i++) {
            expect((await editor.post(`${base}/threads`, comment())).status).toBe(201);
        }
    });

    it('limits how many viewers can join a mockup in a short time', async () => {
        const { t, base } = await sharedMockup();
        for (let i = 0; i < 60; i++) {
            expect((await t.client().post(`${base}/viewers`, {})).status).toBe(201);
        }
        expect(await t.client().post(`${base}/viewers`, {})).toMatchObject({
            status: 429,
            body: { error: 'too_many_requests' },
        });
    });
});
