import { readFile } from 'node:fs/promises';
import { Hono } from 'hono';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { type RegisteredViewer, registerViewerRequestSchema } from '../../shared/api/reviews.ts';
import { randomToken, sha256 } from '../auth/crypto.ts';
import { findReview } from '../db/reviews.ts';
import { insertViewer } from '../db/viewers.ts';
import { apiError, parseJson } from '../http.ts';
import { injectBridge, mockupHeaders } from '../mockups/document.ts';
import { readMockupFile } from '../mockups/files.ts';
import { shareActor, sharedMockup } from '../review/context.ts';
import { anonymousName } from '../review/names.ts';
import { toReview, viewerAuthor } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Share-link metadata and viewer registration, mounted under /api/s. */
export function shareApiRoutes({ db }: AppDeps) {
    return new Hono<AppEnv>()
        .get('/:token', (c) => {
            const row = sharedMockup(db, c);
            const actor = shareActor(db, c, row);
            const review =
                actor?.kind === 'viewer' && findReview(db, row.version.id, actor.viewer.id);
            const body: SharedMockup = {
                mockupId: row.mockup.id,
                name: row.mockup.name,
                readOnly: row.mockup.readOnly,
                contentUrl: `/s/${row.mockup.shareToken}/content`,
                me: actor?.author ?? null,
                canModerate: actor?.kind === 'editor',
                review: review ? toReview(review) : null,
            };
            return c.json(body);
        })
        .post('/:token/viewers', async (c) => {
            const { mockup } = sharedMockup(db, c);
            if (mockup.readOnly) throw apiError(403, 'read_only', 'This mockup is read-only.');
            const { displayName } = await parseJson(c, registerViewerRequestSchema);
            const key = randomToken();
            const viewer = insertViewer(db, {
                mockupId: mockup.id,
                keyHash: sha256(key),
                displayName: displayName || anonymousName(),
            });
            const body: RegisteredViewer = { key, viewer: viewerAuthor(viewer) };
            return c.json(body, 201);
        });
}

/** The sandboxed mockup document, mounted under /s. */
export function shareContentRoutes(deps: AppDeps & { bridgeFile?: string }) {
    return new Hono<AppEnv>().get('/:token/content', async (c) => {
        const { version } = sharedMockup(deps.db, c);
        const [html, bridge] = await Promise.all([
            readMockupFile(deps.config.dataDir, version.sha256),
            // Read on every request so the watch build is picked up in development.
            deps.bridgeFile ? readFile(deps.bridgeFile, 'utf8').catch(() => '') : '',
        ]);
        return c.body(injectBridge(html, bridge), 200, mockupHeaders(deps.config.mockupExternal));
    });
}
