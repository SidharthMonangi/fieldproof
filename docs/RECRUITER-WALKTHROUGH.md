# A two-minute look at FieldProof

Start in Cases and open a fictional applicant. Show the evidence checklist and the separate field and reviewer responsibilities.

Open Sync centre, pause syncing, and record a case or visit. Reload the application to show that the unsent change survives on the device. Resume syncing and verify that the queue empties only after server confirmation.

For the engineering discussion, point to `lib/device.ts` and `lib/operations.ts`. Explain stable operation identifiers, content digests, expected versions, conditional writes and atomic audit/receipt creation. The integration test exercises lost-response retries and concurrent edits against actual local D1/R2 bindings.

Open Knowledge. Ask what evidence is missing from a case, then open a procedural source. Explain the difference between deterministic checklist results, original handbook passages and generated answers. Use the working Gemini integration, then ask for current figures to demonstrate the dated-reference guard.

Finish with the tradeoff: fieldwork remains recoverable while offline, but conflicts require human review and server-confirmed evidence is the source of truth. Evidence verification is not a loan decision.

## Suggested application description after your own review

FieldProof is an offline-capable housing fieldwork and evidence-review application. Its sync layer uses persistent device queues, idempotent server receipts and explicit conflict handling to preserve visits and attachments during interrupted connectivity. A source-backed handbook assistant helps users find procedural guidance without making lending decisions.

Only claim personal ownership of decisions you understand and work you have reviewed. Before interviews, inspect the implementation, change something substantive yourself, explain the tests, and collect feedback from potential users. Do not claim customer adoption, business impact or generated-answer accuracy that has not been measured.


See [the recruiter kit](RECRUITER-KIT.md) for the application response, resume entry and timed demo narration, and [release checks](RELEASE-CHECKS.md) for the evidence and limits.
