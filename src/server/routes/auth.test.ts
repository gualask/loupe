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

// Runs once a password has been checked, before the login it belongs to goes on.
const afterPasswordCheck = vi.hoisted(() => ({ run: async () => {} }));
vi.mock('../auth/crypto.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../auth/crypto.ts')>();
    return {
        ...actual,
        verifyPassword: async (...args: Parameters<typeof actual.verifyPassword>) => {
            const valid = await actual.verifyPassword(...args);
            await afterPasswordCheck.run();
            return valid;
        },
    };
});

afterEach(() => {
    afterPasswordCheck.run = async () => {};
});

describe('API responses', () => {
    it('may not be kept by any cache', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const responses = [
            await admin.get('/api/auth/me'),
            await admin.get('/api/projects'),
            await t.client().get('/api/auth/me'),
            await admin.get('/api/nothing-here'),
        ];
        expect(responses.map((res) => [res.status, res.headers.get('cache-control')])).toEqual([
            [200, 'no-store'],
            [200, 'no-store'],
            [401, 'no-store'],
            [404, 'no-store'],
        ]);
    });
});

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

    it('starts no session when a password reset ends while the password is checked', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editorId } = await inviteEditor(t, admin);
        const link = await admin.post(`/api/admin/users/${editorId}/reset-link`);
        afterPasswordCheck.run = async () => {
            afterPasswordCheck.run = async () => {};
            const reset = await t.client().post(`/api/auth/tokens/${tokenFromUrl(link.body.url)}`, {
                password: 'a brand new password',
            });
            expect(reset.status).toBe(200);
        };

        const client = t.client();
        const login = await client.post('/api/auth/login', {
            username: 'eddie',
            password: PASSWORD,
        });
        expect({ status: login.status, body: login.body }).toEqual({
            status: 401,
            body: { error: 'invalid_credentials', message: 'Wrong username or password.' },
        });
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

    it('cancels the other reset links of a user once one is used', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editorId } = await inviteEditor(t, admin);
        const resetLink = async () =>
            tokenFromUrl((await admin.post(`/api/admin/users/${editorId}/reset-link`)).body.url);
        const [first, second] = [await resetLink(), await resetLink()];

        const used = await t.client().post(`/api/auth/tokens/${second}`, {
            password: 'a brand new password',
        });
        expect(used.status).toBe(200);
        expect(await t.client().get(`/api/auth/tokens/${first}`)).toMatchObject({
            status: 404,
            body: { error: 'invalid_token' },
        });
    });

    it('cancels the reset links of an account when it is disabled', async () => {
        const t = createTestApp();
        const admin = await setUpAdmin(t);
        const { editorId } = await inviteEditor(t, admin);
        const link = await admin.post(`/api/admin/users/${editorId}/reset-link`);

        await admin.patch(`/api/admin/users/${editorId}`, { disabled: true });
        await admin.patch(`/api/admin/users/${editorId}`, { disabled: false });
        const res = await t.client().get(`/api/auth/tokens/${tokenFromUrl(link.body.url)}`);
        expect(res.status).toBe(404);
    });

    it.each([{ change: { role: 'editor' } }, { change: { disabled: true } }])(
        'cancels the invites of an admin once $change',
        async ({ change }) => {
            const t = createTestApp();
            const admin = await setUpAdmin(t);
            const invite = await admin.post('/api/admin/invites', { role: 'admin' });
            const other = t.client();
            const created = await other.post(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`, {
                username: 'olga',
                displayName: 'Olga',
                password: PASSWORD,
            });
            const kept = await admin.post('/api/admin/invites', { role: 'editor' });
            const hers = await other.post('/api/admin/invites', { role: 'admin' });

            const res = await admin.patch(`/api/admin/users/${created.body.id}`, change);
            expect(res.status).toBe(200);
            const status = async (link: { body: { url: string } }) =>
                (await t.client().get(`/api/auth/tokens/${tokenFromUrl(link.body.url)}`)).status;
            expect(await status(hers)).toBe(404);
            // Another admin's invites are theirs.
            expect(await status(kept)).toBe(200);
        },
    );

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

    describe('a request under way when its admin is demoted or disabled', () => {
        /** A second admin, Ada, whose request is sent now and whose body arrives on `send()`. */
        async function adaRequest(method: string, path: string, payload: unknown) {
            const t = createTestApp();
            const admin = await setUpAdmin(t);
            const adminId = (await admin.get('/api/auth/me')).body.id as string;
            const invite = await admin.post('/api/admin/invites', { role: 'admin' });
            const ada = await t.client().post(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`, {
                username: 'ada',
                displayName: 'Ada',
                password: PASSWORD,
            });
            const cookie = ada.headers.getSetCookie()[0]?.split(';')[0] ?? '';
            const json = JSON.stringify(payload);
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
                method,
                headers: {
                    origin: 'http://loupe.test',
                    'content-type': 'application/json',
                    'content-length': String(json.length),
                    cookie,
                },
                body,
                duplex: 'half',
            };
            const pending = t.app.request(path.replace(':adminId', adminId), request);
            await later();
            return { t, admin, adaId: ada.body.id as string, pending, send };
        }

        const REFUSED = {
            demoted: {
                change: { role: 'editor' },
                status: 403,
                body: { error: 'forbidden', message: 'Only admins can do this.' },
            },
            disabled: {
                change: { disabled: true },
                status: 401,
                body: { error: 'unauthenticated', message: 'You are signed out. Sign in again.' },
            },
        };

        it.each(Object.entries(REFUSED))(
            'creates no invite once its issuer is %s',
            async (_, { change, status, body }) => {
                const { t, admin, adaId, pending, send } = await adaRequest(
                    'POST',
                    '/api/admin/invites',
                    { role: 'admin' },
                );
                expect((await admin.patch(`/api/admin/users/${adaId}`, change)).status).toBe(200);

                send();
                const res = await pending;
                expect({ status: res.status, body: await res.json() }).toEqual({ status, body });
                const invites = t.db.$client
                    .prepare("SELECT count(*) AS n FROM account_tokens WHERE kind = 'invite'")
                    .get();
                expect(invites?.n).toBe(0);
            },
        );

        // Two admins disabling each other at once would otherwise leave no admin.
        it.each(Object.entries(REFUSED))(
            'changes no account once its sender is %s',
            async (_, { change, status, body }) => {
                const { admin, adaId, pending, send } = await adaRequest(
                    'PATCH',
                    '/api/admin/users/:adminId',
                    { disabled: true },
                );
                expect((await admin.patch(`/api/admin/users/${adaId}`, change)).status).toBe(200);

                send();
                const res = await pending;
                expect({ status: res.status, body: await res.json() }).toEqual({ status, body });
                expect((await admin.get('/api/auth/me')).body).toMatchObject({ role: 'admin' });
            },
        );
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
