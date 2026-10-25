import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { deleteSession, findSessionWithUser, insertSession, touchSession } from '../db/sessions.ts';
import { apiError } from '../http.ts';
import type { AppDeps, AppEnv } from '../types.ts';
import { randomToken, sha256 } from './crypto.ts';

const COOKIE = 'loupe_session';
// However much it is used, a session ends this long after sign-in, so a stolen cookie cannot be
// kept alive forever.
const MAX_SESSION_MS = 90 * 24 * 60 * 60 * 1000;
// The sliding expiry is extended only when it moves by more than this, to avoid a write on
// every request.
const EXTEND_STEP_MS = 60 * 60 * 1000;

/** Sliding expiry from `now`, never past the absolute limit counted from sign-in. */
function expiryFor(createdAt: number, now: number, { config }: AppDeps) {
    return Math.min(now + config.sessionTtlMs, createdAt + MAX_SESSION_MS);
}

function writeCookie(c: Context, value: string, maxAgeMs: number, { config }: AppDeps) {
    setCookie(c, COOKIE, value, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.secureCookies,
        path: '/',
        maxAge: Math.floor(maxAgeMs / 1000),
    });
}

/** Signs a browser in, ending the session it had (e.g. signing in again, or with another account). */
export function startSession(c: Context, deps: AppDeps, userId: string) {
    const previous = getCookie(c, COOKIE);
    if (previous) deleteSession(deps.db, sha256(previous));
    const id = randomToken();
    const now = Date.now();
    const expiresAt = expiryFor(now, now, deps);
    insertSession(deps.db, { idHash: sha256(id), userId, expiresAt: new Date(expiresAt) });
    writeCookie(c, id, expiresAt - now, deps);
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
                const expiresAt = expiryFor(found.session.createdAt.getTime(), now, deps);
                if (expiresAt - found.session.expiresAt.getTime() > EXTEND_STEP_MS) {
                    touchSession(deps.db, idHash, new Date(expiresAt));
                    writeCookie(c, id, expiresAt - now, deps);
                }
            }
        }
        await next();
    });
}

/** The signed-in user, or a 401 error for anonymous requests. */
export function signedInUser(c: Context<AppEnv>) {
    if (!c.var.user) throw apiError(401, 'unauthenticated', 'You are signed out. Sign in again.');
    return c.var.user;
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (signedInUser(c).role !== 'admin') {
        throw apiError(403, 'forbidden', 'Only admins can do this.');
    }
    await next();
};
