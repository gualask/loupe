import { signal } from '@preact/signals';
import type { User } from '../../shared/api/auth.ts';
import { ApiError, api, errorMessage, handleSignedOut } from './api.ts';

/** The login page, which brings the user back to `next` once signed in. */
export const loginPath = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/**
 * Where the login page goes once signed in: `next` when it stays on the app's `origin`, so a
 * crafted link cannot send the user elsewhere (browsers read `/\\host` as `//host`).
 */
export function nextPath(next: string | undefined, origin: string) {
    try {
        const url = new URL(next ?? '/', origin);
        return url.origin === origin ? url.pathname + url.search + url.hash : '/';
    } catch {
        return '/';
    }
}

/** `undefined` while loading, `null` when signed out. */
export const currentUser = signal<User | null | undefined>(undefined);
/** Why the session could not be checked, e.g. offline or a server error: worth retrying. */
export const sessionError = signal<string>();

/** The signed-in user, for pages that RequireUser renders only once there is one. */
export function signedInUser() {
    const user = currentUser.value;
    if (!user) throw new Error('Rendered without a signed-in user');
    return user;
}

// Signed-in pages then redirect to the login page, which brings the user back afterwards.
handleSignedOut(() => {
    currentUser.value = null;
});

const fetchUser = () => api.get<User>('/auth/me');

export async function loadSession() {
    sessionError.value = undefined;
    try {
        currentUser.value = await fetchUser();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) currentUser.value = null;
        else sessionError.value = errorMessage(error);
    }
}

/**
 * Checks the session again whenever the window regains focus: another tab may have signed out,
 * or in as someone else, whose session this page would otherwise use under the old name. A
 * session that ended returns to the login page; another user's reloads the page.
 */
export function watchSession() {
    addEventListener('focus', async () => {
        const shown = currentUser.value;
        if (!shown) return;
        // Signed out answers 401, which handleSignedOut takes care of; offline changes nothing.
        const user = await fetchUser().catch(() => undefined);
        if (!user) return;
        if (user.id !== shown.id) location.reload();
        else currentUser.value = user;
    });
}

export async function login(username: string, password: string) {
    currentUser.value = await api.post<User>('/auth/login', { username, password });
}

export async function logout() {
    await api.post('/auth/logout');
    currentUser.value = null;
}
