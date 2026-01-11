# FLOW-ASSESSMENT-001: Assessment Execution

> **ID:** FLOW-ASSESSMENT-001 | **Status:** ✅ Complete | **Priority:** HIGH

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 85%     |
| **Zidentyfikowane luki** | 4       |
| **Priorytet naprawy**    | MEDIUM  |

## Purpose

Kompleksowy flow wykonywania assessmentów: tworzenie, wypełnianie przez użytkowników, analiza AI, scoring, i generacja raportów.

## Triggers

| Trigger             | Opis                            |
| ------------------- | ------------------------------- |
| Assessment Start    | User rozpoczyna nowy assessment |
| Response Submit     | Użytkownik wysyła odpowiedzi    |
| AI Analysis Request | System prosi AI o analizę       |
| Report Generate     | Generacja raportu końcowego     |

## Outcomes

- Assessment ukończony z odpowiedziami
- Wyniki przetworzone przez AI
- Scores obliczone
- Raport wygenerowany (opcjonalnie PDF)

## Actors

| Aktor      | Rola                                  |
| ---------- | ------------------------------------- |
| User       | Wypełnia assessment                   |
| AI Service | Analizuje odpowiedzi                  |
| System     | Oblicza scores, generuje raporty      |
| Admin      | Zarządza szablonami, przegląda wyniki |

## Involved Modules

### Frontend

| Komponent           | Lokalizacja                  | Odpowiedzialność |
| ------------------- | ---------------------------- | ---------------- |
| AssessmentWorkspace | `src/views/assessment/`      | Główny widok     |
| QuestionFlow        | `src/components/assessment/` | Przepływ pytań   |
| ResultsView         | `src/views/assessment/`      | Wyniki           |
| ReportViewer        | `src/components/`            | Podgląd raportu  |

### Backend

| Serwis/Route              | Lokalizacja                     | Odpowiedzialność  |
| ------------------------- | ------------------------------- | ----------------- |
| assessment.routes.ts      | `server/src/routes/assessment/` | CRUD assessments  |
| assessmentService         | `server/src/services/`          | Assessment logic  |
| aiAnalysisService         | `server/src/services/ai/`       | AI analysis       |
| assessment-reports.routes | `server/src/routes/assessment/` | Report generation |

### Database

| Tabela                 | Opis                 |
| ---------------------- | -------------------- |
| `assessments`          | Assessment instances |
| `assessment_responses` | User responses       |
| `assessment_scores`    | Calculated scores    |
| `assessment_templates` | Template definitions |
| `assessment_questions` | Question bank        |

## Sequence Diagram

```
┌──────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User      │     │  Assessment │     │     AI      │     │  Database   │
│              │     │   Service   │     │   Service   │     │             │
└──────┬───────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                   │                   │
       │ Start Assessment   │                   │                   │
       │───────────────────>│  CREATE           │                   │
       │                    │───────────────────────────────────────>│
       │<──────────────────────{assessmentId, questions}            │
       │                    │                   │                   │
       │ Submit Response    │                   │                   │
       │───────────────────>│  SAVE response    │                   │
       │                    │───────────────────────────────────────>│
       │                    │                   │                   │
       │ [Repeat for each question]             │                   │
       │                    │                   │                   │
       │ Complete Assessment│                   │                   │
       │───────────────────>│  Trigger AI       │                   │
       │                    │──────────────────>│  ANALYZE          │
       │                    │                   │───────────────────│
       │                    │<──────────────────────ai insights     │
       │                    │  Calculate scores │                   │
       │                    │───────────────────────────────────────>│
       │<─────────────────────{scores, insights, recommendations}   │
       │                    │                   │                   │
       │ Generate Report    │                   │                   │
       │───────────────────>│  Build PDF        │                   │
       │<─────────────────────{reportUrl}       │                   │
```

## Integration Points

### 1. Assessment → AI Service

- **Type:** Analysis Request
- **Status:** ✅ Working
- **Details:** Sends responses for AI analysis

### 2. Assessment → Billing

- **Type:** Usage Tracking
- **Status:** ✅ Working
- **Details:** Token usage tracked

### 3. Assessment → Notifications

- **Type:** Event Trigger
- **Status:** ⚠️ Partial
- **Details:** Completion notification, but no progress notifications

---

## Gap Analysis

### GAP-ASSESSMENT-001: AI analysis timeout handling

| Atrybut              | Wartość                                     |
| -------------------- | ------------------------------------------- |
| **Priorytet**        | HIGH                                        |
| **Szacowany effort** | 3h                                          |
| **Wpływ**            | User experience - długie waity bez feedback |

**Problem:** Gdy AI analysis trwa długo (>30s), użytkownik nie ma feedbacku. Czasem request timeoutuje bez graceful handling.

**Rozwiązanie:**

- Implementacja streaming response lub job queue
- Progress indicator dla użytkownika
- Automatic retry z exponential backoff
- Graceful degradation gdy AI niedostępne

---

### GAP-ASSESSMENT-002: Partial save/resume potrzebuje polish

| Atrybut              | Wartość                                                    |
| -------------------- | ---------------------------------------------------------- |
| **Priorytet**        | MEDIUM                                                     |
| **Szacowany effort** | 2h                                                         |
| **Wpływ**            | UX - użytkownicy tracą postęp przy przypadkowym zamknięciu |

**Problem:** Auto-save działa, ale:

- Brak visual feedback o zapisie
- Resume może pokazać niepoprawny stan
- Brak opcji ręcznego save

**Rozwiązanie:**

- Dodać toast "Progress saved" przy auto-save
- Przy resume pokazać modal z progress summary
- Dodać przycisk "Save & Continue Later"

---

### GAP-ASSESSMENT-003: Report PDF generation flaky

| Atrybut              | Wartość                                  |
| -------------------- | ---------------------------------------- |
| **Priorytet**        | MEDIUM                                   |
| **Szacowany effort** | 3h                                       |
| **Wpływ**            | Użytkownicy nie mogą eksportować wyników |

**Problem:** PDF generation czasem zawodzi:

- Charts nie renderują poprawnie
- Timeout przy dużych raportach
- Brak retry mechanism

**Rozwiązanie:**

- Użyć puppeteer z dłuższym timeout
- Implementować queue dla PDF generation
- Fallback do text-only PDF

---

### GAP-ASSESSMENT-004: Brak progress notifications

| Atrybut              | Wartość                                |
| -------------------- | -------------------------------------- |
| **Priorytet**        | LOW                                    |
| **Szacowany effort** | 2h                                     |
| **Wpływ**            | UX - admin nie wie o postępach zespołu |

**Problem:** Tylko notification przy completion. Brakuje:

- Daily digest z pending assessments
- Reminder dla nieukończonych
- Progress report dla admina

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 4     |
| **HIGH Priority**   | 1     |
| **MEDIUM Priority** | 2     |
| **LOW Priority**    | 1     |
| **Total Effort**    | ~10h  |

## Assessment Features Status

| Feature                | Status |
| ---------------------- | ------ |
| Assessment creation    | ✅     |
| Question flow          | ✅     |
| Response collection    | ✅     |
| Auto-save              | ⚠️     |
| AI analysis            | ✅     |
| Scoring                | ✅     |
| PDF report             | ⚠️     |
| Progress notifications | ❌     |

## Related Flows

- FLOW-AI-001: AI Usage & Limits
- FLOW-NOTIFICATION-001: Notification System
- FLOW-TEAM-001: Team Permissions (who can view results)
