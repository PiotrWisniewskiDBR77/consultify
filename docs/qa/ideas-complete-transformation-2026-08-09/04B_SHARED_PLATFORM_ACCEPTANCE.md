# Shared platform acceptance — E02 Action Registry, E03 Shell/navigation

Naming note: filed as `04B` — `04` was already taken by `04_ACTION_COVERAGE_INVENTORY.csv` in this
directory. See `00_PROGRAM_STATUS_AND_VERSION.md` for the full resolution.

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon: `docs/standards/idea-workspace/02_REJESTR_AKCJI.md` (E02), `03_ARCHITEKTURA_EKRANU.md` + chapter 13 (E03). DoD source: `docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4 E02/E03.

## 1. Four-state summary

| State | E02 Action Registry | E03 Shell/navigation |
|---|---|---|
| Code exists | Yes — `src/actions/ideaActionRegistry.ts`, 231 actions, 10,696 lines | Yes — chapter 13 N0–N8 packages |
| Mounted in a real consumer | Yes, verified this session (see §2) | Implemented (chapter 13 marked "implemented candidate — acceptance evidence pending") |
| Executed at runtime | NOT VERIFIED (no live server/browser session in this program) | NOT VERIFIED |
| Persisted and read back | N/A (registry is client-side command routing, not itself persisted state) | NOT VERIFIED |

## 2. E02 — evidence, verified directly this session

- `bash scripts/check-actions.sh` rerun: **PASS — 231 actions, 124 runtime strings, 7 events, 4 API
  methods, R1–R10 all clean.** This count matches the independently-generated
  `15_ALL_ACTIONS_INVENTORY.csv` exactly (231 rows, cross-checked below).
- `04_ACTION_COVERAGE_INVENTORY.csv` (the existing, untouched-by-this-task file): 264-construct
  baseline, classified 76(a)/152(b)/0(c)/0(d)/36(resolved) — QG-02 is RESOLVED per `deb103fcde`'s
  own commit body, which records an orchestrator catching and reversing a prior overclaim (4 rows
  had a registered id but no rewired call site) before letting the corrected 0/0 stand. This
  program's own history contains a real caught-and-fixed overclaim, not just a clean pass — cited
  here as evidence the RESOLVED status is not self-attestation.
- `15_ALL_ACTIONS_INVENTORY.csv` (built for this delivery package, see §16-adjacent item):
  generated programmatically from the live registry (Python, block-scoped regex over the
  `IDEA_ACTIONS` array, not hand-typed) — 231/231 actions parsed, 0 blank ids, 0 duplicate ids, 0
  blank sources, and the mutates=true/undo-required invariant (R4) holds for all 144 mutating
  actions (0 missing an undo kind).
- **QG-01 (registry monolith split) is still OPEN** — 10,696 lines, single file. Not attempted by
  this task (out of scope: this task's job was the delivery package, not registry refactoring).
- teresa-callable: all 231 actions carry a `teresa: {}` block (mandatory per R9/Z4) — 231/231
  "yes" in the inventory. This means every registered action is *reachable* by Teresa's tool
  manifest generator, not that Teresa has been runtime-tested invoking each one.

## 3. E03 — evidence

- 00_PROGRAM_STATUS_AND_VERSION.md's own reconciliation (2026-08-10, QG-06 pass) already states
  chapter 13 is "IMPLEMENTED (chapter 13 N0–N8), acceptance NOT VERIFIED" and that chapter itself
  is headed "implemented candidate — acceptance evidence pending" in its own source file — this
  report does not relax that; it is restated here because §16 requires an E03-adjacent shared-
  platform acceptance file and no independent runtime pass was performed by this task to change it.
- Baseline four-scene readback (Program A, `93ebc3aa20`/`96ed5637cb`) confirmed geometry (info
  panel left / tool rail right), the mandatory 4-representation switcher with correct PL a11y names,
  and canvas content surviving representation switch — via the dev-render harness (mock data, no
  login), **not** a live authenticated server. That distinction matters: it proves the shell
  renders and wires correctly against static mock props, not that it round-trips through the real
  backend.

## 4. What this report does NOT claim

- No live-server, authenticated-session runtime pass was performed for either E02 or E03 by this
  task. "Mounted in a real consumer" above means: the registry's `runIdeaAction`/`runTblLegacyToolbarAction`
  call sites exist in the actual component files that render in production, verified by grep and by
  the guard's own R6 (every runtime string has a receiving hook) — not that a browser click was
  observed reaching the server.
- QG-03 (the full runtime→persistence→cold-reopen chain, doc 11 §3.4/§3.7) has not run for any tool
  at this SHA. This report inherits that gap; it does not close it.

## 5. Verdict

**E02: IMPLEMENTED and machine-verified at the registry/coverage layer (231/231 actions, 0
unresolved coverage debt); QG-01 (split) open; runtime/Teresa-invocation NOT VERIFIED.**
**E03: IMPLEMENTED per commit record and baseline mock readback; acceptance NOT VERIFIED** — both
consistent with, and not superseding, `00_PROGRAM_STATUS_AND_VERSION.md`'s Program A/B rows.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** QG-01 (this
doc's own "open" item above) is now RESOLVED — the 10,696-line monolith was
split into a 404-line barrel plus `src/actions/registry/*`, 231/231 action
bodies byte-identical, verified 2026-08-10 at `4afa10c31b`; see
`16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-07. Registry action counts were
UNCHANGED at that point in the wave (231/124/7/4) — RISK-30's fix changed
action *semantics* (a truthful `confirmed` field on `ActionResult`), not
registry shape or count.

**CORRECTION, same day (HEAD `bcdda752b7`):** the paragraph above was
overtaken within hours. `check-actions.sh`'s rc=1 (3 unregistered
`FinancialCaseDialog` handlers) was closed by commit `a537a022e2`, which
added `table.financial_case.{save,save_and_close,retry}` to the registry
(mirroring `table.record_template.*`, ids placed per R11's `ORIGINAL_ORDER`)
and routed the dialog's handlers through `runIdeaAction`. **Registry count is
now 234/124/7/4, `check-actions.sh` rc=0.** See
`10_FINANCIAL_CASE_ACCEPTANCE.md` §8. **Still true and unchanged: E02/E03
runtime/Teresa-invocation acceptance was not re-run this wave** — remains
NOT VERIFIED.
