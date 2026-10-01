CREATE TABLE `assistant_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`actor` text NOT NULL,
	`caseId` text,
	`mode` text NOT NULL,
	`sourceIds` text NOT NULL,
	`tokens` integer NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assistant_actor_time` ON `assistant_runs` (`actor`,`createdAt`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`caseId` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_case` ON `audit` (`caseId`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`ref` text NOT NULL,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`assignedTo` text NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`reviewNote` text NOT NULL,
	`lastOperation` text,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignedTo`) REFERENCES `members`(`userId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cases_workspace_status` ON `cases` (`workspaceId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cases_assigned` ON `cases` (`workspaceId`,`assignedTo`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`caseId` text NOT NULL,
	`actor` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`objectKey` text NOT NULL,
	`sha256` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_files_case` ON `files` (`caseId`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_email` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`version` integer NOT NULL,
	`updatedAt` text NOT NULL,
	`sample` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_workspace` ON `knowledge` (`workspaceId`);--> statement-breakpoint
CREATE TABLE `members` (
	`userId` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_members_workspace` ON `members` (`workspaceId`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`caseId` text NOT NULL,
	`requestHash` text NOT NULL,
	`response` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`caseId` text NOT NULL,
	`actor` text NOT NULL,
	`data` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_visits_case` ON `visits` (`caseId`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` text NOT NULL
);
