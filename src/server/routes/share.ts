import { readFile, stat } from 'node:fs/promises';
import { Hono } from 'hono';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { sha256 } from '../auth/crypto.ts';
import { findReview } from '../db/reviews.ts';
import { injectBridge, mockupHeaders } from '../mockups/document.ts';
import { readMockupFile } from '../mockups/files.ts';
import { shareActor, sharedMockup } from '../review/context.ts';
import { toReview } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Share-link metadata, mounted under /api/s. */
export function shareApiRoutes({ db }: AppDeps) {
    return new Hono<AppEnv>().get('/:token', (c) => {
        const row = sharedMockup(db, c);
        const actor = shareActor(db, c, row);
        const review = actor?.kind === 'viewer' && findReview(db, row.version.id, actor.viewer.id);
        const body: SharedMockup = {
            mockupId: row.mockup.id,
            name: row.mockup.name,
            archived: row.mockup.archivedAt !== null,
            version: row.version.number,
            contentUrl: `/s/${row.mockup.shareToken}/content`,
            me: actor?.author ?? null,
            canModerate: actor?.kind === 'editor',
            review: review ? toReview(review) : null,
        };
        return c.json(body);
    });
}

/** Whether an If-None-Match header names the ETag; compression makes the browser's copy weak. */
function matchesEtag(ifNoneMatch: string | undefined, etag: string) {
    return !!ifNoneMatch?.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);
}

/**
 * The built bridge script and its hash, read again only when the file changes, so the watch
 * build is picked up in development. Empty without a file (tests) or when it cannot be read.
 */
function bridgeLoader(file: string | undefined) {
    let cached = { mtimeMs: Number.NaN, script: '', hash: sha256('') };
    return async () => {
        if (!file) return cached;
        const mtimeMs = await stat(file).then(
            (s) => s.mtimeMs,
            () => -1,
        );
        if (mtimeMs !== cached.mtimeMs) {
            const script = mtimeMs < 0 ? '' : await readFile(file, 'utf8').catch(() => '');
            cached = { mtimeMs, script, hash: sha256(script) };
        }
        return cached;
    };
}

/** The sandboxed mockup document, mounted under /s. */
export function shareContentRoutes(deps: AppDeps & { bridgeFile?: string }) {
    const loadBridge = bridgeLoader(deps.bridgeFile);
    return new Hono<AppEnv>().get('/:token/content', async (c) => {
        // Access is checked on every request: the browser revalidates its copy (no-cache), so a
        // regenerated link stops serving it.
        const { version } = sharedMockup(deps.db, c);
        const bridge = await loadBridge();
        // The stored file is addressed by its hash; the bridge changes only with Loupe itself.
        const etag = `"${version.sha256}-${bridge.hash}"`;
        const headers = { ...mockupHeaders(deps.config.mockupExternal), ETag: etag };
        if (matchesEtag(c.req.header('If-None-Match'), etag)) return c.body(null, 304, headers);
        const html = await readMockupFile(deps.config.dataDir, version.sha256);
        return c.body(injectBridge(html, bridge.script), 200, headers);
    });
}
