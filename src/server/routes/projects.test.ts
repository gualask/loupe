import { existsSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestApp, inviteEditor, setUpAdmin, tokenFromUrl } from '../test-utils.ts';

const MOCKUP = `<!doctype html>
<html><head><title>Checkout</title>
<link rel="stylesheet" href="https://cdn.example.com/kit.css"></head>
<body><button onclick="pay()">Pay</button></body></html>`;

function htmlFile(content = MOCKUP, name = 'checkout.html') {
    const form = new FormData();
    form.set('file', new File([content], name, { type: 'text/html' }));
    return form;
}

async function editorWithMockup() {
    const t = createTestApp();
    const admin = await setUpAdmin(t);
    const { editor } = await inviteEditor(t, admin);
    const project = await editor.post('/api/projects', { name: 'Shop' });
    const mockup = await editor.post(`/api/projects/${project.body.id}/mockups`, htmlFile());
    return { t, admin, editor, project: project.body, mockup: mockup.body };
}

describe('projects', () => {
    it('creates and lists projects per owner, all of them for admins', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editor: eddie } = await inviteEditor(t, admin, 'eddie');
        const { editor: fran } = await inviteEditor(t, admin, 'fran');

        const created = await eddie.post('/api/projects', { name: ' Shop ', description: 'Q4' });
        expect(created.status).toBe(201);
        expect(created.body).toEqual({
            id: expect.any(String),
            name: 'Shop',
            description: 'Q4',
            owner: { id: expect.any(String), displayName: 'Eddie' },
            mockupCount: 0,
            createdAt: expect.any(String),
        });

        expect((await eddie.get('/api/projects')).body).toHaveLength(1);
        expect((await fran.get('/api/projects')).body).toEqual([]);
        expect((await admin.get('/api/projects')).body).toHaveLength(1);
        expect((await fran.get(`/api/projects/${created.body.id}`)).status).toBe(404);
        expect((await t.client().get('/api/projects')).status).toBe(401);
    });

    it('renames and deletes a project', async () => {
        const { editor, project } = await editorWithMockup();
        await editor.patch(`/api/projects/${project.id}`, { description: 'Q4' });
        const renamed = await editor.patch(`/api/projects/${project.id}`, { name: 'Store' });
        expect(renamed.body).toMatchObject({ name: 'Store', description: 'Q4', mockupCount: 1 });
        const empty = await editor.patch(`/api/projects/${project.id}`, {});
        expect(empty).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
        expect((await editor.delete(`/api/projects/${project.id}`)).status).toBe(204);
        expect((await editor.get('/api/projects')).body).toEqual([]);
    });
});

describe('mockup upload', () => {
    it('stores the file and reports external references', async () => {
        const { t, project, mockup } = await editorWithMockup();
        expect(mockup).toEqual({
            id: expect.any(String),
            projectId: project.id,
            name: 'checkout',
            shareUrl: expect.stringMatching(/^http:\/\/loupe\.test\/s\/[\w-]{43}$/),
            shareEnabled: true,
            shareExpiresAt: null,
            readOnly: false,
            version: {
                number: 1,
                originalFilename: 'checkout.html',
                sizeBytes: new TextEncoder().encode(MOCKUP).byteLength,
                externalRefs: ['https://cdn.example.com/kit.css'],
                createdAt: expect.any(String),
            },
            createdAt: expect.any(String),
        });
        expect(readdirSync(path.join(t.config.dataDir, 'mockups'))).toHaveLength(1);
    });

    it('renames a mockup', async () => {
        const { editor, mockup } = await editorWithMockup();
        const renamed = await editor.patch(`/api/mockups/${mockup.id}`, { name: ' Checkout v2 ' });
        expect(renamed.body).toEqual({ ...mockup, name: 'Checkout v2' });
        const blank = await editor.patch(`/api/mockups/${mockup.id}`, { name: ' ' });
        expect(blank).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
        const empty = await editor.patch(`/api/mockups/${mockup.id}`, {});
        expect(empty).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    });

    it('rejects files that are not HTML', async () => {
        const { editor, project } = await editorWithMockup();
        const res = await editor.post(
            `/api/projects/${project.id}/mockups`,
            htmlFile('just some text', 'notes.html'),
        );
        expect(res).toMatchObject({ status: 400, body: { error: 'not_html' } });
    });

    it('rejects files over the upload limit', async () => {
        const { editor, project } = await editorWithMockup();
        const big = `<html><body>${'x'.repeat(1024 * 1024)}</body></html>`;
        const res = await editor.post(`/api/projects/${project.id}/mockups`, htmlFile(big));
        expect(res).toMatchObject({ status: 413, body: { error: 'file_too_large' } });
    });

    it('deletes the stored file with the last mockup using it', async () => {
        const { t, editor, mockup } = await editorWithMockup();
        expect((await editor.delete(`/api/mockups/${mockup.id}`)).status).toBe(204);
        expect(readdirSync(path.join(t.config.dataDir, 'mockups'))).toEqual([]);
        expect(existsSync(t.config.dataDir)).toBe(true);
    });
});

describe('share links', () => {
    it('serves the mockup sandboxed, with the bridge first in <head>', async () => {
        const { t, mockup } = await editorWithMockup();
        const res = await t.client().get(`/s/${tokenFromUrl(mockup.shareUrl)}/content`);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-security-policy')).toBe(
            "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' data: blob:; " +
                "style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; " +
                "media-src data: blob:; connect-src 'none'",
        );
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.body).toContain(
            '<head><script>window.loupeBridge = "<\\/script>";</script><title>Checkout</title>',
        );
    });

    it('serves a rebuilt bridge without a restart', async () => {
        const { t, mockup } = await editorWithMockup();
        const content = `/s/${tokenFromUrl(mockup.shareUrl)}/content`;
        const before = await t.app.request(content);
        const bridgeFile = path.join(t.config.dataDir, 'bridge.js');
        writeFileSync(bridgeFile, 'window.rebuilt = true;');
        // A later modification time, as a rebuild would leave.
        utimesSync(bridgeFile, new Date(), new Date(Date.now() + 1000));

        const after = await t.app.request(content);
        expect(await after.text()).toContain('<head><script>window.rebuilt = true;</script>');
        expect(after.headers.get('etag')).not.toBe(before.headers.get('etag'));
    });

    it('lets browsers revalidate their copy, while still checking access', async () => {
        const { t, editor, mockup } = await editorWithMockup();
        const content = `/s/${tokenFromUrl(mockup.shareUrl)}/content`;
        const first = await t.app.request(content, { headers: { 'accept-encoding': 'gzip' } });
        const etag = first.headers.get('etag') ?? '';
        expect(etag).toMatch(/^W\/"[0-9a-f]{64}-[\w-]{43}"$/);
        expect(first.headers.get('cache-control')).toBe('private, no-cache');
        expect(first.headers.get('content-encoding')).toBe('gzip');

        // Compression makes the tag weak; both forms match.
        for (const tag of [etag, etag.slice(2)]) {
            const again = await t.app.request(content, { headers: { 'if-none-match': tag } });
            expect(again.status).toBe(304);
            expect(await again.text()).toBe('');
            expect(again.headers.get('content-security-policy')).toMatch(/^sandbox allow-scripts;/);
        }

        await editor.patch(`/api/mockups/${mockup.id}`, { shareEnabled: false });
        const revoked = await t.app.request(content, { headers: { 'if-none-match': etag } });
        expect(revoked.status).toBe(404);
    });

    it('describes the shared mockup to viewers', async () => {
        const { t, mockup } = await editorWithMockup();
        const token = tokenFromUrl(mockup.shareUrl);
        const res = await t.client().get(`/api/s/${token}`);
        expect(res.body).toEqual({
            mockupId: mockup.id,
            name: 'checkout',
            readOnly: false,
            contentUrl: `/s/${token}/content`,
            me: null,
            canModerate: false,
            review: null,
        });
    });

    it('hides disabled or expired links from viewers but not from the owner', async () => {
        const { t, editor, mockup } = await editorWithMockup();
        const content = `/s/${tokenFromUrl(mockup.shareUrl)}/content`;

        await editor.patch(`/api/mockups/${mockup.id}`, { shareEnabled: false });
        expect((await t.client().get(content)).status).toBe(404);
        expect((await editor.get(content)).status).toBe(200);

        const past = new Date(Date.now() - 1000).toISOString();
        const updated = await editor.patch(`/api/mockups/${mockup.id}`, {
            shareEnabled: true,
            shareExpiresAt: past,
        });
        expect(updated.body).toMatchObject({ shareEnabled: true, shareExpiresAt: past });
        expect((await t.client().get(content)).status).toBe(404);
    });

    it('invalidates the old link when it is regenerated', async () => {
        const { t, editor, mockup } = await editorWithMockup();
        const res = await editor.post(`/api/mockups/${mockup.id}/share/regenerate`);
        expect(res.body.shareUrl).not.toBe(mockup.shareUrl);
        expect((await t.client().get(`/api/s/${tokenFromUrl(mockup.shareUrl)}`)).status).toBe(404);
        expect((await t.client().get(`/api/s/${tokenFromUrl(res.body.shareUrl)}`)).status).toBe(
            200,
        );
    });

    it('does not let other editors manage the mockup', async () => {
        const { t, admin, mockup } = await editorWithMockup();
        const { editor: other } = await inviteEditor(t, admin, 'fran');
        expect((await other.patch(`/api/mockups/${mockup.id}`, { readOnly: true })).status).toBe(
            404,
        );
        expect((await admin.patch(`/api/mockups/${mockup.id}`, { readOnly: true })).status).toBe(
            200,
        );
    });
});
