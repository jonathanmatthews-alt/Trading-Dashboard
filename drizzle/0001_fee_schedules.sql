CREATE TABLE `fee_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer NOT NULL,
	`instrument` text NOT NULL,
	`stage_type` text,
	`fee_per_rt_per_contract` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument`) REFERENCES `instruments`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fee_schedules_firm_inst_idx` ON `fee_schedules` (`firm_id`,`instrument`,`stage_type`);
