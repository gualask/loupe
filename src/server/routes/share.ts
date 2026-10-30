import { readFile, stat } from 'node:fs/promises';
import { type Context, Hono } from 'hono';
import { accepts } from 'hono/accepts';
import type { SharedMockup } from '../../shared/api/projects.ts';
import { sha256 } from '../auth/crypto.ts';
import { findVersion, listEarlierVersions, type MockupVersionRow } from '../db/mockups.ts';
import { apiError, parseVersionNumber } from '../http.ts';
import { injectBridge, mockupHeaders } from '../mockups/document.ts';
import { createDocumentCache } from '../mockups/document-cache.ts';
import { readMockupFile } from '../mockups/files.ts';
import { shareActor, sharedMockup } from '../review/context.ts';
import type { AppDeps, AppEnv } from '../types.ts';

/** Share-link metadata, mounted under /api/s. */
export function shareApiRoutes({ db }: AppDeps) {
    return new Hono<AppEnv>().get('/:token', (c) => {
        const row = sharedMockup(db, c);
        const actor = shareActor(db, c, row);
        const base = `/s/${row.mockup.shareToken}`;
        const body: SharedMockup = {
            mockupId: row.mockup.id,
            name: row.mockup.name,
            archived: row.mockup.archivedAt !== null,
            version: row.version.number,
            contentUrl: `${base}/content`,
            earlierVersions: listEarlierVersions(db, row).map((version) => ({
                number: version.number,
                createdAt: version.createdAt.toISOString(),
                contentUrl: `${base}/versions/${version.number}/content`,
            })),
            me: actor?.author ?? null,
            canModerate: actor?.kind === 'editor',
        };
        return c.json(body);
    });
}

// Room for several large mockups, or many small ones, in their plain and compressed forms.
const DOCUMENT_CACHE_BYTES = 64 * 1024 * 1024;

/** Whether an If-None-Match header names the ETag, in its weak or strong form. */
function matchesEtag(ifNoneMatch: string | undefined, etag: string) {
    const tag = (value: string) => value.trim().replace(/^W\//, '');
    return !!ifNoneMatch?.split(',').some((value) => tag(value) === tag(etag));
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
    const documents = createDocumentCache(DOCUMENT_CACHE_BYTES);
    /** Sends a version's document, prepared once with the bridge inlined. */
    async function serve(c: Context<AppEnv>, version: MockupVersionRow) {
        const bridge = await loadBridge();
        // The stored file is addressed by its hash; the bridge changes only with Loupe itself.
        // Weak, as the same tag names the plain and the compressed document.
        const key = `${version.sha256}-${bridge.hash}`;
        const etag = `W/"${key}"`;
        const headers = { ...mockupHeaders(deps.config), ETag: etag, Vary: 'Accept-Encoding' };
        if (matchesEtag(c.req.header('If-None-Match'), etag)) return c.body(null, 304, headers);
        const document = await documents.get(key, async () =>
            injectBridge(await readMockupFile(deps.config.dataDir, version.sha256), bridge.script),
        );
        const encoding = accepts(c, {
            header: 'Accept-Encoding',
            supports: ['gzip'],
            default: 'identity',
        });
        if (encoding === 'gzip') {
            return c.body(document.gzip, 200, { ...headers, 'Content-Encoding': 'gzip' });
        }
        return c.body(document.body, 200, headers);
    }

    // Access is checked on every request: the browser revalidates its copy (no-cache), so a
    // regenerated link stops serving it.
    return new Hono<AppEnv>()
        .get('/:token/content', (c) => serve(c, sharedMockup(deps.db, c).version))
        .get('/:token/versions/:number/content', (c) => {
            const { mockup } = sharedMockup(deps.db, c);
            const number = parseVersionNumber(c.req.param('number'));
            const version =
                number === undefined ? undefined : findVersion(deps.db, mockup.id, number);
            if (!version) throw apiError(404, 'not_found', 'This version is not available.');
            return serve(c, version);
        });
}
