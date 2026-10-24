import { readFile } from 'node:fs/promises';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { findMockupByShareToken } from '../db/mockups.ts';
import { apiError } from '../http.ts';
import { canManage, isShared } from '../mockups/access.ts';
import { injectBridge, mockupHeaders } from '../mockups/document.ts';
import { readMockupFile } from '../mockups/files.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/**
 * The mockup behind a share token. Viewers need the link to be enabled and not expired; the
 * editors who manage the mockup can always open it, e.g. to preview it before sharing.
 */
function sharedMockup({ db }: AppDeps, c: Context<AppEnv>) {
    const row = findMockupByShareToken(db, c.req.param('token') ?? '');
    if (!row || !(isShared(row.mockup) || canManage(c.var.user, row.ownerId))) {
        throw apiError(404, 'not_found', 'This link is not available.');
    }
    return row;
}

/** Share-link API, mounted under /api/s. */
export function shareApiRoutes(deps: AppDeps) {
    return new Hono<AppEnv>().get('/:token', (c) => {
        const { mockup } = sharedMockup(deps, c);
        const body: SharedMockup = {
            name: mockup.name,
            readOnly: mockup.readOnly,
            contentUrl: `/s/${mockup.shareToken}/content`,
        };
        return c.json(body);
    });
}

/** The sandboxed mockup document, mounted under /s. */
export function shareContentRoutes(deps: AppDeps & { bridgeFile?: string }) {
    return new Hono<AppEnv>().get('/:token/content', async (c) => {
        const { version } = sharedMockup(deps, c);
        const [html, bridge] = await Promise.all([
            readMockupFile(deps.config.dataDir, version.sha256),
            // Read on every request so the watch build is picked up in development.
            deps.bridgeFile ? readFile(deps.bridgeFile, 'utf8').catch(() => '') : '',
        ]);
        return c.body(injectBridge(html, bridge), 200, mockupHeaders(deps.config.mockupExternal));
    });
}
