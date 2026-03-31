# P28-C — weryfikacja i rollout (verification)

**Data:** 2026-03-31  
**Zakres:** FINAL 28 §8.1 P28-C — regresje, dowód staging/rollback, znane limity.

## Co jest zamknięte (technicznie)

- Regresje read-only / guard: `server/src/services/assessment/__tests__/assessmentWorkbench.p28c-regression.test.ts`
  - `recordPromotion` przed `completed` → `P28_PROMOTION_GUARD`.
  - Run `completed` → `proposeScore` i `transition` zwracają `P28_RUN_READ_ONLY`.
- Bazeline P28-B bez zmian funkcjonalnych: E2E `assessmentWorkbench.p28b-e2e.test.ts`, smoke B `server/scripts/smoke-p28-workbench-b.ts`.
- Smoke C (statyczny): `npx tsx server/scripts/smoke-p28-workbench-c.ts`

## Staging (checklist operatorski)

1. Migracja `p28_workbench_v1` na Postgres (jak P28-B).
2. JWT + org z V8; `GET /api/v8/assessment/{id}/workbench` — `whatNext` i stan spójny.
3. Powtórzyć scenariusz z `P28_B_ROLLOUT` (preset DRD → evidence → complete).
4. Po `completed` potwierdzić: mutacje workbench (score/evidence/transition) zwracają `P28_RUN_READ_ONLY`; promocja nadal przez `POST .../promotion` zapisuje trace (jak E2E B).

## Rollback (§8.3)

- Wyłączyć wywołania tras workbench (interpretacja / promocja) po stronie klienta lub feature flag.
- Kolumna `assessments.p28_workbench_v1` pozostaje; runy `completed` są read-only — brak destrukcji danych.

## Znane limity (ujawnione „100%” kontraktu produktowego)

- **Handoff do P19/P10:** `PromotionTrace` i `targetRef` są w workbench JSON; utworzenie realnego artefaktu w Outputs / Insight to osobny konsument payloadu (nie jest zautomatyzowane w tym pakiecie).
- **Pełny UI shell Assessment:** poza zakresem P28-C; API + testy serwerowe są SSOT dla tej fali.
