# Owner UAT and VoiceOver runbook

This is the human acceptance gate for the 15 automated UI-CANON surfaces. It
does not replace the committed automated G4 evidence and must be executed on the
same final release candidate that is being considered for authorization.

## Candidate identity and prerequisites

- Final candidate SHA: `________________________________________`
- `git rev-parse HEAD` matches the SHA above: `PASS / FAIL`
- Mounted production-shaped frontend and backend use that exact SHA.
- Authentication uses signed sessions and real ACTIVE memberships.
- `E2E_MODE=false`; no request interception or authorization bypass.
- Current PostgreSQL migration ledger is initial-green, repeat=0 and dry-run=0.
- Test each applicable journey in PL and EN, light and dark, desktop and mobile.
- Enable macOS VoiceOver before the accessibility pass.
- Do not sign a persona `PASS` if a required state is unreachable. Record
  `BLOCKED` and the missing fixture/flag/authority instead.

## Rubric used for every journey

Verify, by keyboard and VoiceOver:

1. landmarks and heading hierarchy identify the page and its major regions;
2. controls have accurate names, roles, values and disabled/expanded state;
3. focus order follows the visible workflow and never disappears or becomes trapped;
4. errors, loading, success, empty and forbidden states are announced and understandable;
5. dialogs restore focus on close and destructive actions require clear confirmation;
6. PL/EN copy is complete and meaningful; light/dark content remains legible;
7. mobile has no hidden required action, horizontal loss or unreachable control;
8. denied actions fail closed without exposing another tenant's data.

## Seven persona journeys

### 1. Owner

- Open Organization, Admin, Settings, Results and Finance from a signed Owner session.
- Review organization identity, members/roles, policy/security and subscription surfaces.
- Review KPI/ROI/OKR and Finance summaries without changing reconciliation policy.
- Attempt a cross-tenant deep link and confirm denial without data leakage.
- Confirm privileged/destructive actions are clearly named, scoped and confirmed.

### 2. Admin

- Open Admin people, roles, security, billing and Settings security/privacy surfaces.
- Exercise search/filter, a non-destructive update preview and its cancel path.
- Confirm actions outside Admin authority are absent or fail closed.
- Confirm security failures and validation errors are announced by VoiceOver.

### 3. Manager

- Open Initiatives, Execution, Results and My Work.
- Traverse initiative to execution work and inspect the resulting KPI/OKR signal.
- Exercise loading, empty and error messaging where reachable.
- Confirm organization policy, security and billing mutation is unavailable.

### 4. Consultant

- Open Chat, Interview, Discovery Tools, Assessment, Materials and Meetings.
- Start or resume one governed workflow, review its output and return by deep link.
- Confirm tool/output controls, progress and validation are announced correctly.
- Confirm tenant administration and unrelated client data are unavailable.

### 5. Member

- Open My Work, Chat, Meetings and Materials.
- Find assigned work, open it, navigate back and verify the cold/reload path.
- Confirm no Admin controls or authoritative Finance/Results mutation is available.
- Verify empty/forbidden copy tells the user what they can do next.

### 6. Respondent

- Open a valid governed Interview respondent link without the internal application shell.
- Answer, validate and submit; confirm progress, errors and completion are announced.
- Reopen an expired/revoked/completed link and confirm fail-closed behavior.
- Confirm no internal tenant navigation or data is exposed.

### 7. Partner

- Open `/partner` using a signed Partner session.
- Review referral/ledger/accrual information and the manual request journey.
- Confirm status, validation, submission and error feedback are announced.
- Confirm internal Admin and other-tenant records remain inaccessible.

## Sign-off record

Allowed values are `PASS`, `FAIL` or `BLOCKED`. Any `FAIL` or `BLOCKED` keeps
human acceptance open. Defect IDs must link to reproducible evidence.

| Persona | Desktop PL/EN | Mobile PL/EN | Light/dark | VoiceOver | Forbidden/cross-tenant | Verdict | Defect or blocker IDs |
|---|---|---|---|---|---|---|---|
| Owner |  |  |  |  |  |  |  |
| Admin |  |  |  |  |  |  |  |
| Manager |  |  |  |  |  |  |  |
| Consultant |  |  |  |  |  |  |  |
| Member |  |  |  |  |  |  |  |
| Respondent |  |  |  |  |  |  |  |
| Partner |  |  |  |  |  |  |  |

- Reviewer: Piotr
- Reviewed candidate SHA: `________________________________________`
- Date/time and timezone: `________________________________________`
- Overall human verdict: `PASS / FAIL / BLOCKED`
- Signature: `________________________________________`

No signature or `PASS` is supplied by the automated evidence reconciler.
