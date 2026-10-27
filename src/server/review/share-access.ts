import type { Context } from 'hono';
import type { Db } from '../db/client.ts';
import type { MockupRow } from '../db/mockups.ts';
import { apiError } from '../http.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import type { AppEnv } from '../types.ts';
import { shareActor, sharedMockup, shownVersion } from './context.ts';

/** Refuses any change to an archived mockup, from editors too: its editors unarchive it first. */
function checkNotArchived(mockup: MockupRow) {
    if (mockup.archivedAt) throw apiError(403, 'archived', 'This mockup is archived.');
}

/**
 * Access to a share link, for its event stream, new reviewers and every change. One instance
 * serves all share-link routes, so each limit counts across them.
 */
export function createShareAccess(db: Db) {
    // Far above a person typing comments; stops scripts flooding a mockup.
    const viewerChanges = createWindowLimiter({ max: 30, windowMs: 60 * 1000 });
    // Anyone with the link can register, so a script could flood the mockup with viewers.
    const registrations = createWindowLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

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
     * The mockup and actor for a change; archived mockups accept none. Viewers are rate limited,
     * editors are trusted.
     */
    function writer(c: Context<AppEnv>) {
        const row = currentVersion(c);
        checkNotArchived(row.mockup);
        const actor = shareActor(db, c, row);
        if (!actor) throw apiError(401, 'viewer_required', 'Join the review before commenting.');
        if (actor.kind === 'viewer') {
            if (!viewerChanges.take(actor.viewer.id)) {
                throw apiError(429, 'too_many_requests', 'Too many changes, retry in a minute.');
            }
        }
        return { row, actor };
    }

    /** The mockup a new reviewer joins; archived mockups take none. */
    function joiner(c: Context<AppEnv>) {
        const row = sharedMockup(db, c);
        checkNotArchived(row.mockup);
        if (!registrations.take(row.mockup.id)) {
            throw apiError(429, 'too_many_requests', 'Too many new reviewers, retry later.');
        }
        return row;
    }

    return { currentVersion, writer, joiner };
}

export type ShareAccess = ReturnType<typeof createShareAccess>;
