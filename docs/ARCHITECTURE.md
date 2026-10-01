# FieldProof architecture

FieldProof connects field collection with evidence review. It is a working portfolio application with server-side records, object storage, role checks, offline drafts, queued mutations and a handbook assistant. It is not a lender's operational policy or a validated credit decision system.

## Boundaries

The React interface runs in the browser. Vinext routes run as a Cloudflare Worker. Cloudflare D1 stores structured records and R2 stores attachment bytes. Sites dispatch authenticates the browser and forwards the user's site-specific identity; the application resolves workspace membership and checks authorisation on every API operation.

The first sign-in creates a personal workspace and administrator membership. An administrator can pre-register an officer or reviewer email; a new account with that email joins the invited workspace at sign-in. One account belongs to one workspace. Site audience settings are a separate boundary: the initial deployment is private, so invitations do not override site-level access.

## Authoritative and device state

The database owns accepted records. IndexedDB stores a per-user, per-workspace snapshot, form drafts, pending operations and attachment blobs. Browser storage is not the authoritative record. The interface overlays pending operations and labels unconfirmed changes as on-device. Syncing requires a fresh authenticated server read; cached identity alone cannot send mutations.

The service worker caches the application shell and same-origin static assets, never API responses or authentication routes. Offline data comes from IndexedDB. The user must first open the app while connected. Browser storage can be evicted, is not encrypted by the application and is unsuitable for unprotected shared devices. Device backups include unsent file bytes.

## A mutation's lifecycle

1. Validate the form and persist the operation in IndexedDB before acknowledging local success.
2. Give the operation a stable UUID and expected case version. Reuse the UUID after timeouts or lost responses.
3. Authenticate the sender and check workspace, assignment, role and workflow state on the server.
4. Calculate a request digest, including attachment bytes where applicable. Reusing an operation UUID with different information is rejected.
5. Apply the case version change, evidence metadata, audit event and receipt in an atomic D1 batch. Dependent inserts are conditional on the case's `lastOperation` matching the current operation UUID.
6. Return the saved receipt. A repeated request returns that receipt without duplicating evidence or activity.
7. Remove the device queue entry only after success, then refresh server state.

Optimistic concurrency compares the expected version with the server version. Competing edits yield one winner and a conflict. A conflict blocks later operations for that case but does not block other cases. The user compares the proposal with server data before explicitly rebasing or discarding it. There is no automatic overwrite.

R2 and D1 do not share a distributed transaction. Bytes are written to a deterministic object key before metadata commits. A failure or conflict can leave an unreferenced object. Production operation needs an orphan cleanup job and lifecycle policy; the retry path is recoverable because it reuses the same key.

## Workflow and permissions

| Role          | Capabilities                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Officer       | Read assigned cases; create cases; edit draft or returned cases; add visits and evidence; submit complete cases |
| Reviewer      | Read workspace cases; review submitted evidence; request changes or verify completeness                         |
| Administrator | Field and review capabilities; assign cases; archive cases; manage members, invitations and handbook            |

Cases move from draft to submitted, then verified or changes requested. Changes requested cases can be amended and resubmitted. Administrators can archive cases outside active review. Visits and evidence are append-only. Verification requires the configured checklist and a written review explanation. Administrators can exercise both roles for a small portfolio workspace; operational use should enforce independent review where required.

## Assistant

Questions about missing evidence use a deterministic checklist tool over authorised server records. Procedural questions use lexical retrieval over versioned workspace handbook entries. Unsupported questions abstain before any provider call.

OpenAI receives the question and selected handbook passages, not applicant records or attachments. The Responses request uses `store: false`, a bounded output, a timeout, and a strict JSON schema. Returned source IDs and exact quotes are checked against retrieved passages. This checks citation provenance, not semantic correctness of every sentence. Readers are directed to verify the source. Provider errors and quota exhaustion fall back to original passages. Attempts are limited to 20 per user per hour; model token use is recorded without storing question contents.

## Current scope and operational limitations

- Bootstrap loads the most recent 1,000 accessible cases. A larger rollout needs pagination, bounded evidence snapshots and incremental sync.
- The handbook uses lexical retrieval; paraphrases and multilingual questions need retrieval evaluation and likely multilingual embeddings.
- Uploaded types and signatures are checked, but antivirus scanning, PDF sanitisation and document authenticity checks are not implemented.
- There is no automated lending decision, identity verification, structural advice or regulatory certification.
- Live source-checked Gemini answers were verified in the browser; broad semantic-quality evaluation remains pending.
- Before real customer use: establish consent and retention procedures, approved handbook provenance, backup/restore testing, monitoring, attachment scanning, encryption requirements and independent security review.


## Gemini and public sources
Gemini is preferred when GEMINI_API_KEY is set (default gemini-3.1-flash-lite). A live structured answer with an exact quotation passed on 1 October 2026; broad answer-quality evaluation is still pending. Gemini free-tier data-use terms apply. Applicant records and attachments are not sent to the provider.

Administrators can refresh an allowlist of PIB housing updates and BEE building guidance. The importer downloads bounded HTML, extracts up to three relevant paragraphs, and records original URLs, publication information and fetch time in versioned entries. Failed fetches preserve previous entries. This is a small curated source library, not comprehensive news coverage; imported content requires human interpretation and is not lender policy.

## Backup restoration and health checks

The in-app restore endpoint validates record shape, workspace consistency, unique IDs, safe object keys, byte sizes, file signatures and SHA-256 hashes before any writes. It imports new draft copies into the administrator's current workspace; it does not import members or invitations. Consent and visit confirmation are reset, and imported history is labelled as recovered history. New IDs keep existing cases unchanged. Restored handbook entries are marked as sample material.

Object staging is tracked in a durable cleanup job before uploads. Its cleanup eligibility is delayed ten minutes to protect the active operation; unsuccessful restores make it eligible immediately. After objects are written, one D1 batch inserts the relational rows, writes an idempotent response receipt and removes the staging job. If the response is lost after commit, retrying the same request ID returns that receipt. If a Worker crashes before commit, a later administrator cleanup can remove the staged objects. This does not provide a distributed R2/D1 transaction.

`/api/status` exposes only availability and a correlation ID on failure. It performs a database query and never reveals credentials, account information or record counts. The hourly GitHub workflow uses no provider keys and read-only repository permissions. It checks app/database availability rather than AI quotas, email delivery or every storage object. GitHub scheduling and notification settings remain operational dependencies.
