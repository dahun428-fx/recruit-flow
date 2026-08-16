PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_node_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`iteration` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`gate_decision` text,
	`error` text,
	`started_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_node_runs`("id", "run_id", "node_id", "iteration", "status", "gate_decision", "error", "started_at", "ended_at") SELECT "id", "run_id", "node_id", "iteration", "status", "gate_decision", "error", "started_at", "ended_at" FROM `node_runs`;--> statement-breakpoint
DROP TABLE `node_runs`;--> statement-breakpoint
ALTER TABLE `__new_node_runs` RENAME TO `node_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `runs` ADD `label` text;