import { Hono } from 'hono';
import type { z } from 'zod';
import { inviteRequestSchema, updateUserRequestSchema } from '../../shared/api/auth.ts';
import { createAccountLink, isActive, toAdminUser } from '../auth/accounts.ts';
import { currentAdmin, requireAdmin } from '../auth/session.ts';
import { deleteInvitesCreatedBy, deleteResetTokensOfUser } from '../db/account-tokens.ts';
import { atomically, type Db } from '../db/client.ts';
import { deleteUserSessions } from '../db/sessions.ts';
import { findUserById, listUsers, type UserRow, updateUser } from '../db/users.ts';
import { apiError, notFound, parseJson } from '../http.ts';
import type { AppDeps, AppEnv } from '../types.ts';

type UserChanges = z.infer<typeof updateUserRequestSchema>;

/** When the account is disabled after the change: kept from earlier, now, or never. */
function disabledAtAfter({ disabled }: UserChanges, user: UserRow) {
    if (disabled === undefined) return undefined;
    return disabled ? (user.disabledAt ?? new Date()) : null;
}

/** Takes away what a changed account must no longer be able to use. */
function revokeLostAccess(db: Db, userId: string, { role, disabled }: UserChanges) {
    if (disabled) {
        deleteUserSessions(db, userId);
        // They would work again if the account were enabled before they expire.
        deleteResetTokensOfUser(db, userId);
    }
    // Whoever stops being an admin keeps no invite to come back with.
    if (disabled || role === 'editor') deleteInvitesCreatedBy(db, userId);
}

export function adminRoutes(deps: AppDeps) {
    const { db, config } = deps;
    return new Hono<AppEnv>()
        .use(requireAdmin)
        .get('/users', (c) => c.json(listUsers(db).map(toAdminUser)))
        .post('/invites', async (c) => {
            const { role } = await parseJson(c, inviteRequestSchema);
            const link = atomically(db, () =>
                createAccountLink(db, config, {
                    kind: 'invite',
                    role,
                    createdBy: currentAdmin(c, deps).id,
                }),
            );
            return c.json(link, 201);
        })
        .post('/users/:id/reset-link', (c) => {
            const user = findUserById(db, c.req.param('id'));
            if (!user) throw notFound();
            if (!isActive(user))
                throw apiError(409, 'account_disabled', 'This account is disabled.');
            const link = createAccountLink(db, config, { kind: 'reset', userId: user.id });
            return c.json(link, 201);
        })
        .patch('/users/:id', async (c) => {
            const changes = await parseJson(c, updateUserRequestSchema);
            const updated = atomically(db, () => {
                const admin = currentAdmin(c, deps);
                const user = findUserById(db, c.req.param('id'));
                if (!user) throw notFound();
                // An admin cannot demote or disable themselves, so at least one admin always remains.
                if (user.id === admin.id) {
                    throw apiError(
                        409,
                        'cannot_modify_self',
                        'You cannot change your own account.',
                    );
                }
                const row = updateUser(db, user.id, {
                    role: changes.role,
                    disabledAt: disabledAtAfter(changes, user),
                });
                revokeLostAccess(db, user.id, changes);
                return row ?? user;
            });
            return c.json(toAdminUser(updated));
        });
}
