import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { sessionMiddleware } from './auth/session.ts';
import { apiError, notFound } from './http.ts';
import { createHub } from './review/hub.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { isMockupUpload, projectRoutes } from './routes/projects.ts';
import { shareApiRoutes, shareContentRoutes } from './routes/share.ts';
import { threadRoutes } from './routes/threads.ts';
import type { AppDeps, AppEnv } from './types.ts';

// The app loads only its own files. Inline styles are allowed for style attributes (positions,
// colors); scripts are not, so injected markup could never run.
const APP_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    // No other site may frame the app (clickjacking).
    "frame-ancestors 'none'",
].join('; ');

// Far above any JSON payload (a 5000-character comment and its anchor), far below what could
// exhaust memory.
const MAX_JSON_BYTES = 64 * 1024;

/** Sets Cache-Control on files that were found (serveStatic's onFound runs too late for it). */
function cacheFound(cacheControl: string): MiddlewareHandler {
    return async (c, next) => {
        await next();
        if (c.res.status === 200) c.res.headers.set('Cache-Control', cacheControl);
    };
}

export function createApp(
    deps: AppDeps & {
        /** Directory with the built web app; relative paths resolve from the working directory. */
        webRoot?: string;
        /** Built bridge script inlined into mockups; omitted in tests. */
        bridgeFile?: string;
    },
) {
    const { db, config, webRoot = './dist/web' } = deps;
    const app = new Hono<AppEnv>();
    const hub = createHub();

    app.onError((err, c) => {
        if (err instanceof HTTPException) return err.getResponse();
        console.error(err);
        return c.json(
            { error: 'internal_error', message: 'The server had a problem. Retry later.' },
            500,
        );
    });

    // The web app and mockup documents are compressed. API responses are small and carry secrets
    // (share and account links) next to user input, which compression could leak (BREACH).
    const compression = compress();
    app.use('*', (c, next) => (c.req.path.startsWith('/api/') ? next() : compression(c, next)));

    // Mockup documents set their own, sandboxing policy (mockups/document.ts).
    app.use('*', async (c, next) => {
        await next();
        if (!c.res.headers.has('Content-Security-Policy')) {
            c.res.headers.set('Content-Security-Policy', APP_POLICY);
        }
        c.res.headers.set('X-Content-Type-Options', 'nosniff');
    });

    app.get('/healthz', (c) => {
        db.$client.prepare('SELECT 1').get();
        return c.json({ status: 'ok' });
    });

    const jsonLimit = bodyLimit({
        maxSize: MAX_JSON_BYTES,
        onError: () => {
            throw apiError(413, 'payload_too_large', 'The request is too large.');
        },
    });
    app.use('/api/*', (c, next) => (isMockupUpload(c.req.path) ? next() : jsonLimit(c, next)));
    app.use('/api/*', csrf({ origin: config.publicUrl }), sessionMiddleware(deps));
    app.route('/api/auth', authRoutes(deps));
    app.route('/api/admin', adminRoutes(deps));
    app.route('/api/s', shareApiRoutes(deps));
    app.route('/api/s', threadRoutes({ ...deps, hub }));
    // Every project route resolves the signed-in user and answers 401 without one.
    app.route('/api', projectRoutes(deps));
    app.all('/api/*', () => {
        throw notFound();
    });

    app.use('/s/:token/content', sessionMiddleware(deps));
    app.route('/s', shareContentRoutes(deps));

    // Built assets have a content hash in their name, so they never change: cache them for good.
    app.use(
        '/assets/*',
        cacheFound('public, max-age=31536000, immutable'),
        serveStatic({ root: webRoot }),
    );
    // Not the page: an asset of an older build must fail, not load HTML in its place.
    app.all('/assets/*', (c) => c.notFound());
    // Client-side routes all render the single-page app, always revalidated so that an update
    // takes effect at the next load.
    app.get('*', cacheFound('no-cache'), serveStatic({ root: webRoot, path: 'index.html' }));

    return app;
}
