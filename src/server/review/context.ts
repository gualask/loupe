import type { Context } from 'hono';
import { type Author, VIEWER_KEY_HEADER } from '../../shared/api/reviews.ts';
import { sha256 } from '../auth/crypto.ts';
import type { Db } from '../db/client.ts';
import { findMockupByShareToken } from '../db/mockups.ts';
import type { UserRow } from '../db/users.ts';
import { findViewerByKey, touchViewer, type ViewerRow } from '../db/viewers.ts';
import { apiError } from '../http.ts';
import { canManage, isShared } from '../mockups/access.ts';
import type { AppEnv } from '../types.ts';
import { viewerAuthor } from './present.ts';

// Last activity is recorded at most this often per viewer.
const TOUCH_INTERVAL_MS = 60 * 1000;

export type SharedMockupRow = NonNullable<ReturnType<typeof findMockupByShareToken>>;

/**
 * The mockup behind a share token, if the request may open it. Viewers need the link to be
 * enabled and not expired; the editors who manage the mockup can always open it, e.g. to
 * preview it before sharing.
 */
export function findSharedMockup(db: Db, c: Context<AppEnv>) {
    const row = findMockupByShareToken(db, c.req.param('token') ?? '');
    return row && (isShared(row.mockup) || canManage(c.var.user, row.ownerId)) ? row : undefined;
}

/** Like findSharedMockup, but answers 404 when the link is not available. */
export function sharedMockup(db: Db, c: Context<AppEnv>) {
    const row = findSharedMockup(db, c);
    if (!row) throw apiError(404, 'not_found', 'This link is not available.');
    return row;
}

/** Who is acting on a share link: an editor who manages the mockup, or a registered viewer. */
export type ShareActor =
    | { kind: 'editor'; user: UserRow; author: Author }
    | { kind: 'viewer'; viewer: ViewerRow; author: Author };

export function shareActor(db: Db, c: Context<AppEnv>, row: SharedMockupRow): ShareActor | null {
    const user = c.var.user;
    if (user && canManage(user, row.ownerId)) {
        return {
            kind: 'editor',
            user,
            author: { kind: 'editor', id: user.id, displayName: user.displayName },
        };
    }
    const key = c.req.header(VIEWER_KEY_HEADER);
    const viewer = key ? findViewerByKey(db, sha256(key)) : undefined;
    if (!viewer || viewer.mockupId !== row.mockup.id) return null;
    if (Date.now() - viewer.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) touchViewer(db, viewer.id);
    return { kind: 'viewer', viewer, author: viewerAuthor(viewer) };
}

/** Whether the actor wrote a thread or comment. */
export function isAuthor(
    actor: ShareActor,
    row: { authorViewerId: string | null; authorUserId: string | null },
) {
    return actor.kind === 'viewer'
        ? row.authorViewerId === actor.viewer.id
        : row.authorUserId === actor.user.id;
}

export function authorIds(actor: ShareActor) {
    return actor.kind === 'viewer'
        ? { authorViewerId: actor.viewer.id, authorUserId: null }
        : { authorViewerId: null, authorUserId: actor.user.id };
}
