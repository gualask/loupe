import { signal } from '@preact/signals';
import type { User } from '../../shared/api/auth.ts';
import { ApiError, api, handleSignedOut } from './api.ts';

/** The login page, which brings the user back to `next` once signed in. */
export const loginPath = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** `undefined` while loading, `null` when signed out. */
export const currentUser = signal<User | null | undefined>(undefined);

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

export async function loadSession() {
    try {
        currentUser.value = await api.get<User>('/auth/me');
    } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
        currentUser.value = null;
    }
}

export async function login(username: string, password: string) {
    currentUser.value = await api.post<User>('/auth/login', { username, password });
}

export async function logout() {
    await api.post('/auth/logout');
    currentUser.value = null;
}
