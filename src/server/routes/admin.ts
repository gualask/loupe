import { Hono } from 'hono';
import { inviteRequestSchema, updateUserRequestSchema } from '../../shared/api/auth.ts';
import { createAccountLink, toAdminUser } from '../auth/accounts.ts';
import { requireAdmin, signedInUser } from '../auth/session.ts';
import { deleteUserSessions } from '../db/sessions.ts';
import { findUserById, listUsers, updateUser } from '../db/users.ts';
import { apiError, parseJson } from '../http.ts';
import type { AppDeps, AppEnv } from '../types.ts';

export function adminRoutes({ db, config }: AppDeps) {
    return new Hono<AppEnv>()
        .use(requireAdmin)
        .get('/users', (c) => c.json(listUsers(db).map(toAdminUser)))
        .post('/invites', async (c) => {
            const { role } = await parseJson(c, inviteRequestSchema);
            const link = createAccountLink(db, config, {
                kind: 'invite',
                role,
                createdBy: signedInUser(c).id,
            });
            return c.json(link, 201);
        })
        .post('/users/:id/reset-link', (c) => {
            const user = findUserById(db, c.req.param('id'));
            if (!user) throw apiError(404, 'not_found');
            if (user.disabledAt) throw apiError(409, 'account_disabled');
            const link = createAccountLink(db, config, {
                kind: 'reset',
                userId: user.id,
                createdBy: signedInUser(c).id,
            });
            return c.json(link, 201);
        })
        .patch('/users/:id', async (c) => {
            const changes = await parseJson(c, updateUserRequestSchema);
            const user = findUserById(db, c.req.param('id'));
            if (!user) throw apiError(404, 'not_found');
            // An admin cannot demote or disable themselves, so at least one admin always remains.
            if (user.id === signedInUser(c).id) throw apiError(409, 'cannot_modify_self');
            const updated = db.transaction(() => {
                const row = updateUser(db, user.id, {
                    role: changes.role,
                    disabledAt:
                        changes.disabled === undefined
                            ? undefined
                            : changes.disabled
                              ? (user.disabledAt ?? new Date())
                              : null,
                });
                if (changes.disabled) deleteUserSessions(db, user.id);
                return row;
            });
            return c.json(toAdminUser(updated ?? user));
        });
}
