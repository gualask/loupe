import { signal } from '@preact/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { ANN, fakeStorage, SHARED } from '../test-utils.ts';
import { createIdentity } from './identity.ts';

afterEach(() => {
    vi.unstubAllGlobals();
});

/** A browser that has not commented yet, with its own storage and a server that names it. */
function newcomer({ stored = {}, mayAct = true } = {}) {
    const items = fakeStorage(stored);
    const registered: string[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit = {}) => {
            const { displayName } = JSON.parse(String(init.body));
            if (url.endsWith('/viewers/me')) return Response.json({ ...ANN, displayName });
            registered.push(displayName);
            const viewer = { ...ANN, displayName: displayName || 'Anonymous Fox' };
            return Response.json({ key: 'k', viewer }, { status: 201 });
        }),
    );
    const shared = signal<SharedMockup>({ ...SHARED, me: null });
    const onJoined = vi.fn();
    const onError = vi.fn();
    const identity = createIdentity({
        base: '/s/tok',
        shared,
        key: null,
        mayAct: () => mayAct,
        headers: () => ({}),
        onJoined,
        onError,
    });
    return { items, registered, shared, identity, onJoined, onError };
}

describe('viewer identity', () => {
    it('joins under a generated name once, and invites the viewer to choose one', async () => {
        const { items, registered, shared, identity, onJoined } = newcomer();
        expect(await Promise.all([identity.join(), identity.join()])).toEqual([true, true]);
        expect(registered).toEqual(['']);
        expect(shared.value.me?.displayName).toBe('Anonymous Fox');
        expect(identity.keyHeader()).toEqual({ 'x-loupe-viewer': 'k' });
        expect(items.get('loupe:viewer:m1')).toBe('k');
        expect(onJoined).toHaveBeenCalledOnce();
        expect(identity.nameHint.value).toBe(true);

        identity.dismissNameHint();
        expect(identity.nameHint.value).toBe(false);
        expect(items.get('loupe:name-hint')).toBe('dismissed');
    });

    it('joins under the name chosen on an earlier mockup, without the invitation', async () => {
        const { registered, shared, identity } = newcomer({ stored: { 'loupe:name': 'Gino' } });
        await identity.join();
        expect(registered).toEqual(['Gino']);
        expect(shared.value.me?.displayName).toBe('Gino');
        expect(identity.nameHint.value).toBe(false);
    });

    it('does not invite again a viewer who dismissed the invitation', async () => {
        const { identity } = newcomer({ stored: { 'loupe:name-hint': 'dismissed' } });
        await identity.join();
        expect(identity.nameHint.value).toBe(false);
    });

    it('does not join where changes are not accepted', async () => {
        const { registered, identity } = newcomer({ mayAct: false });
        expect(await identity.join()).toBe(false);
        expect(registered).toEqual([]);
    });

    it('renames rather than joins again when a join is under way', async () => {
        const { registered, shared, identity } = newcomer();
        await Promise.all([identity.join(), identity.setName('Gino')]);
        expect(registered).toEqual(['']);
        expect(shared.value.me?.displayName).toBe('Gino');
    });

    it('remembers a chosen name for the next mockups', async () => {
        const { items, registered, identity } = newcomer();
        await identity.setName('Gino');
        expect(registered).toEqual(['Gino']);
        expect(items.get('loupe:name')).toBe('Gino');
        expect(items.get('loupe:name-hint')).toBe('dismissed');
    });
});
