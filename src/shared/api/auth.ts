import { z } from 'zod';
import { updateSchema } from './update.ts';

const roleSchema = z.enum(['admin', 'editor']);
export type Role = z.infer<typeof roleSchema>;

const usernameSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, '3–32 characters: letters, digits, dot, dash or underscore');

const passwordSchema = z
    .string()
    .min(10, 'At least 10 characters')
    .max(200, 'At most 200 characters');

const displayNameSchema = z.string().trim().min(1, 'Required').max(64, 'At most 64 characters');

export const loginRequestSchema = z.object({
    username: usernameSchema,
    password: z.string().min(1).max(200),
});

/** Body for setup and invite tokens. */
export const accountRequestSchema = z.object({
    username: usernameSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
});

/** Body for reset tokens. */
export const resetRequestSchema = z.object({ password: passwordSchema });

export const inviteRequestSchema = z.object({ role: roleSchema });

export const updateUserRequestSchema = updateSchema({ role: roleSchema, disabled: z.boolean() });

export type User = {
    id: string;
    username: string;
    displayName: string;
    role: Role;
};

export type AdminUser = User & { createdAt: string; disabled: boolean };

/** What a single-use account link is for, returned before the form is submitted. */
export type AccountTokenInfo =
    | { kind: 'setup'; role: 'admin' }
    | { kind: 'invite'; role: Role }
    | { kind: 'reset'; username: string };

export type AccountLink = { url: string; expiresAt: string };
