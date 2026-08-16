# TLS-UI-CANON-001 — Dynamic SWOT UI inventory, browser evidence, component coverage, verdict

Lane: `codex/closure-claude-a-method-evidence`, worktree
`/Users/piotrwisniewski/Developer/consultify-closure-claude-a`. Evidence captured 2026-08-16
against this lane's own dedicated sandbox Postgres (`consultify-closure-a-34918`, port 34918;
1888 `information_schema.tables` rows, migrations applied, `SELECT 1` confirmed before use).

**Read this file's Verdict section first** if you only read one section — the short version is
**PARTIAL, not DONE**, for two independent reasons: (1) the lane lease grants zero Tools/SWOT
Playwright specs, so most of the required viewport×theme×language matrix could not be produced
as browser evidence at all; (2) running the one browser spec this lane IS allowed to run
surfaced a real, reproducible product-level mismatch (detailed below) that blocks half of it.

---

## 1. Route mount — verified, not assumed

- `src/routes/AppRoutes.tsx:1934-1948` renders `DiscoveryToolsHub`
  (`src/components/Discovery/DiscoveryToolsHub.tsx`) at the live route.
- Dynamic SWOT is reached through `src/components/DiscoveryTools/ToolCanvas.tsx:160`
  (`toolType === 'dynamic-swot'`) and `ToolWorkspace.tsx`, both mounted from that hub.
- `src/views/discovery-tools/DiscoveryToolsView.tsx` — confirmed **orphaned**: `grep -rl` for its
  export across `src/` finds only its own definition file. It is exported but has no route
  importer. Not evaluated further; it is not the screen a user reaches.
- URL shape confirmed live in this session's browser run:
  `/discovery-tools?docId=<sessionId>` (see §3).

## 2. Surface inventory — mounted vs. orphaned

Dynamic SWOT's phases, from `ToolCanvas.tsx`'s `toolType === 'dynamic-swot'` branch
(`stepDefinition.id` switch, lines ~160-235):

| Surface (component) | Step id | Mounted? | Reached this session? |
|---|---|---|---|
| `ContextStep` (mission) | `mission` | Yes | No (not SWOT-specific; shared across all tools) |
| `SWOTInputExplorationPhase` | `input` | Yes | No — not exercised by the one available spec or by my component tests (1288-line file, out of time budget; see Gaps) |
| `SWOTBuildPhase` (+ `QuadrantCard`, `EvidenceEditor`, `TeresaSwotProposals`) | `swot` | Yes | **Yes** — browser (TLS-02/03) + 24 component tests |
| `SWOTInsightsPhase` | `insights` | Yes | No — not exercised this session (1910-line file, out of time budget) |
| `SummaryStep` + `InitiativesStep` (outputs) | `outputs` | Yes | Partial — browser only, via TLS-05 (Outputs & Actions panel, Request review, Approve, Generate report) |
| `SWOTCorrelationsStep` | — | **No — orphaned** | `grep -rln` for its name outside its own file and `index.ts`'s barrel export returns nothing. Never imported by `ToolCanvas`/`ToolWorkspace`. Confirmed dead code, not a reachable surface. |
| `SWOTQuadrantStep` | — | **No — orphaned** | Same as above. The pre-existing `SWOTBuildPhase.interaction.test.tsx` file's own header comment independently corroborates this ("disconnected legacy `SWOTQuadrantStep`"). |

Shared chrome reached from the SWOT outputs step but **not owned by DynamicSWOT/** (lives at
`src/components/DiscoveryTools/GenerateInitiativesModal.tsx`, `steps/SummaryStep.tsx`): a
"Generate initiatives" modal exists but was **not** inventoried in depth — it is generic
cross-tool infrastructure, not part of this task's leased domain root
(`src/components/DiscoveryTools/tools/DynamicSWOT/**`), and touching/testing it risks colliding
with other lanes. One structural observation made in passing while reading it: it has no
`role="dialog"`/`aria-modal` and no visible focus-trap or focus-return-on-close code — flagged
in §6 as an integrator note, not fixed or deeply tested here.

## 3. Browser evidence — what actually ran, against the real app + real Postgres

### Harness: got it up, on the first properly-isolated attempt

**This lane never hit the 503 `SERVER_STARTING` blocker described in the closure brief.**
Backend on this lane's own DB (port 34918) reported `✅ Database ready — serving traffic` and
answered `POST /api/test-support/bootstrap` successfully within ~30s of a cold `tsx src/index.ts`
start, no readiness loop, no retries needed. (Contrast: a sibling agent's
`docs/program/evidence/closure/a/ASM-UI-CANON-001/BROWSER_HARNESS.md`, read for cross-reference,
root-caused that exact 503 on the Assessment lane's *own* sandbox (port 34914) to three
lane-authored migrations recorded in `tp_migration_history` but never run through
`server/scripts/migrate.postgres.ts`, so `schema_migrations` never agreed. This lane's sandbox
(34918) was not affected — worth noting for the lead as a per-sandbox, not universal, condition.)

Two operational snags, both resolved and worth recording for whoever runs this next:

1. **Backend processes started with plain `nohup … & disown` were reaped anyway.** A backend
   started that way answered one request successfully, then received an explicit `SIGTERM` ~40s
   later (logged: `[Shutdown] Received SIGTERM, initiating graceful shutdown...`) — coincident
   with the next Bash tool call in this session, not a crash. A `vite` frontend started the same
   way in a separate call survived for the whole session, so this is not 100% reproducible, but
   using the harness's own `run_in_background: true` Bash parameter instead of manual
   `nohup`/`disown` was reliable across every subsequent call and is the pattern used for the
   final run below.
2. **`CI=true` + `E2E_USE_WEB_SERVER=false` trips the config's remote-only guard** even when
   `E2E_API_URL`/`E2E_BASE_URL` are both explicit localhost ports (`playwright.config.ts:136-157`
   treats `CI=true` as "assume remote-only L4" unless `E2E_USE_WEB_SERVER=true`). Fixed with
   `E2E_ALLOW_LOCALHOST_REMOTE=true`, which the config itself offers for exactly this case.

**Exact reproducible command** (own ports, own DB, own tmp dir, retries=0, real DB, no mocks):

```bash
# Backend (own terminal / background task):
cd server && env NODE_ENV=test PORT=3421 \
  DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34918/consultinity" \
  DB_TYPE=postgres DB_MANAGED_SCHEMA=off MOCK_DB=false MOCK_REDIS=true \
  DB_QUERY_TIMEOUT=15000 DB_STATEMENT_TIMEOUT=30000 \
  ENABLE_TEST_GATEWAY=true ENABLE_TEST_SUPPORT=true POSTGRES_SKIP_INIT_IN_TEST=1 \
  DISABLE_CONNECTION_POOL=true DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true \
  DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true \
  ENABLE_V8_GLOBAL=false TEST_SUPPORT_KEY=local-test-support-key-change-me \
  E2E_MODE=false CI=true RUN_DB_TESTS=1 TMPDIR=/tmp/e2etls npx tsx src/index.ts

# Frontend (own terminal / background task):
VITE_API_TARGET=http://127.0.0.1:3421 VITE_API_URL= npx vite --port 3420 --strictPort

# Test run (once both /api/health/ping and http://127.0.0.1:3420/ return 200):
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34918/consultinity" \
DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
E2E_API_URL=http://127.0.0.1:3421 E2E_BASE_URL=http://127.0.0.1:3420 \
E2E_REQUIRE_TEST_SUPPORT=true E2E_USE_WEB_SERVER=false E2E_ALLOW_LOCALHOST_REMOTE=true \
E2E_TMP_DIR=/tmp/e2etls TEST_SUPPORT_KEY=local-test-support-key-change-me \
npx playwright test tests/e2e/tools/swot-real-pg-resume.spec.ts \
  --project=chromium --retries=0 --workers=1 --reporter=list
```

### Literal result

```
Running 2 tests using 1 worker
✓  1 [chromium] TLS-02/03: SWOT deep-link, edit, durable autosave and hard-reload resume … (40.0s)
✘  2 [chromium] TLS-05: ready SWOT is submitted and approved in UI, frozen in PostgreSQL … (38.2s)
1 failed, 1 passed (2.0m)
```

**Test 1 (TLS-02/03) — PASSED, full journey, zero shortcuts.** Deep-link into an existing
session via `?docId=`, land on SWOT Build phase, see a seeded item, type a new weakness through
the real `<input>` + Add-button UI, confirm it lands in real Postgres via a polled API read,
**hard-reload the page**, and confirm the same text is still there after a full remount. This is
real autosave-then-resume evidence, English UI, default project viewport (1680×1050 — see Gap
§5 for why this is not the required 1440×900/768×1024/390×844 set), whatever theme the app
defaults to (light — no explicit dark-mode toggle in this spec).

**Test 2 (TLS-05) — FAILED, but only at its last step; everything before it PASSED.** Reading
the failure precisely matters here — this is not "the approval flow is broken":

- Seed a "complete" SWOT via API PUT, deep-link in, open Outputs & Actions. **PASSED.**
- Confirm autosave landed a normalized field before proceeding. **PASSED.**
- Click "Request review" → "Send review" → "Approve" in the real UI. **PASSED** — session
  reaches `status: 'APPROVED'` in Postgres.
- Confirm the immutable `contextSnapshot` was written (`snapshotVersion: 1`,
  `approvedSnapshot.answers` matches exactly what was on screen at approval). **PASSED.**
- **Tamper-after-approval returns 409** (`PUT` with `{answers:{tampered:true}}`) — immutability
  is enforced. **PASSED.**
- Full page reload, confirm `APPROVED` status and identical answers survive a remount.
  **PASSED.**
- Click "Generate report" → **FAILED**: server returned `409 EMPTY_TOOL_OUTPUT` where the test
  expects `200`.

So the state actually reached and proven on real Postgres is: default → in-progress → submitted
→ **approved/frozen** → **conflict (tamper-after-freeze, 409)** → reload-stable. The one state
NOT reached is the post-approval "promote to report" success path, and the reason is a genuine,
diagnosed, reproducible mismatch — not flakiness (I ran it once to green-vs-red distinction, but
the cause is deterministic static-data validation, not timing):

**Root cause.** `server/src/services/tools/toolOutputSnapshotService.ts`'s `EmptyToolOutputError`
(TLS-BVP-001, added 2026-08-13 per its own doc comment) requires `buildSwotOutput`
(`src/toolOutputs/buildSwotOutput.ts`) to produce at least one `conclusion` — i.e. at least one
`recommendedMoves` entry that clears `validateRecommendedMove`'s W2 gate
(`src/config/swot/swotTensionEngine.ts:189-260`). That gate requires, among other things, a
non-empty `tradeoff {chosen, deferred, cost}` and a `rejectedAlternative {option, reason}` on the
move. The spec's own `completeSwotAnswers.recommendedMoves[0]` fixture
(`tests/e2e/tools/swot-real-pg-resume.spec.ts:44-51`) is:
```js
{ id: 'tls-move', title: 'Launch value-retention programme',
  rationale: 'Protect the strongest revenue base first.', proposalStatus: 'accepted' }
```
— no `tradeoff`, no `rejectedAlternative`, no `linkedItemIds`/`linkedTensionIds`. Every one of
those is required by the gate, so the move is rejected, `conclusions.length === 0`, and
`promoteToOutput` refuses with 409 — exactly the mechanism the closure brief itself pointed at
("promoting a SWOT session with EMPTY lineage now returns 409 EMPTY_TOOL_OUTPUT"), just tripped
by stale test data rather than a genuinely empty session.

**This is very unlikely to be a real-user-facing regression.** Checked where `recommendedMoves`
actually get their `tradeoff`/`rejectedAlternative` in production: `src/hooks/discovery/toolAi/
dynamicSwot.ts` is the only place that constructs them, and its LLM prompt is explicit —
`"3-5 moves, EACH with tradeoff + rejectedAlternative — a move without a trade-off will be
rejected by validation"` (line 346), then `normalizeMoveTradeoff`/`normalizeRejectedAlternative`
(lines 523-524) enforce the shape on the way in. There is no other UI path in
`SWOTInsightsPhase.tsx` (1910 lines, grepped) that lets a human hand-author a move without going
through that AI-normalized path. So a session built through the real product (accept an
AI-proposed move via Teresa) should already satisfy the gate; this spec's **hand-written fixture
predates or never accounted for** the TLS-BVP-001 gate added on 2026-08-13.

**I could not fix this myself**: the fixture lives in `tests/e2e/tools/swot-real-pg-resume.spec.ts`,
which is explicitly read-only for this lane per the brief's hard structural constraint. See
Integrator Change Requests, §7.

## 4. Component-level coverage added this session

New file (leased root `src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/`, collected by
the `src/**/__tests__/**` include glob):
`src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/SWOTBuildPhase.a11y-states.test.tsx`

Run against the real zustand store (not mocked), same harness pattern as the pre-existing
`SWOTBuildPhase.interaction.test.tsx`:

```
npx vitest run src/components/DiscoveryTools/tools/DynamicSWOT/__tests__/ --retry=0
 Test Files  2 passed (2)
      Tests  24 passed (24)
```
(14 pre-existing + 10 new, all green, `--retry=0` so no retry masked a flake.)

The 10 new tests cover, and were specifically designed to be **honest about what jsdom cannot
prove**:

1. Empty/default state — all four quadrants show the `noPoints` placeholder with zero items.
2. **Accessible names** — the impact `<select>`'s sr-only `<label htmlFor>`/`<select id>` pair
   resolves via `getByLabelText` (DOM-equivalent of axe's `label`/`select-name` rule); the
   evidence-editor disclosure toggle has a real accessible name and `aria-expanded`.
3. **Keyboard traversal** — proved the Add button is (correctly) skipped by Tab while disabled
   (empty input), then reachable by Tab once real text is typed — i.e. the real keyboard-only
   path a screen-reader/keyboard user would take, not just "focus() works."
4. **Focus return** — opening then closing the evidence-editor disclosure (a real
   expand/collapse UI region in this screen; there is no true modal/drawer inside
   `DynamicSWOT/` itself, see §2) never drops focus to `<body>` across the full cycle.
5. **Client-side conflict/reject state** — `evaluateSwotAcceptGate`'s
   `UNVALIDATED_CLASSIFICATION` rule (an AI proposal claiming "core competency" with zero linked
   evidence) surfaces a real `role="alert"` with an actionable bilingual message, blocks the
   accept, and the item stays `proposed`; a follow-up test shows the same proposal WITH an
   evidence note clears the gate and the alert disappears. This is the same "no unearned
   conclusion" rule family as the server's 409 in §3, reachable synchronously without a network
   round-trip.
6. **PL language** — quadrant chrome renders in Polish with `isPolish`, and the gate's Polish
   message renders for the same conflict state.
7. **Dark-theme class presence (structural only)** — asserted `dark:` Tailwind variants exist in
   the rendered markup. Explicitly documented in the test file's own header that this is NOT
   proof of correct dark rendering (jsdom does not evaluate CSS or `prefers-color-scheme`) — it
   only proves the component authors a dark variant at all.

## 5. Coverage matrix — honest state

Required matrix: **1440×900, 768×1024, 390×844 × light/dark × PL/EN × default/loading/empty/
error/permission/conflict/success.**

| Axis | Covered how | Verdict |
|---|---|---|
| Viewport 1440×900 | Not run — no lease to add/parametrize a Playwright spec; the one allowed spec runs at the project default (1680×1050) | **NOT COVERED** |
| Viewport 768×1024 | Not run, same reason | **NOT COVERED** |
| Viewport 390×844 | Not run, same reason | **NOT COVERED** |
| Light theme | Implicit only (app default in the one browser run); never explicitly asserted | **WEAK** (assumed, not verified) |
| Dark theme | Not run in browser. Component tests assert `dark:` classes exist in markup only | **STRUCTURAL ONLY, NOT VISUALLY VERIFIED** |
| EN language | Browser: both tests, full journeys. Component: yes | **COVERED** (browser + component) |
| PL language | Browser: **not exercised** (fixture/UI copy in both specs is English, no language switch). Component: yes (quadrant chrome + gate message) | **PARTIAL** (component only) |
| default | Browser (TLS-02/03 landing) + component | **COVERED** |
| loading (`isGeneratingAI` spinner banner) | Code-verified reachable (`SWOTBuildPhase.tsx`'s `isGeneratingAI` prop branch) but **not exercised** this session, browser or component | **NOT COVERED** |
| empty | Component (4/4 quadrants) | **COVERED (component only)** |
| error (generic API-failure toast, e.g. `SummaryStep`'s report-creation catch block) | Not exercised — that component is shared cross-tool infra outside `DynamicSWOT/`, out of scope this session | **NOT COVERED** |
| permission | No permission-gated SWOT state found in the reachable code; not evidenced either way | **NOT EVIDENCED** |
| conflict | Browser: 409 tamper-after-freeze (intended) **and** 409 EMPTY_TOOL_OUTPUT (unintended, see §3). Component: client-side accept-gate rejection | **COVERED, unusually well, via a real bug** |
| success (approve → freeze → promote → report → PDF export) | Browser: approve/freeze succeeded; **promote/report/PDF never reached** (blocked by §3's fixture mismatch) | **PARTIAL — blocked before the finish line** |

**Bottom line on the matrix**: of 3 viewports × 2 themes × 2 languages × 7 states = 84 cells,
only a handful have direct browser evidence (all at one viewport, one theme, English, states
default/conflict/most-of-success), a modest handful more have component-level structural
evidence (empty/conflict/PL/dark-class-presence), and the remainder — most of the viewport and
theme axes entirely — have **no evidence either way**. This is the direct, unavoidable
consequence of the zero-Tools-Playwright-lease constraint stated in the brief; it is not a gap
this lane could close within its granted scope.

## 6. Accessibility (axe) — could not be measured; here is exactly why

`@axe-core/playwright` **is** an installed dependency (`package.json:427`, version `4.13.0`) —
so this is explicitly **not** the "dependency missing, do not install" case the brief describes.
The actual blocker is narrower and structural: `@axe-core/playwright` needs a live Chromium
`page` object to inject into and scan, which only exists inside a Playwright spec. Running it
against Dynamic SWOT screens would require either (a) adding assertions to the one existing
`tests/e2e/tools/swot-real-pg-resume.spec.ts` — forbidden, it is read-only for this lane — or
(b) adding a new spec under `tests/e2e/tools/` — not present in this lane's
`CLAUDE_LANE_A_PATH_LEASE.json` Playwright list (verified: the list contains only
`assessment-*`/`interview-*` specs, zero `tools`/`swot` entries). So axe is blocked by the exact
same zero-lease constraint as browser evidence generally, not by anything installable.

**Substituted, and explicitly labeled as partial**: the component tests in §4 assert the DOM-level
equivalents axe would flag as `label`/`select-name` (accessible-name resolution via
`getByLabelText`) and `aria-*` state correctness (`aria-expanded`). What they **cannot**
substitute for: axe's `color-contrast` (serious, very commonly the one that fails in practice —
jsdom does not render CSS, so this is unmeasurable without a browser), landmark/heading-structure
rules, or anything about the actual computed accessibility tree a screen reader would see.

## 7. Integrator change requests

1. **Missing Tools/SWOT Playwright lease entry.** `CLAUDE_LANE_A_PATH_LEASE.json`'s
   `tests.playwright` array has zero entries under `tests/e2e/tools/` — confirmed via
   `jq -r '.tests.playwright[]' docs/cleanup/agents/generated/CLAUDE_LANE_A_PATH_LEASE.json`.
   Without at least one leased, writable spec path for Tools/SWOT, the viewport×theme×language
   matrix in §5 cannot be closed by this lane under any approach that respects the brief's other
   constraints. Recommend leasing a new path (e.g. `tests/e2e/tools/swot-ui-canon.spec.ts`) or
   granting write access to the existing spec.
2. **Stale fixture in the one lease-visible spec.** `tests/e2e/tools/swot-real-pg-resume.spec.ts`'s
   `completeSwotAnswers.recommendedMoves[0]` (line ~44) needs `tradeoff`, `rejectedAlternative`,
   and at least one `linkedItemIds`/`linkedTensionIds` entry referencing IDs already present in
   the same fixture's `items`/`tensions`, to satisfy `validateRecommendedMove`
   (`src/config/swot/swotTensionEngine.ts:189`) — the same shape
   `src/hooks/discovery/toolAi/dynamicSwot.ts` already normalizes AI-generated moves into. Until
   fixed, TLS-05 will deterministically fail at its `Generate report` step with `409
   EMPTY_TOOL_OUTPUT` on every future run, real regression or not — it currently gives a false
   negative for the promote→report→PDF-export path. This is not something this lane can fix
   itself (read-only spec).
3. **`GenerateInitiativesModal.tsx` (shared, `src/components/DiscoveryTools/GenerateInitiativesModal.tsx`)
   has no `role="dialog"`/`aria-modal` and no visible focus-management code** (grepped for both;
   neither present). Reachable from the SWOT outputs step. Flagged, not fixed — it is generic
   cross-tool infrastructure outside `DynamicSWOT/`, and editing it risks colliding with whatever
   other lane owns that shared shell.
4. Not a request, a data point for whoever runs this harness next: this lane's own DB sandbox
   (port 34918) did **not** reproduce the sibling ASM lane's 503 `SERVER_STARTING` root cause
   (stale `schema_migrations` vs. `tp_migration_history`). If a future run of *this* lane's
   harness hits that symptom, check the same two ledgers before assuming load.

## 8. Verdict

**PARTIAL, not DONE.** Justification, weighed honestly:

- What IS proven, on the real app against real Postgres: the SWOT Build phase's core edit/
  autosave/hard-reload-resume loop end to end (TLS-02/03, full pass); the approve→freeze→
  immutability→reload-persistence chain end to end (TLS-05, passed up to but not including
  promote); a real, reachable client-side conflict/reject state with an actionable message
  (component-level, 10/10 new tests green, 24/24 total in the SWOT component suite); keyboard
  reachability and accessible-name correctness for the controls exercised; PL-language rendering
  of the exercised surfaces; two confirmed orphaned/dead surfaces removed from further
  consideration (`SWOTCorrelationsStep`, `SWOTQuadrantStep`).
- What is NOT proven, and cannot be proven within this lane's current lease: the
  1440×900/768×1024/390×844 viewport matrix (zero browser coverage at any but the one project
  default); dark-theme *rendering* (only markup-level `dark:` class presence); the promote→
  report→PDF-export success path (blocked by a stale fixture in a spec this lane cannot edit);
  axe-measured color-contrast/serious-rule coverage (blocked by the same zero-lease constraint,
  despite the dependency being installed); the loading-spinner state; the generic API-error-toast
  state; permission-gated states (none found, none evidenced).
- Per the brief's own framing: human brand/UX sign-off and manual VoiceOver verification are
  external gates this lane cannot close under any circumstance — that portion is `BLOCKED_HUMAN`
  regardless of the rest of this verdict, and is unaffected by the lease gap above.

**Recommended reviewer bundle** (for the named human reviewer once available): open
`/discovery-tools?docId=<a dynamic-swot session id>`, walk SWOT Build phase in both languages and
both themes at the three required breakpoints (none of which this lane could screenshot), then
walk Outputs & Actions through Approve using a session whose `recommendedMoves` carry
tradeoff/rejectedAlternative (e.g. one built through the real Teresa/AI flow, not this lane's
fixture) to see the promote→report→PDF path this lane could not reach. Pair with
`docs/ui-standards/TRIADA_KANON.md`'s 40-point checklist per this repo's CLAUDE.md standing
instruction for any list/table screen reached along the way (Outputs table, if any) — SWOT's own
screens are canvas/record-style (SPEC-A), not list screens, so TRIADA's checklist applies only
incidentally here.
