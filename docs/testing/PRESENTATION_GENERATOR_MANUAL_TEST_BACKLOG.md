# Manual Test Backlog - Presentation Generator

Status: `OPEN`
Owner: QA / Delivery Owner
Scope: Consultify presentation generator from artifact selection to generated client deck, AI proposal governance, quality gates, exports, sharing, refresh resistance, and Outputs Library read-back.

## Test Environment (Default)

- Target: `demo.consultify.ai`
- Login: `piotr wisniewski@dbr77.com`
- Password: `<HASLO>`

If a test requires role switching, use the existing internal role-switch/testing mechanism (e.g., `X-Test-Role` headers where available) and record the evidence in the “Network/API evidence” section.

## Evidence Standard

For every manual test below collect:

- UI evidence: screenshots or screen recording of the relevant state.
- Toast/banner evidence: success, error, degraded, blocked, or empty state copy.
- Network/API evidence: request URL, method, status, response payload for mutations and failures.
- Console evidence: browser console clean or captured errors.
- Refresh resistance: refresh after mutation and verify read-back.
- Result vocabulary: `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, or `INCONCLUSIVE`.
- Severity vocabulary: `P0`, `P1`, `P2`, `P3`.

## P0/P1 Release Gates

### MT-PRES-001 - Artifact Selection To Deck Generation

Priority: P1
Result: TODO

Steps:
1. Open Presentations wizard.
2. Select a system template: `Digital Transformation Read Deck`.
3. Search/filter source artifacts and select concrete ready artifacts for Interview/DRD/Initiatives.
4. Continue to outline review.
5. Generate deck.
6. Refresh the page and reopen the generated deck.

Expected:
- Selected artifacts survive step changes and refresh/read-back.
- Outline shows confidence/source refs and no raw JSON.
- Generated deck is available in builder and Outputs Library.
- No fake success if generation fails.

Evidence:
- UI, toast/banner, Network/API, Console, refresh resistance, read-back.

### MT-PRES-002 - Org Template Visibility And Execution

Priority: P1
Result: TODO

Steps:
1. Clone a system template into organization templates.
2. Open wizard setup.
3. Verify org template appears alongside system templates.
4. Generate a deck from the org template.

Expected:
- Org template is visible and clearly marked.
- Generation uses template recipe: intents, block mix, density, visual policy, notes policy, limits.
- No hidden fallback to generic AI outline without warning.

### MT-PRES-003 - AI Proposal Governance

Priority: P0
Result: TODO

Steps:
1. Open a generated deck in builder.
2. Ask AI to add executive summary or shorten copy.
3. Verify the UI shows proposal/diff and requires accept/reject.
4. Reject once and refresh.
5. Repeat and accept.
6. Refresh and verify accepted change persists.

Expected:
- No silent execution.
- `proposal -> approval -> execution -> audit` is visible.
- Reject does not mutate deck.
- Accept persists and creates audit/version history.

### MT-PRES-004 - Quality Gate Blocked Export

Priority: P0
Result: TODO

Steps:
1. Create or modify a deck so quality gates return blocking P0/P1 issues.
2. Try PPTX export from builder.
3. Try export from hub.
4. Open Quality Gates panel.

Expected:
- Export is blocked with honest error payload and toast/banner.
- Quality panel shows actionable blockers.
- Jump-to-slide works where `cardIndex` exists.
- No fake downloaded file and no completed export ledger record.

### MT-PRES-005 - Export Formats Fidelity

Priority: P1
Result: TODO

Steps:
1. Use a passing deck.
2. Export PPTX, PDF, PNG, and HTML.
3. Open exported files.
4. Inspect cover, dashboard, insight, initiative, roadmap, appendix.

Expected:
- Header/footer/page numbers/confidentiality render consistently.
- Brand colors and readable layout are preserved.
- PNG zip contains slide images.
- HTML is self-contained and navigable.
- Export QA records show correct completed status.

### MT-PRES-006 - Failed Export Ledger Semantics

Priority: P0
Result: TODO

Steps:
1. Force a failed export path or missing file condition.
2. Trigger PPTX download.
3. Inspect network response and export records.

Expected:
- Failure is not recorded as completed export.
- User sees honest error state.
- Export QA record has `failed` or `blocked`, not `completed`.

## P2 Functional Coverage

### MT-PRES-007 - Empty, Error, And Degraded Source States

Priority: P2
Result: TODO

Steps:
1. Test source picker with no artifacts.
2. Test source picker with API failure.
3. Test source picker with partial-ready/policy-blocked artifacts.

Expected:
- Empty/error/degraded states explain what happened and next step.
- No infinite spinner.
- Manual source fallback is clearly marked as partially grounded.

### MT-PRES-008 - Search, Filter, Pagination Source UX

Priority: P2
Result: TODO

Steps:
1. Search source artifacts by title, type, and readiness.
2. Filter by artifact type.
3. Load more pages.
4. Select/deselect items.

Expected:
- Search/filter results are stable and understandable.
- Load more does not lose selection.
- Selected artifacts are summarized.

### MT-PRES-009 - Template Gallery In Hub

Priority: P2
Result: TODO

Steps:
1. Open Presentations hub.
2. Open Templates tab.
3. Expand outline previews.
4. Use a template.

Expected:
- Template gallery is discoverable in the hub.
- System and org templates are distinguishable.
- Use action routes to wizard with selected template.

### MT-PRES-010 - Outputs Library Read-Back

Priority: P1
Result: TODO

Steps:
1. Generate a deck from artifacts.
2. Open Outputs Library or artifact registry view.
3. Locate generated presentation.
4. Open it after browser refresh.

Expected:
- Presentation is registered as an output artifact.
- Title, status, source lineage, and export metadata are readable.
- No tenant leakage or missing ACL enforcement.

## Visual And Accessibility Backlog

### MT-PRES-011 - Light/Dark Mode Visual Audit

Priority: P2
Result: TODO

Steps:
1. Open wizard, template gallery, source picker, builder, quality panel in light mode.
2. Repeat in dark mode.

Expected:
- Text contrast is acceptable.
- Status colors follow semantic meaning.
- No raw internals, `NaN`, `Invalid Date`, or `[object Object]`.

### MT-PRES-012 - Keyboard And Focus Flow

Priority: P2
Result: TODO

Steps:
1. Navigate wizard and quality panel with keyboard.
2. Verify focus states for template/source/export actions.

Expected:
- Main actions are reachable.
- Focus is visible.
- Modal/panel close controls work.

### MT-PRES-013 - Monthly Benchmark DBR77/VTS Scorecard

Priority: P1
Result: TODO

Steps:
1. Run generator for DBR77 Growth Machine reference context.
2. Run generator for VTS Program Transformacji reference context.
3. Execute quality gates and export all formats.
4. Fill benchmark scorecard (`content quality`, `visual fidelity`, `evidence completeness`, `export consistency`).
5. Compare with previous benchmark run and record deltas.

Expected:
- Both benchmark decks have explicit PASS vocabulary verdict.
- Scorecard fields are complete for both references.
- Any regression in content/evidence/export is flagged with owner and due date.

## Telemetry, Governance, And Confidentiality

### MT-PRES-014 - Telemetry Rollup Endpoint Returns Honest Zeros For Cold Deck

Module: Presentations
Priority: P1
Result: TODO

Preconditions:
- User logged in as ADMIN.
- Deck exists.
- No agent edits performed yet on this deck.

Steps:
1. Open Deck Builder for the cold deck.
2. Note current `Last agent activity` indicator state.
3. From devtools, call `GET /api/presentations/decks/:id/runtime-events/summary?windowDays=7`.

Expected:
- HTTP 200 OK.
- `data.totals.total === 0`.
- `data.lastActivityAt === null`.
- UI badge shows confidentiality level, no violet pulse.

Pass criteria: All four expected items.
Failure mode: Any non-zero counter or fake activity timestamp.

### MT-PRES-015 - Brand Kit Governance UI Is Read-Only Without brand_change Capability

Module: Presentations / Settings
Priority: P1
Result: TODO

Preconditions:
- Logged in as a USER role (not ADMIN/OWNER).

Steps:
1. Open the Brand Kit Governance settings page.
2. Inspect every input.
3. Try to click `Save` (it should not be present).

Expected:
- Read-only chip shown.
- All inputs disabled.
- Save button not rendered (not just hidden).
- On load failure -> amber degraded banner.

Pass criteria: All four expected items.
Failure mode: Editable fields or visible Save action under USER.

### MT-PRES-016 - Confidentiality Matrix Blocks Export And Share At API For Non-Privileged Caller

Module: Presentations / Backend
Priority: P0
Result: TODO

Preconditions:
- At least one `confidential` deck.
- At least one `internal` deck.

Steps:
1. As USER, attempt PPTX export of confidential deck -> expect 403 with `code === 'CONFIDENTIALITY_POLICY_BLOCKED'`.
2. As PROJECT_MANAGER, attempt share of internal deck -> expect 403 with `code === 'CONFIDENTIALITY_SHARE_REQUIRES_ADMIN'`.
3. As ADMIN, attempt the same operations -> expect 200 (or `QUALITY_GATE_BLOCKED` if blocked by quality, which is a different separate check).

Expected:
- All blocked attempts return JSON with the exact codes above.
- No PPTX file is downloaded for the blocked confidential case.
- Audit log shows blocked attempts as policy denials (if audit log is checked manually).

Pass criteria: All three expected items.
Failure mode: Any silent success, missing code field, or unexpected 200.

---

## Sprint 12–16 Premium Coverage (System Completeness)

### MT-PRES-017 - Template Governance Lifecycle (draft/approved/deprecated) + Lineage

Module: Presentations / SuperAdmin
Priority: P0
Result: TODO

Preconditions:
- Logged in as SUPERADMIN or role with `template_approve`.
- At least one template exists (system template ok).

Steps:
1. Open SuperAdmin → `Template Governance`.
2. In `Draft` tab, clone an existing template (system template) into a draft.
3. Verify lineage shows `v1 -> v2` (or higher) chain and “root” is stable.
4. Approve the draft template (provide reason where required).
5. Attempt to edit the approved template recipe via any template edit UI/API.
6. Deprecate the approved template with a reason.
7. Try to transition deprecated template back to approved (should be blocked) and try “clone as draft” path.
8. Refresh and re-open the governance panel for this template.

Expected:
- Lifecycle transitions enforce capability gates (no approve/deprecate without `template_approve`).
- Approved/deprecated templates are lifecycle-locked for edits (409 `TEMPLATE_LIFECYCLE_LOCKED` or equivalent honest block).
- Lineage parent/root/version persist across refresh and are immutable (clone increments version).
- Governance ledger shows events for `cloned`, `approved`, `deprecated` (and any blocked attempts are communicated honestly).
- No raw DB errors; missing schema shows honest 503 + UI banner.

Pass criteria: All expected items.
Failure mode: Silent lifecycle change, editable approved template, broken lineage, or missing governance events.

### MT-PRES-018 - Webhook Playground (Signed Dispatch + Inbox Verify)

Module: Presentations / SuperAdmin
Priority: P1
Result: TODO

Preconditions:
- Logged in as SUPERADMIN or role with `presentation_edit`.

Steps:
1. Open SuperAdmin → `Alert Subscriptions`.
2. Expand “Webhook Playground (advanced)”.
3. Generate signed dispatch (default P0).
4. Verify it shows: headers, canonical string, signature, one-time secret.
5. Verify inbox (no tamper) → expect `verified`.
6. Toggle “Tamper signature” and verify inbox again → expect `invalid_signature`.
7. Override algorithm to `HMAC-SHA1` and verify inbox → expect rejection (`missing_headers`/unsupported algorithm).
8. Refresh the page and verify the secret is not persisted (auto-cleared).

Expected:
- Playground does NOT touch real subscriptions or dispatch audit table.
- Verified path returns `verified: true` with reason “Signature OK”.
- Tamper path returns `invalid_signature` with clear reason.
- Unsupported algorithm is rejected.
- Secret is cleared from UI state (60s) and not stored in localStorage.

Pass criteria: All expected items.
Failure mode: Any real subscription mutated, secret persisted, or “verified” on tampered payload.

### MT-PRES-019 - Operations Health Export (PDF + HTML Fallback)

Module: Presentations / SuperAdmin
Priority: P1
Result: TODO

Preconditions:
- Logged in as SUPERADMIN or role with `presentation_edit`.

Steps:
1. Open SuperAdmin → `Operations Health`.
2. Click `Export PDF`.
3. If the environment has chromium available, ensure a real PDF downloads.
4. If the environment lacks chromium, ensure HTML downloads with a print banner (“⌘P / Ctrl+P”).
5. For API evidence: open devtools Network and call:
   - `GET /api/presentations/operations/health/export?windowDays=7&format=pdf`
6. Verify response headers:
   - success: `Content-Type: application/pdf`, `X-Operations-Health-Format: pdf`
   - fallback: `Content-Type: text/html`, `X-Operations-Health-Format-Fallback: html`, `X-Operations-Health-Fallback-Reason: ...`

Expected:
- Export always results in a usable artifact (PDF or honest HTML fallback).
- No fake download toast; banner/copy matches actual format.
- Export respects RBAC (forbidden users see honest 403 / banner).

Pass criteria: All expected items.
Failure mode: Empty file, wrong content-type, fake success, or silent failure.

### MT-PRES-020 - Governance Watchlist Saved Searches (Create / Apply / Highlight / Manage)

Module: Presentations / SuperAdmin
Priority: P1
Result: TODO

Preconditions:
- Logged in as SUPERADMIN or role with `presentation_edit`.
- Watchlist has at least a few entries.

Steps:
1. Open SuperAdmin → `Governance Watchlist`.
2. Type a title query in “Filter by deck title…” and verify the list filters.
3. Save current as a Saved Search (name + query + filters).
4. Refresh and verify Saved Search persists and can be re-applied.
5. Verify deck title highlighting uses `<mark>` and does not break layout.
6. Modify filters/query and verify active search chip shows `(modified)`.
7. Delete the saved search from “Manage” and verify it disappears after refresh.

Expected:
- Saved search is org-scoped and survives refresh/read-back.
- Missing migration shows honest banner “apply migration 766” (or equivalent) and disables saved search actions.
- Highlighting is safe (no regex injection symptoms), capped, and accessible.

Pass criteria: All expected items.
Failure mode: Saved search leaks across org, disappears on refresh, or highlighting breaks UI.

### MT-PRES-021 - Audit Integrity Check (Verifier + Optional Alert)

Module: Presentations / Operations
Priority: P1
Result: TODO

Preconditions:
- Logged in as SUPERADMIN or role with `presentation_edit`.

Steps:
1. Call `GET /api/presentations/operations/audit-integrity?windowDays=7`.
2. Verify the report schema: totals, issues[], verdict.
3. If the environment supports CLI, run:
   - `npm run audit:integrity -- --organization-id <orgId> --window-days 7 --report-file /tmp/audit.json`
4. (Optional) Run with `--alert` and confirm it only fires on `BLOCKED_P1`.

Expected:
- Verdict mapping is deterministic: P1 issues → `BLOCKED_P1`, only P2 → `PASS_WITH_P2`.
- Missing tables degrade honestly (schema-missing warning, never 500).
- Verifier is read-only (does not write audit rows).

Pass criteria: All expected items.
Failure mode: 500, missing fields, or verifier mutates audit log.

### MT-PRES-022 - Export Parity Report (API + CLI)

Module: Presentations / Backend + QA
Priority: P1
Result: TODO

Preconditions:
- A deck exists with at least PDF and PPTX export records (completed).

Steps:
1. Call `GET /api/presentations/decks/:deckId/export-parity`.
2. Verify report contains: formatsChecked, formatsMissing, issues[], summary, verdict.
3. Verify required formats (`pdf`, `pptx`) missing triggers `FAIL`.
4. Verify missing optional formats (`png`, `html`) are `info` only (not critical).
5. If CLI is available:
   - `npm run parity:check -- --deck-ids <deckId> --organization-id <orgId> --report-file /tmp/parity.json`

Expected:
- Parity report is read-only and schema-tolerant (503 on storage unavailable).
- Whitespace-only header/footer diffs do not produce false mismatches.
- Confidentiality watermark requirements are enforced for confidential/restricted decks.

Pass criteria: All expected items.
Failure mode: Parity says PASS when required export missing or when confidentiality watermark is missing.

### MT-PRES-023 - Operations Health Incident Runbooks Card (Recommendation + Copy Paths)

Module: Presentations / SuperAdmin
Priority: P2
Result: TODO

Steps:
1. Open SuperAdmin → `Operations Health`.
2. Locate the “Incident Runbooks” card.
3. Verify it shows either “No active incident” or a recommended runbook (RB-01..RB-04).
4. Verify recommended actions list is visible and copyable.
5. Verify the runbook index path and individual runbook path are present and copyable.

Expected:
- Card never crashes the page, never shows raw internals.
- Copy paths match files under `docs/operations/incident-runbooks/`.

Pass criteria: All expected items.
Failure mode: Broken UI, missing paths, or raw internal errors.

### MT-PRES-024 - Migration Dry-Run + Rollback Check (Operator Workflow)

Module: Presentations / Operations
Priority: P2
Result: TODO

Steps:
1. Run dry-run:
   - `npm run migrate:dry-run -- --migrations 760,767 --estimated-deck-count 1500 --report-file /tmp/migrate.json`
2. Run rollback-check:
   - `npm run migrate:rollback-check -- --migrations 760,767`
3. Verify recommendation and blockers are explicit.
4. Verify the sign-off template is present and usable:
   - `docs/operations/PRESENTATION_MIGRATION_SIGN_OFF_TEMPLATE.md`

Expected:
- Dry-run is read-only and always exits deterministically.
- Output includes rollback strategy and pre/post checks per migration.

Pass criteria: All expected items.
Failure mode: Missing rollback guidance or non-deterministic recommendations.

### MT-PRES-025 - Documentation Change Control (Validator + Parity Gate)

Module: Docs / Governance
Priority: P2
Result: TODO

Steps:
1. Run validator:
   - `npm run docs:check`
2. Run parity check:
   - `npm run docs:parity`
3. Verify `DOCUMENTATION_CHANGE_CONTROL.md` describes parity as implemented.
4. Simulate a PR scenario (locally): change a controlled doc without updating its CHANGELOG and confirm parity gate reports `doc_changed_without_changelog`.

Expected:
- Changelog validator rejects boilerplate rationale and missing fields.
- Parity gate flags meaningful doc diffs without corresponding changelog entry.
- When git is unavailable, parity falls back to informational mode (no hard fail).

Pass criteria: All expected items.
Failure mode: Doc changes can land silently without changelog entry.

### MT-PRES-026 - Monthly Benchmark Run (Manual Input + Persist When Available)

Module: Presentations / Operations + QA
Priority: P2
Result: TODO

Steps:
1. Prepare a scores JSON input (2–3 decks).
2. Run dry-run:
   - `npm run benchmark:monthly -- --organization-id <orgId> --run-label YYYY-MM --reference-set DBR77+VTS --input <file>`
3. Verify Markdown output is generated and includes verdict + per-dimension table.
4. If migration 768 is applied on the environment, run with `--persist` and confirm history endpoint returns the run.

Expected:
- Verdict thresholds match the spec: PASS if all dims ≥4.0, WARN if any <4.0 but all ≥3.5, BLOCK if any <3.5.
- Schema-missing degrades honestly (storage unavailable) without crashing.

Pass criteria: All expected items.
Failure mode: Non-deterministic verdict or missing markdown content.

### MT-PRES-027 - Benchmark Trend Dashboard (Gamma Target Trajectory)

Module: Presentations / SuperAdmin
Priority: P2
Result: TODO

Preconditions:
- At least 2 benchmark runs exist (otherwise test the empty-state path).

Steps:
1. Open SuperAdmin → `Benchmark Trend`.
2. Verify empty state copy when no runs exist (points to `npm run benchmark:monthly`).
3. With runs present, verify 5 dimension cards render with sparkline + dashed gamma target line.
4. Change `windowMonths` control and verify series updates.
5. Verify status and distance-to-gamma fields are consistent with latest values.

Expected:
- Honest states: INCONCLUSIVE when insufficient history (<3 points).
- Sparkline handles missing months without faking data.

Pass criteria: All expected items.
Failure mode: Blank view, fake values, or raw internals.

### MT-PRES-028 - Benchmark Judge (LLM-Assisted Scoring)

Module: Presentations / Operations
Priority: P2
Result: TODO

Preconditions:
- A deck exists (deck id).

Steps:
1. Run:
   - `npm run benchmark:judge -- --deck-ids <deckId> --organization-id <orgId> --output-file /tmp/judge-scores.json`
2. If no LLM keys configured, verify it exits gracefully with `unavailable` and explains why.
3. If keys are configured, verify output file is a valid `DeckScoreInput[]` for `benchmark:monthly`.
4. Run:
   - `npm run benchmark:monthly -- --organization-id <orgId> --run-label YYYY-MM --reference-set DBR77+VTS --judge <deckId>`
5. Verify a side-channel `*.judge.json` audit file is produced with per-dimension rationale.

Expected:
- No silent fabrication: invalid LLM JSON response results in explicit `invalid_response`.
- Cost protection: prompt truncation and sequential judging.

Pass criteria: All expected items.
Failure mode: Fake “ok” when no keys, or missing judge audit rationale.

### MT-PRES-029 - Subscriber Dashboard UI (Token Hygiene + Embed Mode)

Module: Subscriber (Public)
Priority: P1
Result: TODO

Preconditions:
- A valid subscriber dashboard token exists (issued via SuperAdmin).

Steps:
1. Open `/subscriber/dashboard#token=<rawToken>`.
2. Verify token is scrubbed from URL hash immediately after load.
3. Verify token is stored in `sessionStorage` only (no localStorage).
4. Verify loaded view shows masked target, health badge, delivery stats, recent dispatches.
5. Reload tab and confirm it stays logged in (sessionStorage persists).
6. Close tab and reopen (new tab) — confirm token is not present.
7. Open `/subscriber/dashboard?embed=1#token=<rawToken>` and verify chrome is reduced (embed mode).

Expected:
- Honest errors on 401/403/429/503/network_error with recovery actions.
- No token is leaked to console, URL, or storage outside session.

Pass criteria: All expected items.
Failure mode: Token persists in URL/history/localStorage or page requires Consultify login.

### MT-PRES-030 - Subscriber Token Revocation (Admin Surface)

Module: Presentations / SuperAdmin
Priority: P1
Result: TODO

Preconditions:
- At least one subscription exists.
- At least one dashboard token issued.

Steps:
1. Open SuperAdmin → `Alert Subscriptions`.
2. Expand a subscription row and open “Tokens”.
3. Verify token list shows only 8-char prefixes, never hashes.
4. Revoke an active token with required reason + confirm checkbox.
5. Verify UI shows success and token status becomes `revoked`.
6. Attempt to revoke the same token again and verify idempotent handling.
7. Use that token in subscriber dashboard and verify it returns 401 “Token revoked” (or equivalent reason).

Expected:
- Revocation is irreversible and immediate.
- Audit event recorded for revocation with prefix + truncated reason.
- Schema-missing shows honest banner and disables actions (503).

Pass criteria: All expected items.
Failure mode: Revoked token still works or UI reveals token hash.

### MT-PRES-031 - Incident Customer Comms Templates Availability

Module: Docs / Operations
Priority: P3
Result: TODO

Steps:
1. Open `docs/operations/incident-runbooks/INCIDENT_INDEX.md`.
2. Verify it links to `customer-comms-templates.md`.
3. Verify the templates file contains: tone standards, severity matrix, 5 templates (ack/update/resolution/postmortem/maintenance), compliance notes.

Expected:
- Operators have a single source-of-truth comms pack referenced by runbooks.

Pass criteria: All expected items.
Failure mode: Missing file or runbooks reference non-existent templates.

## Manual Test Queue

Use this queue when assigning testers:

- TODO: `MT-PRES-001` artifact selection to generated deck.
- TODO: `MT-PRES-002` org template execution.
- TODO: `MT-PRES-003` AI proposal governance.
- TODO: `MT-PRES-004` blocked export gate.
- TODO: `MT-PRES-005` export fidelity across formats.
- TODO: `MT-PRES-006` failed export ledger semantics.
- TODO: `MT-PRES-007` source empty/error/degraded states.
- TODO: `MT-PRES-008` source search/filter/pagination.
- TODO: `MT-PRES-009` template gallery hub.
- TODO: `MT-PRES-010` Outputs Library read-back.
- TODO: `MT-PRES-011` light/dark visual audit.
- TODO: `MT-PRES-012` keyboard and focus flow.
- TODO: `MT-PRES-013` monthly DBR77/VTS benchmark scorecard.
- TODO: `MT-PRES-014` telemetry rollup honest zeros for cold deck.
- TODO: `MT-PRES-015` brand kit governance read-only without capability.
- TODO: `MT-PRES-016` confidentiality matrix blocks export and share at API.
- TODO: `MT-PRES-017` template governance lifecycle + lineage.
- TODO: `MT-PRES-018` webhook playground signed dispatch verification.
- TODO: `MT-PRES-019` operations health export (PDF + HTML fallback).
- TODO: `MT-PRES-020` watchlist saved searches (create/apply/highlight/manage).
- TODO: `MT-PRES-021` audit integrity check (verifier + optional alert).
- TODO: `MT-PRES-022` export parity report (API + CLI).
- TODO: `MT-PRES-023` incident runbooks card visibility + copy paths.
- TODO: `MT-PRES-024` migration dry-run + rollback-check.
- TODO: `MT-PRES-025` documentation change control (validator + parity).
- TODO: `MT-PRES-026` monthly benchmark run (manual input + persist).
- TODO: `MT-PRES-027` benchmark trend dashboard (Gamma trajectory).
- TODO: `MT-PRES-028` benchmark judge (LLM-assisted scoring).
- TODO: `MT-PRES-029` subscriber dashboard UI (token hygiene + embed).
- TODO: `MT-PRES-030` subscriber token revocation (admin surface).
- TODO: `MT-PRES-031` incident customer comms templates availability.
