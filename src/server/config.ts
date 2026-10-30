import path from 'node:path';
import { z } from 'zod';
import {
    MOCKUP_PERMISSIONS,
    type MockupPermissions,
    mockupPermissionVariable,
} from '../shared/mockup-permissions.ts';

// Each mockup permission is blocked unless its variable (mockupPermissionVariable) says `allow`.
const permission = z.enum(['block', 'allow']).default('block');

const envSchema = z.object({
    LOUPE_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOUPE_DATA_DIR: z.string().min(1).default('./data'),
    LOUPE_PUBLIC_URL: z.url().optional(),
    LOUPE_MAX_UPLOAD_MB: z.coerce.number().positive().default(20),
    LOUPE_MOCKUP_EXTERNAL: permission,
    LOUPE_MOCKUP_FORMS: permission,
    LOUPE_MOCKUP_EVAL: permission,
    LOUPE_MOCKUP_MODALS: permission,
    LOUPE_MOCKUP_DOWNLOADS: permission,
    LOUPE_MOCKUP_CLIPBOARD: permission,
    LOUPE_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
        throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
    }
    const e = parsed.data;
    const mockupPermissions = Object.fromEntries(
        MOCKUP_PERMISSIONS.map((name) => [name, e[mockupPermissionVariable(name)] === 'allow']),
    ) as MockupPermissions;
    const publicUrl = new URL(e.LOUPE_PUBLIC_URL ?? `http://localhost:${e.LOUPE_PORT}`);
    return {
        port: e.LOUPE_PORT,
        dataDir: path.resolve(e.LOUPE_DATA_DIR),
        publicUrl: publicUrl.origin,
        secureCookies: publicUrl.protocol === 'https:',
        maxUploadBytes: Math.round(e.LOUPE_MAX_UPLOAD_MB * 1024 * 1024),
        mockupPermissions,
        sessionTtlMs: e.LOUPE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    };
}
