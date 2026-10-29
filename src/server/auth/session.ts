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

/**
 * Over https the cookie is `__Host-loupe_session`: browsers then accept it only from this host,
 * so a sibling subdomain cannot plant a session of its own choosing. Plain http (local use)
 * cannot have the prefix.
 */
function scope({ config }: AppDeps) {
    const prefix = config.secureCookies ? ('host' as const) : undefined;
    return { path: '/', secure: config.secureCookies, prefix };
}

function readCookie(c: Context, deps: AppDeps) {
    return getCookie(c, COOKIE, scope(deps).prefix);
}

function writeCookie(c: Context, value: string, maxAgeMs: number, deps: AppDeps) {
    setCookie(c, COOKIE, value, {
        ...scope(deps),
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: Math.floor(maxAgeMs / 1000),
    });
}

function clearCookie(c: Context, deps: AppDeps) {
    deleteCookie(c, COOKIE, scope(deps));
}

/** Signs a browser in, ending the session it had (e.g. signing in again, or with another account). */
export function startSession(c: Context, deps: AppDeps, userId: string) {
    const previous = readCookie(c, deps);
    if (previous) deleteSession(deps.db, sha256(previous));
    const id = randomToken();
    const now = Date.now();
    const expiresAt = expiryFor(now, now, deps);
    insertSession(deps.db, { idHash: sha256(id), userId, expiresAt: new Date(expiresAt) });
    writeCookie(c, id, expiresAt - now, deps);
}

export function endSession(c: Context, deps: AppDeps) {
    const id = readCookie(c, deps);
    if (id) deleteSession(deps.db, sha256(id));
    clearCookie(c, deps);
}

/** Resolves the session cookie into `c.var.user` (null when absent, expired or disabled). */
export function sessionMiddleware(deps: AppDeps) {
    return createMiddleware<AppEnv>(async (c, next) => {
        c.set('user', null);
        const id = readCookie(c, deps);
        if (id) {
            const idHash = sha256(id);
            const found = findSessionWithUser(deps.db, idHash);
            const now = Date.now();
            if (!found || found.session.expiresAt.getTime() <= now || found.user.disabledAt) {
                if (found) deleteSession(deps.db, idHash);
                clearCookie(c, deps);
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
