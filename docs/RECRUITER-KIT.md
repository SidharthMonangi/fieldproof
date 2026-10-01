# FieldProof recruiter kit

Live app: https://fieldproof.sidharthmonangi.chatgpt.site
Source: https://github.com/SidharthMonangi/fieldproof

## Project description
FieldProof is a housing fieldwork and evidence-review application designed for interrupted connectivity. Field officers capture cases, visits and attachments; separate reviewers request corrections and verify evidence completeness. A source-backed Gemini assistant answers handbook questions and explains dated official housing reports.

## Application: where to look in two minutes
Start with Sync centre: pause syncing, save a fictional field update, reload, and resume. Then inspect `lib/operations.ts` and `tests/release-workflow.mjs`: stable operation identifiers prevent duplicate writes, version checks surface conflicts, and a separate officer and reviewer complete a tested correction-and-verification journey.

## Resume entry
**FieldProof — offline-capable housing fieldwork and review platform**  
React, TypeScript, Supabase Auth, Cloudflare D1/R2, IndexedDB, Gemini

- Implemented device-persisted drafts and queued evidence updates with idempotent receipts, version conflicts and an auditable review workflow.
- Integrated Gemini answers with schema-constrained source quotations, unsupported-question abstention and explicit handling of dated public reports.
- Verified 24 unit tests, 13 recovery/deletion tests, 37 local maintenance checks and 35 hosted account/privacy/storage/recovery checks; checked mobile forms, keyboard focus and conflict recovery locally in the browser.

Use these bullets after reviewing and understanding the implementation. Describe AI-assisted development honestly when asked. The counts describe checks, not customer impact or a measured accuracy percentage.

## Two-minute demo narration
**0:00–0:20 — The problem.** “Fieldwork often happens with unreliable connectivity. FieldProof preserves a visit locally and makes the difference between a device save and a confirmed server save visible.”

**0:20–0:55 — Recovery.** Open Sync centre, pause syncing, update a fictional case and reload. Show the preserved queue. Resume and show the queue clearing. For a prepared conflict, open the local/server comparison and explain why applying a proposal requires an explicit decision.

**0:55–1:20 — Review.** Show a submitted fictional case, a separate reviewer’s change request, the officer’s correction and the review event identifying the reviewer. Verification means evidence completeness, not loan approval.

**1:20–1:45 — Knowledge.** Open a public housing update and its publisher link. Ask about the update. Open the citation. Ask for current figures and show the dated-reference warning rather than treating an old report as live facts.

**1:45–2:00 — Engineering judgment.** “I chose explicit conflict resolution and source provenance. The system does not authenticate documents or make lending decisions. The local tests exercise actual D1/R2 persistence and separate roles.”

## Interview questions to prepare
1. Why is retrying the same UUID safer than issuing a new operation?
2. What happens if the attachment is uploaded but the database write fails?
3. Why does a conflict block later queued changes for that case?
4. What does an exact quotation prove, and what does it not prove?
5. Why separate the publication date from the download date?
6. How would this change for a real lender with independent review, device security, malware scanning and retention requirements?

## Sharing status
The public GitHub repository and hosted application are published at the links above. Hosted GitHub authentication, persistent storage, generated cited answers and disposable-account privacy/recovery checks passed. GitHub CI passed. Hosted photo preparation and offline reconnection still need ordinary-browser checks; email sign-in remains disabled. A recording script is supplied; no narrated video or user-research claim is implied.
