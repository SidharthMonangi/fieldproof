CREATE TABLE file_cleanup (
 id TEXT PRIMARY KEY NOT NULL,
 workspaceId TEXT NOT NULL,
 objectKeys TEXT NOT NULL,
 createdAt TEXT NOT NULL
);
CREATE INDEX idx_file_cleanup_workspace ON file_cleanup(workspaceId);
