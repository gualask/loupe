import type { Context } from 'hono';
import type { Db } from '../db/client.ts';
import { apiError } from '../http.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import type { AppEnv } from '../types.ts';
import { shareActor, sharedMockup, shownVersion } from './context.ts';

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
