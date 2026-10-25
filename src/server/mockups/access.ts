import type { MockupRow } from '../db/mockups.ts';
import type { UserRow } from '../db/users.ts';

/** Admins manage every project; editors manage their own. */
export function canManage(user: UserRow | null, ownerId: string) {
    return !!user && (user.role === 'admin' || user.id === ownerId);
}

/** Whether viewers can currently open a mockup through its share link. */
export function isShared(mockup: MockupRow) {
    return (
        mockup.shareEnabled &&
        (!mockup.shareExpiresAt || mockup.shareExpiresAt.getTime() > Date.now())
    );
}
