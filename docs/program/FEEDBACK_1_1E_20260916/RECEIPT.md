# FEEDBACK-1/1e — Execution → Work language boundary

**READY FOR CTO REVIEW.** The reported Polish copy in the English Work surface was measured as persisted/customer-authored data, not UI chrome: all 35/35 diacritics and the reported words came from `/api/tasks`, initiative names, or member names. The fix defines and exercises an explicit `user-content` boundary without translating or mutating persisted values.

- Base: `b16a64e4d1`
- Branch: `codex/feedback-1-1e-execution-language-20260916`
- Scope marker: `[ODMROZENIE 06_EXECUTION DEC-575]`
- Database/migration/flag: none
- Shared additive contract: `titleContentOrigin`, `textContentOrigin`, and relation `contentOrigin` pass the boundary through the canonical preview components. Existing callers are unchanged by default.

## Behavior proof

The real `ExecutionWorkSurface` is rendered from the real EN and PL translation catalogs. The fixture deliberately contains Polish task, description, initiative, and person values. The test removes nodes explicitly marked as persisted data and verifies that English chrome contains neither the measured Polish words nor Polish diacritics, before and after opening the preview. It also verifies that localized system role labels and the unknown-user fallback remain inside the UI-language audit.

## Verification

- `ExecutionWorkSurface.languageBoundary.test.tsx`: 2/2 PASS, `--retry=0`.
- `jezykRealizacji.source.test.ts`: 4/4 PASS, `--retry=0`.
- Independent review: ACCEPT, P0=0, P1=0, P2=0; related canonical preview tests included in the review, total 12/12 PASS.
- Existing `ExecutionWorkSurface.edycjaWierszem.test.tsx`: base 8/14 PASS, candidate 8/14 PASS; the same 6 assertions expect `Anna Kowalska` while the fixture renders `Osoba 1`, so regression delta is 0.
- Existing `ExecutionWorkSurface.daneRealne.test.tsx`: 8/8 PASS.
- Full TypeScript, measured without timeout:
  - base `b16a64e4d1`: frontend RC=2 / 169 errors; server RC=0 / 0 errors;
  - candidate: frontend RC=2 / 169 errors; server RC=0 / 0 errors;
  - delta: 0 / 0.
- `git diff --check`: PASS.

No staging write, deployment, Railway change, migration, or protected-ref push was performed.
