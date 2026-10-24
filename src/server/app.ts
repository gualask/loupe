import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { Db } from './db/client.ts';

export type AppDeps = {
    db: Db;
    /** Directory with the built web app; relative paths resolve from the working directory. */
    webRoot?: string;
};

export function createApp({ db, webRoot = './dist/web' }: AppDeps) {
    const app = new Hono();

    app.get('/healthz', (c) => {
        db.$client.prepare('SELECT 1').get();
        return c.json({ status: 'ok' });
    });

    app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

    app.use('/assets/*', serveStatic({ root: webRoot }));
    // Client-side routes all render the single-page app.
    app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));

    return app;
}
