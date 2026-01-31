# 🧩 Moduł: Assessment – Overview

## Status: ✅ KOMPLETNY (Full Workflow + Nowy Edytor DRD)

**Ostatnia aktualizacja:** 2026-01-29

---

## 📋 Plan źródłowy

`wdrozenia/plan-assessment-initiatives.md`

---

## 🎯 Cel

Assessment (DRD/SIRI/...) → raport → approval → generowanie inicjatyw (DRAFT).

## Standard artefaktu (Assessment Report)

Raport w module Assessment jest artefaktem Discovery (wyniki + gaps + evidence + approval), a nie raportem zarządczym:

- `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md`

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
- ✅ **Assessment Level Attachments API** (upload/download/delete evidence files)
- ✅ **Backward compatibility** dla SQLite (brakujące kolumny `version`, `project_id`)

### Frontend (kompletny)

- ✅ AssessmentModuleHub (lista, filtry, wyszukiwanie)
- ✅ DRDForm, SIRIForm (live scoring)
- ✅ **AssessmentSessionEditorView** - główny edytor sesji assessment
- ✅ **DRDAssessmentEditor** - nowy interaktywny edytor DRD
- ✅ **LevelAttachments** - zarządzanie załącznikami per poziom
- ✅ MultiFwBenchmarkComparison (real API)
- ✅ PDFImportWizard (real API)
- ✅ GenerateInitiativesModal
- ✅ AssessmentInitiativesDrawer
- ✅ Filters & Search
- ✅ **Auto-save** z debouncing (600ms)
- ✅ **Manual save** z keyboard shortcut (Ctrl+S/Cmd+S)
- ✅ **Progress tracking** (overall, per axis, per area)
- ✅ **Axis navigation tabs** (DRD)
- ✅ **Responsive design** (mobile-friendly sidebar)
- ✅ **Breadcrumbs integration** (dynamiczne menu)
- ✅ **Toast notifications** (save success/error)

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

| Decision               | Owner           | Opis                     |
| ---------------------- | --------------- | ------------------------ |
| `REQUEST_REVIEW`       | Project Lead    | Wysłanie do review       |
| `APPROVE_REPORT`       | PMO/Owner       | Zatwierdzenie raportu    |
| `APPROVE_ASSESSMENT`   | PMO/Owner       | Zatwierdzenie assessment |
| `GENERATE_INITIATIVES` | Consultant Lead | Generowanie inicjatyw    |

---

## 📊 Frameworki

| Framework    | Skala | Wymiary             |
| ------------ | ----- | ------------------- |
| **DRD**      | 1-7   | 7 osi transformacji |
| **SIRI**     | 0-5   | 3 bloki, 8 wymiarów |
| **ADMA**     | 1-5   | 5 filarów           |
| **CMMI**     | 1-5   | 3 kategorie         |
| **Lean 4.0** | 1-5   | 3 wymiary           |

---

## 🎯 5 Metodologii Generowania Inicjatyw

| Metodologia          | Opis                       |
| -------------------- | -------------------------- |
| `impact-feasibility` | Macierz Impact/Feasibility |
| `moscow`             | MoSCoW Method              |
| `rice`               | RICE Score                 |
| `value-effort`       | Value vs Effort            |
| `strategic-fit`      | Strategic Fit              |

---

## 📁 Artefakty modułu

| Typ      | Lokalizacja                              |
| -------- | ---------------------------------------- |
| UI       | `wdrozenia/modules/assessment/frontend/` |
| API      | `wdrozenia/modules/assessment/backend/`  |
| Features | `wdrozenia/modules/assessment/features/` |
| Testy    | `wdrozenia/modules/assessment/testing/`  |

---

## 🔧 Kluczowe Pliki

### Frontend

```
src/components/assessment/
├── AssessmentModuleHub.tsx          # Hub z listą assessmentów
├── AssessmentSessionEditorView.tsx  # Główny widok edytora (host)
├── drd/
│   └── DRDAssessmentEditor.tsx      # Nowy interaktywny edytor DRD
├── LevelAttachments.tsx             # Komponent załączników per poziom
├── tools/
│   ├── DRDForm.tsx                  # Stary formularz DRD (legacy)
│   ├── SIRIForm.tsx
│   └── index.ts
├── modals/
│   ├── GenerateInitiativesModal.tsx
│   └── NewAssessmentModal.tsx
├── MultiFwBenchmarkComparison.tsx
├── import/PDFImportWizard.tsx
└── ...

src/services/
├── drdStructure.ts                  # Struktura DRD (7 osi, 34 obszary)
└── assessmentKnowledge/
    └── drdKnowledge.ts              # Baza wiedzy (pytania, przykłady, technologie)

src/views/
└── AssessmentSessionEditorView.tsx  # Main editor view
```

### Backend

```
server/src/
├── controllers/AssessmentController.ts
├── services/AssessmentInitiativeService.ts
├── validators/assessment.validators.ts
├── routes/
│   ├── assessment-workflow-v2.routes.ts
│   └── assessment/
│       └── assessment-level-attachments.routes.ts  # API załączników
└── database/
    └── migrations/
        └── assessment_level_attachments (auto-created)
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

## 🆕 Nowe Funkcjonalności (2026-01-29)

### Nowy Edytor DRD (DRDAssessmentEditor)

Kompletnie przeprojektowany edytor DRD z następującymi funkcjami:

#### 1. **Struktura Hierarchiczna**

- **7 Osí** (Axes): Digital Processes, Digital Products, Digital Business Models, Data & Analytics, Organizational Culture, Cybersecurity, AI
- **34 Obszary** (Areas): każda oś zawiera 5-9 obszarów oceny
- **Poziomy** (Levels): każdy obszar ma 5-7 poziomów (w zależności od osi)

#### 2. **Ocena Poziomów**

- **Monotoniczna logika**: jeśli poziom wyższy jest osiągnięty, wszystkie niższe są automatycznie osiągnięte
- **Odpowiedź TAK/NIE** dla każdego poziomu
- **Achieved Level**: aktualny osiągnięty poziom (0-7)
- **Target Level**: docelowy poziom (opcjonalny)

#### 3. **Baza Wiedzy per Poziom**

- **3 pytania walidacyjne** (yes/no) dla każdego poziomu
- **Opis poziomu** z przykładami
- **Sugerowane technologie** (z bazy wiedzy, w przyszłości AI-powered)
- **Przykłady** (examples) dla każdego poziomu

#### 4. **Komentarze i Załączniki**

- **Komentarz per poziom**: możliwość dodania notatek dla każdego poziomu
- **Załączniki per poziom**: upload plików jako dowód (evidence)
  - Typy: Evidence, Screenshot, Document, Report, Other
  - Maksymalny rozmiar: 25MB
  - Obsługa wszystkich typów plików (images, PDFs, documents)
  - Opcjonalny opis dla każdego załącznika

#### 5. **Nawigacja i UX**

- **Top Header**:
  - Przycisk "Back to Assessment"
  - Tytuł assessmentu
  - Metadata (framework, status, completion %)
  - Overall progress bar
  - Status zapisu (saving/saved time)
  - Przycisk "Save" (również Ctrl+S/Cmd+S)
- **Axis Navigation Tabs** (tylko DRD):
  - Poziome zakładki dla każdej z 7 osi
  - Progress indicator per oś (`completed/total` areas)
  - Aktywna oś jest podświetlona
  - Tooltips z informacją o postępie
- **Sidebar z Obszarami**:
  - Lista obszarów dla aktualnej osi
  - Progress bar per obszar
  - CheckCircle icon dla ukończonych obszarów
  - Wyszukiwanie obszarów (search)
  - Responsywny (collapsible na mobile)
- **Główny Panel Edycji**:
  - Wyświetlanie poziomów dla wybranego obszaru
  - Każdy poziom jako karta z:
    - Checkbox "Yes (in place)" / "No"
    - Opis poziomu
    - 3 pytania walidacyjne
    - Sugerowane technologie
    - Pole komentarza
    - Sekcja załączników
  - Wizualne wskaźniki dla osiągniętych poziomów:
    - Zielona ramka i tło
    - CheckCircle icon
    - "Verified" badge przy pytaniach

#### 6. **Auto-save i Manual Save**

- **Auto-save**: automatyczne zapisywanie po 600ms debounce
- **Manual save**: przycisk "Save" + keyboard shortcut (Ctrl+S/Cmd+S)
- **Status zapisu**: wizualny wskaźnik (saving spinner / saved timestamp)
- **Toast notifications**: sukces/błąd przy zapisie

#### 7. **Progress Tracking**

- **Overall completion %**: procent ukończenia całego assessmentu
- **Per-axis progress**: `completed/total` areas dla każdej osi
- **Per-area progress**: wizualny wskaźnik w sidebarze
- **Real-time updates**: progress aktualizuje się automatycznie przy zmianach

#### 8. **Integracja z Systemem**

- **Breadcrumbs**: integracja z dynamicznym menu (`useAppStore`, `AppView`)
- **Routing**: `/assessment/:framework/:assessmentId`
- **Framework support**: DRD (pełny), SIRI (podstawowy), ADMA/CMMI/LEAN (placeholder)

#### 9. **Responsywność**

- **Mobile-friendly**: collapsible sidebar z przyciskiem Menu/X
- **Responsive header**: ukrywanie tekstu na małych ekranach
- **Smooth scrolling**: automatyczne przewijanie do góry przy zmianie osi/obszaru

#### 10. **Baza Wiedzy (drdKnowledge.ts)**

- **Domyślne pytania**: generowane automatycznie dla wszystkich poziomów
- **Przykłady**: uniwersalne przykłady per poziom
- **Technologie**: sugerowane na podstawie słów kluczowych w opisie poziomu
- **Override system**: możliwość nadpisania konkretnych poziomów w `DRD_KNOWLEDGE_OVERRIDES`

### API Endpoints (Backend)

#### Assessment Level Attachments

- `POST /api/assessment-level-attachments` - Upload pliku
- `GET /api/assessment-level-attachments/level/:assessmentId/:axisId/:levelNumber` - Lista załączników
- `GET /api/assessment-level-attachments/download/:attachmentId` - Pobranie pliku
- `PUT /api/assessment-level-attachments/:attachmentId/description` - Aktualizacja opisu
- `DELETE /api/assessment-level-attachments/:attachmentId` - Usunięcie załącznika

**Storage:**

- Pliki: `/uploads/assessment-level-attachments/<orgId>/`
- Metadata: tabela `assessment_level_attachments` w SQLite

### Struktura Danych

#### DRD Answers Format

```typescript
{
  drd: {
    areas: {
      "1A": {
        achievedLevel: 3,        // 0-7 (monotonic)
        targetLevel: 5,         // optional
        levelNotes: {
          "1": "Comment for level 1",
          "3": "Comment for level 3"
        }
      },
      "1B": { ... },
      // ... wszystkie 34 obszary
    }
  }
}
```

#### Attachment Metadata

```typescript
{
  id: string;
  assessmentId: string;
  axisId: string;
  areaId?: string;
  levelNumber: number;
  attachmentType: 'EVIDENCE' | 'SCREENSHOT' | 'DOCUMENT' | 'REPORT' | 'OTHER';
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}
```

---

## 📚 Powiązane Dokumenty

- `wdrozenia/plan-assessment-initiatives.md` - oryginalny plan
- `wdrozenia/ANALIZA_ZGODNOSCI_ASSESSMENT.md` - analiza zgodności
- `wdrozenia/UI_UX_GOLDEN_STANDARD.md` - standardy UI
- `15-NEW-FEATURES-2026-01.md` - **NOWY** - podsumowanie wszystkich nowych funkcjonalności (2026-01-29)
- `frontend/07-drd-editor.md` - szczegółowa dokumentacja edytora DRD
- `frontend/08-level-attachments.md` - dokumentacja systemu załączników
- `features/03-knowledge-base.md` - dokumentacja bazy wiedzy
- `backend/01-api-list.md` - lista endpointów API (zaktualizowana o załączniki)
