CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `folder_id` text REFERENCES folders(id);