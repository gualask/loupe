import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { sessionMiddleware } from './auth/session.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import type { AppDeps, AppEnv } from './types.ts';

export function createApp(
    deps: AppDeps & {
        /** Directory with the built web app; relative paths resolve from the working directory. */
        webRoot?: string;
    },
) {
    const { db, config, webRoot = './dist/web' } = deps;
    const app = new Hono<AppEnv>();

    app.onError((err, c) => {
        if (err instanceof HTTPException) return err.getResponse();
        console.error(err);
        return c.json({ error: 'internal_error' }, 500);
    });

    app.get('/healthz', (c) => {
        db.$client.prepare('SELECT 1').get();
        return c.json({ status: 'ok' });
    });

    app.use('/api/*', csrf({ origin: config.publicUrl }), sessionMiddleware(deps));
    app.route('/api/auth', authRoutes(deps));
    app.route('/api/admin', adminRoutes(deps));
    app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

    app.use('/assets/*', serveStatic({ root: webRoot }));
    // Client-side routes all render the single-page app.
    app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));

    return app;
}
