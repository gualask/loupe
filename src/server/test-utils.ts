import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { createApp } from './app.ts';
import { issueSetupLinkIfNeeded } from './auth/accounts.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/client.ts';

/** Stand-in for the built bridge; contains "</script>" to exercise escaping. */
const TEST_BRIDGE = 'window.loupeBridge = "</script>";';

const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** An app on a fresh in-memory database, plus a client that keeps cookies like a browser. */
export function createTestApp() {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'loupe-test-'));
    tempDirs.push(dataDir);
    const config = loadConfig({
        LOUPE_PUBLIC_URL: 'http://loupe.test',
        LOUPE_DATA_DIR: dataDir,
        LOUPE_MAX_UPLOAD_MB: '1',
    });
    const bridgeFile = path.join(dataDir, 'bridge.js');
    writeFileSync(bridgeFile, TEST_BRIDGE);
    const db = openDb(':memory:');
    const app = createApp({ db, config, bridgeFile });
    return { app, db, config, client: () => createClient(app) };
}

type App = ReturnType<typeof createApp>;

function createClient(app: App) {
    const cookies = new Map<string, string>();
    const extraHeaders: Record<string, string> = {};

    async function request(method: string, path: string, body?: unknown) {
        const headers: Record<string, string> = { origin: 'http://loupe.test', ...extraHeaders };
        const isForm = body instanceof FormData;
        if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
        if (cookies.size) {
            headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        }
        const res = await app.request(path, {
            method,
            headers,
            body: body === undefined || isForm ? body : JSON.stringify(body),
        });
        for (const header of res.headers.getSetCookie()) {
            const [pair = '', ...attributes] = header.split(';');
            const [name = '', value = ''] = pair.split('=');
            const expired = attributes.some((a) => /max-age=0/i.test(a.trim()));
            if (expired || !value) cookies.delete(name);
            else cookies.set(name, value);
        }
        const text = await res.text();
        const json = res.headers.get('content-type')?.startsWith('application/json');
        return { status: res.status, headers: res.headers, body: json ? JSON.parse(text) : text };
    }

    return {
        get: (path: string) => request('GET', path),
        post: (path: string, body?: unknown) => request('POST', path, body),
        patch: (path: string, body?: unknown) => request('PATCH', path, body),
        put: (path: string, body?: unknown) => request('PUT', path, body),
        delete: (path: string) => request('DELETE', path),
        /** Sends a header with every following request. */
        header: (name: string, value: string) => {
            extraHeaders[name] = value;
        },
    };
}

/** The secret at the end of an account or share link URL. */
export function tokenFromUrl(url: string) {
    return url.slice(url.lastIndexOf('/') + 1);
}

type TestApp = ReturnType<typeof createTestApp>;
type Client = ReturnType<TestApp['client']>;

export const PASSWORD = 'correct horse battery';

export function setupLink(t: TestApp) {
    const link = issueSetupLinkIfNeeded(t.db, t.config);
    if (!link) throw new Error('expected a setup link');
    return link;
}

/** Runs first-run setup and returns the admin's signed-in client. */
export async function setUpAdmin(t: TestApp) {
    const admin = t.client();
    await admin.post(`/api/auth/tokens/${tokenFromUrl(setupLink(t).url)}`, {
        username: 'Admin',
        displayName: 'The Admin',
        password: PASSWORD,
    });
    return admin;
}

/** Invites an editor through the admin and returns their signed-in client. */
export async function inviteEditor(t: TestApp, admin: Client, username = 'eddie') {
    const invite = await admin.post('/api/admin/invites', { role: 'editor' });
    const editor = t.client();
    const res = await editor.post(`/api/auth/tokens/${tokenFromUrl(invite.body.url)}`, {
        username,
        displayName: username[0]?.toUpperCase() + username.slice(1),
        password: PASSWORD,
    });
    return { editor, editorId: res.body.id as string };
}
