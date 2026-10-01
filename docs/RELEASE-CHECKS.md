# Local release verification

Checked on 1 October 2026. These results cover the local application, not a hosted deployment or a formal WCAG audit.

| Area | Evidence | Result |
| --- | --- | --- |
| Domain, source and provider behaviour | 16 unit tests | Passed |
| Separate officer / reviewer journey | `WORKFLOW-RESULT.json`, 28 checks | Passed |
| Invitations and role restrictions | `tests/roles.integration.mjs`, 12 checks | Passed in prior local run |
| Live assistant behaviour | `AI-EVALUATION.json`, six controlled scenarios | Passed after fixes |
| Mobile form | 390px viewport, labelled fields, required validation, saved case | Passed |
| Draft recovery | Closed dialog, reloaded, reopened and saved the recovered fictional draft | Passed |
| Dialog keyboard interaction | First/last focus trap, Escape, focus returns to opening button | Passed after fixes |
| Sync conflict recovery | Paused local edit, competing server edit, comparison, explicit retry, empty queue | Passed |
| Offline cached shell and visit | Production preview disconnected and reloaded, pending visit later synced | Passed earlier in this project |
| Accessibility styling | Secondary text contrast and keyboard focus outlines improved | Manual checks; not a conformance certificate |
| Type checking and production build | Local TypeScript and Vinext build | Passed |
| Source packaging | Credentials and local database excluded, saved-key scan | Checked before handoff |

## Issues fixed by the release pass
- Gemini-only configuration now correctly enables the assistant status.
- Impossible calendar dates are rejected, while visit dates use India’s calendar day for the future-date check.
- Dialogs restore keyboard focus rather than dropping it on the page body.
- Citation quotes are chosen from bounded server-supplied excerpts and still checked against their source.
- Requests for current facts from dated public reports use a deterministic warning.
- Secondary text and keyboard focus outlines have stronger contrast.

## AI evaluation limits
The six scenarios cover supported guidance, an unrelated forecast, dated reports, user instruction injection, retrieved instruction injection and unsupported structural certification. This is a small controlled evaluation, not a statistical accuracy or security guarantee. Earlier runs exposed citation validation fallback; the final run uses source-constrained quote choices. Provider failures continue to show original passages rather than inventing an answer.

## Remaining deployment checks
Apply database migrations once; confirm trusted authentication dispatch; provision persistent D1/R2; configure the Gemini secret on the server; verify source refresh and generated answers; verify independent accounts and file access; verify offline cache on the hosted origin; configure reviewer access before sharing a recruiter link.

## Recovery and deletion checks

- Full fictional workspace export and isolated SQLite/object recovery passed. Six recovery tests reject corrupt or unsafe backups. In-app restore to the live workspace remains unavailable.
- Seven SQLite tests exercise the actual account deletion eligibility query: empty sole-admin workspace accepted; other users, non-admins, team workspaces, cases and pending cleanup rejected.
- Local account deletion screen returned 200; unsigned deletion returned 401; cross-site deletion returned 403. The saved server key was accepted by a read-only Supabase admin request. No real account was deleted, so successful provider deletion and failure/retry behaviour are not yet end-to-end verified.
- Account closure retains only user ID, workspace ID, status and creation time as a retry/replay marker. No email or fieldwork is retained in this marker. All cases must be purged first. Team account removal is currently blocked.
- File cleanup no longer clears unrelated local drafts.
- CI now runs Python recovery and deletion tests as well as app tests and build checks.
- Database migration journal includes both maintenance tables.

## Hosted verification on 1 October 2026

Production: https://fieldproof.sidharthmonangi.chatgpt.site

- GitHub sign-in returned to the hosted origin and authenticated workspace; session persisted after reload. Supabase Site URL and callback allowlist were checked in the dashboard.
- Native deployment reported success; all 12 database tables were present. Server AI and auth credentials were stored as secrets; release archive and source ZIP passed saved-key scans.
- Live service check: database reachable, storage configured, assistant configured, no pending file cleanup.
- Three PIB sources downloaded live; BEE retained its explicitly labelled reviewed snapshot.
- Gemini generated a consent answer with literal handbook citations. Fictional starter cases were stored in the real user's hosted workspace for exploration.
- 25 hosted integration checks passed using two disposable real Supabase password-authenticated accounts. These exercised workspace separation, anonymous backup denial, cross-account file and case denial, attachment upload/read byte equality, backup checksum validation, purge and object cleanup, account deletion, and rejection of deleted-account sessions. Both test accounts were removed by the application's deletion endpoint. GitHub OAuth was tested separately on the real account.
- Browser photo upload automation stalled twice; its image decoding check did not succeed. PDF upload and download passed through the hosted API. Photo preparation through an ordinary user browser remains unverified on the hosted origin.

Remaining limits at the preceding release: live workspace restoration was not available in the UI; email sign-in was disabled; external uptime monitoring was not configured; hosted offline/reconnection and ordinary-browser downloads needed a final manual check.

## Release 3: hosted recovery and monitoring

This section supersedes the earlier restoration, monitoring and disposable-account verification limits above.

- Deployment of source commit `7895241ed8028acd8851353a3c0416eb5694b4c3` succeeded on the same public origin.
- 24 unit tests, 13 Python tests, 37 local maintenance checks, type checking and production build passed.
- 35 hosted integration checks passed on 1 October 2026 at 15:18 UTC, using two disposable real Supabase sessions. Recovery created a separate draft, required fresh consent, preserved attachment bytes, denied another account access and reused the same receipt on retry without duplicate cases. Both recovered and original test cases were purged and both disposable accounts were deleted through the app. The real user's account and cases were retained.
- In-app restoration is available to administrators in Workspace maintenance. It validates checksums, object references and domain records; copies records to new IDs; leaves current records unchanged; and does not import permissions. The README documents import bounds and crash-cleanup protection.
- Public source is published at https://github.com/SidharthMonangi/fieldproof.
- GitHub CI completed successfully: https://github.com/SidharthMonangi/fieldproof/actions/runs/36882032326.
- The hourly uptime workflow's first manually triggered live run succeeded: https://github.com/SidharthMonangi/fieldproof/actions/runs/36883482070. It checks the public minimal health endpoint and database, using no secrets. Scheduled runs may be delayed; notification delivery follows the owner's GitHub Actions preferences and was not separately tested.

- Hosted Workspace backup download was also checked in the in-app browser. Its automation missed the download event, but two JSON files appeared in the user's Downloads folder. Isolated recovery of the latest download validated three fictional cases; live records were unchanged. This verifies the Workspace backup control, not every individual attachment download.

Remaining limits: email sign-in is disabled pending reliable delivery; hosted ordinary-browser photo preparation, individual attachment downloads and offline reconnection require a final manual check. Provider failure/retry behaviour has not been fault-injected. These results are not a production compliance, load, or accessibility certificate.

## User-assisted hosted browser checks

On 1 October 2026, the user confirmed that the uploaded photograph remained after reload and could be downloaded. Supplied Chrome screenshots showed the case loading with DevTools Offline enabled, one visit preserved in the device queue during offline reload, and one synced visit after reconnection. These are user-assisted checks, not automated browser results. The final empty-queue check after reload was not explicitly confirmed. The screenshot verifies download availability; opening the downloaded image was not separately confirmed.

GitHub remains the supported sign-in method. Email sign-in was removed from the agreed scope after Gmail SMTP delivery failed. The previously listed photo upload and reconnection checks are superseded by the evidence above; independent load/security review and provider failure injection remain outside this verification.
