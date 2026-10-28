import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../shared/api/auth.ts';
import { currentUser, loadSession, sessionError, watchSession } from './session.ts';

const user = (id: string): User => ({
    id,
    username: id,
    displayName: id.toUpperCase(),
    role: 'editor',
});

/** Answers /auth/me with `answer` from now on. */
function serverAnswers(answer: () => Response) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => answer()),
    );
}

const signedOut = () => Response.json({ error: 'unauthenticated' }, { status: 401 });

beforeEach(() => {
    currentUser.value = undefined;
    sessionError.value = undefined;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('loadSession', () => {
    it('tells a signed-out browser from a session that could not be checked', async () => {
        serverAnswers(signedOut);
        await loadSession();
        expect([currentUser.value, sessionError.value]).toEqual([null, undefined]);

        currentUser.value = undefined;
        serverAnswers(() => new Response('Bad gateway', { status: 502 }));
        await loadSession();
        expect(currentUser.value).toBeUndefined();
        expect(sessionError.value).toBe('The server had a problem (error 502). Retry later.');

        serverAnswers(() => Response.json(user('u1')));
        await loadSession();
        expect([currentUser.value, sessionError.value]).toEqual([user('u1'), undefined]);
    });
});

describe('watchSession', () => {
    /** Starts watching, and returns what regaining focus does. */
    function watch() {
        let onFocus = async () => {};
        vi.stubGlobal('addEventListener', (type: string, listener: () => Promise<void>) => {
            if (type === 'focus') onFocus = listener;
        });
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        watchSession();
        return { focus: () => onFocus(), reload };
    }

    it('signs out a page whose session ended elsewhere', async () => {
        const { focus } = watch();
        currentUser.value = user('u1');
        serverAnswers(signedOut);
        await focus();
        expect(currentUser.value).toBeNull();
    });

    it('reloads a page whose browser signed in as someone else meanwhile', async () => {
        const { focus, reload } = watch();
        currentUser.value = user('u1');
        serverAnswers(() => Response.json(user('u2')));
        await focus();
        expect(reload).toHaveBeenCalled();
    });

    it('keeps the page as it is while the server cannot be reached', async () => {
        const { focus, reload } = watch();
        currentUser.value = user('u1');
        serverAnswers(() => {
            throw new TypeError('Failed to fetch');
        });
        await focus();
        expect(currentUser.value).toEqual(user('u1'));
        expect(reload).not.toHaveBeenCalled();
    });
});
