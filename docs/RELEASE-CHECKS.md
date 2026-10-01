# Local release verification

Checked on 1 October 2026. These results cover the local application, not a hosted deployment or a formal WCAG audit.

| Area | Evidence | Result |
| --- | --- | --- |
| Domain, source and provider behaviour | 15 unit tests | Passed |
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
