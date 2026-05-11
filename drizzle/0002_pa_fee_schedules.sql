-- Rebuild fee_schedules: firm_id becomes nullable, add account_id, add second index.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `fee_schedules_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer,
	`account_id` integer,
	`instrument` text NOT NULL,
	`stage_type` text,
	`fee_per_rt_per_contract` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument`) REFERENCES `instruments`(`symbol`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `fee_schedules_new` (`id`, `firm_id`, `account_id`, `instrument`, `stage_type`, `fee_per_rt_per_contract`, `notes`)
  SELECT `id`, `firm_id`, NULL, `instrument`, `stage_type`, `fee_per_rt_per_contract`, `notes` FROM `fee_schedules`;
--> statement-breakpoint
DROP TABLE `fee_schedules`;
--> statement-breakpoint
ALTER TABLE `fee_schedules_new` RENAME TO `fee_schedules`;
--> statement-breakpoint
CREATE INDEX `fee_schedules_firm_inst_idx` ON `fee_schedules` (`firm_id`,`instrument`,`stage_type`);
--> statement-breakpoint
CREATE INDEX `fee_schedules_acct_inst_idx` ON `fee_schedules` (`account_id`,`instrument`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
