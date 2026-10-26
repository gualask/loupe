import type {
    AccountLink,
    AccountTokenInfo,
    AdminUser,
    Role,
    User,
} from '../../shared/api/auth.ts';
import type { Config } from '../config.ts';
import {
    type AccountTokenRow,
    deleteAccountToken,
    deleteAccountTokensOfKind,
    findUsableAccountToken,
    insertAccountToken,
} from '../db/account-tokens.ts';
import type { Db } from '../db/client.ts';
import { deleteUserSessions } from '../db/sessions.ts';
import {
    countUsers,
    findUserById,
    findUserByUsername,
    insertUser,
    type UserRow,
    updateUser,
} from '../db/users.ts';
import { apiError } from '../http.ts';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto.ts';

const HOUR = 60 * 60 * 1000;
const TOKEN_TTL: Record<AccountTokenRow['kind'], number> = {
    setup: 24 * HOUR,
    invite: 48 * HOUR,
    reset: 24 * HOUR,
};

const invalidLink = () =>
    apiError(404, 'invalid_token', 'This link is invalid, expired or already used.');
const wrongLink = () => apiError(400, 'wrong_token_kind', 'This link cannot be used here.');

// Verified when the username does not exist, so response time does not reveal valid usernames.
const DUMMY_PASSWORD_HASH = await hashPassword(randomToken());

export function toUser(row: UserRow): User {
    return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
}

export function toAdminUser(row: UserRow): AdminUser {
    return { ...toUser(row), createdAt: row.createdAt.toISOString(), disabled: !!row.disabledAt };
}

export function createAccountLink(
    db: Db,
    config: Config,
    token: { kind: AccountTokenRow['kind']; role?: Role; userId?: string },
): AccountLink {
    const secret = randomToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL[token.kind]);
    insertAccountToken(db, { ...token, tokenHash: sha256(secret), expiresAt });
    return {
        url: `${config.publicUrl}/${token.kind}/${secret}`,
        expiresAt: expiresAt.toISOString(),
    };
}

/** While no account exists, replaces any previous setup link with a fresh one. */
export function issueSetupLinkIfNeeded(db: Db, config: Config) {
    if (countUsers(db) > 0) return undefined;
    deleteAccountTokensOfKind(db, 'setup');
    return createAccountLink(db, config, { kind: 'setup', role: 'admin' });
}

function usableToken(db: Db, secret: string) {
    const row = findUsableAccountToken(db, sha256(secret));
    if (!row) throw invalidLink();
    return row;
}

export function describeAccountToken(db: Db, secret: string): AccountTokenInfo {
    const row = usableToken(db, secret);
    switch (row.kind) {
        case 'setup':
            return { kind: 'setup', role: 'admin' };
        case 'invite':
            return { kind: 'invite', role: row.role ?? 'editor' };
        case 'reset': {
            const user = row.userId ? findUserById(db, row.userId) : undefined;
            if (!user) throw invalidLink();
            return { kind: 'reset', username: user.username };
        }
    }
}

/** Creates the account for a setup or invite link and consumes the link. */
export async function redeemAccountLink(
    db: Db,
    secret: string,
    input: { username: string; displayName: string; password: string },
) {
    const passwordHash = await hashPassword(input.password);
    return db.transaction(() => {
        const token = usableToken(db, secret);
        if (token.kind === 'reset') throw wrongLink();
        if (token.kind === 'setup' && countUsers(db) > 0) {
            throw apiError(409, 'already_set_up', 'Loupe is already set up. Sign in instead.');
        }
        if (findUserByUsername(db, input.username)) {
            throw apiError(409, 'username_taken', 'This username is taken. Choose another one.');
        }
        const user = insertUser(db, {
            username: input.username,
            displayName: input.displayName,
            passwordHash,
            role: token.kind === 'setup' ? 'admin' : (token.role ?? 'editor'),
        });
        deleteAccountToken(db, token.id);
        return user;
    });
}

/** Sets a new password from a reset link, signs the user out everywhere and consumes the link. */
export async function redeemResetLink(db: Db, secret: string, input: { password: string }) {
    const passwordHash = await hashPassword(input.password);
    return db.transaction(() => {
        const token = usableToken(db, secret);
        const user = token.kind === 'reset' && token.userId && findUserById(db, token.userId);
        if (!user) throw wrongLink();
        if (user.disabledAt) throw apiError(403, 'account_disabled', 'This account is disabled.');
        const updated = updateUser(db, user.id, { passwordHash });
        deleteUserSessions(db, user.id);
        deleteAccountToken(db, token.id);
        return updated ?? user;
    });
}

/** Returns the user when the credentials are valid and the account is enabled. */
export async function checkCredentials(db: Db, username: string, password: string) {
    const user = findUserByUsername(db, username);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    return valid && user && !user.disabledAt ? user : undefined;
}
