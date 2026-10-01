# Public-use release status

GitHub/email authentication is being added through Supabase Auth. This is not yet a verified public release.

Implemented in this pass:
- GitHub OAuth and email magic-link sign-in screen with PKCE callback.
- Server-side `getUser()` verification; configured Supabase authentication never falls back to hosting identity headers.
- Roles remain in the private workspace database, never in editable user metadata.
- Server sign-out and no-store authentication callback responses.
- Seven-day invitation expiry and renewal.
- Atomic generated-answer reservations capped at 20 per user, 60 per workspace and 200 across the application per hour. These are request limits, not billing guarantees.

Verification: 16 unit tests passed before authentication changes; authentication code passes TypeScript checking. Real GitHub/email sign-in, session renewal, invitations and independent-account isolation must be tested against the configured provider before release.

Provider setup required:
1. Create the approved Supabase project; save its URL and publishable key as SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Never use a service-role key in the browser.
2. Enable GitHub OAuth with the owner's GitHub OAuth credentials. Register the provider callback shown by Supabase and the exact FieldProof origin/auth/callback redirect.
3. Configure production email delivery and provider abuse protection before opening email registration to the public.
4. Verify cookies refresh in this Worker runtime, login expiry, failed callback, sign-out and two separate users.

Still required: workspace export/deletion lifecycle, backup and restore drill, monitoring, public resource quotas, hosted security and end-to-end checks. Existing sample guidance remains portfolio material, not approved organisational procedures.

The source ZIP from the previous handoff predates this ongoing public-use work.

## GitHub login verification — 1 October 2026
GitHub provider enabled in Supabase. A real GitHub login completed, the server created an empty administrator workspace, and the authenticated workspace persisted after a browser reload. The local preview proxy now preserves separate Set-Cookie headers and rewrites its internal callback redirect to the public preview origin. The proxy no longer injects a fictional identity. No session cookies or OAuth secrets were recorded in source. This verifies one real account locally, not independent-account isolation or hosted authentication.


## Workspace export pass
Administrator-only /api/export provides a consistent D1 record snapshot and attachment bytes, verifies each attachment size and SHA-256, and rejects exports exceeding 25 MB of attachments. Pending device changes must be synced before export. Email sign-in UI is disabled by default pending production delivery configuration. Unit tests and production build pass. Real-account export returned HTTP 200 locally, but the in-app browser download failed to complete; file verification and restore drill remain unverified. User has only one GitHub account, so two-real-account privacy verification remains pending. Deletion and monitoring implementation remain outstanding.

## Recovery and deletion verification — 1 October 2026
- 23 loopback maintenance integration checks passed with fictional identities on a separate test Worker. Verified administrator-only export, anonymous/officer denial, attachment bytes and digest, active-case deletion refusal, cross-workspace denial, typed confirmation, stale-version refusal, removal of archived records and completed file cleanup.
- Exported one fictional case and attachment from the actual server and restored them into a new isolated SQLite/object folder. Running application data was not replaced.
- Six Python recovery tests passed, including tampering, unsafe paths, cross-workspace records, duplicate attachments and existing destination protection.
- Administrator service checks report database reachability, configuration presence and pending cleanup jobs. Unexpected errors have correlation IDs without logging applicant data. External alerting and uptime monitoring are not configured.
- New migration: drizzle/0001_file_cleanup.sql. Applied locally only. Apply once on hosting before using maintenance.
- Permanent deletion removes archived case records and retains durable file cleanup jobs until R2 deletion succeeds. Administrators can retry. It does not delete the Supabase account or an entire workspace. Offline copies on other devices cannot be remotely erased; downloaded backups remain with their owners.
- Recovery is an operator tool, not a live browser import. Production restoration into D1/R2 and a hosted restore drill remain pending.
- In-app browser download automation remains unreliable; ordinary-browser download verification is still needed.
