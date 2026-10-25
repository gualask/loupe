import { Hono } from 'hono';
import {
    accountRequestSchema,
    loginRequestSchema,
    resetRequestSchema,
} from '../../shared/api/auth.ts';
import {
    checkCredentials,
    describeAccountToken,
    redeemAccountLink,
    redeemResetLink,
    toUser,
} from '../auth/accounts.ts';
import { endSession, signedInUser, startSession } from '../auth/session.ts';
import { apiError, parseJson } from '../http.ts';
import { createWindowLimiter } from '../rate-limit.ts';
import type { AppDeps, AppEnv } from '../types.ts';

export function authRoutes(deps: AppDeps) {
    const { db } = deps;
    // Keyed by username: behind a reverse proxy every client may share the same address.
    const loginFailures = createWindowLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

    return new Hono<AppEnv>()
        .post('/login', async (c) => {
            const { username, password } = await parseJson(c, loginRequestSchema);
            if (loginFailures.isBlocked(username)) {
                throw apiError(429, 'too_many_attempts', 'Too many failed attempts, retry later.');
            }
            const user = await checkCredentials(db, username, password);
            if (!user) {
                loginFailures.record(username);
                throw apiError(401, 'invalid_credentials', 'Wrong username or password.');
            }
            loginFailures.reset(username);
            startSession(c, deps, user.id);
            return c.json(toUser(user));
        })
        .post('/logout', (c) => {
            endSession(c, deps);
            return c.body(null, 204);
        })
        .get('/me', (c) => c.json(toUser(signedInUser(c))))
        .get('/tokens/:token', (c) => c.json(describeAccountToken(db, c.req.param('token'))))
        .post('/tokens/:token', async (c) => {
            const token = c.req.param('token');
            const user =
                describeAccountToken(db, token).kind === 'reset'
                    ? await redeemResetLink(db, token, await parseJson(c, resetRequestSchema))
                    : await redeemAccountLink(db, token, await parseJson(c, accountRequestSchema));
            startSession(c, deps, user.id);
            return c.json(toUser(user));
        });
}
