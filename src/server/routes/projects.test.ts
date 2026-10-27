import { existsSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../shared/api/projects.ts';
import { PIN_ANCHOR } from '../../shared/test-fixtures.ts';
import {
    createSharedMockup,
    createTestApp,
    htmlFile,
    inviteEditor,
    later,
    setUpAdmin,
    tokenFromUrl,
} from '../test-utils.ts';

const MOCKUP = `<!doctype html>
<html><head><title>Checkout</title>
<link rel="stylesheet" href="https://cdn.example.com/kit.css"></head>
<body><button onclick="pay()">Pay</button></body></html>`;

const checkoutFile = () => htmlFile(MOCKUP, 'checkout.html');

const editorWithMockup = () => createSharedMockup(checkoutFile());

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
            activity: { openThreads: 0, resolvedThreads: 0 },
            createdAt: expect.any(String),
            updatedAt: created.body.createdAt,
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

    it('sums the threads of current versions and lists the latest updated first', async () => {
        const { editor, project, mockup, base, viewer, uploadVersion } = await editorWithMockup();
        await later();
        const quiet = await editor.post('/api/projects', { name: 'Quiet' });
        const listed = async () =>
            (await editor.get('/api/projects')).body.map((p: Project) => [
                p.id,
                p.activity,
                p.updatedAt,
            ]);
        const none = { openThreads: 0, resolvedThreads: 0 };
        expect(await listed()).toEqual([
            [quiet.body.id, none, quiet.body.createdAt],
            [project.id, none, mockup.version.createdAt],
        ]);

        await later();
        const { client } = await viewer('Alice');
        const thread = (body: string) =>
            client.post(`${base}/threads`, { id: crypto.randomUUID(), kind: 'general', body });
        const first = await thread('Looks good');
        await editor.patch(`${base}/threads/${first.body.id}`, { status: 'resolved' });
        const second = await thread('Larger buttons');
        const commentedAt = second.body.comments[0].createdAt;
        expect(await listed()).toEqual([
            [project.id, { openThreads: 1, resolvedThreads: 1 }, commentedAt],
            [quiet.body.id, none, quiet.body.createdAt],
        ]);

        await later();
        await uploadVersion();
        const detail = (await editor.get(`/api/projects/${project.id}`)).body;
        expect(detail).toMatchObject({
            mockupCount: 1,
            activity: none,
            updatedAt: detail.mockups[0].version.createdAt,
        });
    });
});

describe('mockups', () => {
    it('stores the file and reports external references', async () => {
        const { t, project, mockup } = await editorWithMockup();
        expect(mockup).toEqual({
            id: expect.any(String),
            project: {
                id: project.id,
                name: 'Shop',
                owner: { id: project.owner.id, displayName: 'Eddie' },
            },
            name: 'checkout',
            shareUrl: expect.stringMatching(/^http:\/\/loupe\.test\/s\/[\w-]{43}$/),
            archivedAt: null,
            version: {
                number: 1,
                originalFilename: 'checkout.html',
                sizeBytes: new TextEncoder().encode(MOCKUP).byteLength,
                externalRefs: ['https://cdn.example.com/kit.css'],
                createdAt: expect.any(String),
            },
            activity: {
                openThreads: 0,
                resolvedThreads: 0,
                lastActivityAt: null,
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

    it('archives a mockup, keeping the date of the first archiving', async () => {
        const { t, editor, mockup } = await editorWithMockup();
        const archive = (archived: boolean) =>
            editor.patch(`/api/mockups/${mockup.id}`, { archived });
        const shared = async () =>
            (await t.client().get(`/api/s/${tokenFromUrl(mockup.shareUrl)}`)).body.archived;

        const archived = await archive(true);
        expect(archived).toMatchObject({ status: 200 });
        expect(archived.body).toEqual({ ...mockup, archivedAt: expect.any(String) });
        expect(await shared()).toBe(true);
        expect((await archive(true)).body.archivedAt).toBe(archived.body.archivedAt);

        expect((await archive(false)).body).toEqual(mockup);
        expect(await shared()).toBe(false);
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
        const res = await editor.post(
            `/api/projects/${project.id}/mockups`,
            htmlFile(big, 'checkout.html'),
        );
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

        await editor.post(`/api/mockups/${mockup.id}/share/regenerate`);
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
            archived: false,
            version: 1,
            contentUrl: `/s/${token}/content`,
            me: null,
            canModerate: false,
        });
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
        expect((await other.patch(`/api/mockups/${mockup.id}`, { archived: true })).status).toBe(
            404,
        );
        expect((await admin.patch(`/api/mockups/${mockup.id}`, { archived: true })).status).toBe(
            200,
        );
    });
});

describe('mockup versions', () => {
    it('serves a new version on the same link', async () => {
        const { t, editor, project, mockup } = await editorWithMockup();
        const next = '<!doctype html><button>Pay now</button>';
        const res = await editor.post(
            `/api/mockups/${mockup.id}/versions`,
            htmlFile(next, 'checkout-v2.html'),
        );
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            ...mockup,
            version: {
                number: 2,
                originalFilename: 'checkout-v2.html',
                sizeBytes: new TextEncoder().encode(next).byteLength,
                externalRefs: [],
                createdAt: expect.any(String),
            },
        });

        const token = tokenFromUrl(mockup.shareUrl);
        expect((await t.client().get(`/api/s/${token}`)).body).toMatchObject({ version: 2 });
        expect((await t.client().get(`/s/${token}/content`)).body).toContain('Pay now');
        const listed = await editor.get(`/api/projects/${project.id}`);
        expect(listed.body.mockups).toEqual([
            expect.objectContaining({ id: mockup.id, version: res.body.version }),
        ]);
        // Both files stay stored: the first version still references its own.
        expect(readdirSync(path.join(t.config.dataDir, 'mockups'))).toHaveLength(2);
    });

    it('checks the file and who uploads it', async () => {
        const { t, admin, editor, mockup } = await editorWithMockup();
        const url = `/api/mockups/${mockup.id}/versions`;
        expect(await editor.post(url, htmlFile('just some text', 'notes.html'))).toMatchObject({
            status: 400,
            body: { error: 'not_html' },
        });
        const big = `<html><body>${'x'.repeat(1024 * 1024)}</body></html>`;
        expect(await editor.post(url, htmlFile(big, 'checkout.html'))).toMatchObject({
            status: 413,
            body: { error: 'file_too_large' },
        });
        const { editor: other } = await inviteEditor(t, admin, 'fran');
        expect((await other.post(url, checkoutFile())).status).toBe(404);
        expect((await t.client().post(url, checkoutFile())).status).toBe(401);
        expect(await editor.post(url, checkoutFile())).toMatchObject({
            status: 409,
            body: {
                error: 'same_file',
                message: 'This file is the same as the current version.',
            },
        });
        expect((await editor.get(`/api/mockups/${mockup.id}`)).body.version.number).toBe(1);
    });

    it('refuses new versions of an archived mockup', async () => {
        const { editor, mockup } = await editorWithMockup();
        await editor.patch(`/api/mockups/${mockup.id}`, { archived: true });
        const next = htmlFile('<!doctype html><html><body>v2</body></html>', 'checkout.html');
        expect(await editor.post(`/api/mockups/${mockup.id}/versions`, next)).toMatchObject({
            status: 409,
            body: { error: 'archived' },
        });
    });
});

describe('mockup feedback', () => {
    it('counts threads and dates the latest comment', async () => {
        const { editor, mockup, base, viewer } = await createSharedMockup();
        expect((await editor.get(`/api/mockups/${mockup.id}`)).body.activity).toEqual({
            openThreads: 0,
            resolvedThreads: 0,
            lastActivityAt: null,
        });

        const alice = await viewer('Alice');
        const id = crypto.randomUUID();
        await alice.client.post(`${base}/threads`, { id, kind: 'general', body: 'Hi' });
        // Editors' threads count too.
        await editor.post(`${base}/threads`, {
            id: crypto.randomUUID(),
            kind: 'pin',
            anchor: PIN_ANCHOR,
            body: 'There',
        });
        await editor.patch(`${base}/threads/${id}`, { status: 'resolved' });

        const activity = {
            openThreads: 1,
            resolvedThreads: 1,
            lastActivityAt: expect.any(String),
        };
        expect((await editor.get(`/api/mockups/${mockup.id}`)).body.activity).toEqual(activity);
        const listed = await editor.get(`/api/projects/${mockup.project.id}`);
        expect(listed.body.mockups[0].activity).toEqual(activity);
    });

    it('lists viewers to the editors of the mockup only', async () => {
        const { t, admin, mockup } = await createSharedMockup();
        const { editor: fran } = await inviteEditor(t, admin, 'fran');
        expect((await fran.get(`/api/mockups/${mockup.id}/reviewers`)).status).toBe(404);
        expect((await admin.get(`/api/mockups/${mockup.id}/reviewers`)).body).toEqual([]);
    });
});
