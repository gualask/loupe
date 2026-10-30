import type { Context } from 'hono';
import { type Author, VERSION_HEADER, VIEWER_KEY_HEADER } from '../../shared/api/reviews.ts';
import { sha256 } from '../auth/crypto.ts';
import type { Db } from '../db/client.ts';
import { findMockupByShareToken } from '../db/mockups.ts';
import type { UserRow } from '../db/users.ts';
import { findViewerByKey, type ViewerRow } from '../db/viewers.ts';
import { apiError, parseVersionNumber } from '../http.ts';
import { canManage } from '../mockups/access.ts';
import type { AppEnv } from '../types.ts';
import { viewerAuthor } from './present.ts';

export type SharedMockupRow = NonNullable<ReturnType<typeof findMockupByShareToken>>;

/** The mockup behind the request's share token, while that link exists. */
function findSharedMockup(db: Db, c: Context<AppEnv>) {
    return findMockupByShareToken(db, c.req.param('token') ?? '');
}

/** Like findSharedMockup, but answers 404 once the link was regenerated or its mockup deleted. */
export function sharedMockup(db: Db, c: Context<AppEnv>) {
    const row = findSharedMockup(db, c);
    if (!row) throw apiError(404, 'not_found', 'This link is not available.');
    return row;
}

/**
 * The number of the version shown by the review space sending the request; the current one when
 * the request does not say (docs/SPEC.md §5.3).
 */
export function shownVersion(c: Context<AppEnv>, row: SharedMockupRow) {
    const header = c.req.header(VERSION_HEADER);
    if (header === undefined) return row.version.number;
    const number = parseVersionNumber(header);
    if (number === undefined) {
        throw apiError(400, 'invalid_request', `Invalid ${VERSION_HEADER} header.`);
    }
    return number;
}

/** Who is acting on a share link: an editor who manages the mockup, or a registered viewer. */
type ShareActor =
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
