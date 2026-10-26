import type { Context } from 'hono';
import { type Author, VERSION_HEADER, VIEWER_KEY_HEADER } from '../../shared/api/reviews.ts';
import { sha256 } from '../auth/crypto.ts';
import type { Db } from '../db/client.ts';
import { findMockupByShareToken } from '../db/mockups.ts';
import type { UserRow } from '../db/users.ts';
import { findViewerByKey, touchViewer, type ViewerRow } from '../db/viewers.ts';
import { apiError } from '../http.ts';
import { canManage, isShared } from '../mockups/access.ts';
import { createWindowLimiter } from '../rate-limit.ts';
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

/**
 * The number of the version shown by the review space sending the request; the current one when
 * the request does not say (docs/SPEC.md §5.3).
 */
export function shownVersion(c: Context<AppEnv>, row: SharedMockupRow) {
    const header = c.req.header(VERSION_HEADER);
    if (header === undefined) return row.version.number;
    if (!/^[1-9]\d*$/.test(header)) {
        throw apiError(400, 'invalid_request', `Invalid ${VERSION_HEADER} header.`);
    }
    return Number(header);
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

/**
 * Access to the current version of a share link, for its event stream and every change. One
 * instance serves all share-link routes, so a viewer's changes count against one limit.
 */
export function createShareAccess(db: Db) {
    // Far above a person typing comments; stops scripts flooding a mockup.
    const viewerChanges = createWindowLimiter({ max: 30, windowMs: 60 * 1000 });

    /**
     * The mockup behind the link; refuses a request from a review space that shows an older
     * version, e.g. a pin placed on the old file after a new version was uploaded.
     */
    function currentVersion(c: Context<AppEnv>) {
        const row = sharedMockup(db, c);
        if (shownVersion(c, row) !== row.version.number) {
            throw apiError(
                409,
                'version_changed',
                'A new version of this mockup is available. Reload to see it.',
            );
        }
        return row;
    }

    /**
     * The mockup and actor for a change; read-only mockups accept changes from editors only.
     * Viewers are rate limited, editors are trusted.
     */
    function writer(c: Context<AppEnv>) {
        const row = currentVersion(c);
        const actor = shareActor(db, c, row);
        if (!actor) throw apiError(401, 'viewer_required', 'Join the review before commenting.');
        if (actor.kind === 'viewer') {
            if (row.mockup.readOnly) throw apiError(403, 'read_only', 'This mockup is read-only.');
            if (!viewerChanges.take(actor.viewer.id)) {
                throw apiError(429, 'too_many_requests', 'Too many changes, retry in a minute.');
            }
        }
        return { row, actor };
    }

    return { currentVersion, writer };
}

export type ShareAccess = ReturnType<typeof createShareAccess>;
