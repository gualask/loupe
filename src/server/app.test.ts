import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createTestApp } from './test-utils.ts';

describe('createApp', () => {
    const { app } = createTestApp();

    it('reports health once migrations are applied', async () => {
        const res = await app.request('/healthz');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'ok' });
    });

    it('answers unknown API routes with JSON 404', async () => {
        const res = await app.request('/api/nope');
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
            error: 'not_found',
            message: 'Not found: it may have been deleted, or the link changed.',
        });
    });

    it('restricts what the app may load and who may frame it', async () => {
        for (const path of ['/healthz', '/api/nope', '/api/projects']) {
            const res = await app.request(path);
            expect(res.headers.get('content-security-policy')).toBe(
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:; object-src 'none'; base-uri 'none'; " +
                    "form-action 'self'; frame-ancestors 'none'",
            );
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        }
    });

    it('rejects oversized request bodies before reading them', async () => {
        const res = await app.request('/api/auth/login', {
            method: 'POST',
            headers: { origin: 'http://loupe.test', 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'x'.repeat(64 * 1024) }),
        });
        expect(res.status).toBe(413);
        expect(await res.json()).toEqual({
            error: 'payload_too_large',
            message: 'The request is too large.',
        });
    });

    it('never compresses API responses', async () => {
        const res = await app.request('/api/nope', { headers: { 'accept-encoding': 'gzip' } });
        expect(res.headers.get('content-encoding')).toBeNull();
    });
});

describe('web app files', () => {
    const t = createTestApp();
    const webRoot = mkdtempSync(path.join(tmpdir(), 'loupe-web-'));
    mkdirSync(path.join(webRoot, 'assets'));
    writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><div id="app"></div>');
    writeFileSync(
        path.join(webRoot, 'assets', 'index-abc123.js'),
        `console.log("${'x'.repeat(2000)}");`,
    );
    const app = createApp({ db: t.db, config: t.config, webRoot });

    it('caches hashed assets for good and compresses them', async () => {
        const res = await app.request('/assets/index-abc123.js', {
            headers: { 'accept-encoding': 'gzip' },
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
        expect(res.headers.get('content-encoding')).toBe('gzip');
    });

    it('revalidates the page on every load, for every client-side route', async () => {
        for (const route of ['/', '/projects/123', '/s/some-token']) {
            const res = await app.request(route);
            expect(res.status).toBe(200);
            expect(res.headers.get('cache-control')).toBe('no-cache');
            expect(await res.text()).toContain('<div id="app">');
        }
    });

    it('answers 404 for assets of another build instead of the page', async () => {
        const res = await app.request('/assets/index-old999.js');
        expect(res.status).toBe(404);
    });
});
