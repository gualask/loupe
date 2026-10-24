import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { PinAnchor } from '../../shared/anchor.ts';

const id = () => text('id').primaryKey();
const createdAt = () =>
    integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`);
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const users = sqliteTable('users', {
    id: id(),
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'editor'] }).notNull(),
    createdAt: createdAt(),
    disabledAt: timestamp('disabled_at'),
});

export const sessions = sqliteTable(
    'sessions',
    {
        idHash: text('id_hash').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: createdAt(),
        expiresAt: timestamp('expires_at').notNull(),
        lastSeenAt: timestamp('last_seen_at').notNull(),
    },
    (t) => [index('sessions_user_idx').on(t.userId)],
);

export const accountTokens = sqliteTable('account_tokens', {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    kind: text('kind', { enum: ['setup', 'invite', 'reset'] }).notNull(),
    // Role granted by an invite or setup token.
    role: text('role', { enum: ['admin', 'editor'] }),
    // Target account of a reset token.
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
});

export const projects = sqliteTable(
    'projects',
    {
        id: id(),
        ownerId: text('owner_id')
            .notNull()
            .references(() => users.id),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        createdAt: createdAt(),
        archivedAt: timestamp('archived_at'),
    },
    (t) => [index('projects_owner_idx').on(t.ownerId)],
);

export const mockups = sqliteTable(
    'mockups',
    {
        id: id(),
        projectId: text('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        shareToken: text('share_token').notNull().unique(),
        shareEnabled: integer('share_enabled', { mode: 'boolean' }).notNull().default(true),
        shareExpiresAt: timestamp('share_expires_at'),
        readOnly: integer('read_only', { mode: 'boolean' }).notNull().default(false),
        // Not a foreign key: versions reference mockups, and SQLite cannot add the cycle later.
        currentVersionId: text('current_version_id'),
        createdBy: text('created_by')
            .notNull()
            .references(() => users.id),
        createdAt: createdAt(),
    },
    (t) => [index('mockups_project_idx').on(t.projectId)],
);

export const mockupVersions = sqliteTable(
    'mockup_versions',
    {
        id: id(),
        mockupId: text('mockup_id')
            .notNull()
            .references(() => mockups.id, { onDelete: 'cascade' }),
        number: integer('number').notNull(),
        sha256: text('sha256').notNull(),
        sizeBytes: integer('size_bytes').notNull(),
        originalFilename: text('original_filename').notNull(),
        externalRefs: text('external_refs', { mode: 'json' }).$type<string[]>().notNull(),
        uploadedBy: text('uploaded_by')
            .notNull()
            .references(() => users.id),
        createdAt: createdAt(),
    },
    (t) => [uniqueIndex('mockup_versions_number_idx').on(t.mockupId, t.number)],
);

export const viewers = sqliteTable(
    'viewers',
    {
        id: id(),
        mockupId: text('mockup_id')
            .notNull()
            .references(() => mockups.id, { onDelete: 'cascade' }),
        keyHash: text('key_hash').notNull().unique(),
        displayName: text('display_name').notNull(),
        colorIndex: integer('color_index').notNull(),
        createdAt: createdAt(),
        lastSeenAt: timestamp('last_seen_at').notNull(),
    },
    (t) => [index('viewers_mockup_idx').on(t.mockupId)],
);

export const reviews = sqliteTable(
    'reviews',
    {
        id: id(),
        versionId: text('version_id')
            .notNull()
            .references(() => mockupVersions.id, { onDelete: 'cascade' }),
        viewerId: text('viewer_id')
            .notNull()
            .references(() => viewers.id, { onDelete: 'cascade' }),
        status: text('status', { enum: ['in_progress', 'submitted'] })
            .notNull()
            .default('in_progress'),
        verdict: text('verdict', { enum: ['approved', 'changes_requested'] }),
        summary: text('summary').notNull().default(''),
        submittedAt: timestamp('submitted_at'),
        createdAt: createdAt(),
    },
    (t) => [uniqueIndex('reviews_version_viewer_idx').on(t.versionId, t.viewerId)],
);

export const threads = sqliteTable(
    'threads',
    {
        id: id(),
        versionId: text('version_id')
            .notNull()
            .references(() => mockupVersions.id, { onDelete: 'cascade' }),
        kind: text('kind', { enum: ['pin', 'general'] }).notNull(),
        anchor: text('anchor', { mode: 'json' }).$type<PinAnchor>(),
        status: text('status', { enum: ['open', 'resolved'] })
            .notNull()
            .default('open'),
        resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
        resolvedAt: timestamp('resolved_at'),
        authorViewerId: text('author_viewer_id').references(() => viewers.id, {
            onDelete: 'cascade',
        }),
        authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
        createdAt: createdAt(),
    },
    (t) => [index('threads_version_idx').on(t.versionId)],
);

export const comments = sqliteTable(
    'comments',
    {
        id: id(),
        threadId: text('thread_id')
            .notNull()
            .references(() => threads.id, { onDelete: 'cascade' }),
        authorViewerId: text('author_viewer_id').references(() => viewers.id, {
            onDelete: 'cascade',
        }),
        authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
        body: text('body').notNull(),
        createdAt: createdAt(),
        editedAt: timestamp('edited_at'),
        deletedAt: timestamp('deleted_at'),
    },
    (t) => [index('comments_thread_idx').on(t.threadId)],
);
