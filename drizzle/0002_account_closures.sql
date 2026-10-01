CREATE TABLE account_closures (
 userId TEXT PRIMARY KEY NOT NULL,
 workspaceId TEXT NOT NULL,
 status TEXT NOT NULL,
 createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_account_closure_workspace ON account_closures(workspaceId);
