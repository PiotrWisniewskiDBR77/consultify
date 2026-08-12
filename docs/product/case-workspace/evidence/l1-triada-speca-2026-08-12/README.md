# L1 — VISUAL_TRIADA_SPEC_A_LEDGER.csv truth pass (2026-08-12)

Packet L1, Case Workspace V1 program. Worktree
`/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`, branch
`claude/case-workspace-v1-20260809`, starting HEAD `e3d616b4b1`.

Allowlist for this packet: `docs/product/case-workspace/acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv`
(append-only) and this evidence directory. No product code, no other CSV, no
`ledger-report.mjs` was touched.

## 1. What was found on arrival

The ledger has 235 rows, extracted 2026-08-09 from `TRIADA_KANON.md`,
`ARTIFACT_ANATOMY_STANDARD.md`, `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` and the
Case Workspace canon docs (00–14). Every single row was `status=NOT_IMPLEMENTED`,
`implementation_path`/`test_ref`/`evidence_ref` empty, `actor=claude-coordinator`,
`candidate_sha=80d75f24ce...` (the extraction commit, not a proof commit). This
confirmed the coordinator's finding: the file had 0% evidence in either
direction since extraction, despite real UI work landing on the branch since
(commits `778c2fb058` through `e3d616b4b1`, including five dated
`evidence/{e5,f1,f2,f3,g1}-*-2026-08-12/` packets described in this task's
brief).

## 2. Method

1. Read `docs/ui-standards/TRIADA_KANON.md` (full, including the 40-point
   checklist) and `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§10.2,
   §11.2, §13, §18.1) to have the canon in hand before judging any row.
2. Read all 235 `requirement_text` values in full (not truncated) to build a
   map of which rows are: (a) narrow/atomic and could plausibly be closed by a
   single fix, vs (b) compound (bundle 3–10 sub-clauses in one sentence,
   typical of the DoD/canon extraction style) and therefore cannot be fully
   closed by partial evidence without over-claiming.
3. Opened and read, in full, all five evidence directories named in the task
   brief: `e5-a11y-matrix-2026-08-12`, `f1-back-button-a11y-2026-08-12`,
   `f2-bottomnav-contrast-2026-08-12`, `f3-partial-skipped-2026-08-12`,
   `g1-nav-active-canon-2026-08-12`. For each, confirmed via `git log --oneline
   -1 -- <dir>` that the evidence is committed and via `git merge-base
   --is-ancestor <sha> e3d616b4b1` that the commit is a real ancestor of this
   worktree's HEAD (all five: yes — `778c2fb058`, `b4a513bac0`, `8c4ddd9f07`).
4. Personally re-ran the two guard tests cited as evidence
   (`src/components/shared/NModeLayout/__tests__/NModeHeader.a11y.test.tsx`,
   `tests/components/navigation/BottomNavigation.activeStateCanon.test.tsx`)
   via `npx vitest run <files>` — not the full suite, per this packet's HARD
   RULES. Result: 2 files, 8/8 passed (transcript below, §4).
5. Statically confirmed the cited implementation paths exist and contain the
   claimed code (`grep`/`Read` on `apiResults.ts`, `RezultatyView.tsx`,
   `NModeHeader.tsx`, `BottomNavigation.tsx`).
6. For each of the ~15 rows that looked like plausible candidates
   (crimson/focus/active-state/PARTIAL-literal rows), checked whether the
   evidenced component is actually the SAME UI object the row is talking
   about, not just semantically adjacent. This ruled out more rows than it
   confirmed (§5 below).
7. Applied the six-point closing rule literally to the two rows that survived
   step 6, and wrote them as new, superseding rows (`-U1` suffix, following
   the exact convention already used in `EPIC_DOD_COVERAGE.csv` /
   `GOLDEN_CASE_EVIDENCE_LEDGER.csv`: new `row_id`, `supersedes_row_id` points
   at the row being corrected, historical row left untouched).
8. Did NOT run the full test suite, the 30-minute long-run test, or start/
   restart the backend on :3001. Did NOT stamp a candidate SHA — both new rows
   carry `PENDING-CANDIDATE-SHA`, matching the convention already used
   elsewhere in this program for uncommitted-candidate rows.

## 3. Rows closed/upgraded — 2 of 235

### CW-RT-038 → CW-RT-038-U1 (NOT_IMPLEMENTED → IMPLEMENTED_AND_PROVEN)

Requirement: *"UI Częściowo zakończone derives from explicit PARTIAL, never
from warnings or node counts."*

Six-point check:
1. **Code exists**: `src/components/CaseWorkspace/apiResults.ts:145-158`
   (`resultAcceptanceLabel`) switches literally on the backend
   `result_acceptance` enum value; `RezultatyView.tsx` is the real, routed
   "Wyniki wykonania kroków" table that calls it.
2. **Real consumer**: `RezultatyView.tsx` is mounted inside `CaseDetailScreen`
   under the Rezultaty tab — a real, routed screen, not a fixture — confirmed
   by F3's own screenshots taken against the live dev server.
3. **Test/check covers exactly this**: F3's `drive-states.mjs` drove the real
   HTTP API against the real backend and real disposable Postgres to produce
   an actual `result_acceptance='PARTIAL'` row (server enum in
   `server/src/routes/caseWorkspace/executionGraph.routes.ts:58`), confirmed
   by direct `psql` readback, then opened the live UI and confirmed the label
   rendered is `Częściowo zakończone` with `tone=warning` — i.e., it
   demonstrates the derivation is driven by the explicit backend value, not
   by counting nodes or reading a warnings array.
4. **Evidence as file**: `docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/README.md`
   plus `drive-states-output.json`, `run-results.json`, and 10 screenshots
   (desktop/mobile × light/dark, including a refresh and a close/reopen
   check).
5. **Right layer**: a live-stack drive-and-capture (real backend, real DB,
   real DOM) is the correct layer for a UI-derivation claim — a unit test
   asserting `resultAcceptanceLabel('PARTIAL') === 'Częściowo zakończone'`
   would prove the label function but not that the real screen actually
   receives and displays that exact backend value end to end; F3 proves the
   latter.
6. **Real SHA**: `b4a513bac0` (F3's commit), confirmed an ancestor of HEAD
   `e3d616b4b1` via `git merge-base --is-ancestor`.

All six pass. Marked `IMPLEMENTED_AND_PROVEN`. This packet did not re-run F3's
live-stack drive itself (would require starting the coordinator-owned backend
on :3001, prohibited by this packet's HARD RULES) — it re-read the evidence
file in full and independently confirmed the cited code exists and matches
the described behaviour by static inspection.

### CW-DOD-H7 → CW-DOD-H7-U1 (NOT_IMPLEMENTED → PARTIAL, explicitly not closed)

Requirement: *"Automated a11y has zero critical/serious findings."*

This is a whole-module claim ("automated a11y", no screen qualifier), and the
evidence covers only 2 of the Case Workspace's screens (CasesListScreen,
CaseDetailScreen's Plan tab), 28 width×theme cells total. Within that scope:

- E5's baseline sweep found exactly 2 problems: 1 critical (`button-name`,
  the Menu 1 back button, all 14 Detail cells) and 1 serious
  (`color-contrast`, BottomNavigation labels, dark theme, <768px, 3 cells on
  each screen).
- F1 fixed the critical finding (`aria-label`/`title` on the back button) and
  re-verified 0 critical on all 14 Detail cells, with two independent
  negative controls (jsdom RED→GREEN, live-browser axe RED→GREEN).
- F2 fixed the specific contrast measurement E5 flagged on BottomNavigation
  (3.75:1 → 6.18:1, composed-background pixel sampling, both themes).
- G1 additionally fixed a crimson canon violation on the same component's
  active-state colouring (a canon-compliance fix, not an a11y-contrast fix —
  axe reported 0 `color-contrast` violations on this element before AND
  after, per G1's own README §4).

That is real, verified progress — but the requirement is not met: F1's own
re-verification sweep (§4 of its README) still recorded a serious
`color-contrast` finding on several cells, which its per-node inspection
attributed to the org-avatar chip ("CW") and two right-panel action buttons —
components no packet in this list has touched. "Zero critical/serious" is
therefore false for the one screen that was swept twice, and completely
unevidenced for every other Case Workspace screen (Realizacja tab, Rezultaty
tab, Plan Ekspercki/Lista sub-views, any mobile drawer/modal). Marked
`PARTIAL`, not `IMPLEMENTED_AND_PROVEN` — closing it fully would overclaim
past what the cited evidence actually shows.

## 4. Guard-test re-run transcript (personally executed, this packet)

```
$ npx vitest run src/components/shared/NModeLayout/__tests__/NModeHeader.a11y.test.tsx tests/components/navigation/BottomNavigation.activeStateCanon.test.tsx --reporter=verbose

 ✓ NModeHeader — F1 back-button accessible name (axe critical, 2026-08-12) > exposes an accessible name on the icon-only back button
 ✓ NModeHeader — F1 back-button accessible name (axe critical, 2026-08-12) > the accessible name does not duplicate the adjacent kebab (⋮) name
 ✓ NModeHeader — F1 back-button accessible name (axe critical, 2026-08-12) > clicking the named back button still invokes the real onClose (no behavior change)
 ✓ NModeHeader — F1 back-button accessible name (axe critical, 2026-08-12) > the back button is keyboard-focusable and reachable via Tab order
 ✓ BottomNavigation — active-state canon guard (G1, no crimson outside critical semantics) > paints no primary-*/crimson utility anywhere in the nav
 ✓ BottomNavigation — active-state canon guard (G1, no crimson outside critical semantics) > uses the canonical neutral token (text-c-text) for the active item
 ✓ BottomNavigation — active-state canon guard (G1, no crimson outside critical semantics) > uses an existing semantic token (bg-c-info) for the active indicator bar
 ✓ BottomNavigation — active-state canon guard (G1, no crimson outside critical semantics) > keeps the active item identifiable WITHOUT colour

 Test Files  2 passed (2)
      Tests  8 passed (8)
```

## 5. Rows considered and rejected — why they stay OPEN

These were the realistic candidates given the five evidence packets, and the
specific reason each was rejected (wrong UI object, wrong screen scope, or
compound clause not fully provable):

| Row | Text (short) | Why rejected |
|---|---|---|
| `TRIADA-M2-02` | Active Menu 2 pill = neutral, never crimson | `BottomNavigation` (G1's subject) is the global mobile primary-nav equivalent of the desktop `Sidebar`, not a module's "Menu 2" tab bar per `TRIADA_KANON.md`'s own definition (Menu 2 = in-module sub-navigation pills). Wrong UI object. |
| `CW-DOD-F6` | Active state is neutral, focus is blue | This DoD row is inside Group F, scoped specifically to the Zlecenia (Case list) SPEC-L screen's own controls (`14_COMPLETE_DOD...md:285-296`), not global app chrome. `BottomNavigation` sits outside that screen. |
| `MYWORK-FOCUS-COLOR` | Crimson never signals active tab...every icon-only control has an accessible name... | Compound, and each clause is a whole-app claim ("every icon-only control"). F1 fixed exactly one icon-only control; dozens of others are unaudited. Cannot close without overclaiming. |
| `CW-03-007` | Selection is neutral, crimson never signals selection | About row/node *selection* state (a Case Workspace interaction concept), not navigation *active-tab* state. Different concept, no evidence found for either. |
| `CW-DOD-F5` / `CW-SSOT-8-01` / `TRIADA-A11Y-03` / `ARTIFACT-A11Y` | various compound crimson/focus/contrast bundles | Each bundles clauses (contrast AND focus AND ARIA AND reduced-motion, etc.) where at least one clause has no evidence at all (e.g., reduced-motion, full keyboard navigation across every artifact screen). Marking any of them PARTIAL was considered but rejected as too speculative without reading every sub-clause's own evidence trail — left for a future packet with narrower, matching evidence. |
| `CW-DOD-E9` / `CW-CANON-14` | `PARTIAL`/`UNKNOWN`/`BLOCKED`/`EVIDENCE_MISSING` remain literal | Ambiguous reading (could mean "shown verbatim in end-user UI" or "kept as literal enum names in internal audit/status tracking, never softened into vague prose"). F3's own evidence shows the OPPOSITE of the first reading — the UI translates `PARTIAL` into the Polish label `Częściowo zakończone`, not the literal string. Rather than guess which reading is intended and risk a wrong closure, left untouched. |
| `ARTIFACT-STATUS-PILL` | Lifecycle status is a text pill, crimson forbidden | About the *lifecycle status* pill (draft/review/approved/rejected), a different field from F3's *result acceptance* pill (PARTIAL/ACCEPTED/REJECTED/NOT_APPLICABLE per NodeRun). No evidence exists for the lifecycle-status pill specifically. |

All other 226 rows: no evidence exists in this worktree that speaks to them
at all (verified by reading every `requirement_text` and checking it against
what the five evidence directories actually demonstrate) — they remain
`NOT_IMPLEMENTED`, unchanged, which is the honest state.

## 6. What would close the largest remaining group

The single largest concrete, actionable target visible from this pass is
**`CW-DOD-H7` fully** (and by extension several of the compound a11y rows in
§5's rejected list): the E5/F1 evidence already identifies the exact
remaining serious finding's location (org-avatar chip "CW" + two right-panel
buttons "Wczytaj ponownie"/"Wróć do listy zleceń", both on
`CaseDetailScreen`) — a future packet could fix those specific elements'
contrast (same pixel-sampling method F1/F2/G1 already established and
validated), re-sweep with axe on the same 28 cells, and if clean, that row
(and possibly `ARTIFACT-A11Y`'s contrast clause) would have a real path to
`IMPLEMENTED_AND_PROVEN` — still gated on extending the sweep to the
Realizacja/Rezultaty tabs and other sub-views, which have zero axe evidence
today.

## 7. What could not be verified by this packet

- Whether any of the 226 untouched rows are secretly already implemented
  elsewhere in the codebase outside these five evidence directories — this
  packet's scope (per the task brief) was to verify the SPECIFIC evidence
  named in the brief, not to conduct an independent implementation audit of
  all 235 requirements from scratch. That is a much larger undertaking than
  one packet's allowlist/time budget supports.
- A fresh, live axe-core sweep of the fix landing site — not re-run here
  (would require the coordinator-owned backend on :3001).
- VoiceOver/NVDA (already flagged `BLOCKED_BY_HOST_PERMISSION` elsewhere in
  this program; unrelated to this packet's scope).
