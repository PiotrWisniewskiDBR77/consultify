# 20 — E15: two consecutive clean rounds

Executed 2026-08-10 by the orchestrator at HEAD `c5b1b6e6b9`.
Supersedes `18_E15_ROUND1_BASELINE.md`, whose verdict ("round 1 NOT clean, one
confirmed regression") was correct when written. That regression is fixed, and a
second one it could not have seen was found and fixed with it.

## 1. Method — and why the first method was not enough

Both rounds run the same scope against the candidate, and the identical scope
against **`origin/demo` @ `9d17cac114`** in a throwaway worktree. Without that
A/B, a failure list says nothing: this repo carries substantial inherited debt,
and "31 files red" is meaningless until you know how many were red before.

Round 1's first pass compared **pass/fail per file**. That is not sufficient, and
this program has the scar to prove it:

> `tests/unit/mindmap/floatingNodeToolbar.test.tsx` was ALREADY failing at
> baseline (2 assertion failures). On the candidate it collected **0 tests**.
> Five passing tests vanished — and because the file was red on both sides, a
> per-file red/green diff reported "no change".

So both rounds are compared **per test, and by test count per file**. A file that
loses tests is now a first-class finding, on equal footing with a new failure.
Runs use `--reporter=json` so the comparison is on structured results, not on
grepped console output.

Command (identical for candidate and baseline):

```
npx vitest run tests/components/MyWork tests/unit/mindmap "src/components/MyWork/**/__tests__/**" \
  --retry=0 --reporter=json --outputFile=<out>.json
```

`--retry=0` is deliberate: retries hide flakiness, and flakiness is one of the
things these rounds exist to measure.

## 2. Results

| | Baseline `9d17cac114` | Round 1 | Round 2 |
|---|---:|---:|---:|
| Test files | 122 | 146 | 146 |
| Tests collected | 650 | **852** | **852** |
| Files that lost tests vs baseline | — | **0** | **0** |
| New failing tests vs baseline | — | **0** | **0** |
| Tests fixed vs baseline | — | **11** | 11 |
| Differences between round 1 and round 2 | — | — | **0** |

**Verdict: two consecutive clean rounds. No new P0/P1 at the test level.**

Round 1 and round 2 are byte-identical in outcome — every test that passed in one
passed in the other, and the collected count matches exactly. **Zero flakiness**
across the two runs. That matters here specifically: an earlier round-1 attempt
found two realdb suites that failed only inside a large batch and passed in
isolation, which is exactly the kind of noise that can fake a regression. It did
not recur.

The candidate carries **+202 tests** over baseline and **fixes 11** tests that
fail on `origin/demo`.

## 3. The regressions that were found and closed

Both were introduced by this program, both are fixed, and both are recorded here
rather than being quietly absorbed into the inherited-debt bucket.

**R-1 — `IdeaWorkspaceTools.inspector.test.tsx`, density rule.** Asserted "at most
5 top-level sections", reported 10. The tempting fixes — raise the limit to 10, or
delete UI — were both wrong. Five of the ten titles are E08's maturity-gate stage
rows (Spark, Growing, Shaping, Ready, Promoted) **nested inside** the Status
section; the panel still has five top-level sections. The measurement was broken,
not the panel: the selector matched `button > span.uppercase.tracking-wide`, a
visual SHAPE that the maturity gate legitimately reuses. Fixed with a
`data-idea-section-header` marker stamped by the `Section` component, so the
guard counts meaning rather than appearance. Negative control: injecting a real
sixth top-level section fails with `expected 6 to be less than or equal to 5`.

**R-2 — the invisible one.** Two `tests/unit/mindmap/*` files replace the whole
`react-i18next` module with `vi.mock`. The locale sweep added `useTranslation` to
a component in their import graph, that graph reached `src/i18n.ts`, and the
partial mocks did not return `initReactI18next` — so the files failed to
COLLECT. One of them was already red, which is what made it invisible. Both
mocks completed to the shape `tests/setup.ts` already uses; four further files
carrying the same latent hole were hardened before they could detonate.

**R-3 — `processflow-panels.test.tsx > closes on Escape key`.** A genuine
behaviour regression, not a test artefact: before the canvas context menus were
unified onto the shared `CanvasContextMenu`, each tool listened on `document` and
closed on Escape from anywhere; the shared component only handles Escape via a
React `onKeyDown` on the menu div. All seven consumers silently lost that. A
document-level listener was restored, guarded on the target being outside any
menu surface so it can never double-fire with the React handler.

## 4. What "clean" does and does not mean here

**Does mean:** relative to `origin/demo`, on this scope, the candidate introduces
no new failing test and loses no test, twice in a row, with no flakiness.

**Does NOT mean:**
- the suite is green — it is not, and neither is baseline. The inherited failures
  (i18n raw-key mocks, `CanvasContextMenu` roving tabindex, `AITableProposal`,
  `TablePlatformFrontend` "AI Table Builder", `RowDetailPanel.comments`) fail
  identically on both sides and were deliberately not adopted or "fixed" blind;
- anything about surfaces this scope does not reach. Server-side evidence lives
  in `13_RUNTIME_GATE_EVIDENCE.md`; browser-surface evidence is the visual matrix
  and is **not** a substitute for the owner's acceptance;
- that the two `RowDetailPanel.comments` / `TablePlatformFrontend` files are
  acceptable — they are pre-existing debt, still open, and still failing.

## 5. Scope note, stated rather than buried

This scope is the Idea Workspace surface: `tests/components/MyWork`,
`tests/unit/mindmap`, and colocated `src/components/MyWork/**/__tests__/**`. It is
not the whole repository. A prior round used a differently-curated 245-file list;
the numbers here are not comparable to it, and no attempt is made to pretend they
are. The full-repo suite was not run — running it is not blocked, it simply was
not part of this gate, and claiming otherwise would be the kind of quiet scope
inflation this program exists to avoid.

---

## RETRACTION 2026-08-11 — this document's PASS is withdrawn

**The two "clean rounds" recorded above measured a scope that silently excluded
59 test files, and a real regression was hiding in the excluded tier.**

### What went wrong

The runs passed `"src/components/MyWork/**/__tests__/**"` as a CLI argument.
Vitest treats CLI arguments as path *filters*, not shell globs — quoted, it
matched **nothing**. Verified after the fact against the stored JSON: of the 146
files in each round, **zero** were colocated `src/components/MyWork/**/__tests__/`
files. The real scope is **208 files**; 59 were never run in either round.

This is precisely the failure mode this program documents and guards against —
silent truncation reading as full coverage — committed by the round that exists
to catch exactly that. The lesson the rounds themselves recorded ("compare test
COUNTS, not just pass/fail") was the right lesson at the wrong level: I compared
counts *within* the scope and never checked the scope itself.

### What was hiding there

`src/components/MyWork/canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx`
— **4 passed at `origin/demo` (9d17cac114), 4 failed on the candidate.** Bisected
across nine commits: the transition is exactly at **`93ebc3aa20`**, this program's
FIRST commit ("E00: forward-port Ideas navigation/context-menu unification").

The failures are real keyboard-accessibility losses, not test noise:
```
expected <body> to be <div class="react-flow__node" …>   // focus not restored to the node trigger
expected <body> to be SVGGElement{…}                      // focus not restored to the edge trigger
expected <body> to be <div class="react-flow__pane" …>    // focus not restored to the pane trigger
expected -1 to be greater than or equal to 0              // no menuitem carries tabIndex >= 0
```

It compounds a second mislabelling: "roving-tabindex gaps in the shared
`CanvasContextMenu`" has been carried on this program's **known pre-existing
failures** list for weeks. It is not pre-existing. It is this program's own
regression, and being on that list is what kept anyone from bisecting it.

### Consequence

- **E15 is NOT PASS.** The gate board reverts to E15 = FIX_REQUIRED.
- Both rounds must be re-run on the corrected 208-file scope, and the scope must
  be **proven from the run's own JSON** (file count and a named spot-check),
  never from the command line that was typed.
- Two entries on the "known pre-existing" list are now suspect on principle. Any
  item on that list that has never been A/B'd against `origin/demo` must be
  treated as unverified rather than as inherited debt.

### Rule added

A scope is not a scope until the run itself proves it: assert the file count and
assert that a named file you expect is present. A filter that matches nothing
exits 0 and looks identical to a filter that matches everything and passes.

---

## RE-RUN 2026-08-11 — corrected scope, scope proven from the run itself

The retracted rounds are replaced. Scope is now passed as real directories, and
— the point of the correction — **proven from each run's own JSON**, never from
the command line that was typed.

```
npx vitest run tests/components/MyWork tests/unit/mindmap src/components/MyWork \
  --retry=0 --reporter=json --outputFile=<out>.json
```

Scope assertion, printed for every run: **208 files · 59 colocated
`src/components/MyWork/**/__tests__/` · `whiteboardContextMenu` present: True.**
The old rounds reported 146 / 0 / False.

| | Baseline `9d17cac114` | Round 1 | Round 2 |
|---|---:|---:|---:|
| Test files | 155 | 208 | 208 |
| Tests collected | 887 | **1239** | **1239** |
| Files that lost tests vs baseline | — | **0** | **0** |
| New failing tests vs baseline | — | **0** | **0** |
| Tests fixed vs baseline | — | **13** | 13 |
| Round 1 vs round 2 differences | — | — | **0** |

**Two consecutive clean rounds, no flakiness, on a scope that is 53 files and
352 tests larger than the one the withdrawn rounds measured.**

### What the corrected scope caught immediately

The first corrected round found a new failure the old scope could never see:
`IntakeJwtPanel.test.tsx > renders the intake summary…` expected `2 fields` and
got the raw key `ideas.table.intakeJwt.fieldCount`.

Diagnosed rather than patched: the **product was correct** — the locale sweep had
converted a hand-rolled English plural into real i18next plural keys, present in
both locales with correct Polish forms (`pole` / `pola` / `pól`). The gap was in
the test helper: `src/test-utils/realTranslations.ts` resolved only exact dot
paths, so `t('…fieldCount', { count: 2 })` found nothing (the JSON holds
`fieldCount_one` / `_other`) and fell back to the key.

Fixed at the helper, using `Intl.PluralRules` — the same mechanism i18next uses,
so Polish resolves through real Slavic rules rather than an English-shaped
one/other guess — and the test was pointed at the real shipped JSON instead of
the global key-returning mock.

That makes the assertion **stricter than it was before the string was
localized**: it now also fails if the key or its plural form goes missing.
Proven by negative control — deleting `fieldCount_one`/`_other` from `en` turns
it red, restoring them turns it green. The test file's assertions were not
weakened; nothing was made green by lowering a bar.

### Standing rule

A scope is not a scope until the run proves it. Assert the file count **and**
assert that a named file you expect is present. A filter matching nothing exits 0
and is indistinguishable from a filter matching everything and passing.

---

## Re-verified and RE-RUN at `f5cdc7b867` (2026-08-12)

The two-clean-rounds result above (208 files / 1239 tests) was executed at
`c5b1b6e6b9`, **16 commits behind** the candidate this section reports on
(`f5cdc7b867`, the final code SHA of this wave — only documentation commits
follow it). Per the "standing rule" above, that older scope is history, not
this candidate's proof. **This section is the actual re-run at the current
SHA.**

### Numbers, both rounds `--retry=0`, scope proven from each run's own JSON

| | Baseline `9d17cac114` | Round 1 | Round 2 |
|---|---:|---:|---:|
| Test files | 155 | **212** | **212** |
| Colocated `src/**/__tests__` | 33 | **59** | **59** |
| Tests collected | 887 | **1291** | **1291** |
| Tests failed | 132 | **121** | **121** |
| `whiteboardContextMenu.keyboard.integration` | present, 4/4 | present, 4/4 | present, 4/4 |
| New failing tests vs baseline | — | **0** | **0** |
| Tests fixed vs baseline | — | **8** | **8** |
| Round 1 vs Round 2 differences | — | — | **0 — zero flakiness** |

Real exit code **1** on both rounds — expected, not concealed: the baseline
itself carries 132 failures, so neither side is green, and a `1` here is not
a sign of a broken run.

### Mechanical verdict: **NOT CLEAN** — reported as such, not rounded up

The comparison script's job is to flag every file-set difference between
baseline and candidate, the same "per test AND by test count per file"
discipline §1 above established. It flagged two items. Both are adjudicated
below with evidence; **neither is an open product defect**, but the honest
mechanical verdict is NOT CLEAN and this file says so rather than reporting
"clean" because the aggregate numbers look good.

**Item 1 — `tests/components/MyWork/ContextMenuPortal.test.tsx`: present at
baseline, absent on the candidate.**

Deleted by `93ebc3aa20` — this program's **first** commit — together with the
`ContextMenuPortal` component it covered. Before concluding anything, the
re-home was verified in code: the covered behaviour now lives in the shared
`CanvasContextMenu`, which portals via `createPortal(menu, portalTarget ??
document.body)`. **The component deletion was legitimate. The assertion
going with it was not** — from `93ebc3aa20` until this fix, nothing proved
context menus still escape the canvas's transformed stacking context, which
makes "correct" indistinguishable from "correct by accident." A React-Flow
canvas ancestor carries a CSS transform, and a transformed ancestor
establishes a containing block for `position:fixed` descendants — a menu
rendered inside the canvas subtree instead of portalled out would be
positioned and clipped against the panned/zoomed canvas instead of the
viewport.

**Fixed:** restored as `tests/components/MyWork/canvasContextMenu.portal.test.tsx`
(commit `fe2b8b7a82`). Three assertions: the menu is not reachable from
inside the transformed host subtree; no ancestor of the portalled menu
carries a transform (stronger than pinning one specific parent — survives a
future change of portal target); the menu is still `position: fixed`, since
the portal is only load-bearing in combination with that. Negative control:
replacing `createPortal(menu, target)` with a plain in-place `{menu}` turns
it red on two independent assertions (`expected <div role=menu> to be null`,
`expected [Array(1)] to deeply equal []`). Restored, green again.

The comparison still flags the old filename, and it is right to: it compares
by path and cannot know a deliberate re-home happened. **That is the detector
working correctly, not a defect in this candidate.**

**Note for the record — how this hid from the earlier "two clean rounds":**
that pass (§ above, `c5b1b6e6b9`) reported "0 files losing tests" and did not
catch this, because that comparison only looked at files present on **both**
sides. A file that vanishes entirely never entered its comparison set at
all — it is a distinct failure mode from a file losing some-but-not-all of
its tests, and needs its own check (a set-difference on filenames, not a
per-file test-count diff).

**Item 2 — three tests gone from `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`.**

Not lost — deliberately superseded by the E10 work, which moved whole-map AI
generators out of the node context menu into the pane menu. The replacement
tests assert both the new location (`pane_dependencies` disabled/enabled
states) and the explicit removal of the old
(`"E10: ctx_ai_deepen no longer exists (merged into ctx_ai_expand)"`,
`"E10: whole-map AI generators no longer render inside the node menu"`). Net
effect: the file gained tests overall; three specific ones were replaced by
name because what they tested moved.

### Recommendation impact

Neither item changes the `NOT_READY` recommendation's substance — see
`24_FINAL_ACCEPTANCE.md` §11. The only residual blocking
`READY_FOR_CODEX_REVIEW` is the owner's visual acceptance.
