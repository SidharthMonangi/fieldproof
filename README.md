# FieldProof

Offline-capable housing fieldwork, evidence review and a source-backed handbook assistant.

FieldProof is a complete working portfolio application: cases and visits persist in a server database, attachments persist in object storage, and field officers can keep working through interrupted connectivity. It is not a credit-approval system or a lender-approved procedure.

## What works

- Authenticated personal workspaces with administrator, officer and reviewer permissions.
- Applicant cases, assignments, consent recording and mobile field-visit forms.
- PDF/image evidence uploads, photo resizing, metadata removal and protected downloads.
- Draft, submitted, changes requested, verified and archived case states.
- Checklist-gated submission, written review explanations and an append-only activity history.
- IndexedDB drafts and operation queues that survive reloads, including attachment bytes.
- Stable mutation identifiers, saved receipts, safe retries and explicit conflict resolution.
- Installable application shell with offline recovery after an initial connected visit.
- Versioned handbook entries, deterministic case checklist tools, supported-source retrieval and Gemini-generated answers with optional OpenAI support.
- Unsent-work backups, case exports, private key handling and provider-failure fallbacks.

## Two-minute review

Open a fictional case, pause sync in Sync centre, record a visit and reload. Resume sync and confirm that one visit arrives. Then read `lib/operations.ts` to see how version checks, conditional inserts and atomic receipts prevent silent overwrites and duplicates.

See [the walkthrough](docs/RECRUITER-WALKTHROUGH.md) and [architecture and limitations](docs/ARCHITECTURE.md).

## Local development

Requires Node.js 22.13 or newer. The application uses the provided Vinext/Cloudflare starter and npm lockfile.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set the server-only Gemini key (OpenAI is optional). Never commit it.
3. Run `npm run build` to generate the local Worker configuration.
4. Apply each generated migration once, in order:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aromatic_unus.sql`

5. Run `npm run dev` and open the printed local URL.
6. Choose Open your workspace. Portable development uses the fictional local account `Seedy`; this mock sign-in is not included in production.
7. Load fictional starter cases from an empty workspace, or create your own sample data.

The production build needs Cloudflare D1 (`DB`), R2 (`BUCKET`) and trusted dispatcher identity headers. Sites supplies these on deployment. A plain static host cannot run this application.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run test:integration` with the local development server running
- Set `FIELDPROOF_TEST_AI=1` to opt into one provider request during integration checks.
- `npm run build`

The integration suite checks real local D1/R2 persistence, duplicate retries, concurrent edits, downloads, submission prerequisites, review transitions, audit counts and cross-site/anonymous rejection. It creates fictional fixtures and archives its completed case.

Initial verification: six domain/retrieval tests and 36 integration checks passed. Gemini subsequently generated source-checked answers in the browser using live PIB content. Ten unit tests and twelve additional local account-permission checks passed; broad AI-quality evaluation remains pending.

## Deployment and secrets

The existing private Sites identity is in `.openai/hosting.json`. Reuse that project; do not create another. Keep runtime keys in private environment settings. Source and deployment archives must exclude `.env.local`, device data, `.wrangler/`, `.sites-runtime/` and `node_modules/`.

The initial workspace is private. App-level invitations do not grant site-level access. Sharing needs an explicit audience decision, followed by site access settings and the workspace role invitation.

## Before operational use

The project is suitable for portfolio review and fictional workflow testing. Real customer deployment needs approved procedures, security review, document scanning, retention rules, device protection, backup/restore testing and operational monitoring. See the architecture document for concrete bounds and tradeoffs.

MIT licensed. Built with React, TypeScript, Vinext, Cloudflare D1/R2, IndexedDB and Gemini / OpenAI APIs.


## Gemini and public sources
Gemini is preferred when GEMINI_API_KEY is set (default gemini-3.1-flash-lite). A live structured answer with an exact quotation passed on 1 October 2026; broad answer-quality evaluation is still pending. Gemini free-tier data-use terms apply. Applicant records and attachments are not sent to the provider.

Administrators can refresh an allowlist of PIB housing updates and BEE building guidance. The importer downloads bounded HTML, extracts up to three relevant paragraphs, and records original URLs, publication information and fetch time in versioned entries. Failed fetches preserve previous entries. This is a small curated source library, not comprehensive news coverage; imported content requires human interpretation and is not lender policy.


The public updates feed shows publication dates separately from fetch dates, labels snapshots, links to original publishers, and opens context-specific assistant questions. Three PIB releases were downloaded in the local preview; BEE remained a labelled snapshot. Re-fetching unchanged content preserves its version. The phone layout was checked at 390px, including navigation and horizontal overflow.

Run the additional local role checks with `node tests/roles.integration.mjs` against the Worker on port 8788. This test-only workflow emulates trusted dispatch headers with fictional accounts and must never be used to bypass authentication on a deployed server.


## Local release evidence

The final local release has 15 unit tests, a 28-check journey with separate officer and reviewer accounts, and six controlled live AI scenarios. Browser checks cover mobile case forms, draft recovery, dialog focus, and a conflict recovered after comparing both versions. These are local checks, not proof of production load capacity or a security certification.

- [Release checks and limitations](docs/RELEASE-CHECKS.md)
- [Recruiter kit and two-minute demo script](docs/RECRUITER-KIT.md)
- [Workflow result](docs/WORKFLOW-RESULT.json)
- [AI evaluation results](docs/AI-EVALUATION.json)

A GitHub Actions workflow is included for unit tests, type checking and builds. It has not run on GitHub because this repository has not been published. The integration scripts use fictional trusted-header identities against the loopback Worker only. Never expose the test proxy or use those identities as deployed authentication.
