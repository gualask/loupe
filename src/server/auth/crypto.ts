import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** 256-bit random secret, base64url encoded. */
export function randomToken() {
    return randomBytes(32).toString('base64url');
}

export function sha256(value: string) {
    return createHash('sha256').update(value).digest('base64url');
}

/** Returns `scrypt$<salt>$<hash>`, both parts base64url encoded. */
export async function hashPassword(password: string) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password, salt, KEY_LENGTH);
    return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
    const [scheme, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64url');
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length);
    return timingSafeEqual(actual, expected);
}
