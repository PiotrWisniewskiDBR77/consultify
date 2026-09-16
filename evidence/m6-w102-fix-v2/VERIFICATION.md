# M6 W102 fix v2 — verification

Status: **READY FOR CTO REVIEW**

- Base: `85541745e8226562b75ab318e1efe1f8178b5097`
- Implementation: `84023de1b20cb8fbce3c1ab4d9b781738f1db9c2`
- Branch: `codex/a-m6-w96-fix-v2-20260916`

## W102 closures

- P0: the `tests/unit/` twin now asserts the product invariant introduced by
  IDE-027: the first patch materializes a fresh Idea workspace state even when
  it equals the derived default. The product fix was retained.
- `no-scrollbar`: the new scrollbar suppression is scoped to
  `.module-nav-scrollbar-hidden` on the ModuleNavBar command row. The six
  pre-existing consumers of the formerly undefined generic class are untouched.
- Conversion receipts: a missing server identifier uses dedicated EN/PL copy;
  no `ID: —` can be rendered and navigation remains disabled without an id.
- Audits routes: every direct client-facing error branch in
  `server/src/routes/audits/*.routes.ts` now returns a stable localization code;
  missing EN/PL fallbacks were added. The contract test scans every route file.
- DRD language debt: the measured corpus is **60/233** levels with `titleEN` or
  `descriptionEN`. W102 quoted 60/235; the runtime structure contains 233, so the
  test records the measured denominator rather than repeating 235.
- The brittle assertion that counted seven global `no-scrollbar` occurrences was
  replaced with a render assertion on the intended ModuleNavBar behavior.

## Test and build evidence

- M6 delta plus both importers of `ideaWorkspaceState`: **9 files / 53 tests
  PASS**, `--retry=0`, one worker.
- Error-copy localization behavior: **1 file / 16 tests PASS**, `--retry=0`.
- Full TypeScript, no time limit, same owner `node_modules` and TypeScript:
  frontend base **169** → candidate **169** (RC 2 / RC 2); server base **0** →
  candidate **0** (RC 0 / RC 0).
- Production build: default 4 GB Node heap reached OOM after 10,956 transformed
  modules; exact rerun with `NODE_OPTIONS=--max-old-space-size=8192` **PASS**,
  10,956 modules, 36.97 s. This is an instrument memory limit, not a code failure.
- `check:flagi:dockerfile`: PASS (`194/205/13/0`).
- `check:artefakt`: PASS (`8/0/117`).
- `check:list-canon`: PASS (`349`, no increase).
- `check:jezyk:ci`: PASS; K4en −8, K4obj −36, K5pl −26.
- `git diff --check`: PASS.

## Boundaries

No migration, staging write, deployment, Railway change, protected-ref push,
feature-flag default change, or test record was created. W81 visual acceptance at
1280 px is the CTO-confirmed evidence in W102; this fix changes only scrollbar
scope and does not claim a new browser screenshot.
