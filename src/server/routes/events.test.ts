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

    it('ends open streams once the link is disabled or regenerated', async () => {
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
