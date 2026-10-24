import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
    LOUPE_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOUPE_DATA_DIR: z.string().min(1).default('./data'),
    LOUPE_PUBLIC_URL: z.url().optional(),
    LOUPE_MAX_UPLOAD_MB: z.coerce.number().positive().default(20),
    LOUPE_MOCKUP_EXTERNAL: z.enum(['block', 'allow']).default('block'),
    LOUPE_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
        throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
    }
    const e = parsed.data;
    const publicUrl = new URL(e.LOUPE_PUBLIC_URL ?? `http://localhost:${e.LOUPE_PORT}`);
    return {
        port: e.LOUPE_PORT,
        dataDir: path.resolve(e.LOUPE_DATA_DIR),
        publicUrl: publicUrl.origin,
        secureCookies: publicUrl.protocol === 'https:',
        maxUploadBytes: Math.round(e.LOUPE_MAX_UPLOAD_MB * 1024 * 1024),
        mockupExternal: e.LOUPE_MOCKUP_EXTERNAL,
        sessionTtlMs: e.LOUPE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    };
}
