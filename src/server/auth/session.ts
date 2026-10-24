import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { deleteSession, findSessionWithUser, insertSession, touchSession } from '../db/sessions.ts';
import { apiError } from '../http.ts';
import type { AppDeps, AppEnv } from '../types.ts';
import { randomToken, sha256 } from './crypto.ts';

const COOKIE = 'loupe_session';
// Sliding expiry is refreshed at most this often, to avoid a write on every request.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function writeCookie(c: Context, value: string, { config }: AppDeps) {
    setCookie(c, COOKIE, value, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.secureCookies,
        path: '/',
        maxAge: Math.floor(config.sessionTtlMs / 1000),
    });
}

export function startSession(c: Context, deps: AppDeps, userId: string) {
    const id = randomToken();
    insertSession(deps.db, { idHash: sha256(id), userId, ttlMs: deps.config.sessionTtlMs });
    writeCookie(c, id, deps);
}

export function endSession(c: Context, { db }: AppDeps) {
    const id = getCookie(c, COOKIE);
    if (id) deleteSession(db, sha256(id));
    deleteCookie(c, COOKIE, { path: '/' });
}

/** Resolves the session cookie into `c.var.user` (null when absent, expired or disabled). */
export function sessionMiddleware(deps: AppDeps) {
    return createMiddleware<AppEnv>(async (c, next) => {
        c.set('user', null);
        const id = getCookie(c, COOKIE);
        if (id) {
            const idHash = sha256(id);
            const found = findSessionWithUser(deps.db, idHash);
            const now = Date.now();
            if (!found || found.session.expiresAt.getTime() <= now || found.user.disabledAt) {
                if (found) deleteSession(deps.db, idHash);
                deleteCookie(c, COOKIE, { path: '/' });
            } else {
                c.set('user', found.user);
                if (now - found.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
                    touchSession(deps.db, idHash, deps.config.sessionTtlMs);
                    writeCookie(c, id, deps);
                }
            }
        }
        await next();
    });
}

/** The signed-in user, or a 401 error for anonymous requests. */
export function signedInUser(c: Context<AppEnv>) {
    if (!c.var.user) throw apiError(401, 'unauthenticated');
    return c.var.user;
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (signedInUser(c).role !== 'admin') throw apiError(403, 'forbidden');
    await next();
};
