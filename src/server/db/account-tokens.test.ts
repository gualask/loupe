import { describe, expect, it } from 'vitest';
import {
    deleteAccountTokensOfKind,
    deleteExpiredAccountTokens,
    findUsableAccountToken,
    insertAccountToken,
} from './account-tokens.ts';
import { openDb } from './client.ts';

const tokenHashes = (db: ReturnType<typeof openDb>) =>
    db.$client.prepare('SELECT token_hash FROM account_tokens ORDER BY token_hash').all();

describe('account tokens', () => {
    it('finds tokens only until they expire', () => {
        const db = openDb(':memory:');
        insertAccountToken(db, {
            tokenHash: 'usable',
            kind: 'invite',
            expiresAt: new Date(Date.now() + 60_000),
        });
        insertAccountToken(db, { tokenHash: 'expired', kind: 'invite', expiresAt: new Date(0) });
        expect(findUsableAccountToken(db, 'usable')).toMatchObject({ tokenHash: 'usable' });
        expect(findUsableAccountToken(db, 'expired')).toBeUndefined();
    });

    it('deletes expired tokens and keeps usable ones', () => {
        const db = openDb(':memory:');
        insertAccountToken(db, {
            tokenHash: 'usable',
            kind: 'invite',
            expiresAt: new Date(Date.now() + 60_000),
        });
        insertAccountToken(db, { tokenHash: 'expired', kind: 'invite', expiresAt: new Date(0) });
        deleteExpiredAccountTokens(db);
        expect(tokenHashes(db)).toEqual([{ token_hash: 'usable' }]);
    });

    it('deletes every token of one kind', () => {
        const db = openDb(':memory:');
        const later = new Date(Date.now() + 60_000);
        insertAccountToken(db, { tokenHash: 'setup', kind: 'setup', expiresAt: later });
        insertAccountToken(db, { tokenHash: 'invite', kind: 'invite', expiresAt: later });
        deleteAccountTokensOfKind(db, 'setup');
        expect(tokenHashes(db)).toEqual([{ token_hash: 'invite' }]);
    });
});
