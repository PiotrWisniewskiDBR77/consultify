# IE01 native Milestones / Tasks split — independent follow-up acceptance

Date: 2026-09-13
Reviewer: Sol independent reviewer
Product worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-initiative-card-split-20260913`
Base HEAD: `69dbb5b746aa870f5e5d93e840906604557a5276`
Scope: bounded receipt for the two actual-host HOLD findings in `IE01_CARD_SPLIT_SOL_INDEPENDENT_REVIEW.md`.

## Final bounded verdict

**ACCEPT** for the IE01 native runtime-v1 Tasks/Milestones card split and the two reviewed repairs. This does not accept unrelated IE01 gaps or expand the earlier full checkpoint status.

The corrected `InitiativeDocumentView` now:

- uses `presentation={isRuntimeOnlyRecord ? 'tasks' : 'combined'}` for the existing Tasks mount, preserving the legacy combined Tasks + Milestones surface;
- passes `readonly={!canEditCards}` to both direct Tasks and Milestones mounts;
- keeps the new separate Milestones native owner limited to runtime-v1 canonical navigation.

No additional blocker was found in the frozen card-split scope.

## Correction to the first HOLD probe

The original standalone `gate-denied` assertion used a fixture value that the runtime-v1 host never consumes. `runOriginAwareInitiativeSubresource` skips the planning `getGateReadiness` request for runtime-v1 and calls `buildFallbackGateReadiness`; a runtime-v1 DRAFT therefore received editable fallback capability despite the test fixture's unused `canEditCards=false` value.

That first assertion is an **instrumentation failure, not a confirmed product defect**. The follow-up test uses a reachable host condition: a post-DRAFT record opens in the actual document Preview mode, `canEditCards` becomes false, and the native Milestones writer affordance is absent. The source repair is accepted on that behavior.

The legacy combined finding was a real introduced regression and remains supported by the preserved raw `IE01_CARD_SPLIT_SOL_HOST_PROBES.json` failure. It is GREEN after the conditional presentation repair.

## Exact final command

```bash
npx vitest run \
  tests/components/Initiatives/TasksMilestonesSection.cardSplit.behavior.test.tsx \
  tests/components/Initiatives/TasksMilestonesSection.milestones.test.tsx \
  src/components/Initiatives/sections/__tests__/TasksMilestonesSection.a11y.test.tsx \
  tests/components/Initiatives/InitiativeDocumentView.canonicalNavigation.behavior.test.tsx \
  src/components/Initiatives/__tests__/initiativeProfileContract.test.ts \
  tests/unit/initiatives-execution/definitionReadiness.test.ts \
  tests/unit/initiatives-execution/cardRegistry.test.ts \
  --maxWorkers=1 --maxConcurrency=1 \
  --reporter=json \
  --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/IE01_CARD_SPLIT_SOL_FINAL_GREEN.json
```

Result: **7 files, 30/30 tests PASS, 0 failed, exit 0**.

The two added actual-host full names are:

- `does not expose the native milestone writer in the actual document Preview mode`
- `keeps the legacy mounted Tasks and Milestones card combined`

## Durable final evidence

- `IE01_CARD_SPLIT_SOL_FINAL_GREEN_20260913T061057Z.json`
  - SHA-256: `d40c372f57a777bbecea0f691af9629d84429abc49111ae2838707c0d60e34ba`
- `IE01_CARD_SPLIT_SOL_FINAL_GREEN_20260913T061057Z.log`
  - SHA-256: `151eb4f277d10f5d69b6223063dcd084ce5d2aaa25ebe3d96e2688f98638290b`

The un-timestamped `IE01_CARD_SPLIT_SOL_FINAL_GREEN.json/.log` currently contain the same final 30/30 result. Before the request to preserve each attempt separately arrived, those names had already overwritten an intermediate 29/30 run. That intermediate file pair is therefore **EVIDENCE_MISSING**; the earlier preserved five-test host probe still records both original failures, and the final timestamped receipt is immutable.

The independently recovered clean-base matched RED remains:

- exact latest tests on base `69dbb5b746aa870f5e5d93e840906604557a5276`;
- **23/28 PASS, 5/28 FAIL, exit 1**;
- `IE01_CARD_SPLIT_SOL_BASE_RED.json` SHA-256 `5d1026ff77d42799bb5f6f572c5a53ce475810e5e0fed5018c0919aa19496075`.

## Final frozen identities

| File | Git blob | SHA-256 |
| --- | --- | --- |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | `5c33bf7d240e41c55c2174d238040d934c3cd964` | `ccd80ae4b5bc32e5106d20ee7f625412a67c01cb17277e9fcee4ea7b5179ee25` |
| `src/components/Initiatives/canonicalInitiativeSections.tsx` | `a2ef846932918b0ad3992df8b48bdf443d0f294c` | `2964315f7e82f79631ce69cca271b7934e8d9ff666722faf01340ad350cce8d5` |
| `src/components/Initiatives/sections/TasksMilestonesSection.tsx` | `4998ad888fa6b4774c58b1689693f8d0d0cf3a1c` | `b1b6d8e8c1f2f122a96d63986ebbe4b16c32e1560045d1cb197e68445412b54c` |
| `tests/components/Initiatives/TasksMilestonesSection.cardSplit.behavior.test.tsx` | `eb481efe866f2b35bf5a03021226d37e80f5b18d` | `223a7d18799ee792a1d9e6af520f8230d79b642a5c4066f40431afff9778975b` |
| `tests/components/Initiatives/InitiativeDocumentView.canonicalNavigation.behavior.test.tsx` | `792d73e51bdd98a4df70924d35169d8c5ceeef9d` | `9b0f54eb6801114e9dce995df05c2508591acbda28237c6cfe2e5a04ad685e69` |

`git diff --check` passed on the final frozen WIP. The source worktree retains only the expected three modified product files, one modified host test, and one new behavior test.
