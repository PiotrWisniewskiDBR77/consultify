# FLOW-FEEDBACK-001: User Feedback System

> **ID:** FLOW-FEEDBACK-001 | **Status:** ✅ Complete | **Priority:** MEDIUM

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 75%     |
| **Zidentyfikowane luki** | 3       |
| **Priorytet naprawy**    | LOW     |

## Purpose

Zbieranie i zarządzanie feedbackiem użytkowników: feature requests, bug reports, satisfaction surveys, i product roadmap voting.

## Triggers

| Trigger       | Opis                            |
| ------------- | ------------------------------- |
| User Submit   | User wysyła feedback/request    |
| Admin Review  | Admin przegląda feedback        |
| Vote          | User głosuje na feature request |
| Status Change | Feedback zmienia status         |

## Outcomes

- Feedback zebrany i skategoryzowany
- Feature requests priorytetyzowane przez głosy
- Bug reports adresowane
- Product roadmap aktualizowany

## Actors

| Aktor      | Rola                           |
| ---------- | ------------------------------ |
| User       | Wysyła feedback, głosuje       |
| Admin      | Przegląda, kategoryzuje        |
| SuperAdmin | Zarządza roadmap               |
| System     | Agreguje, wysyła powiadomienia |

## Involved Modules

### Frontend

| Komponent     | Lokalizacja             | Odpowiedzialność   |
| ------------- | ----------------------- | ------------------ |
| FeedbackModal | `src/components/`       | Submit feedback    |
| FeedbackList  | `src/views/`            | Lista feedback     |
| RoadmapView   | `src/views/superadmin/` | Roadmap management |

### Backend

| Serwis/Route         | Lokalizacja               | Odpowiedzialność |
| -------------------- | ------------------------- | ---------------- |
| feedback.routes.ts   | `server/src/routes/`      | Feedback CRUD    |
| feedbackService      | `server/src/services/`    | Feedback logic   |
| SuperAdminController | `server/src/controllers/` | Admin operations |

### Database

| Tabela              | Opis             |
| ------------------- | ---------------- |
| `feedback_items`    | User feedback    |
| `feedback_votes`    | Votes on items   |
| `feedback_comments` | Discussion       |
| `feature_roadmap`   | Planned features |

## Gap Analysis

### GAP-FEEDBACK-001: Brak email notification przy status change

| Atrybut              | Wartość                                              |
| -------------------- | ---------------------------------------------------- |
| **Priorytet**        | MEDIUM                                               |
| **Szacowany effort** | 2h                                                   |
| **Wpływ**            | Users nie wiedzą że ich feedback został zaadresowany |

**Problem:** Gdy admin zmienia status (np. "Under Review" → "Planned"), user nie dostaje powiadomienia.

---

### GAP-FEEDBACK-002: Brak duplicate detection

| Atrybut              | Wartość                     |
| -------------------- | --------------------------- |
| **Priorytet**        | LOW                         |
| **Szacowany effort** | 3h                          |
| **Wpływ**            | Duplikaty zaśmiecają system |

**Problem:** Users często wysyłają podobny feedback. Brak automatycznego sugerowania istniejących items.

---

### GAP-FEEDBACK-003: Brak public roadmap view

| Atrybut              | Wartość                          |
| -------------------- | -------------------------------- |
| **Priorytet**        | LOW                              |
| **Szacowany effort** | 4h                               |
| **Wpływ**            | Transparentność dla użytkowników |

**Problem:** Roadmap jest tylko dla admin. Użytkownicy nie widzą co jest planowane.

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 3     |
| **MEDIUM Priority** | 1     |
| **LOW Priority**    | 2     |
| **Total Effort**    | ~9h   |

## Related Flows

- FLOW-NOTIFICATION-001: Notification System
- FLOW-CUSTOMER-001: Customer Success (satisfaction tracking)
