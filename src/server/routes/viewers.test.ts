import { describe, expect, it } from 'vitest';
import { createSharedMockup, openStream } from '../test-utils.ts';

describe('viewers', () => {
    it('registers viewers with a color in order of arrival', async () => {
        const { base, mockup, viewer } = await createSharedMockup();
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
            archived: false,
            version: 1,
            contentUrl: expect.stringMatching(/^\/s\/[\w-]{43}\/content$/),
            me: alice.viewer,
            canModerate: false,
        });
    });

    it('identifies editors who manage the mockup and ignores unknown keys', async () => {
        const { t, editor, editorId, base } = await createSharedMockup();
        expect((await editor.get(base)).body).toMatchObject({
            me: { kind: 'editor', id: editorId, displayName: 'Eddie' },
            canModerate: true,
        });
        const stranger = t.client();
        stranger.header('x-loupe-viewer', 'not-a-key');
        expect((await stranger.get(base)).body).toMatchObject({ me: null, canModerate: false });
    });

    it('lets viewers rename themselves wherever their name shows', async () => {
        const { t, editor, base, viewer } = await createSharedMockup();
        const alice = await viewer();
        const bob = await viewer('Bob');
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, { id, kind: 'general', body: 'Hi' });
        const bobStream = await openStream(t, `${base}/events`, bob.key);
        await bobStream.next(); // presence: Bob
        const aliceStream = await openStream(t, `${base}/events`, alice.key);
        await bobStream.next(); // presence: Bob and Alice

        const renamed = await alice.client.patch(`${base}/viewers/me`, {
            displayName: ' Alice ',
        });
        const alicia = { ...alice.viewer, displayName: 'Alice' };
        expect(renamed).toMatchObject({ status: 200, body: alicia });
        expect(await bobStream.next()).toEqual({ type: 'viewer', viewer: alicia });
        expect((await alice.client.get(base)).body.me).toEqual(alicia);
        expect((await alice.client.get(`${base}/threads`)).body).toMatchObject([
            { id, author: alicia, comments: [{ author: alicia }] },
        ]);
        // Presence published from now on shows the new name.
        await aliceStream.reader.cancel();
        expect(await bobStream.next()).toEqual({ type: 'presence', participants: [bob.viewer] });
        const aliceAgain = await openStream(t, `${base}/events`, alice.key);
        expect(await bobStream.next()).toEqual({
            type: 'presence',
            participants: [bob.viewer, alicia],
        });
        await Promise.all([bobStream.reader.cancel(), aliceAgain.reader.cancel()]);

        const empty = await alice.client.patch(`${base}/viewers/me`, { displayName: ' ' });
        expect(empty).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
        const anonymous = await t.client().patch(`${base}/viewers/me`, { displayName: 'Eve' });
        expect(anonymous).toMatchObject({ status: 401, body: { error: 'viewer_required' } });
        expect((await editor.patch(`${base}/viewers/me`, { displayName: 'Ed' })).status).toBe(403);
    });

    it('does not accept viewers on archived mockups', async () => {
        const { t, editor, mockup, base } = await createSharedMockup();
        await editor.patch(`/api/mockups/${mockup.id}`, { archived: true });
        const res = await t.client().post(`${base}/viewers`, { displayName: 'Alice' });
        expect(res).toMatchObject({ status: 403, body: { error: 'archived' } });
    });
});

describe('rate limits', () => {
    it('limits how many viewers can join a mockup in a short time', async () => {
        const { t, base } = await createSharedMockup();
        for (let i = 0; i < 60; i++) {
            expect((await t.client().post(`${base}/viewers`, {})).status).toBe(201);
        }
        expect(await t.client().post(`${base}/viewers`, {})).toMatchObject({
            status: 429,
            body: { error: 'too_many_requests' },
        });
    });
});
