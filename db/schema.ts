// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const fileCleanup = sqliteTable('file_cleanup', {
  id: text().primaryKey(), workspaceId: text().notNull(),
  objectKeys: text().notNull(), createdAt: text().notNull(),
}, table => [index('idx_file_cleanup_workspace').on(table.workspaceId)]);
export const workspaces = sqliteTable('workspaces', {
  id: text().primaryKey(),
  name: text().notNull(),
  createdAt: text().notNull(),
});
export const members = sqliteTable(
  'members',
  {
    userId: text().primaryKey(),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id),
    email: text().notNull(),
    name: text().notNull(),
    role: text().notNull(),
  },
  (t) => [
    index('idx_members_workspace').on(t.workspaceId),
    uniqueIndex('idx_members_email').on(t.email),
  ],
);
export const invitations = sqliteTable(
  'invitations',
  {
    id: text().primaryKey(),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id),
    email: text().notNull(),
    role: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('idx_invitations_email').on(t.email)],
);
export const cases = sqliteTable(
  'cases',
  {
    id: text().primaryKey(),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id),
    ref: text().notNull(),
    data: text().notNull(),
    status: text().notNull(),
    version: integer().notNull(),
    assignedTo: text()
      .notNull()
      .references(() => members.userId),
    createdBy: text().notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    reviewNote: text().notNull(),
    lastOperation: text(),
  },
  (t) => [
    index('idx_cases_workspace_status').on(t.workspaceId, t.status),
    index('idx_cases_assigned').on(t.workspaceId, t.assignedTo),
  ],
);
export const visits = sqliteTable(
  'visits',
  {
    id: text().primaryKey(),
    caseId: text()
      .notNull()
      .references(() => cases.id),
    actor: text().notNull(),
    data: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [index('idx_visits_case').on(t.caseId)],
);
export const files = sqliteTable(
  'files',
  {
    id: text().primaryKey(),
    caseId: text()
      .notNull()
      .references(() => cases.id),
    actor: text().notNull(),
    name: text().notNull(),
    kind: text().notNull(),
    mime: text().notNull(),
    size: integer().notNull(),
    objectKey: text().notNull(),
    sha256: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [index('idx_files_case').on(t.caseId)],
);
export const audit = sqliteTable(
  'audit',
  {
    id: text().primaryKey(),
    caseId: text()
      .notNull()
      .references(() => cases.id),
    actor: text().notNull(),
    action: text().notNull(),
    detail: text().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [index('idx_audit_case').on(t.caseId)],
);
export const mutations = sqliteTable('mutations', {
  id: text().primaryKey(),
  workspaceId: text().notNull(),
  caseId: text().notNull(),
  requestHash: text().notNull(),
  response: text().notNull(),
  createdAt: text().notNull(),
});
export const knowledge = sqliteTable(
  'knowledge',
  {
    id: text().primaryKey(),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id),
    title: text().notNull(),
    body: text().notNull(),
    category: text().notNull(),
    version: integer().notNull(),
    updatedAt: text().notNull(),
    sample: integer().notNull(),
  },
  (t) => [index('idx_knowledge_workspace').on(t.workspaceId)],
);
export const assistantRuns = sqliteTable(
  'assistant_runs',
  {
    id: text().primaryKey(),
    workspaceId: text().notNull(),
    actor: text().notNull(),
    caseId: text(),
    mode: text().notNull(),
    sourceIds: text().notNull(),
    tokens: integer().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [index('idx_assistant_actor_time').on(t.actor, t.createdAt)],
);
export const accountClosures = sqliteTable('account_closures', {
  userId: text().primaryKey(),
  workspaceId: text().notNull(),
  status: text().notNull(),
  createdAt: text().notNull(),
}, t => [uniqueIndex('idx_account_closure_workspace').on(t.workspaceId)]);
