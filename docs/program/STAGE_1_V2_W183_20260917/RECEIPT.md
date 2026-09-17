# STAGE-1 v2 — W183 receipt

Status: **READY FOR CTO REVIEW**.

## Identity

- Base: `bd7ff4943118fdcf3442cffb4532a89cce00860b`.
- Branch: `codex/stage-1-v2-w183-20260917`.
- Prior STAGE-1 candidate ported unchanged as `5e5a7eeb2`; this v2 closes W183 P0/P1 findings.
- Decision: DEC-539; default-OFF flag remains `VITE_INITIATIVES_STAGES_12`.

## W183 closure

1. `runtime-to-status` now checks membership before reading canonical maps. Illegal runtime values return `undefined` internally, so the existing three-step adapter can map legacy `EXECUTING` to `IN_EXECUTION` and fall back to visible `DRAFT` for empty or nonsensical values. The public overload remains non-null for a legal typed stage.
2. OFF parity is preserved: malformed runtime values never erase the register and always retain a seven-code status. The two mounted `InitiativesHub.pustaLista` regressions pass.
3. ON mode assigns malformed/future stages to the visible `UNKNOWN` bucket. The row label, filter option and shared counter all use the localized `Unknown / Other` / `Nieznany / Inny` value.
4. The demo fixture typo `DEFINING` is corrected to the canonical `DEFINED`.

## Evidence

- Focused final family: 7 files / 32 PASS; final W183 subset: 3 files / 13 PASS.
- Mutations: runtime membership guard removed -> both mounted empty-list tests RED (2/2); unknown bucket removed -> projection/filter/count test RED (1/1).
- Server TypeScript with exact lock `@types/node 22.19.3`: 0 diagnostics.
- Front TypeScript exact-lock: 151 diagnostics; diagnostics in the W183 changed hunks are zero. The inherited `initiativesDemoData.ts:1016` diagnostic is outside the changed hunk. CTO line reference is 169.
- Gates: language PASS (`K8sen -2`), Docker flag guard 197/209 with 0 missing, list canon 346=346, artifact crimson 8=8, `git diff --check` PASS.
- Independent re-review after the TypeScript overload correction: PASS, P0=0, P1=0, P2=0.
- The additive migration `20262260_initiatives_lifecycle_stage.sql` is unchanged from the prior candidate. Its accepted evidence remains 926/926 fresh migrations, replay 0, RealPG 15/15, and the same source checksum. This v2 adds no migration or database change.

## Boundaries

No staging/demo/Railway write, deploy, protected-ref push, environment change or screenshot was performed.
