import { Hono } from 'hono';
import {
    type RegisteredViewer,
    registerViewerRequestSchema,
    renameViewerRequestSchema,
} from '../../shared/api/reviews.ts';
import { randomToken, sha256 } from '../auth/crypto.ts';
import { insertViewer, renameViewer } from '../db/viewers.ts';
import { apiError, notFound, parseJson } from '../http.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import { sharedMockup } from '../review/context.ts';
import type { Hub } from '../review/hub.ts';
import { anonymousName } from '../review/names.ts';
import { viewerAuthor } from '../review/present.ts';
import type { ShareAccess } from '../review/share-access.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Viewer registration and names on a share link, mounted under /api/s. */
export function viewerRoutes({ db, hub, access }: AppDeps & { hub: Hub; access: ShareAccess }) {
    // Anyone with the link can register, so a script could flood the mockup with viewers.
    const registrations = createWindowLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

    return new Hono<AppEnv>()
        .post('/:token/viewers', async (c) => {
            const { mockup } = sharedMockup(db, c);
            if (mockup.readOnly) throw apiError(403, 'read_only', 'This mockup is read-only.');
            if (!registrations.take(mockup.id)) {
                throw apiError(429, 'too_many_requests', 'Too many new reviewers, retry later.');
            }
            const { displayName } = await parseJson(c, registerViewerRequestSchema);
            const key = randomToken();
            const viewer = insertViewer(db, {
                mockupId: mockup.id,
                keyHash: sha256(key),
                displayName: displayName || anonymousName(),
            });
            const body: RegisteredViewer = { key, viewer: viewerAuthor(viewer) };
            return c.json(body, 201);
        })
        .patch('/:token/viewers/me', async (c) => {
            const { row, actor } = access.writer(c);
            if (actor.kind !== 'viewer') {
                throw apiError(403, 'forbidden', 'Editors use the name of their account.');
            }
            const { displayName } = await parseJson(c, renameViewerRequestSchema);
            const renamed = renameViewer(db, actor.viewer.id, displayName);
            if (!renamed) throw notFound();
            const viewer = viewerAuthor(renamed);
            hub.updateParticipant(row.version.id, viewer);
            hub.publish(row.version.id, { type: 'viewer', viewer });
            return c.json(viewer);
        });
}
