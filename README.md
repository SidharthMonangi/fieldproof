# FieldProof

Housing fieldwork with recoverable offline drafts, evidence review and a source-checked handbook assistant.

**[Open the live app](https://fieldproof.sidharthmonangi.chatgpt.site)** · [Two-minute walkthrough](docs/RECRUITER-WALKTHROUGH.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification evidence](docs/RELEASE-CHECKS.md)

Sign in with GitHub. Each new account receives a private workspace unless its email has a pending team invitation. Use the clearly labelled fictional starter cases to explore the workflow.

## What the application does

- Stores cases, consent, assignments, visits, evidence and review history in persistent D1/R2 storage.
- Supports administrator, field-officer and reviewer roles with server-side workspace and assignment checks.
- Saves IndexedDB drafts and attachment bytes before syncing. Stable operation IDs and server receipts prevent retry duplicates; version checks surface conflicts for explicit resolution.
- Gates submission on evidence completeness. Reviewers can request changes or verify evidence; these are separate from lending decisions.
- Retrieves versioned handbook passages and generates bounded Gemini answers whose cited quotations are checked against the original text. Unsupported questions and provider failures return source material or abstain.
- Imports a small allowlist of official PIB and BEE references with publication dates, fetch times and explicit snapshot labels.
- Exports workspace records and attachment bytes with SHA-256 checksums. In-app restoration adds new draft copies, requires fresh consent and visit confirmation, and never imports team permissions.
- Provides permanent deletion for archived cases, durable attachment cleanup, and account deletion for empty personal workspaces.
- Exposes a minimal health endpoint at `/api/status`. An hourly GitHub Actions workflow checks the app and database without authentication secrets.

## Where to look first

Open Sync centre, pause syncing, edit a fictional case, and resume. Then read [lib/operations.ts](lib/operations.ts) and [lib/device.ts](lib/device.ts) for version checks, atomic mutation receipts and conflict recovery. For backup integrity and safe recovery, read [lib/backup.ts](lib/backup.ts) and [app/api/restore/route.ts](app/api/restore/route.ts).

## Run locally

Requires Node.js 22.13+ and Python 3.12+ for recovery tests.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. Configure your own Supabase URL and publishable key, and optionally a Gemini key. Account deletion also requires a server-only Supabase secret key. Never commit secrets.
3. Run `npm run build`.
4. Apply the SQL files in `drizzle/` once, in numeric order, using the generated Worker configuration. For example:

   `node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aromatic_unus.sql`

5. Copy `.env.local` to `dist/server/.dev.vars` for the local Worker, then run `npm start`. Repeat that copy after rebuilding. This file is local-only and must be removed before packaging a deployment.
6. Add your local `/auth/callback` URL to your own Supabase redirect allowlist and sign in. Load fictional starter cases or create sample records.

The provided Sites manifest belongs to the original hosted project. Forks must use their own hosting project and provider configuration. A static host alone cannot run the server APIs.

## Verification

- `npm test` — 24 domain, provider, source and backup tests.
- `python -m unittest discover -s tests -p 'test_*.py'` — 13 isolated recovery and account-deletion eligibility tests.
- `npm run typecheck` and `npm run build`.
- `node tests/maintenance.integration.mjs` — 37 local maintenance checks, including restoration, role boundaries, checksum rejection and retry deduplication. This requires an isolated loopback Worker with fictional trusted-header identities, never public authentication bypasses.
- `tests/hosted.integration.mjs` is an explicit opt-in destructive test limited to freshly created disposable accounts. It requires a private local admin key and deletes only its own test workspaces and accounts. Do not put that key into CI.

GitHub sign-in, hosted sessions, generated cited answers, official source fetching, account separation, PDF storage, backup checksums and disposable account deletion were verified on the deployed origin. See the release evidence for the exact scope and remaining browser checks.

## Recovery bounds

In-app imports accept at most 20 cases, 50 visits, 100 history entries, 40 attachments, 40 guidance entries and 10 MB of attachment bytes within a 16 MB request. Export supports up to 25 MB of attachments. Larger backups can be validated into a new isolated SQLite/object folder with `python scripts/restore-backup.py backup.json new-recovery-folder`.

Restored records receive new IDs and are assigned to the restoring administrator. Current records remain unchanged. Imported guidance is labelled sample material. If restoration is interrupted, unused objects are tracked for cleanup; an active restore is protected from manual cleanup for ten minutes. A stable restore request ID prevents retry duplicates.

## Monitoring and operational limits

The hourly workflow uses a standard Ubuntu runner with read-only repository permissions and no credentials. GitHub schedules can be delayed; this is a portfolio uptime check, not a service-level guarantee. Failure notifications follow the repository owner's GitHub Actions notification settings.

GitHub sign-in is the supported public login; email sign-in was excluded after an unsuccessful Gmail SMTP trial. User-assisted hosted browser checks demonstrated photo upload, persistence after reload and download, cached offline reload, a device-preserved visit, and reconnection with one synced visit. Final confirmation of an empty queue after reload remains outstanding. Uploaded signatures are checked, but antivirus scanning and document authenticity verification are not implemented. Real customer use requires approved procedures, consent and retention policies, device protection, and independent security review.

Gemini receives handbook questions and selected passages, not applicant records or attachments. Free-tier quotas and provider data-use terms apply. Exact citation checking establishes provenance, not that every generated sentence is correct. This application does not approve credit, verify identity, certify buildings or claim regulatory compliance.

## Stack

React, TypeScript, Vinext, Supabase Auth, Cloudflare D1/R2, IndexedDB and server-side Gemini. MIT licensed; see [LICENSE](LICENSE).
