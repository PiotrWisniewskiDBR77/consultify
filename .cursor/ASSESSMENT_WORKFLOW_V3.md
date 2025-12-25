# Assessment Module - Workflow v3.0

## Przegląd

Moduł Assessment w wersji 3.0 ma uproszczoną strukturę z 4 głównymi zakładkami i jasnym przepływem pracy.

## Menu Główne (4 przyciski)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Assessment]    [Map]        [Reports]      [Initiatives]         │
│     📋            🗺️            📄              💡                  │
│    Tabela       Edytor       Tabela          Tabela                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Assessment (Tabela)
- Lista wszystkich assessmentów
- Statusy: Draft | In Review | Approved
- Akcje: Nowy | Otwórz w Map | Utwórz raport (dla zatwierdzonych)

### 2. Map (Edytor)
- Narzędzie do edycji DRD (7 osi)
- Otwierane z tabeli Assessment lub jako nowy
- Po zakończeniu → zatwierdzenie → wraca do tabeli

### 3. Reports (Tabela)
- Lista raportów
- Statusy: Draft | Final
- Tworzone z zatwierdzonych assessmentów
- Finalizacja → możliwość generowania inicjatyw

### 4. Initiatives (Tabela)
- Lista inicjatyw transformacyjnych
- Generowane z finalnych raportów
- Statusy: Draft | Approved | In Progress | Completed
- Możliwość edycji, zatwierdzania, usuwania

## Przepływ Pracy (Workflow)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  ASSESSMENT  │───▶│     MAP      │───▶│   REPORTS    │───▶│ INITIATIVES  │
│   (Tabela)   │    │   (Edytor)   │    │   (Tabela)   │    │   (Tabela)   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   • Nowy             • Edycja osi        • Draft raport      • Draft init
   • Lista            • AI Partner        • Finalizacja       • Approve
   • Statusy          • Submit review     • Eksport           • Start work
                      • Zatwierdzenie                         • Complete
```

### Szczegółowy Flow

```
1. ASSESSMENT (Tabela)
   └─▶ Kliknij "Nowy" lub "Otwórz"
   
2. MAP (Edytor)
   └─▶ Wypełnij 7 osi DRD
   └─▶ Użyj AI Partner
   └─▶ Submit for Review
   └─▶ Zatwierdzenie
   └─▶ Wraca do tabeli jako APPROVED
   
3. REPORTS (Tabela)
   └─▶ Kliknij "Create Report" na zatwierdzonym assessment
   └─▶ Edytuj draft raportu
   └─▶ Finalizuj raport
   └─▶ Status: FINAL
   
4. INITIATIVES (Tabela)
   └─▶ Kliknij "Generate Initiatives" na final raporcie
   └─▶ AI generuje inicjatywy
   └─▶ Edytuj/zatwierdź/usuń każdą inicjatywę
   └─▶ Zatwierdzone idą do Roadmap (Module 3)
```

## Komponenty

### Główny Hub
- `AssessmentModuleHub.tsx` - Główny kontener z 4 zakładkami

### Zakładka Assessment
- `AssessmentTable.tsx` - Tabela assessmentów

### Zakładka Map
- `AssessmentAxisWorkspace.tsx` - Edytor osi
- `AssessmentSummaryWorkspace.tsx` - Podsumowanie
- `AIAssessmentSidebar.tsx` - AI Partner

### Zakładka Reports
- `ReportsTable.tsx` - Tabela raportów

### Zakładka Initiatives
- `InitiativesTable.tsx` - Tabela inicjatyw
- `InitiativeGeneratorWizard.tsx` - Wizard generowania

## Statusy

### Assessment Status
| Status | Opis | Następny krok |
|--------|------|---------------|
| DRAFT | W edycji | Submit for Review |
| IN_REVIEW | Recenzja stakeholderów | Approve/Reject |
| AWAITING_APPROVAL | Oczekuje na zatwierdzenie | Final Approve |
| APPROVED | Zatwierdzony | Create Report |
| REJECTED | Odrzucony | Back to Draft |

### Report Status
| Status | Opis | Następny krok |
|--------|------|---------------|
| DRAFT | W edycji | Finalize |
| FINAL | Sfinalizowany | Generate Initiatives |
| ARCHIVED | Zarchiwizowany | - |

### Initiative Status
| Status | Opis | Następny krok |
|--------|------|---------------|
| DRAFT | Wygenerowany/edytowany | Approve |
| APPROVED | Zatwierdzony | Start Work |
| IN_PROGRESS | W realizacji | Complete |
| COMPLETED | Zakończony | - |
| CANCELLED | Anulowany | - |

## API Endpoints

### Assessment
```
GET  /api/assessments?projectId=xxx           # Lista
POST /api/assessments                         # Nowy
GET  /api/assessments/:id                     # Szczegóły
PUT  /api/assessments/:id                     # Aktualizacja
```

### Reports
```
GET  /api/assessment-reports?projectId=xxx    # Lista
POST /api/assessment-reports                  # Nowy (z assessment)
POST /api/assessment-reports/:id/finalize     # Finalizacja
```

### Initiatives
```
GET  /api/initiatives?projectId=xxx           # Lista
POST /api/initiatives/generate/:reportId      # Generowanie
PUT  /api/initiatives/:id                     # Aktualizacja
POST /api/initiatives/:id/approve             # Zatwierdzenie
DELETE /api/initiatives/:id                   # Usunięcie
```

## Integracja z Module 3

Po zatwierdzeniu inicjatywy automatycznie są dostępne w Module 3 (Roadmap/Planning) do:
- Planowania
- Harmonogramowania
- Alokacji zasobów
- Śledzenia postępu

---

**Wersja:** 3.0  
**Data:** 25 grudnia 2025  
**Status:** Active

