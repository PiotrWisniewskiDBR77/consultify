# FLOW-CONTENT-001: Content Management

> **ID:** FLOW-CONTENT-001 | **Status:** ✅ Complete | **Priority:** LOW

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 80%     |
| **Zidentyfikowane luki** | 2       |
| **Priorytet naprawy**    | LOW     |

## Purpose

Zarządzanie treściami: help articles, knowledge base, templates, i documentation.

## Triggers

| Trigger        | Opis                    |
| -------------- | ----------------------- |
| Content Create | Admin tworzy nową treść |
| Content Search | User szuka pomocy       |
| Template Use   | User używa template     |

## Outcomes

- Treści dostępne i aktualne
- Users mogą znajdować pomoc
- Templates przyspieszają pracę

## Actors

| Aktor  | Rola                 |
| ------ | -------------------- |
| Admin  | Zarządza treściami   |
| User   | Konsumuje treści     |
| System | Indeksuje, wyszukuje |

## Involved Modules

### Backend

| Serwis/Route        | Lokalizacja            |
| ------------------- | ---------------------- |
| contentService      | `server/src/services/` |
| knowledge.routes.ts | `server/src/routes/`   |
| helpChat.routes.ts  | `server/src/routes/`   |

### Database

| Tabela               | Opis          |
| -------------------- | ------------- |
| `content_articles`   | Help articles |
| `content_templates`  | Templates     |
| `content_categories` | Categories    |

## Gap Analysis

### GAP-CONTENT-001: Brak version control dla treści

| Priorytet  | LOW |
| ---------- | --- |
| **Effort** | 4h  |

**Problem:** Content edits nie są wersjonowane.

---

### GAP-CONTENT-002: Brak analytics dla content usage

| Priorytet  | LOW |
| ---------- | --- |
| **Effort** | 3h  |

**Problem:** Nie wiadomo które artykuły są najbardziej przydatne.

---

## Summary

| Total Gaps       | 2   |
| ---------------- | --- |
| **Total Effort** | ~7h |

## Related Flows

- FLOW-FEEDBACK-001: User Feedback (content requests)
