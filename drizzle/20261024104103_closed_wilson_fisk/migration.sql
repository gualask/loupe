CREATE TABLE `account_tokens` (
	`id` text PRIMARY KEY,
	`token_hash` text NOT NULL UNIQUE,
	`kind` text NOT NULL,
	`role` text,
	`user_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	CONSTRAINT `fk_account_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_account_tokens_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	`author_viewer_id` text,
	`author_user_id` text,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_comments_thread_id_threads_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comments_author_viewer_id_viewers_id_fk` FOREIGN KEY (`author_viewer_id`) REFERENCES `viewers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comments_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `mockup_versions` (
	`id` text PRIMARY KEY,
	`mockup_id` text NOT NULL,
	`number` integer NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`original_filename` text NOT NULL,
	`external_refs` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_mockup_versions_mockup_id_mockups_id_fk` FOREIGN KEY (`mockup_id`) REFERENCES `mockups`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_mockup_versions_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `mockups` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`share_token` text NOT NULL UNIQUE,
	`share_enabled` integer DEFAULT true NOT NULL,
	`share_expires_at` integer,
	`read_only` integer DEFAULT false NOT NULL,
	`current_version_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_mockups_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_mockups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`archived_at` integer,
	CONSTRAINT `fk_projects_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY,
	`version_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`verdict` text,
	`summary` text DEFAULT '' NOT NULL,
	`submitted_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_reviews_version_id_mockup_versions_id_fk` FOREIGN KEY (`version_id`) REFERENCES `mockup_versions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reviews_viewer_id_viewers_id_fk` FOREIGN KEY (`viewer_id`) REFERENCES `viewers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY,
	`version_id` text NOT NULL,
	`kind` text NOT NULL,
	`anchor` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`author_viewer_id` text,
	`author_user_id` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_threads_version_id_mockup_versions_id_fk` FOREIGN KEY (`version_id`) REFERENCES `mockup_versions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_threads_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_threads_author_viewer_id_viewers_id_fk` FOREIGN KEY (`author_viewer_id`) REFERENCES `viewers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_threads_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`username` text NOT NULL UNIQUE,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE TABLE `viewers` (
	`id` text PRIMARY KEY,
	`mockup_id` text NOT NULL,
	`key_hash` text NOT NULL UNIQUE,
	`display_name` text NOT NULL,
	`color_index` integer NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT `fk_viewers_mockup_id_mockups_id_fk` FOREIGN KEY (`mockup_id`) REFERENCES `mockups`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `comments_thread_idx` ON `comments` (`thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mockup_versions_number_idx` ON `mockup_versions` (`mockup_id`,`number`);--> statement-breakpoint
CREATE INDEX `mockups_project_idx` ON `mockups` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_version_viewer_idx` ON `reviews` (`version_id`,`viewer_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `threads_version_idx` ON `threads` (`version_id`);--> statement-breakpoint
CREATE INDEX `viewers_mockup_idx` ON `viewers` (`mockup_id`);