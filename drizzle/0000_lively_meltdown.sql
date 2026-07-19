CREATE TABLE `availability` (
	`response_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_response_slot_unique` ON `availability` (`response_id`,`slot_id`);--> statement-breakpoint
CREATE INDEX `availability_slot_idx` ON `availability` (`slot_id`);--> statement-breakpoint
CREATE TABLE `candidate_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_dates_event_date_unique` ON `candidate_dates` (`event_id`,`date`);--> statement-breakpoint
CREATE INDEX `candidate_dates_event_idx` ON `candidate_dates` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`deadline_date` text NOT NULL,
	`access_code_hash` text NOT NULL,
	`admin_token_hash` text NOT NULL,
	`line_group_id` text,
	`line_group_name` text,
	`line_link_code_hash` text,
	`line_link_expires_at` text,
	`reminder_enabled` integer DEFAULT 1 NOT NULL,
	`reminder_sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_admin_token_unique` ON `events` (`admin_token_hash`);--> statement-breakpoint
CREATE INDEX `events_deadline_idx` ON `events` (`deadline_date`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`edit_token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_edit_token_unique` ON `responses` (`edit_token_hash`);--> statement-breakpoint
CREATE INDEX `responses_event_idx` ON `responses` (`event_id`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`candidate_date_id` text NOT NULL,
	`time_option_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_date_id`) REFERENCES `candidate_dates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`time_option_id`) REFERENCES `time_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_event_date_time_unique` ON `slots` (`event_id`,`candidate_date_id`,`time_option_id`);--> statement-breakpoint
CREATE INDEX `slots_event_idx` ON `slots` (`event_id`);--> statement-breakpoint
CREATE TABLE `time_options` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `time_options_event_range_unique` ON `time_options` (`event_id`,`start_time`,`end_time`);--> statement-breakpoint
CREATE INDEX `time_options_event_idx` ON `time_options` (`event_id`);
