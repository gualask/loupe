import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSharedMockup, openStream } from '../test-utils.ts';

afterEach(() => {
    vi.useRealTimers();
});

describe('event stream', () => {
    it('streams presence and thread changes', async () => {
        const { t, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        const { headers, reader, next } = await openStream(t, `${base}/events`, bob.key);
        expect(headers.get('content-type')).toBe('text/event-stream');
        expect(headers.get('x-accel-buffering')).toBe('no');

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

    it('ends open streams once the link is regenerated', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const { t, editor, mockup, base, viewer } = await createSharedMockup();
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

        const stream = await open();
        expect(await heartbeat(stream)).toEqual({ done: false, value: ': heartbeat\n\n' });
        await editor.post(`/api/mockups/${mockup.id}/share/regenerate`);
        expect((await heartbeat(stream)).done).toBe(true);
        expect((await t.app.request(`${base}/events`)).status).toBe(404);
    });

    it('tells open streams when the mockup is archived or unarchived', async () => {
        const { t, editor, mockup, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence
        const archive = (archived: boolean) =>
            editor.patch(`/api/mockups/${mockup.id}`, { archived });

        await archive(true);
        expect(await next()).toEqual({ type: 'archived', archived: true });
        // Archiving again changes nothing, so nothing is sent.
        await archive(true);
        await archive(false);
        expect(await next()).toEqual({ type: 'archived', archived: false });

        await reader.cancel();
    });

    it('ends open streams of the previous version', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const { t, base, viewer, uploadVersion } = await createSharedMockup();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence

        await uploadVersion();
        await vi.advanceTimersByTimeAsync(25_000);
        expect((await reader.read()).done).toBe(true);
    });
});
