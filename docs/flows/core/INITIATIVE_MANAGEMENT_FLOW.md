# FLOW-INITIATIVE-001: Initiative Management

> **ID:** FLOW-INITIATIVE-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value                                           |
| ------------------------- | ----------------------------------------------- |
| **Completeness**          | 85%                                             |
| **Gaps Identified**       | 3                                               |
| **Implementation Status** | Mostly implemented, needs status machine update |

## Purpose

Zarządzanie cyklem życia inicjatyw - od generowania z assessmentu po realizację i tracking wyników.

## Initiative Flow (User's Definition)

```
ASSESSMENT ──► DRAFT ──► PLANNING ──► REVIEW ──► APPROVED ──► EXECUTING ──► DONE
                                                    │            │
                                                    │            ▼
                                                    │        BLOCKED
                                                    │            │
                                                    ▼            ▼
                                                CANCELLED    ARCHIVED
```

### Status Definitions

| Status        | Visibility                  | Description                                           |
| ------------- | --------------------------- | ----------------------------------------------------- |
| **DRAFT**     | Strategic Initiatives Board | Generowane z assessment, edycja szczegółów            |
| **PLANNING**  | Strategic Initiatives Board | Praca nad szczegółami, completion checker             |
| **REVIEW**    | Initiatives Module          | Lista do przeglądu, approval workflow                 |
| **APPROVED**  | Initiatives + Roadmap       | Pojawia się na timeline, Q1-Q8                        |
| **EXECUTING** | Roadmap + Implementation    | Nadal na timeline, Kanban                             |
| **BLOCKED**   | Implementation (alert)      | Czerwony znacznik, kolumna "Zablokowane"              |
| **DONE**      | Implementation → Benefits   | Kolumna "Gotowe", ZNIKA z Roadmap, pojawia w Benefits |
| **CANCELLED** | Widoczna z flagą wszędzie   | Anulowana                                             |
| **ARCHIVED**  | Tylko w archiwum/raportach  | Zarchiwizowana                                        |

## Triggers

| Trigger             | Description                                  |
| ------------------- | -------------------------------------------- |
| Assessment Complete | Raport assessment generuje draft initiatives |
| Manual Creation     | PM/Admin tworzy ręcznie inicjatywę           |
| Import PDF          | Wgranie zewnętrznego audytu → roadmap        |
| Status Change       | Transition między statusami                  |

## Outcomes

- Inicjatywa utworzona z assessment z pełnym kontekstem
- Completion checker wymusza uzupełnienie przed review
- Stage gates dla approval workflow
- Tracking realizacji w Implementation
- KPI tracking w Benefits po zakończeniu

## Actors

| Actor | Role                                    |
| ----- | --------------------------------------- |
| Owner | Zatwierdza inicjatywy, widzi wszystko   |
| Admin | Zarządza inicjatywami                   |
| PM    | Tworzy, planuje, realizuje inicjatywy   |
| User  | Pracuje nad taskami w ramach inicjatywy |
| AI    | Generuje, sugeruje, analizuje           |

## Sequence Diagram: Assessment → Initiatives

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Assessment  │   │  Initiative  │   │    Project   │   │    AI        │
│    Module    │   │   Generator  │   │    Service   │   │   Advisor    │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       │ Complete         │                  │                  │
       │ Assessment       │                  │                  │
       │─────────────────►│                  │                  │
       │                  │                  │                  │
       │                  │  Analyze Results │                  │
       │                  │─────────────────────────────────────►
       │                  │                  │                  │
       │                  │◄─────────────────────────────────────
       │                  │  {recommendations}                  │
       │                  │                  │                  │
       │                  │  Generate Draft  │                  │
       │                  │  Initiatives     │                  │
       │                  │─────────────────►│                  │
       │                  │                  │                  │
       │◄─────────────────│                  │                  │
       │  {draft_initiatives}               │                  │
       │                  │                  │                  │
```

## Database Schema Enhancements

### initiatives table additions:

```sql
-- Stage gate tracking
review_requested_at TIMESTAMP
review_requested_by TEXT
approved_at TIMESTAMP
approved_by TEXT
approval_comment TEXT

-- Execution tracking
execution_started_at TIMESTAMP
blocked_at TIMESTAMP
blocked_reason TEXT
done_at TIMESTAMP
done_by TEXT

-- Benefits reference
benefits_tracking_enabled BOOLEAN DEFAULT FALSE
benefits_kpi_ids TEXT -- JSON array of KPI IDs

-- Source reference
source_type TEXT -- 'assessment', 'manual', 'pdf_import', 'ai_generated'
source_id TEXT -- assessment_id, pdf_id, etc.

-- Roadmap positioning
roadmap_quarter TEXT -- 'Q1', 'Q2', etc.
roadmap_year INTEGER
priority_order INTEGER
```

## Gap Analysis

### GAP-INITIATIVE-001: Brakujące statusy (review, approved, executing, blocked, done)

| Attribute    | Value                       |
| ------------ | --------------------------- |
| **Priority** | HIGH                        |
| **Effort**   | 4h                          |
| **Impact**   | Status machine niekompletna |

**Solution:**

- Zaktualizować enum w validator
- Dodać endpoints dla transitions
- UI: Kanban z nowymi kolumnami

---

### GAP-INITIATIVE-002: Brak completion checker

| Attribute    | Value                                      |
| ------------ | ------------------------------------------ |
| **Priority** | MEDIUM                                     |
| **Effort**   | 4h                                         |
| **Impact**   | Inicjatywy mogą iść do review niekompletne |

**Solution:**

- Service sprawdzający wymagane pola
- Endpoint: `GET /api/initiatives/:id/readiness`
- UI: Checklist przed wysłaniem do review

---

### GAP-INITIATIVE-003: Brak move between projects

| Attribute    | Value                               |
| ------------ | ----------------------------------- |
| **Priority** | MEDIUM                              |
| **Effort**   | 3h                                  |
| **Impact**   | Inicjatywy nie mogą być przenoszone |

**Solution:**

- Endpoint: `POST /api/initiatives/:id/move`
- Przenoś taski wraz z inicjatywą
- Audit log zmian

## Implementation Tasks

- [x] Basic CRUD
- [x] Status transitions (limited)
- [x] KPI tracking
- [x] Project association
- [ ] Extended status machine (review, approved, executing, blocked, done)
- [ ] Completion checker
- [ ] Move between projects
- [ ] Benefits tracking integration
- [ ] PDF import to initiatives
- [ ] AI-assisted planning

## API Endpoints

### Existing

| Method | Endpoint                      | Description       |
| ------ | ----------------------------- | ----------------- |
| GET    | `/api/initiatives`            | List initiatives  |
| POST   | `/api/initiatives`            | Create initiative |
| GET    | `/api/initiatives/:id`        | Get initiative    |
| PUT    | `/api/initiatives/:id`        | Update initiative |
| PATCH  | `/api/initiatives/:id/status` | Update status     |
| GET    | `/api/initiatives/portfolio`  | Portfolio view    |

### To Add

| Method | Endpoint                               | Description                |
| ------ | -------------------------------------- | -------------------------- |
| GET    | `/api/initiatives/:id/readiness`       | Check completion readiness |
| POST   | `/api/initiatives/:id/submit-review`   | Submit for review          |
| POST   | `/api/initiatives/:id/approve`         | Approve initiative         |
| POST   | `/api/initiatives/:id/reject`          | Reject initiative          |
| POST   | `/api/initiatives/:id/start-execution` | Start execution            |
| POST   | `/api/initiatives/:id/block`           | Mark as blocked            |
| POST   | `/api/initiatives/:id/unblock`         | Remove block               |
| POST   | `/api/initiatives/:id/complete`        | Mark as done               |
| POST   | `/api/initiatives/:id/move`            | Move to different project  |
| POST   | `/api/initiatives/:id/archive`         | Archive initiative         |

## Related Flows

- FLOW-PROJECT-001: Initiatives belong to projects
- FLOW-TASK-001: Tasks belong to initiatives
- FLOW-DECISION-001: Decisions can block initiatives
- FLOW-ASSESSMENT-001: Initiatives generated from assessments
- FLOW-BENEFITS-001: Done initiatives go to benefits tracking
