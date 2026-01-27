# 🧩 Moduł: Assessment – Overview

## Status: ✅ KOMPLETNY (Full Workflow)

**Ostatnia aktualizacja:** 2026-01-27

---

## 📋 Plan źródłowy
`wdrozenia/plan-assessment-initiatives.md`

---

## 🎯 Cel
Assessment (DRD/SIRI/...) → raport → approval → generowanie inicjatyw (DRAFT).

---

## ✅ Zaimplementowane Funkcjonalności

### Backend (kompletny workflow)
- ✅ CRUD assessments
- ✅ Workflow: DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED
- ✅ 4 Gate Decisions
- ✅ Report generation & approval
- ✅ Initiative generation (5 metodologii)
- ✅ DoD validation
- ✅ Dynamic submenu (max 6)
- ✅ Audit logging
- ✅ Permissions RBAC

### Frontend (kompletny)
- ✅ AssessmentModuleHub
- ✅ DRDForm, SIRIForm (live scoring)
- ✅ MultiFwBenchmarkComparison (real API)
- ✅ PDFImportWizard (real API)
- ✅ GenerateInitiativesModal
- ✅ AssessmentInitiativesDrawer
- ✅ Filters & Search

### Testy
- ✅ Unit tests (`assessment.test.ts`)
- ✅ E2E tests (`assessmentFlow.spec.ts`, `assessment-workflow.spec.ts`)

---

## 🔄 Workflow Statusów

```
┌───────┐   request   ┌───────────┐   approve   ┌───────────────────┐   approve   ┌──────────┐
│ DRAFT │ ──────────► │ IN_REVIEW │ ──────────► │ AWAITING_APPROVAL │ ──────────► │ APPROVED │
└───────┘   review    └───────────┘   report    └───────────────────┘  assessment └──────────┘
                                                                                        │
                                                                                        │ generate
                                                                                        ▼
                                                                                  ┌────────────┐
                                                                                  │ INITIATIVES│
                                                                                  │  (DRAFT)   │
                                                                                  └────────────┘
```

---

## 🎯 4 Gate Decisions

| Decision | Owner | Opis |
|----------|-------|------|
| `REQUEST_REVIEW` | Project Lead | Wysłanie do review |
| `APPROVE_REPORT` | PMO/Owner | Zatwierdzenie raportu |
| `APPROVE_ASSESSMENT` | PMO/Owner | Zatwierdzenie assessment |
| `GENERATE_INITIATIVES` | Consultant Lead | Generowanie inicjatyw |

---

## 📊 Frameworki

| Framework | Skala | Wymiary |
|-----------|-------|---------|
| **DRD** | 1-7 | 7 osi transformacji |
| **SIRI** | 0-5 | 3 bloki, 8 wymiarów |
| **ADMA** | 1-5 | 5 filarów |
| **CMMI** | 1-5 | 3 kategorie |
| **Lean 4.0** | 1-5 | 3 wymiary |

---

## 🎯 5 Metodologii Generowania Inicjatyw

| Metodologia | Opis |
|-------------|------|
| `impact-feasibility` | Macierz Impact/Feasibility |
| `moscow` | MoSCoW Method |
| `rice` | RICE Score |
| `value-effort` | Value vs Effort |
| `strategic-fit` | Strategic Fit |

---

## 📁 Artefakty modułu

| Typ | Lokalizacja |
|-----|-------------|
| UI | `wdrozenia/modules/assessment/frontend/` |
| API | `wdrozenia/modules/assessment/backend/` |
| Features | `wdrozenia/modules/assessment/features/` |
| Testy | `wdrozenia/modules/assessment/testing/` |

---

## 🔧 Kluczowe Pliki

### Frontend
```
src/components/assessment/
├── AssessmentModuleHub.tsx
├── tools/
│   ├── DRDForm.tsx
│   ├── SIRIForm.tsx
│   └── index.ts
├── modals/
│   ├── GenerateInitiativesModal.tsx
│   └── ...
├── MultiFwBenchmarkComparison.tsx
├── import/PDFImportWizard.tsx
└── ...
```

### Backend
```
server/src/
├── controllers/AssessmentController.ts
├── services/AssessmentInitiativeService.ts
├── validators/assessment.validators.ts
└── routes/assessment-workflow-v2.routes.ts
```

### Baza danych
```
server/migrations/
└── 293_assessment_workflow.sql
```

---

## ⚠️ Ważne Zasady

1. **NIE UŻYWAJ MOCK DATA** - wszystko z real API (zweryfikowane!)
2. **DoD wymagane** - completion >= 100%, confidence >= 3
3. **Raport przed approval** - raport musi być zatwierdzony
4. **Inicjatywy jako DRAFT** - z source_type='assessment'
5. **Max 7 inicjatyw** - per batch generowania

---

## 📚 Powiązane Dokumenty

- `wdrozenia/plan-assessment-initiatives.md` - oryginalny plan
- `wdrozenia/ANALIZA_ZGODNOSCI_ASSESSMENT.md` - analiza zgodności
- `wdrozenia/UI_UX_GOLDEN_STANDARD.md` - standardy UI
