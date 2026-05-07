# Manual Test Backlog - Presentation Generator

Status: `OPEN`
Owner: QA / Delivery Owner
Scope: Consultify presentation generator from artifact selection to generated client deck, AI proposal governance, quality gates, exports, sharing, refresh resistance, and Outputs Library read-back.

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
