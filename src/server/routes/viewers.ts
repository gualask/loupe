import { Hono } from 'hono';
import {
    type RegisteredViewer,
    registerViewerRequestSchema,
    renameViewerRequestSchema,
} from '../../shared/api/reviews.ts';
import { randomToken, sha256 } from '../auth/crypto.ts';
import { insertViewer, renameViewer } from '../db/viewers.ts';
import { apiError, notFound } from '../http.ts';
import type { Hub } from '../review/hub.ts';
import { anonymousName } from '../review/names.ts';
import { viewerAuthor } from '../review/present.ts';
import type { ShareAccess } from '../review/share-access.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Viewer registration and names on a share link, mounted under /api/s. */
export function viewerRoutes({ db, hub, access }: AppDeps & { hub: Hub; access: ShareAccess }) {
    return new Hono<AppEnv>()
        .post('/:token/viewers', async (c) => {
            const { mockup, input } = await access.joiner(c, registerViewerRequestSchema);
            const key = randomToken();
            const viewer = insertViewer(db, {
                mockupId: mockup.id,
                keyHash: sha256(key),
                displayName: input.displayName || anonymousName(),
            });
            const body: RegisteredViewer = { key, viewer: viewerAuthor(viewer) };
            return c.json(body, 201);
        })
        .patch('/:token/viewers/me', async (c) => {
            const { row, actor, input } = await access.writerWith(c, renameViewerRequestSchema);
            if (actor.kind !== 'viewer') {
                throw apiError(403, 'forbidden', 'Editors use the name of their account.');
            }
            const renamed = renameViewer(db, actor.viewer.id, input.displayName);
            if (!renamed) throw notFound();
            const viewer = viewerAuthor(renamed);
            hub.updateParticipant(row.version.id, viewer);
            hub.publish(row.version.id, { type: 'viewer', viewer });
            return c.json(viewer);
        });
}
