import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/client.ts';

/** An app on a fresh in-memory database, plus a client that keeps cookies like a browser. */
export function createTestApp() {
    const config = loadConfig({ LOUPE_PUBLIC_URL: 'http://loupe.test' });
    const db = openDb(':memory:');
    const app = createApp({ db, config });
    return { app, db, config, client: () => createClient(app) };
}

type App = ReturnType<typeof createApp>;

function createClient(app: App) {
    const cookies = new Map<string, string>();

    async function request(method: string, path: string, body?: unknown) {
        const headers: Record<string, string> = { origin: 'http://loupe.test' };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (cookies.size) {
            headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        }
        const res = await app.request(path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const header of res.headers.getSetCookie()) {
            const [pair = '', ...attributes] = header.split(';');
            const [name = '', value = ''] = pair.split('=');
            const expired = attributes.some((a) => /max-age=0/i.test(a.trim()));
            if (expired || !value) cookies.delete(name);
            else cookies.set(name, value);
        }
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : undefined };
    }

    return {
        get: (path: string) => request('GET', path),
        post: (path: string, body?: unknown) => request('POST', path, body),
        patch: (path: string, body?: unknown) => request('PATCH', path, body),
    };
}

/** The secret part of an account link URL. */
export function tokenFromUrl(url: string) {
    return url.slice(url.lastIndexOf('/') + 1);
}
