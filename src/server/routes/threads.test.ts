import { describe, expect, it } from 'vitest';
import { PIN_ANCHOR } from '../../shared/test-fixtures.ts';
import { createSharedMockup } from '../test-utils.ts';

describe('threads', () => {
    it('creates pin and general threads with their first comment', async () => {
        const { t, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const id = crypto.randomUUID();

        const created = await alice.client.post(`${base}/threads`, {
            id,
            kind: 'pin',
            anchor: PIN_ANCHOR,
            body: ' Make this bigger ',
        });
        expect(created.status).toBe(201);
        expect(created.body).toEqual({
            id,
            kind: 'pin',
            number: 1,
            anchor: PIN_ANCHOR,
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
        const { base, viewer } = await createSharedMockup();
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
        const { t, base, viewer } = await createSharedMockup();
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
            anchor: { ...PIN_ANCHOR, offset: { x: 2, y: 0 } },
            body: 'Hi',
        });
        expect(invalid).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    });

    it('numbers pins in order and never reuses the number of a deleted one', async () => {
        const { base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const pin = () =>
            alice.client.post(`${base}/threads`, {
                id: crypto.randomUUID(),
                kind: 'pin',
                anchor: PIN_ANCHOR,
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
        const { editor, base, viewer } = await createSharedMockup();
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
});

describe('comments', () => {
    async function threadWithReply() {
        const ctx = await createSharedMockup();
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

    it('keeps archived mockups readable but closed to everyone, editors included', async () => {
        const { editor, mockup, base, alice, threadId } = await threadWithReply();
        await editor.patch(`/api/mockups/${mockup.id}`, { archived: true });
        const reply = { id: crypto.randomUUID(), body: 'Late' };
        for (const client of [alice.client, editor]) {
            expect(await client.post(`${base}/threads/${threadId}/comments`, reply)).toMatchObject({
                status: 403,
                body: { error: 'archived' },
            });
        }
        const threads = await alice.client.get(`${base}/threads`);
        expect(threads.body.map((t: { id: string }) => t.id)).toEqual([threadId]);

        await editor.patch(`/api/mockups/${mockup.id}`, { archived: false });
        expect(
            (await alice.client.post(`${base}/threads/${threadId}/comments`, reply)).status,
        ).toBe(201);
    });
});

describe('reviewers', () => {
    it('lists reviewers by their last activity, which opening the link does not change', async () => {
        const { editor, mockup, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        const carol = await viewer('Carol');
        const thread = await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'First',
        });
        // Each change later than the one before, at millisecond precision.
        const later = () => new Promise((resolve) => setTimeout(resolve, 5));
        await later();
        const reply = await bob.client.post(`${base}/threads/${thread.body.id}/comments`, {
            id: crypto.randomUUID(),
            body: 'Agreed',
        });
        const reviewers = async () =>
            (await editor.get(`/api/mockups/${mockup.id}/reviewers`)).body;
        const alicesRow = (lastActivityAt: string) => ({
            viewer: alice.viewer,
            threads: { open: 1, resolved: 0 },
            lastActivityAt,
        });
        const bobsRow = {
            viewer: bob.viewer,
            threads: { open: 0, resolved: 0 },
            lastActivityAt: reply.body.comments[1].createdAt,
        };
        const carolsRow = {
            viewer: carol.viewer,
            threads: { open: 0, resolved: 0 },
            lastActivityAt: null,
        };
        const expected = [bobsRow, alicesRow(thread.body.comments[0].createdAt), carolsRow];
        expect(await reviewers()).toEqual(expected);

        // Reading the mockup and its threads is not activity.
        await alice.client.get(base);
        await alice.client.get(`${base}/threads`);
        await carol.client.get(base);
        expect(await reviewers()).toEqual(expected);

        // Editing is.
        await later();
        const edited = await alice.client.patch(`${base}/comments/${thread.body.comments[0].id}`, {
            body: 'First, edited',
        });
        expect(await reviewers()).toEqual([
            alicesRow(edited.body.comments[0].editedAt),
            bobsRow,
            carolsRow,
        ]);
    });
});

describe('versions', () => {
    it('starts a new version without threads, keeping the viewers', async () => {
        const { editor, mockup, base, viewer, uploadVersion } = await createSharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: PIN_ANCHOR,
            body: 'Bigger',
        });
        await bob.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'Looks good',
        });

        await uploadVersion();
        expect((await alice.client.get(base)).body).toMatchObject({
            version: 2,
            me: alice.viewer,
        });
        expect((await alice.client.get(`${base}/threads`)).body).toEqual([]);
        const created = await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: PIN_ANCHOR,
            body: 'Better',
        });
        // Pins are numbered per version.
        expect(created.body).toMatchObject({ number: 1, author: alice.viewer });
        // Reviewers of earlier versions stay listed, without feedback on this one yet.
        const reviewers = (await editor.get(`/api/mockups/${mockup.id}/reviewers`)).body;
        expect(reviewers).toHaveLength(2);
        expect(reviewers).toEqual(
            expect.arrayContaining([
                {
                    viewer: alice.viewer,
                    threads: { open: 1, resolved: 0 },
                    lastActivityAt: expect.any(String),
                },
                {
                    viewer: bob.viewer,
                    threads: { open: 0, resolved: 0 },
                    // Nothing on this version yet.
                    lastActivityAt: null,
                },
            ]),
        );
    });

    it('refuses changes to an older version, but keeps its threads readable', async () => {
        const { t, base, viewer, uploadVersion } = await createSharedMockup();
        const alice = await viewer('Alice');
        alice.client.header('x-loupe-version', '1');
        const first = await alice.client.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'general',
            body: 'On the first file',
        });

        await uploadVersion();
        expect(
            await alice.client.post(`${base}/threads`, {
                id: crypto.randomUUID(),
                kind: 'general',
                body: 'Still on the first file',
            }),
        ).toMatchObject({
            status: 409,
            body: {
                error: 'version_changed',
                message: 'A new version of this mockup is available. Reload to see it.',
            },
        });
        const stream = await t.app.request(`${base}/events`, {
            headers: { 'x-loupe-viewer': alice.key, 'x-loupe-version': '1' },
        });
        expect(stream.status).toBe(409);
        expect((await alice.client.get(`${base}/threads`)).body).toEqual([first.body]);

        alice.client.header('x-loupe-version', '2');
        expect((await alice.client.get(`${base}/threads`)).body).toEqual([]);
        alice.client.header('x-loupe-version', '7');
        expect((await alice.client.get(`${base}/threads`)).status).toBe(404);
        alice.client.header('x-loupe-version', 'latest');
        expect(await alice.client.get(`${base}/threads`)).toMatchObject({
            status: 400,
            body: { error: 'invalid_request', message: 'Invalid x-loupe-version header.' },
        });
    });
});

describe('rate limits', () => {
    it('limits how fast a viewer can change things, but not editors', async () => {
        const { editor, base, viewer } = await createSharedMockup();
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
});
