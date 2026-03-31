# P28-C — weryfikacja i rollout (verification) — 100%

**Data:** 2026-03-31  
**Zakres:** FINAL 28 §8.1 P28-C — regresje, handoff P19, staging proof, rollback.

## Co jest zamknięte

- **Regresje read-only / guard:** `server/src/services/assessment/__tests__/assessmentWorkbench.p28c-regression.test.ts`
  - `recordPromotion` przed `completed` → `P28_PROMOTION_GUARD`.
  - Run `completed` → `proposeScore` i `transition` zwracają `P28_RUN_READ_ONLY`.
- **Handoff do P19 Outputs Library:** `recordPromotion` z `targetKind: 'outputs_artifact'` automatycznie wywołuje `registerArtifactOrigin` — artefakt pojawia się w `v8_output_artifacts` z `originSummary.sourceType = 'ASSESSMENT'`, `promotionTraceId`, `assessmentDefinitionId`, `limits`. Test: `promotion_artifact_registered` w audit.
- Bazeline P28-B: E2E `assessmentWorkbench.p28b-e2e.test.ts`, smoke B.
- Smoke C: `npx tsx server/scripts/smoke-p28-workbench-c.ts`

## Staging (checklist operatorski)

1. Migracja `p28_workbench_v1` na Postgres (jak P28-B).
2. JWT + org z V8; `GET /api/v8/assessment/{id}/workbench` — `whatNext` i stan spójny.
3. Powtórzyć scenariusz z `P28_B_ROLLOUT` (preset DRD → evidence → complete).
4. Po `completed`: mutacje workbench zwracają `P28_RUN_READ_ONLY`.
5. `POST .../promotion` z `targetKind: 'outputs_artifact'` → artefakt w Outputs Library (sprawdź `v8_output_artifacts`).

## Rollback (§8.3)

- Wyłączyć wywołania tras workbench po stronie klienta lub feature flag.
- Kolumna `assessments.p28_workbench_v1` pozostaje; runy `completed` są read-only — brak destrukcji danych.
- Artefakty w `v8_output_artifacts` pozostają (read-only safe).
