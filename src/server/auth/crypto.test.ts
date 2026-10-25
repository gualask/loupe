import { argon2 } from 'node:crypto';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './crypto.ts';

describe('password hashing', () => {
    it('stores Argon2id hashes in PHC format with their parameters', async () => {
        const hash = await hashPassword('correct horse battery');
        expect(hash).toMatch(
            /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
        );
        expect(await hashPassword('correct horse battery')).not.toBe(hash);
    });

    it('accepts the right password only', async () => {
        const hash = await hashPassword('correct horse battery');
        expect(await verifyPassword('correct horse battery', hash)).toBe(true);
        expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
        expect(await verifyPassword('', hash)).toBe(false);
    });

    it('verifies hashes made with other parameters', async () => {
        const salt = Buffer.from('0123456789abcdef');
        const params = { memory: 8192, passes: 3, parallelism: 2 };
        const key = await promisify(argon2)('argon2id', {
            message: 'old password',
            nonce: salt,
            tagLength: 32,
            ...params,
        });
        const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
        const stored = `$argon2id$v=19$m=8192,t=3,p=2$${b64(salt)}$${b64(key)}`;
        expect(await verifyPassword('old password', stored)).toBe(true);
        expect(await verifyPassword('new password', stored)).toBe(false);
    });

    it('rejects malformed or foreign hashes', async () => {
        for (const stored of ['', 'scrypt$abc$def', '$argon2i$v=19$m=19456,t=2,p=1$YWJj$ZGVm']) {
            expect(await verifyPassword('anything', stored)).toBe(false);
        }
    });
});
