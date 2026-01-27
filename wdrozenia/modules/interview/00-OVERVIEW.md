# 🧩 Moduł: Interview – Overview

## Status: ✅ KOMPLETNY (BCG Enterprise Level)

**Ostatnia aktualizacja:** 2026-01-27

---

## 📋 Plan źródłowy
`wdrozenia/plan-interview-context.md`

---

## 🎯 Cel
Zebrać „as-is" kontekst organizacji (fakty), który zasila Tools/Assessment. Bez rekomendacji.

---

## ✅ Zaimplementowane Funkcjonalności

### Backend (50+ endpointów)
- ✅ Sessions CRUD
- ✅ Questions CRUD (task-list style)
- ✅ Notes CRUD
- ✅ Evidence upload
- ✅ Templates management
- ✅ Assignments workflow
- ✅ AI Assist (suggest, parse)
- ✅ **10 typów Insights (BCG-level)**
- ✅ Organization context (Company Facts)
- ✅ Summary & Export

### Frontend (ModuleHub pattern)
- ✅ InterviewHub z 5 tabami
- ✅ TemplateBuilder
- ✅ InsightCreatorModal (10 typów analiz)
- ✅ InsightViewer (Markdown rendering)
- ✅ InterviewWorkspace (ClickUp-like)
- ✅ CategorySidebar (5 kategorii)
- ✅ QuestionsList, NotesPanel, EvidencePanel
- ✅ CompanyFactsPanel

### Testy
- ✅ E2E tests (`tests/e2e/interview.spec.ts`)

---

## 📂 Kategorie Pytań (5)

| Kategoria | Ikona | Opis |
|-----------|-------|------|
| Strategy | 🎯 | Strategia biznesowa |
| Operations | ⚙️ | Operacje |
| Digital | 💻 | Transformacja cyfrowa |
| People | 👥 | Ludzie i kultura |
| Finance | 💰 | Finanse |

---

## 🎯 Typy Insights (10 BCG-level)

| Typ | Nazwa |
|-----|-------|
| `summary` | Executive Summary |
| `trends` | Trend Analysis |
| `problems` | Problem Discovery |
| `recommendations` | Recommendations |
| `comparison` | Cross-Interview Comparison |
| `gaps` | Gap Analysis |
| `risk_assessment` | Risk Assessment |
| `opportunity_scan` | Opportunity Scan |
| `maturity` | Maturity Assessment |
| `stakeholder_map` | Stakeholder Mapping |

---

## 📁 Artefakty modułu

| Typ | Lokalizacja |
|-----|-------------|
| UI | `wdrozenia/modules/interview/frontend/` |
| API | `wdrozenia/modules/interview/backend/` |
| Features | `wdrozenia/modules/interview/features/` |
| Testy | `wdrozenia/modules/interview/testing/` |

---

## 🔧 Kluczowe Pliki

### Frontend
```
src/components/Interview/
├── InterviewHub.tsx          # Główny hub (ModuleHub pattern)
├── TemplateBuilder.tsx       # Kreator szablonów
├── InsightCreatorModal.tsx   # Kreator insightów (10 typów)
├── InsightViewer.tsx         # Widok insightu (markdown)
├── InterviewWorkspace.tsx    # Workspace dla sesji
├── CategorySidebar.tsx       # Sidebar kategorii
├── QuestionsList.tsx         # Lista pytań
├── NotesPanel.tsx            # Panel notatek
├── EvidencePanel.tsx         # Panel dowodów
├── CompanyFactsPanel.tsx     # Panel faktów o firmie
└── index.ts                  # Eksporty
```

### Backend
```
server/src/
├── controllers/InterviewController.ts
├── services/InterviewInsightService.ts
└── routes/interview.routes.ts
```

### Baza danych
```
server/migrations/
├── 295_interview_context.sql
├── 297_interview_library_templates.sql
├── 299_interview_assignments.sql
├── 305_interview_insights.sql
└── 420_interview_demo_data.sql
```

---

## ⚠️ Ważne Zasady

1. **NIE UŻYWAJ MOCK DATA** - wszystko z real API
2. **RBAC** - przyciski tworzenia tylko dla PM/Admin
3. **Summary = FACTS ONLY** - bez rekomendacji
4. **Null-safety** - zawsze sprawdzaj czy dane istnieją
5. **Toast notifications** - informuj użytkownika

---

## 📚 Powiązane Dokumenty

- `wdrozenia/plan-interview-context.md` - oryginalny plan
- `wdrozenia/UI_UX_GOLDEN_STANDARD.md` - standardy UI
- `.cursor/rules/04-module-hub-pattern.mdc` - wzorzec ModuleHub
- `.cursor/rules/01-no-mock-data.mdc` - zakaz mock data
