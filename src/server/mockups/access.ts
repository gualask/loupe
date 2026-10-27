import type { UserRow } from '../db/users.ts';

/** Admins manage every project; editors manage their own. */
export function canManage(user: UserRow | null, ownerId: string) {
    return !!user && (user.role === 'admin' || user.id === ownerId);
}
