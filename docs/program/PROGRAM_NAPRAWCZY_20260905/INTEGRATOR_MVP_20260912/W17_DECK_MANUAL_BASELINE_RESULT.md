# W17 — manual helper baseline, 2026-09-12

Root candidate e4184a178685b8832e5d43496d7ac7e3ef65b57c. Existing tests run unchanged, Vitest4.1.8, maxWorkers1, exit0,4files/21tests PASS in4.08s. Command: vitest run src/components/Presentations/DeckBuilder/__tests__/{presentationArtifactCommands.test.ts,manualEditing.test.ts,geometryOps.test.ts,manualMultiselect.test.tsx} --maxWorkers=1 --reporter=verbose. Shell command used explicit four paths. Log W17_DECK_MANUAL_BASELINE.log in external handoff.

Evidence classification: registry6 tests validate visibility, permission/conflict and callback; manualEditing10 includes ONE source-text wiring check and9 helper behavior tests; geometry3 exercises numeric/model operations; multiselect2 renders boundary components with mocked children and callbacks. Thus21 is test count, not21 proven UI actions. No browser/API/PG/export/provider/live run. No product changes.

The tests support reuse of existing geometry/selection/helpers while repairing the integrated writer. They do not overturn real reopen RED, component restore/AI/in-flight RED, or establish manual operations through persistence. W17_DECK_ACTION_COVERAGE.md retains the full action families and separate invocation variants, dynamic UI inventory and three difficult end-to-end scenarios. Unmounted quickactions are not treated as visible buttons or a mandate to resurrect retired UI.
