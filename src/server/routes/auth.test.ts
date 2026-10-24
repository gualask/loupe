import { describe, expect, it, vi } from 'vitest';
import { issueSetupLinkIfNeeded } from '../auth/accounts.ts';
import { createTestApp, tokenFromUrl } from '../test-utils.ts';

const PASSWORD = 'correct horse battery';

function setupLink(t: ReturnType<typeof createTestApp>) {
    const link = issueSetupLinkIfNeeded(t.db, t.config);
    if (!link) throw new Error('expected a setup link');
    return link;
}

/** Runs first-run setup and returns the admin's signed-in client. */
async function setUpAdmin(t: ReturnType<typeof createTestApp>) {
    const admin = t.client();
    await admin.post(`/api/auth/tokens/${tokenFromUrl(setupLink(t).url)}`, {
        username: 'Admin',
        displayName: 'The Admin',
        password: PASSWORD,
    });
    return admin;
}

async function inviteEditor(
    t: ReturnType<typeof createTestApp>,
    admin: Awaited<ReturnType<typeof setUpAdmin>>,
) {
    const invite = await admin.post('/api/admin/invites', { role: 'editor' });
    const editor = t.client();
    const res = await editor.post(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`, {
        username: 'eddie',
        displayName: 'Eddie',
        password: PASSWORD,
    });
    return { editor, editorId: res.body.id as string };
}

describe('first-run setup', () => {
    it('issues a setup link only while no account exists', async () => {
        const t = createTestApp();
        const link = setupLink(t);
        expect(link.url).toMatch(/^http:\/\/loupe\.test\/setup\/[\w-]{43}$/);

        const info = await t.client().get(`/api/auth/tokens/${tokenFromUrl(link.url)}`);
        expect(info).toEqual({ status: 200, body: { kind: 'setup', role: 'admin' } });

        await setUpAdmin(t);
        expect(issueSetupLinkIfNeeded(t.db, t.config)).toBeUndefined();
    });

    it('invalidates the previous setup link when a new one is issued', async () => {
        const t = createTestApp();
        const first = setupLink(t);
        issueSetupLinkIfNeeded(t.db, t.config);
        const res = await t.client().get(`/api/auth/tokens/${tokenFromUrl(first.url)}`);
        expect(res.status).toBe(404);
    });

    it('creates the first admin, signs them in and consumes the link', async () => {
        const t = createTestApp();
        const token = tokenFromUrl(setupLink(t).url);
        const client = t.client();

        const res = await client.post(`/api/auth/tokens/${token}`, {
            username: ' Admin ',
            displayName: 'The Admin',
            password: PASSWORD,
        });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: expect.any(String),
            username: 'admin',
            displayName: 'The Admin',
            role: 'admin',
        });
        expect((await client.get('/api/auth/me')).body).toEqual(res.body);

        const reuse = await t.client().post(`/api/auth/tokens/${token}`, {
            username: 'other',
            displayName: 'Other',
            password: PASSWORD,
        });
        expect(reuse.status).toBe(404);
    });

    it('rejects weak passwords and invalid usernames', async () => {
        const t = createTestApp();
        const token = tokenFromUrl(setupLink(t).url);
        const res = await t.client().post(`/api/auth/tokens/${token}`, {
            username: 'a b',
            displayName: 'A',
            password: 'short',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });
});

describe('login and logout', () => {
    it('signs in with valid credentials and out again', async () => {
        const t = createTestApp();
        await setUpAdmin(t);
        const client = t.client();

        expect((await client.get('/api/auth/me')).status).toBe(401);
        const login = await client.post('/api/auth/login', {
            username: 'admin',
            password: PASSWORD,
        });
        expect(login.status).toBe(200);
        expect((await client.get('/api/auth/me')).body.username).toBe('admin');

        expect((await client.post('/api/auth/logout')).status).toBe(204);
        expect((await client.get('/api/auth/me')).status).toBe(401);
    });

    it('gives the same answer for unknown users and wrong passwords', async () => {
        const t = createTestApp();
        await setUpAdmin(t);
        const wrong = await t
            .client()
            .post('/api/auth/login', { username: 'admin', password: 'nope' });
        const unknown = await t
            .client()
            .post('/api/auth/login', { username: 'ghost', password: 'nope' });
        expect(wrong).toEqual(unknown);
        expect(wrong.status).toBe(401);
    });

    it('blocks a username after 10 failed attempts', async () => {
        const t = createTestApp();
        await setUpAdmin(t);
        const client = t.client();
        for (let i = 0; i < 10; i++) {
            await client.post('/api/auth/login', { username: 'admin', password: 'nope' });
        }
        const res = await client.post('/api/auth/login', { username: 'admin', password: PASSWORD });
        expect(res.status).toBe(429);
    });

    it('rejects cross-site form posts', async () => {
        const t = createTestApp();
        const res = await t.app.request('/api/auth/logout', {
            method: 'POST',
            headers: { origin: 'https://evil.example', 'content-type': 'text/plain' },
        });
        expect(res.status).toBe(403);
    });
});

describe('invites', () => {
    it('lets an admin invite an editor, who cannot use admin routes', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);

        const invite = await admin.post('/api/admin/invites', { role: 'editor' });
        expect(invite.status).toBe(201);
        expect(invite.body.url).toMatch(/^http:\/\/loupe\.test\/invite\//);

        const info = await t.client().get(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`);
        expect(info.body).toEqual({ kind: 'invite', role: 'editor' });

        const { editor } = await inviteEditor(t, admin);
        expect((await editor.get('/api/auth/me')).body.role).toBe('editor');
        expect((await editor.get('/api/admin/users')).status).toBe(403);
        expect((await t.client().get('/api/admin/users')).status).toBe(401);
    });

    it('rejects a taken username without consuming the invite', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const invite = await admin.post('/api/admin/invites', { role: 'admin' });
        const token = tokenFromUrl(invite.body.url);

        const taken = await t.client().post(`/api/auth/tokens/${token}`, {
            username: 'admin',
            displayName: 'Copy',
            password: PASSWORD,
        });
        expect(taken.status).toBe(409);
        expect((await t.client().get(`/api/auth/tokens/${token}`)).status).toBe(200);
    });

    it('expires invites after 48 hours', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const invite = await admin.post('/api/admin/invites', { role: 'editor' });

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 48 * 60 * 60 * 1000 + 1);
        const res = await t.client().get(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`);
        vi.useRealTimers();
        expect(res.status).toBe(404);
    });
});

describe('user management', () => {
    it('resets a password and signs the user out everywhere', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editor, editorId } = await inviteEditor(t, admin);

        const link = await admin.post(`/api/admin/users/${editorId}/reset-link`);
        expect(link.status).toBe(201);
        const token = tokenFromUrl(link.body.url);
        expect((await t.client().get(`/api/auth/tokens/${token}`)).body).toEqual({
            kind: 'reset',
            username: 'eddie',
        });

        const fresh = t.client();
        const res = await fresh.post(`/api/auth/tokens/${token}`, {
            password: 'a brand new password',
        });
        expect(res.status).toBe(200);
        expect((await editor.get('/api/auth/me')).status).toBe(401);
        expect((await fresh.get('/api/auth/me')).body.username).toBe('eddie');
    });

    it('disables an account and ends its sessions', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editor, editorId } = await inviteEditor(t, admin);

        const res = await admin.patch(`/api/admin/users/${editorId}`, { disabled: true });
        expect(res.body).toMatchObject({ username: 'eddie', disabled: true });
        expect((await editor.get('/api/auth/me')).status).toBe(401);
        const login = await t
            .client()
            .post('/api/auth/login', { username: 'eddie', password: PASSWORD });
        expect(login.status).toBe(401);
    });

    it('does not let admins change their own account', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const me = await admin.get('/api/auth/me');
        const res = await admin.patch(`/api/admin/users/${me.body.id}`, { role: 'editor' });
        expect(res).toEqual({ status: 409, body: { error: 'cannot_modify_self' } });
    });

    it('lists users for admins', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        await inviteEditor(t, admin);
        const res = await admin.get('/api/admin/users');
        expect(res.body).toEqual([
            {
                id: expect.any(String),
                username: 'admin',
                displayName: 'The Admin',
                role: 'admin',
                createdAt: expect.any(String),
                disabled: false,
            },
            {
                id: expect.any(String),
                username: 'eddie',
                displayName: 'Eddie',
                role: 'editor',
                createdAt: expect.any(String),
                disabled: false,
            },
        ]);
    });
});
