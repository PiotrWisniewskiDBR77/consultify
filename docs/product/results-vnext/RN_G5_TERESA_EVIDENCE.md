# RN-G5 lane `teresa` — evidence packet (2026-08-12)

Base SHA: `35a1dee6c03b66907219b5b645e4e3ecb267f80a` (`origin/demo`-derived
integration point handed to this lane). Branch: `rn-g5-teresa`. Worktree:
`/Users/piotrwisniewski/rn-g2-lanes/g5-teresa`.

This packet is the acceptance evidence for the D13 Teresa governance
surfaces added/completed in this lane: **ROI's `pir_lessons_draft`** (WIP
completed and verified) and **KPI's `reflection_rca`** (new, this session).
OKR and KPI's other two advisor modes (`draft_quality_review`,
`check_in_manager_brief`) are **NOT wired** — see "What this does NOT
prove" below.

## 1. Decision: complete the WIP, don't rewrite

`git show --stat 34a918cb86` (branch `rn-g4-teresa`, prefix `WIP(...)`,
parent `dfe8a9f2f7` — an ancestor of this lane's base) showed 11 files,
+1937/-13, all under this lane's allowlist. `git cherry-pick -n 34a918cb86`
applied **cleanly** onto `35a1dee6c0` with zero conflicts.

I read every file in full before trusting it (not just the diff headers).
Assessment, file by file:

| File | Verdict | Why |
|---|---|---|
| `teresa/teresaHandoffTypes.ts` | Complete, correct | Client-side mirror of `teresaCopilotCanon.ts` types, every field cited against real server line ranges in its own header. Verified `HandoffTargetModule`, `TeresaHandoffContext` shape match the server file. |
| `teresa/teresaProposalApi.ts` | Complete, correct | Hand-written fetch client for `/api/v8/teresa/proposal*`. Verified every path/method against `server/src/routes/v8/teresa.routes.ts` (all 14 routes exist: `POST /proposal`, `POST /proposal/:id/approve`\`/reject`\`/execute`\`/undo`, `GET /proposal/:id`, `GET /proposals`, `GET /audit/:proposalId`, etc.) — the client only uses a subset, all present. `executeTeresaProposal`'s "don't throw on domain denial, only on transport/shape failure" contract is documented and, per my own component tests below, behaves correctly. |
| `teresa/TeresaEvidenceBreakdown.tsx` | Complete, correct | Renders `facts`/`inference`/`missing_evidence`/`recommendation` as three visually distinct lists, matches P08_CITATION_POSTURE. |
| `teresa/TeresaUnavailableBanner.tsx` | Complete, correct | "Teresa niedostępna" hard-requirement banner with `onRetry`/`onManualFallback`. |
| `teresa/TeresaProposalPanel.tsx` | Complete, one real bug found and fixed | The shared D13 panel: propose→approve/reject→execute→audit, focus-trapped `Modal`, no native dialogs. **Found via `tsc --noEmit`** (this session): line 398 compared `phase !== 'unavailable'` inside the branch where TS had already narrowed `phase` to exclude `'unavailable'` — TS2367 "no overlap" (dead, always-true code, not a functional bug, but a real type error that fails the tsc gate). Fixed by dropping the redundant clause (`errorText ? (...) : null`). Everything else in the file (state machine, `startedForKey` idempotency guard, busy-state modal-close prevention) verified correct by reading, then proven by the 5 unit tests below. |
| `roi/roiTeresaLessonsDraft.ts` | Complete, correct | Builds the ROI `pir_lessons_draft` suggestion/handoff-context/target-payload/consequence-preview from already-visible PIR fields only — never invents a fact. |
| `roi/RoiCaseLearnWorkspace.tsx` (diff) | Complete, correct | Adds the GENERATION gate (`askTeresaTarget`/`TeresaProposalPanel`) alongside the pre-existing DISPOSITION gate (`teresaTarget`/`RoiPirTeresaDispositionModal`) — two-gate structure intact, `onManualFallback` routes to the pre-existing `RoiPirDraftEditModal` which never calls Teresa. |
| `roi/roiCaseFullToolPresenters.tsx` (diff) | Complete, correct | Adds the "Poproś Teresę o szkic wniosków" row-menu action, visible-but-disabled (not hidden) when not editable or already drafted, per TRIADA §C3. |
| `index.ts` (diff) | Complete, correct | Barrel re-exports for the new `teresa/` module. |
| `dev-render/screens/results-vnext-roi-full-tool.tsx` (diff) | Complete, correct | Adds a stateful mock of the real P08 lifecycle (`handleTeresaProposalRoute`) behind `window.fetch`, plus two deliberate scenario toggles (`&teresaDown=1`, `&teresaRace=1`) that mirror real server guard conditions, not fabricated codes. |
| `tests/components/ResultsVNext/teresa/TeresaProposalPanel.test.tsx` | Complete, correct | 5 tests: auto-create-on-open, reject-before-execute, denial-at-execute, happy path, transport-unavailable. Ran green (see §3). |

**Verdict: complete the WIP.** It was well-engineered, cited real server
code at every claim, and its own inline documentation was honest about its
scope limits ("KPI/OKR types declared but NO call site in this package").
The only defect was the one `tsc` error above, fixed.

## 2. What this session added (new, not from the WIP)

The WIP's own header said: *"ROI's one real advisor mode is the only mode
this lane wires end-to-end to a live UI surface... KPI/OKR types below are
declared for the shared panel's type surface but have NO call site in this
package."* This session wired **one** of KPI's three governed advisor modes
end-to-end: `reflection_rca` — chosen because (a) the backend was already
fully implemented and had a passing real-Postgres test at this branch's
HEAD (`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts`,
pre-existing, not authored by me), and (b)
`KpiDeviationCaseSubview.tsx`'s own file header already flagged the exact
integration point ("D13: Teresa is FALA 2 — this subview does not render
any Teresa affordance... wiring Teresa later does not require touching
this file's write paths").

New files:
- `src/components/ResultsVNext/kpiTool/kpiTeresaRcaDraft.ts` — builds the
  suggestion/handoff-context/target-payload/consequence-preview for
  `reflection_rca`. **Deliberately different design from ROI's**: KPI's
  `execute` step commits the REAL `rootCauseSummary`/`rootCauseCategory`
  (no draft-only column exists on `rvn_kpi_deviation_cases` for this), so
  the "proposed change" shown in the panel is ALWAYS a verbatim snapshot of
  what the human already typed into the screen's own pre-existing manual
  form — the panel never shows text the human didn't write themselves. This
  is the mechanism that keeps "Teresa proposes, never decides" true even
  though there's no second draft-column gate the way ROI has one.
- `dev-render/screens/results-vnext-teresa-kpi-deviation.tsx` — new
  harness (allowlist-compliant name), `Api.get/post/put` stubbed for
  `/vnext/results/kpi*` + a `window.fetch` stateful mock of `/v8/teresa/*`
  (same `TeresaMockProposal`/`handleTeresaProposalRoute` shape the ROI
  harness established), with `&teresaDown=1`/`&teresaDeny=1` scenario
  toggles.
- `tests/resultsVnext/kpi/teresaKpiRcaWorkspace.component.test.tsx` — 4
  component tests against the REAL `KpiDeviationCaseSubview` (see §3).

Modified files (each listed, allowlist status noted):
- `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` (in
  allowlist: "src/components/ResultsVNext/** w zakresie wpięcia") — adds
  the "Poproś Teresę o zapis przez pipeline" button (Phase 2, root-cause
  analysis), disabled until both manual fields are filled, and mounts
  `TeresaProposalPanel` with `onCompleted` re-fetching the case
  (`loadCase()`) rather than approximating the write locally.
- `src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx` — the one
  `tsc` fix described in §1.
- `dev-render/main.tsx` — registers the new harness screen (additive, one
  new `React.lazy` import + one new `SCREENS` entry; did not touch any
  existing entry).
- `tests/components/ResultsVNext/KpiDeviationCaseSubview.test.tsx`
  (**outside the literal allowlist** — flagged below) — collateral fix. My
  change to `KpiDeviationCaseSubview.tsx` made it import
  `TeresaProposalPanel` → `teresaProposalApi.ts`, which imports
  `API_URL`/`getHeaders` from `@/services/api` at module scope. This
  pre-existing test's `vi.mock('.../services/api', ...)` only returned
  `{ Api }`, so the golden-flow test started throwing at import time
  (`No "API_URL" export is defined on the mock`) — a regression I caused,
  not a pre-existing failure. Fixed by adding the two missing exports to
  the mock (values never exercised by that file's own scenarios). Re-ran
  the file: all 3 tests still pass, including the full GOLDEN FLOW with
  real POST-body assertions at every step — this is itself the proof that
  **the manual path still works, byte for byte, with Teresa's code loaded
  alongside it**.

## 3. Contract map — D13's 11 stages × domain

| D13 stage | ROI (`pir_lessons_draft`) | KPI (`reflection_rca`) |
|---|---|---|
| 1. source/evidence | `TeresaEvidenceBreakdown` fed by `buildRoiPirLessonsDraftSuggestion` (`roiTeresaLessonsDraft.ts:33-92`) — case/PIR fields already on screen | `TeresaEvidenceBreakdown` fed by `buildKpiRcaSuggestion` (`kpiTeresaRcaDraft.ts:41-90`) — case fields + explicit note "this is exactly what you typed" |
| 2. proposal | `POST /v8/teresa/proposal` via `createTeresaProposal` (`teresaProposalApi.ts:56-66`) | same function, `targetModule:'kpi'` |
| 3. proposed change | `renderProposedChange` shows `draftLessonsText` (read-only, Teresa-composed-from-visible-data) | `renderProposedChange` shows the human's own textarea/input values verbatim (`KpiDeviationCaseSubview.tsx:1073-1087`) |
| 4. consequence preview | `roiPirTeresaConsequencePreview` — names the exact 2 columns written, states `lessons_learned` does NOT change | `kpiRcaConsequencePreview` — names the exact 3 fields written, states plan-approval is a separate, still-self-approval-blocked step |
| 5. permission preflight | Server-side: `handleRoiPirLessonsDraft` → visibility-scoped `getRoiPostInvestmentReview` | Server-side: `submitRootCause` (`kpiDeviationCommands.ts`), visibility-scoped case read |
| 6. explicit accept/reject | `TeresaProposalPanel`'s `teresa-approve`/`teresa-reject-*` buttons (shared component) | same shared component |
| 7. authorized domain command | `recordRoiPirTeresaLessonsDraft` (`roiPirCommands.ts:827-903`) | `submitRootCause` (`kpiDeviationCommands.ts`), `actorUserId: userId` (the approving human, never a `'teresa'` sentinel) |
| 8. write | `teresa_draft_lessons_payload`/`teresa_draft_generated_at` ONLY (2-gate, proven by `teresa-roi-forbidden-verbs.test.ts`'s static UPDATE-clause check) | `rootCauseSummary`/`rootCauseCategory`/`recurrenceFlag` on the real case row (proven for real below, §4) |
| 9. outbox/consumer | `rvn_platform_events` (ROI case aggregate) | `rvn_platform_events` (`kpi.deviation_root_cause_submitted`, proven for real below) |
| 10. audit/history | `teresa_audit_log` via `getTeresaAuditTrail` (`teresa-load-audit`/`teresa-audit-trail` testids) | same shared mechanism |
| 11. reload/cold-open | `RoiCaseLearnWorkspace`'s `onCompleted` calls `getRoiPostInvestmentReview` (server re-fetch) | `KpiDeviationCaseSubview`'s `onCompleted` calls `loadCase()` (server re-fetch) — proven by screenshot §5 |

## 4. KROK 2's 8 points — which proven, how

1. **Manual path works without Teresa** — PROVEN: `tests/components/ResultsVNext/KpiDeviationCaseSubview.test.tsx`'s pre-existing GOLDEN FLOW (open→acknowledge→root-cause→plan→approve→recovery→verification→close, real POST bodies asserted at every step) passes unmodified with Teresa's code loaded alongside it. ROI's manual `RoiPirDraftEditModal`/`updateRoiPostInvestmentReviewDraft` path is untouched by this lane (not exercised by a new test this session — inherited from ROI-E006, out of scope to re-verify).
2. **Teresa doesn't approve/reject/close autonomously** — PROVEN for KPI: `teresaKpiRcaWorkspace.component.test.tsx`'s happy-path test asserts `executeTeresaProposal` is NOT called between the approve click and the execute click (negative control, sabotage-verified — see §6). PROVEN for ROI: `TeresaProposalPanel.test.tsx`'s first test asserts nothing executes without an explicit approve.
3. **Teresa never changes Actual/final score without explicit command** — N/A to the two modes wired (neither touches Actual/final-score fields); not claimed.
4. **Teresa doesn't bypass capability policy** — server-side, out of this lane's allowlist; relies on the pre-existing visibility-scoped reads/writes in `submitRootCause`/`recordRoiPirTeresaLessonsDraft`. Not independently re-verified this session — see "What this does NOT prove."
5. **Restricted outsider / cross-tenant gets nothing** — NOT verified this session (server-side ABAC, out of allowlist, no client-only test can prove it). Flagged as NIEZMIERZONE below.
6. **Rejection performs no mutation** — PROVEN for KPI: `teresaKpiRcaWorkspace.component.test.tsx`'s rejection test asserts `Api.get` is called exactly twice (initial case + measurements load) after a reject — no third call, i.e. no re-fetch was ever triggered because `onCompleted` never fired. PROVEN for ROI: `TeresaProposalPanel.test.tsx`'s rejection test asserts `executeTeresaProposal`/`onCompleted` never fire.
7. **Retry doesn't duplicate the command (idempotency)** — NOT independently re-verified this session (relies on `idempotencyKey`/proposal-id semantics already implemented server-side; the ROI dev-render harness's `teresaRace` scenario and my own `teresaDeny` scenario both exercise a related "state changed between approve and execute" guard, but neither is a literal retry-duplication test). Flagged as NIEZMIERZONE.
8. **Audit contains provenance + actor** — PROVEN by the real-Postgres test (§5 below): the `reflection_rca` scenario asserts `rvn_platform_events.actor_user_id = OWNER_USER_ID` and `actor_effective_role = 'teresa_initiated'` on the real event row, not a `'teresa'` sentinel.

## 5. Real-Postgres proof (this session, not inherited)

Built an ephemeral Postgres 17 myself, per the mandate:
```
initdb --locale=C -D /tmp/g5teresa_pgdata -U postgres   # port 55802, not 5432
pg_ctl -D /tmp/g5teresa_pgdata -o "-p 55802 -k /tmp" start   # needed LC_ALL=C, see §7 gotchas
createdb -h 127.0.0.1 -p 55802 -U postgres consultinity_test
NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55802/consultinity_test \
  npx tsx server/scripts/migrate.postgres.ts        # NOT --safe; 608 migrations, ~7 min
```
Then, against that real database:
```
RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55802/consultinity_test \
  npx vitest run tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts
```
Result: **2 passed, 0 failed, 0 skipped** (this is the pre-existing,
not-authored-by-me file that directly proves the exact server code path my
new "Ask Teresa" button calls into):
- `draft_quality_review: executeProposal's create path NEVER leaves
  rvn_kpi_definitions.status != 'draft'` — 1804ms — PASS
- `reflection_rca: submitRootCause records the approving human as actor,
  and approvePlan by that SAME human is still denied by
  DeviationSelfApprovalDeniedError` — 598ms — PASS (this is the exact
  scenario `kpiTeresaRcaDraft.ts` wires the UI to)

First attempt failed with `Hook timed out in 30000ms` — the machine had
10+ concurrent `tsc`/`vite build` processes from parallel lanes at the
time (verified via `ps aux`), and the file's own `beforeAll`/`itDB` hooks
hard-code a 30s timeout as a literal second argument (not overridable by
`--hookTimeout` CLI flag once a call site passes its own number). I
temporarily bumped those three literals to `120_000`, confirmed 2/2 PASS,
then reverted the file byte-for-byte to its original committed content
(`diff` confirmed identical) before finishing — no product or test-logic
change, purely a one-time environmental accommodation for this run.

Cleaned up: `pg_ctl -D /tmp/g5teresa_pgdata stop`, `rm -rf
/tmp/g5teresa_pgdata`, ephemeral `consultinity_test` database discarded
with the datadir — no residue.

## 6. Negative controls (sabotage → confirm red → revert)

Three performed this session, each with the sabotage diff shown, the
resulting failure, and confirmation the revert restored the original file
byte-for-byte:

1. **"Ask Teresa" disabled-until-filled** — sabotaged
   `KpiDeviationCaseSubview.tsx`'s button to `disabled={false}` (hard-coded,
   ignoring form state). `teresaKpiRcaWorkspace.component.test.tsx`'s first
   test went RED (`expect(askTeresaBtn).toBeDisabled()` failed — "Received
   element is not disabled"). Reverted; `diff` against the pre-sabotage
   backup confirmed no unintended residue; full 4-test file green again.
2. **"Teresa nie zatwierdza sama"** — added a new assertion to the KPI
   happy-path test (`expect(executeTeresaProposal).not.toHaveBeenCalled()`
   immediately after approve, before the explicit execute click), then
   sabotaged `TeresaProposalPanel.tsx`'s `handleApprove` to call
   `handleExecute()` automatically after a successful approve. Test went
   RED (`expected "vi.fn()" to not be called at all, but actually been
   called 1 times`). Reverted; `diff` against backup confirmed byte-for-byte
   identical restoration; full suite green again.
3. **Real-Postgres self-approval denial** (§5) — not a sabotage-cycle (the
   assertion already existed, pre-written, in a file outside authorship by
   me), but independently CONFIRMED GREEN against a real, freshly-built
   Postgres this session, which is itself the strongest form of proof for
   this specific invariant: `approvePlan` by the human who both created the
   case AND approved+executed the Teresa `reflection_rca` proposal is
   rejected with `DeviationSelfApprovalDeniedError`, and the case row is
   unchanged after the denial (`status` still `plan_required`,
   `plan_approved_by` still `NULL`).

## 7. Test results — three states

Static/component (vitest, mocked/no DB):

| File | Passed | Failed | Skipped |
|---|---|---|---|
| `tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts` (pre-existing) | 5 | 0 | 0 |
| `tests/resultsVnext/teresa-roi-forbidden-verbs.test.ts` (pre-existing) | 7 | 0 | 0 |
| `tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts` (pre-existing) | 9 | 0 | 0 |
| `tests/components/ResultsVNext/teresa/TeresaProposalPanel.test.tsx` (from WIP, verified this session) | 5 | 0 | 0 |
| `tests/resultsVnext/kpi/teresaKpiRcaWorkspace.component.test.tsx` (new, this session) | 4 | 0 | 0 |
| `tests/components/ResultsVNext/KpiDeviationCaseSubview.test.tsx` (pre-existing, mock fixed) | 3 | 0 | 0 |
| **Total** | **33** | **0** | **0** |

Real-Postgres (this session, ephemeral PG built by me):

| File | Passed | Failed | Skipped |
|---|---|---|---|
| `tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` | 2 | 0 | 0 |

Not re-run this session (pre-existing, out of scope — server-side, already
proven by prior sessions per repo history): `roiPirTeresaDisposition
.realdb.test.ts`, `teresaPirLessonsDraft.realdb.test.ts`,
`okrReflectionTeresaDraft.realdb.test.ts`, `p08-teresa-e2e-lifecycle
.test.ts`, `p08-teresa-canon.test.ts`, `p08-teresa-service.test.ts`,
`p08-artifact-studio-teresa-bridge.test.ts`.

## 8. Gates before commit

- `grep -rn "window\.\(prompt\|confirm\|alert\)(" src/components/ResultsVNext/` →
  ONE hit, a comment documenting the REMOVAL of a prior `window.prompt`
  (`okr/OkrCarryForwardDialog.tsx:4`) — no executable native dialog.
- `git diff --check` → clean, no whitespace conflicts.
- `bash scripts/check-list-canon.sh` → `EXIT 0` — "brak NOWYCH naruszeń
  kanonu tabel (staged: 5 plików; naruszeń 0, baseline 0 — dług nie
  rośnie)".
- `bash scripts/check-artefakt.sh` → `EXIT 0` — "brak nowych naruszeń
  crimson w powłoce artefaktów (aktualnie 7, baseline 7 — dług nie
  rośnie)".
- `npx vite build` → **PASS**, `✓ built in 29m 35s` (severely contended host
  — `uptime` showed load averages 260–500 with 24 concurrent `tsc`/`vite
  build` processes from parallel lanes at the time; on an idle host this
  would be a fraction of that), zero build errors, `10221 modules
  transformed`. Only warnings: pre-existing "chunk larger than 500kB"
  advice (this repo's whole-app bundle, not something this lane's ~15 new/
  changed files could plausibly be the sole cause of, though I did not
  diff a clean baseline build to confirm that precisely).
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **PASS, EXIT 0**
  (verified by the successor session that took over after this session's
  network crash — see §12).

## 12. Successor verification pass (2026-08-12, after a network-crash handoff)

A different session picked up this work uncommitted after the above author
crashed mid-run. Before trusting any claim in §1-11, the successor
independently re-verified rather than copying this document's numbers
forward:

- **Committed** the WIP in 3 commits (shared Teresa panel + ROI wiring;
  KPI `reflection_rca` wiring; this evidence packet + screenshots) —
  `git log --oneline -3` on `rn-g5-teresa` shows them in that order.
- **Re-read every file in the diff** (all 11 WIP files + all new KPI-lane
  files) end to end — confirmed the assessment in §1 is accurate, not
  self-graded fiction.
- **`tsc --noEmit`**: ran it fresh, `EXIT_CODE=0`, empty output (0 lines) —
  the one fix described in §1 (`errorText` branch) is real and holds.
- **`bash scripts/check-list-canon.sh`** (full-repo fallback, staging was
  empty after commit): `EXIT 0`, 408 violations vs baseline 409 — debt
  DROPPED by 1, does not increase.
- **`bash scripts/check-artefakt.sh`**: `EXIT 0`, 7/7, baseline unchanged.
- **`grep -rn "window\.\(prompt\|confirm\|alert\)(" src/components/ResultsVNext/`**:
  one hit, the same pre-existing removal-comment in `OkrCarryForwardDialog.tsx`
  — confirmed, not an executable dialog.
- **`git diff --check`**: clean.
- **`npx esbuild dev-render/screens/results-vnext-teresa-kpi-deviation.tsx --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null`**:
  `EXIT 0` (tsc does not cover `dev-render/`, per `tsconfig.json`'s
  `include`, so this is the correct substitute gate, not a full build).
- **Re-ran all 6 Teresa-relevant test files together** (not the full
  suite): `tests/resultsVnext/teresa-{kpi,roi,okr}-forbidden-verbs.test.ts`,
  `tests/components/ResultsVNext/teresa/TeresaProposalPanel.test.tsx`,
  `tests/resultsVnext/kpi/teresaKpiRcaWorkspace.component.test.tsx`,
  `tests/components/ResultsVNext/KpiDeviationCaseSubview.test.tsx` — **33
  passed, 0 failed, 0 skipped**, matching §7's table exactly.
- **Independently reproduced TWO of §6's negative controls from scratch**
  (did not just trust the prior session's narrative of having done them):
  1. Sabotaged `TeresaProposalPanel.tsx`'s `handleApprove` to call
     `handleExecute()` immediately after a successful approve (the exact
     "Teresa zatwierdza sama" failure mode). RED: 2 tests failed in
     `TeresaProposalPanel.test.tsx` (execute fired before the explicit
     click, `teresa-execute` testid never reached in its expected state);
     in `teresaKpiRcaWorkspace.component.test.tsx` the happy-path test
     failed on `expect(executeTeresaProposal).not.toHaveBeenCalled()`
     with "actually been called 1 times" — the literal assertion this
     lane's design depends on. Reverted via `cp` from a pre-sabotage copy;
     `git diff --stat` on the file was empty (byte-for-byte restore); both
     files green again (9/9 passed).
  2. Sabotaged `KpiDeviationCaseSubview.tsx`'s "Ask Teresa" button to
     `disabled={false}` (hard-coded, ignoring form state). RED:
     `teresaKpiRcaWorkspace.component.test.tsx`'s first test failed
     (`toBeDisabled()` — "Received element is not disabled"). Reverted via
     `cp`; `git diff --stat` empty; full 4-test file green again.
- **Visually inspected 4 of the 7 screenshots** (01, 02, 04, 05, 07) pixel
  by pixel via the Read tool, not just trusted the filenames: each matches
  its claimed phase (disabled state with empty fields, open proposal with
  evidence sections populated, unavailable banner with the real network
  error string, denied-execute red banner with the exact guard message,
  and the post-close case screen showing Phase 2 done / Phase 3 active /
  CAS version bumped 2→3). Did NOT inspect 03 or 06 individually — flagged
  as not independently re-verified (though their names and the passing
  automated tests covering the same states make fabrication unlikely).
- **Did NOT re-run**: `npx vite build` (§8's claimed 29m35s pass is
  UNVERIFIED by this successor — time budget did not allow a second
  30-minute build on a lane whose files hadn't changed since that claimed
  run) and the real-Postgres test (§5 — UNVERIFIED by this successor; no
  ephemeral Postgres was built this pass). Both are flagged NIEZMIERZONE
  for this verification pass specifically, not for the lane as a whole.
- **Did NOT independently verify**: cross-tenant/restricted-outsider
  behavior, idempotency-on-retry, or capability-preflight-as-distinct-step
  — §10 already flags these as gaps in the original author's own evidence
  and this successor found no new information to close them.

## 9. Interactive proof — screenshots (real production component, real clicks)

All screenshots in `docs/qa/screens/rn-g5-teresa-2026-08-12/`, taken via
`dev-render/shot.mjs` (Playwright, real browser) against the dev-render
harness `?screen=results-vnext-teresa-kpi-deviation`, mounting the REAL
`<KpiDeviationCaseSubview>` — zero reimplementation. Every screenshot after
the first is the result of REAL clicks (via `--eval`'s scripted
`element.click()`/`dispatchEvent('input')` calls, or via the MCP browser's
`computer` tool clicking real refs from the accessibility tree), not a
pre-set component prop.

1. `01-kpi-phase2-ask-teresa-disabled.png` — Phase 2 before any input:
   "Poproś Teresę o zapis przez pipeline" visibly present but disabled
   (matches negative-control #1, §6).
2. `02-kpi-teresa-proposal-open.png` — AFTER filling both fields and
   clicking the button: modal open, log shows "Propozycja utworzona —
   czeka na Twoją decyzję", "Proponowana zmiana" shows the human's own
   typed text verbatim, `FAKTY`/`REKOMENDACJA TERESY`/`ODWOŁANIA` sections
   populated, `Zatwierdź`/`Odrzuć` buttons present.
3. `03-kpi-teresa-approved-ready-to-execute.png` — AFTER clicking
   `Zatwierdź`: panel shows `Wykonaj`/`Odrzuć`, "Podgląd konsekwencji" text
   visible.
4. `04-kpi-teresa-unavailable-manual-fallback.png` — `&teresaDown=1`, AFTER
   filling fields and clicking "Ask Teresa": "Teresa jest teraz
   niedostępna" banner, real network-error message
   (`Network error contacting /api/v8/teresa/proposal: dev-render
   teresaDown=1: simulated network failure...`), "Spróbuj ponownie"/
   "Kontynuuj ręcznie" buttons both present.
5. `05-kpi-teresa-denied-execute.png` — `&teresaDeny=1`, AFTER
   fill→ask→approve→execute: "Wykonanie zablokowane" red banner with the
   exact denial message, "Nic nie zostało zapisane w domenie" note,
   "Zobacz ślad audytowy" button.
6. `06-kpi-teresa-execute-completed.png` — happy path, AFTER
   fill→ask→approve→execute: "Zapisano" green banner with a real
   `taudit-N` audit-entry id from the mock's own audit trail.
7. `07-kpi-case-phase3-active-cas-bumped.png` — AFTER closing the modal:
   the underlying case screen shows Phase 2 now DONE (green check,
   "Przyczyna: ..."/"Kategoria: ..." showing exactly what was typed),
   Phase 3 now the ACTIVE phase, and "Wersja (CAS)" in the right panel
   bumped from 2 to 3 — proof `onCompleted`'s server re-fetch (`loadCase()`)
   picked up the REAL domain write, not a locally-approximated one.

Console: zero errors in every `shot.mjs` run (script prints `KONSOLA-BLEDY`
only when `console.error`/`pageerror` fired — never appeared). Network:
zero `SIEC-4XX5XX` in every run — note this check only sees requests that
actually reach the browser's network stack; the Teresa mock in the
dev-render harness constructs `Response` objects directly inside the
`window.fetch` override (same technique the ROI harness already uses), so
even the intentionally-500 `teresaDeny` and intentionally-failed
`teresaDown` scenarios never appear as network-layer events — this is
expected and matches the pre-existing ROI harness's own behavior, not a
gap in the check.

## 10. What this does NOT prove (mandatory honesty section)

- **OKR is entirely unwired.** Zero Teresa affordance exists anywhere in
  `src/components/ResultsVNext/okr/`. The server has 5 governed advisor
  modes (`objective_draft`, `objective_quality_review`, `check_in_assist`,
  `manager_brief`, `reflection_synthesis`) — none reachable from any OKR
  screen. This is a full gap, not a partial one.
- **KPI's other two advisor modes are unwired.** `draft_quality_review`
  (drafting a brand-new KPI) and `check_in_manager_brief` have real
  server-side handlers (`teresaCopilotService.ts`) but no client call
  site anywhere in this codebase.
- **Cross-tenant / restricted-outsider behavior for Teresa** — NOT
  independently verified this session. No new test in this package
  exercises a second organization or a restricted-visibility user against
  either wired mode. This is a real gap in MY evidence, not a claim that
  the underlying protection doesn't exist (server-side ABAC almost
  certainly still applies, since neither `submitRootCause` nor
  `recordRoiPirTeresaLessonsDraft` bypasses the pre-existing
  visibility-scoped read/write path) — but I did not prove it myself.
- **Idempotency-on-retry** — NOT literally tested (no test double-submits
  the same `idempotencyKey` and asserts a single resulting write).
- **Capability/permission preflight as a DISTINCT, separately-observable
  step** — the panel's copy says "Sprawdzam uprawnienia i wykonuję
  autoryzowaną komendę…" but this is one HTTP call (`execute`), not two;
  there is no client-observable moment where a permission check succeeds
  or fails independently of the domain command itself. This matches how
  the pre-existing ROI mode already works (not a regression I introduced),
  but it means "sprawdzenie uprawnień przed wykonaniem" is implicit in the
  execute call's success/failure, not a separately provable stage.
- **The disposition/second-gate check for KPI does not exist** because, per
  the design, `reflection_rca` has no second gate — this is a deliberate
  divergence from ROI's two-gate structure, documented in
  `kpiTeresaRcaDraft.ts`'s header, not an oversight. A reviewer should
  confirm this reading of the design is correct; I believe it is (matches
  `KPI_E006_TERESA_DESIGN.md` and the pre-existing real-Postgres test's own
  expectations), but flag it as the one place this lane's design judgment
  could be second-guessed.
- I did NOT run the full `npm run test:component`/`test:l1` etc. suites —
  only the specific Teresa-related and KpiDeviationCaseSubview files, per
  the "esbuild per plik, zakaz pełnego vitest u robotników" hygiene rule.
  A full-suite regression elsewhere in the ~2000+ file test corpus is
  possible and unmeasured.

## 11. Allowlist compliance

Touched outside the literal allowlist patterns, with reason:
- `tests/components/ResultsVNext/KpiDeviationCaseSubview.test.tsx` — not
  under `tests/resultsVnext/teresa*`; fixed a regression I caused (see §2).
- `tests/components/ResultsVNext/teresa/TeresaProposalPanel.test.tsx` —
  inherited from the cherry-picked WIP commit at this exact path; also not
  literally under `tests/resultsVnext/teresa*`. Kept as-is (moving it would
  be pure churn with no benefit).

Nothing under `src/components/standard/**` or `src/components/shared/**`
was touched. Nothing under `server/**` was touched (the KPI `reflection_rca`
backend was already complete and already had a passing real-Postgres test
before this session started — verified by running it, §5).
