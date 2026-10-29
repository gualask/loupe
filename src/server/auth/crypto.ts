import { argon2, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { apiError } from '../http.ts';
import { createConcurrencyLimiter } from '../rate-limit.ts';

const argon2Async = promisify(argon2);

// Login attempts with ever different usernames escape the per-username limit, and each one costs
// a hash. Hashes run on libuv's thread pool (4 threads by default), which also reads files such as
// mockups: two at a time leave it room, and a short queue absorbs bursts of real sign-ins.
const hashing = createConcurrencyLimiter({ max: 2, queue: 20 });

function argon2id(params: Parameters<typeof argon2Async>[1]) {
    const result = hashing.tryRun(() => argon2Async('argon2id', params));
    if (!result) throw apiError(503, 'server_busy', 'The server is busy. Retry in a moment.');
    return result;
}

// OWASP's minimum for Argon2id: 19 MiB of memory, 2 passes, 1 lane. Each hash holds that memory
// only while it runs (~tens of ms); the parameters are stored in the hash, so they can be raised
// later without breaking existing passwords.
const PARAMS = { memory: 19 * 1024, passes: 2, parallelism: 1 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/** 256-bit random secret, base64url encoded. */
export function randomToken() {
    return randomBytes(32).toString('base64url');
}

export function sha256(value: string) {
    return createHash('sha256').update(value).digest('base64url');
}

// PHC string format, as written by other Argon2 implementations: unpadded standard base64.
const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** Returns `$argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<hash>`. */
export async function hashPassword(password: string) {
    const salt = randomBytes(SALT_BYTES);
    const hash = await argon2id({
        message: password,
        nonce: salt,
        tagLength: HASH_BYTES,
        ...PARAMS,
    });
    const { memory, passes, parallelism } = PARAMS;
    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${b64(salt)}$${b64(hash)}`;
}

/** Checks a password against a stored hash, with the parameters the hash was made with. */
export async function verifyPassword(password: string, stored: string) {
    const match = PHC.exec(stored);
    if (!match) return false;
    const [, memory, passes, parallelism, salt = '', hash = ''] = match;
    const expected = Buffer.from(hash, 'base64');
    const actual = await argon2id({
        message: password,
        nonce: Buffer.from(salt, 'base64'),
        tagLength: expected.length,
        memory: Number(memory),
        passes: Number(passes),
        parallelism: Number(parallelism),
    });
    return timingSafeEqual(actual, expected);
}
