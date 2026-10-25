import { readFile, stat } from 'node:fs/promises';
import { Hono } from 'hono';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { type RegisteredViewer, registerViewerRequestSchema } from '../../shared/api/reviews.ts';
import { randomToken, sha256 } from '../auth/crypto.ts';
import { findReview } from '../db/reviews.ts';
import { insertViewer } from '../db/viewers.ts';
import { apiError, parseJson } from '../http.ts';
import { injectBridge, mockupHeaders } from '../mockups/document.ts';
import { readMockupFile } from '../mockups/files.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import { shareActor, sharedMockup } from '../review/context.ts';
import { anonymousName } from '../review/names.ts';
import { toReview, viewerAuthor } from '../review/present.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Share-link metadata and viewer registration, mounted under /api/s. */
export function shareApiRoutes({ db }: AppDeps) {
    // Anyone with the link can register, so a script could flood the mockup with viewers.
    const registrations = createWindowLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

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
        // disabled or expired link stops serving it.
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
