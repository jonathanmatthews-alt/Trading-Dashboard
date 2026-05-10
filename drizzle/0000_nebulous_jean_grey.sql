CREATE TABLE `account_transitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`occurred_at` text DEFAULT (current_timestamp) NOT NULL,
	`reason` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`account_type` text NOT NULL,
	`firm_id` integer,
	`program_id` integer,
	`current_stage` text,
	`state` text DEFAULT 'active' NOT NULL,
	`rule_template_id` integer,
	`starting_balance` real NOT NULL,
	`purchased_at` text,
	`activated_at` text,
	`closed_at` text,
	`rule_overrides` text,
	`notes` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_template_id`) REFERENCES `rule_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `accounts_type_state_idx` ON `accounts` (`account_type`,`state`);--> statement-breakpoint
CREATE TABLE `biases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`definition` text,
	`examples` text,
	`recognition_cues` text,
	`countermeasure` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `biases_name_unique` ON `biases` (`name`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`date` text PRIMARY KEY NOT NULL,
	`body` text,
	`mood` integer,
	`sleep_hours` real,
	`tilted` integer
);
--> statement-breakpoint
CREATE TABLE `firms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firms_name_unique` ON `firms` (`name`);--> statement-breakpoint
CREATE TABLE `goal_daily_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`date` text NOT NULL,
	`passed` integer NOT NULL,
	`auto_checked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_daily_checks_idx` ON `goal_daily_checks` (`goal_id`,`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule` text NOT NULL,
	`type` text NOT NULL,
	`mechanical_def` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`symbol` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`tick_size` real NOT NULL,
	`point_value` real NOT NULL,
	`ticks_per_point` real NOT NULL,
	`session_start` text,
	`session_end` text
);
--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`one_liner` text,
	`triggers` text,
	`prevention` text,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_name_unique` ON `mistakes` (`name`);--> statement-breakpoint
CREATE TABLE `news_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`title` text NOT NULL,
	`impact` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer NOT NULL,
	`name` text NOT NULL,
	`starting_balance` real NOT NULL,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rule_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`stage_type` text NOT NULL,
	`stage_display_label` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`profit_target` real,
	`drawdown_type` text,
	`drawdown_amount` real,
	`drawdown_lock_at` real,
	`daily_loss_limit` real,
	`min_trading_days` integer,
	`consistency_pct` real,
	`max_contracts` integer,
	`allowed_instruments_csv` text,
	`news_restrictions` text,
	`payout_cadence_days` integer,
	`payout_minimum` real,
	`first_payout_eligibility_days` integer,
	`first_payout_min_profit` real,
	`activation_fee` real,
	`monthly_fee` real,
	`payout_split_pct` real,
	`payout_buffer_retained` real,
	`notes` text,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rule_templates_program_stage_idx` ON `rule_templates` (`program_id`,`stage_type`,`version`);--> statement-breakpoint
CREATE TABLE `setups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`tier` text,
	`one_liner` text,
	`criteria` text,
	`anti_criteria` text,
	`indicators` text,
	`gotchas` text,
	`plan_entry` text,
	`plan_stop` text,
	`plan_target` text,
	`plan_sizing` text,
	`plan_contexts` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setups_name_unique` ON `setups` (`name`);--> statement-breakpoint
CREATE TABLE `tendencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`one_liner` text,
	`triggers` text,
	`counter_strategy` text,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tendencies_name_unique` ON `tendencies` (`name`);--> statement-breakpoint
CREATE TABLE `todo_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todo_item_id` integer NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`todo_item_id`) REFERENCES `todo_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_checks_idx` ON `todo_checks` (`todo_item_id`,`date`);--> statement-breakpoint
CREATE TABLE `todo_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_event_mistakes` (
	`trade_event_id` integer NOT NULL,
	`mistake_id` integer NOT NULL,
	PRIMARY KEY(`trade_event_id`, `mistake_id`),
	FOREIGN KEY (`trade_event_id`) REFERENCES `trade_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trade_event_tendencies` (
	`trade_event_id` integer NOT NULL,
	`tendency_id` integer NOT NULL,
	PRIMARY KEY(`trade_event_id`, `tendency_id`),
	FOREIGN KEY (`trade_event_id`) REFERENCES `trade_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tendency_id`) REFERENCES `tendencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trade_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument` text NOT NULL,
	`direction` text NOT NULL,
	`entry_time` text NOT NULL,
	`exit_time` text NOT NULL,
	`entry_avg` real NOT NULL,
	`exit_avg` real NOT NULL,
	`mae_points` real NOT NULL,
	`mfe_points` real NOT NULL,
	`initial_stop_points` real NOT NULL,
	`setup_id` integer,
	`note` text,
	`enriched` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`instrument`) REFERENCES `instruments`(`symbol`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`setup_id`) REFERENCES `setups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trade_events_entry_time_idx` ON `trade_events` (`entry_time`);--> statement-breakpoint
CREATE INDEX `trade_events_enriched_idx` ON `trade_events` (`enriched`);--> statement-breakpoint
CREATE TABLE `trade_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_event_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`contracts` integer NOT NULL,
	`override_entry` real,
	`override_exit` real,
	`override_mae_points` real,
	`override_mfe_points` real,
	`override_pnl_dollars` real,
	FOREIGN KEY (`trade_event_id`) REFERENCES `trade_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trade_executions_trade_idx` ON `trade_executions` (`trade_event_id`);--> statement-breakpoint
CREATE INDEX `trade_executions_account_idx` ON `trade_executions` (`account_id`);