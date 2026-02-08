# Assessment – Testy (Status Coverage)

## Status: ⚠️ CZĘŚCIOWO ZAIMPLEMENTOWANE (~65% coverage)

**Ostatnia aktualizacja:** 2026-02-08

---

## Cel

Minimum testów unit/API + E2E dla kluczowych ścieżek Assessment.

---

## Minimum DoD

- E2E: create assessment → fill DRD/SIRI → generate report → approve → generate initiatives
- Test invalid: generate initiatives przed APPROVED
- Unit: key services (initiative generation, permissions, workflow)

---

## Inventory plików testowych (32+ plików)

### E2E Tests (✅ 5 plików, ~51 test cases)

| Plik | Linie | Testy | Status |
|------|-------|-------|--------|
| `tests/e2e/assessment-complete-flow.spec.ts` | ~388 | 16 | ✅ Real |
| `tests/e2e/assessment-initiatives.spec.ts` | ~520 | 23 | ✅ Real |
| `tests/e2e/assessmentFlow.spec.ts` | ~104 | 4 | ✅ Real |
| `tests/e2e/assessment-workflow.spec.ts` | - | - | ✅ Real |
| `tests/e2e/journeys/assessment-complete-flow.spec.ts` | - | - | ✅ Real |

**Pokrycie E2E:** Pełny lifecycle (create → fill → review → report → approve → initiatives), framework-specific testy, session management.

### Integration Tests (⚠️ 4+ plików, ~9 test cases)

| Plik | Linie | Testy | Status |
|------|-------|-------|--------|
| `tests/integration/assessment-reports.routes.test.ts` | ~56 | 1 | ✅ Minimal |
| `tests/integration/assessment-reports.routes.test.js` | ~45 | 3 | ✅ Real |
| `tests/integration/assessmentOverview.integration.test.js` | ~130 | 5 | ✅ Real |

### Unit Tests – Backend (✅ 8+ plików, ~47 test cases)

| Plik | Linie | Testy | Status |
|------|-------|-------|--------|
| `tests/unit/backend/assessment/assessmentInitiativeService.test.ts` | ~465 | 20 | ✅ Real |
| `tests/unit/assessment/assessment-module.test.ts` | ~318 | 24 | ✅ Real |
| `tests/unit/backend/services/assessmentInitiativeGenerationRunService.test.ts` | ~133 | 1 | ✅ Real |

### Unit Tests – Server (⚠️ 11+ plików, improved)

| Plik | Status |
|------|--------|
| `server/tests/.../AssessmentService.test.ts` | ✅ Real (CRUD, error handling) |
| `server/tests/.../AssessmentWorkflowService.test.ts` | ✅ Real (transitions, DoD, errors) |
| `server/tests/.../assessment-reports.routes.test.ts` | ✅ Real (templates, validation, permissions) |
| `server/tests/.../assessments.routes.test.ts` | ⚠️ Skeleton |
| `server/tests/.../assessment.routes.test.ts` | ⚠️ Skeleton |
| `server/tests/.../assessment-workflow.routes.test.ts` | ⚠️ Skeleton |
| `server/tests/.../assessment-level-attachments.routes.test.ts` | ⚠️ Skeleton |
| `server/tests/.../assessment-hub.routes.test.ts` | ⚠️ Skeleton |

### Component Tests (⚠️ 7+ plików, skeleton)

| Plik | Status |
|------|--------|
| `tests/components/AssessmentModuleHub.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentWizard.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentTable.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentWorkflowPanel.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentMatrixCard.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentHubDashboard.test.tsx` | ⚠️ Basic render |
| `tests/components/AssessmentAxisWorkspace.test.tsx` | ⚠️ Basic render |

---

## Coverage Analysis

### Dobrze pokryte

1. **Initiative generation** — 20 testów (metodologie, fallback, dedup)
2. **Assessment core logic** — 24 testy (scoring, gap analysis, templates)
3. **E2E workflows** — 39+ testów (pełny lifecycle)
4. **Batch processing** — testy enterprise generation run
5. **Workflow service** — transitions, DoD validation, error handling
6. **Assessment reports routes** — templates, validation, permissions

### Do uzupełnienia

1. Server-side route tests (5 plików → skeleton)
2. Component tests (7 plików → basic render only)
3. Integration tests (ograniczony scope)

---

## Rekomendacje

1. Uzupełnić route skeletons o realne testy HTTP (supertest)
2. Rozszerzyć component testy o interakcje i state management
3. Dodać integration testy dla assessment-workflow-v2 endpoints
4. Dodać unit testy dla assessmentPermissionService (RBAC, access requests)
5. Dodać testy AI form helper (aiAssessmentFormHelper)

---

## Powiązane

- `tests/TEST_AUDIT_REGISTRY.md` — globalny rejestr testów
- `tests/ASSESSMENT_TESTS_README.md` — konwencje testowe