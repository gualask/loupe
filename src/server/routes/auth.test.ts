import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueSetupLinkIfNeeded } from '../auth/accounts.ts';
import {
    createTestApp,
    inviteEditor,
    later,
    PASSWORD,
    setUpAdmin,
    setupLink,
    tokenFromUrl,
} from '../test-utils.ts';

describe('first-run setup', () => {
    it('issues a setup link only while no account exists', async () => {
        const t = createTestApp();
        const link = setupLink(t);
        expect(link.url).toMatch(/^http:\/\/loupe\.test\/setup\/[\w-]{43}$/);

        const info = await t.client().get(`/api/auth/tokens/${tokenFromUrl(link.url)}`);
        expect(info).toMatchObject({ status: 200, body: { kind: 'setup', role: 'admin' } });

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

    describe('session lifetime', () => {
        const DAY = 24 * 60 * 60 * 1000;

        async function signedIn() {
            const t = createTestApp();
            const admin = await setUpAdmin(t);
            vi.useFakeTimers({ toFake: ['Date'] });
            const advance = (days: number) => vi.setSystemTime(Date.now() + days * DAY);
            const status = async () => (await admin.get('/api/auth/me')).status;
            const lastSeen = () =>
                t.db.$client.prepare('SELECT last_seen_at AS at FROM sessions').get()?.at;
            return { advance, status, lastSeen };
        }

        afterEach(() => {
            vi.useRealTimers();
        });

        it('ends after 30 days without use', async () => {
            const { advance, status } = await signedIn();
            advance(29);
            expect(await status()).toBe(200);
            advance(30.1);
            expect(await status()).toBe(401);
        });

        it('extends with use, but never past 90 days from sign-in', async () => {
            const { advance, status, lastSeen } = await signedIn();
            for (let day = 20; day <= 80; day += 20) {
                advance(20);
                expect(await status()).toBe(200);
            }
            // The expiry has reached the limit: using the session no longer writes to it.
            const seen = lastSeen();
            expect(seen).toEqual(expect.any(Number));
            advance(9.9);
            expect(await status()).toBe(200);
            expect(lastSeen()).toBe(seen);
            advance(0.2);
            expect(await status()).toBe(401);
        });
    });

    it('ends the previous session when the same browser signs in again', async () => {
        const t = createTestApp();
        await setUpAdmin(t);
        const credentials = { username: 'admin', password: PASSWORD };
        const first = await t.client().post('/api/auth/login', credentials);
        const cookie = first.headers.getSetCookie()[0]?.split(';')[0] ?? '';
        const me = () => t.app.request('/api/auth/me', { headers: { cookie } });
        expect((await me()).status).toBe(200);

        await t.app.request('/api/auth/login', {
            method: 'POST',
            headers: { cookie, origin: 'http://loupe.test', 'content-type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        expect((await me()).status).toBe(401);
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
        expect(wrong.body).toEqual(unknown.body);
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

    it('counts failed attempts sent in parallel', async () => {
        const t = createTestApp();
        await setUpAdmin(t);
        const client = t.client();
        const attempts = Array.from({ length: 15 }, () =>
            client.post('/api/auth/login', { username: 'admin', password: 'nope' }),
        );
        const statuses = (await Promise.all(attempts)).map((res) => res.status);
        expect(Object.groupBy(statuses, String)).toEqual({
            401: Array(10).fill(401),
            429: Array(5).fill(429),
        });
    });

    it('refuses sign-ins beyond what the server can check at once', async () => {
        const t = createTestApp();
        // Different usernames, as a flood escaping the per-username limit would use.
        const attempts = Array.from({ length: 30 }, (_, i) =>
            t.client().post('/api/auth/login', { username: `user${i}`, password: 'nope' }),
        );
        const responses = await Promise.all(attempts);
        const statuses = responses.map((res) => res.status);
        // Two checked at once, twenty waiting.
        expect(Object.groupBy(statuses, String)).toEqual({
            401: Array(22).fill(401),
            503: Array(8).fill(503),
        });
        expect(responses.find((res) => res.status === 503)?.body).toEqual({
            error: 'server_busy',
            message: 'The server is busy. Retry in a moment.',
        });
    });

    it('uses a cookie bound to the host over https', async () => {
        const t = createTestApp({ LOUPE_PUBLIC_URL: 'https://loupe.test' });
        await setUpAdmin(t);
        const login = await t.client().post('/api/auth/login', {
            username: 'admin',
            password: PASSWORD,
        });
        const [cookie = ''] = login.headers.getSetCookie();
        expect(cookie).toMatch(
            /^__Host-loupe_session=[\w-]{43}; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
        );

        const value = cookie.split(';')[0]?.split('=')[1];
        const me = (name: string) =>
            t.app.request('/api/auth/me', { headers: { cookie: `${name}=${value}` } });
        expect((await me('__Host-loupe_session')).status).toBe(200);
        // A cookie without the prefix could have been set by another subdomain.
        expect((await me('loupe_session')).status).toBe(401);
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
        expect(res).toMatchObject({ status: 409, body: { error: 'cannot_modify_self' } });
    });

    it('keeps an active admin when two admins disable each other at once', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const adminId = (await admin.get('/api/auth/me')).body.id;
        const invite = await admin.post('/api/admin/invites', { role: 'admin' });
        const second = await t.client().post(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`, {
            username: 'ada',
            displayName: 'Ada',
            password: PASSWORD,
        });
        const cookie = second.headers.getSetCookie()[0]?.split(';')[0] ?? '';

        // Ada's request is under way, signed in as an admin, while the first admin disables her:
        // its body arrives afterwards.
        const json = JSON.stringify({ disabled: true });
        let send = () => {};
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                send = () => {
                    controller.enqueue(new TextEncoder().encode(json));
                    controller.close();
                };
            },
        });
        // Node needs `duplex` for a streamed body, which the DOM types do not know.
        const request: RequestInit & { duplex: 'half' } = {
            method: 'PATCH',
            headers: {
                origin: 'http://loupe.test',
                'content-type': 'application/json',
                'content-length': String(json.length),
                cookie,
            },
            body,
            duplex: 'half',
        };
        const pending = t.app.request(`/api/admin/users/${adminId}`, request);
        await later();
        const disabled = await admin.patch(`/api/admin/users/${second.body.id}`, {
            disabled: true,
        });
        expect(disabled.body).toMatchObject({ username: 'ada', disabled: true });

        send();
        const res = await pending;
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
            error: 'last_admin',
            message: 'At least one active admin must remain.',
        });
        expect((await admin.get('/api/auth/me')).status).toBe(200);
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
