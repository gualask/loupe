import { signal } from '@preact/signals';
import type { User } from '../../shared/api/auth.ts';
import { ApiError, api } from './api.ts';

/** `undefined` while loading, `null` when signed out. */
export const currentUser = signal<User | null | undefined>(undefined);

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
