import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createSharedMockup,
    htmlFile,
    newThread,
    openStream,
    tokenFromUrl,
} from '../test-utils.ts';

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

        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, newThread('Hi', { id }));
        expect(await next()).toMatchObject({
            type: 'thread',
            thread: { id, author: alice.viewer },
        });

        await reader.cancel();
    });

    it('ends open streams at once when the link is regenerated', async () => {
        const { t, editor, mockup, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence

        await editor.post(`/api/mockups/${mockup.id}/share/regenerate`);
        expect((await reader.read()).done).toBe(true);
        expect((await t.app.request(`${base}/events`)).status).toBe(404);
    });

    it('ends open streams at once when the mockup or its project is deleted', async () => {
        const { t, editor, mockup, project, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const first = await openStream(t, `${base}/events`, alice.key);
        await first.next(); // presence
        await editor.delete(`/api/mockups/${mockup.id}`);
        expect((await first.reader.read()).done).toBe(true);

        const other = await editor.post(
            `/api/projects/${project.id}/mockups`,
            htmlFile('<!doctype html><main>Other</main>', 'other.html'),
        );
        const otherBase = `/api/s/${tokenFromUrl(other.body.shareUrl)}`;
        const second = await openStream(t, `${otherBase}/events`, '');
        await second.next(); // presence
        await editor.delete(`/api/projects/${project.id}`);
        expect((await second.reader.read()).done).toBe(true);
    });

    it('beats every 25 seconds, and ends streams whose link changed without the hub knowing', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const { t, mockup, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence

        await vi.advanceTimersByTimeAsync(25_000);
        expect(await reader.read()).toEqual({ done: false, value: ': heartbeat\n\n' });
        // E.g. a change made directly in the database.
        t.db.$client
            .prepare('UPDATE mockups SET share_token = ? WHERE id = ?')
            .run('changed', mockup.id);
        await vi.advanceTimersByTimeAsync(25_000);
        expect((await reader.read()).done).toBe(true);
    });

    it('tells only an anonymous reader who is here, since nobody sees them', async () => {
        const { t, base, viewer } = await createSharedMockup();
        const alice = await viewer('Alice');
        const bob = await viewer('Bob');
        const watching = await openStream(t, `${base}/events`, bob.key);
        expect(await watching.next()).toEqual({ type: 'presence', participants: [bob.viewer] });

        const reader = await openStream(t, `${base}/events`, '');
        expect(await reader.next()).toEqual({ type: 'presence', participants: [bob.viewer] });
        await reader.reader.cancel();

        // Bob heard nothing of the reader: his next event is Alice's thread.
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, newThread('Hi', { id }));
        expect(await watching.next()).toMatchObject({ type: 'thread', thread: { id } });
        await watching.reader.cancel();
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

    it('tells open streams when an earlier version is deleted', async () => {
        const { t, editor, mockup, base, viewer, uploadVersion } = await createSharedMockup();
        await uploadVersion();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence

        await editor.delete(`/api/mockups/${mockup.id}/versions/1`);
        expect(await next()).toEqual({ type: 'version-deleted', number: 1 });

        await reader.cancel();
    });

    it('ends open streams of the previous version at once', async () => {
        const { t, base, viewer, uploadVersion } = await createSharedMockup();
        const alice = await viewer('Alice');
        const { reader, next } = await openStream(t, `${base}/events`, alice.key);
        await next(); // presence

        await uploadVersion();
        expect((await reader.read()).done).toBe(true);
        const again = await t.app.request(`${base}/events`, {
            headers: { 'x-loupe-version': '1' },
        });
        expect(again.status).toBe(409);
    });
});
