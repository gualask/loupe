import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { openDb } from './db/client.ts';

describe('createApp', () => {
    const app = createApp({ db: openDb(':memory:') });

    it('reports health once migrations are applied', async () => {
        const res = await app.request('/healthz');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'ok' });
    });

    it('answers unknown API routes with JSON 404', async () => {
        const res = await app.request('/api/nope');
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
    });
});
