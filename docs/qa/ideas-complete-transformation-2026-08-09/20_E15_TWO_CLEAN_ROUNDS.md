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
