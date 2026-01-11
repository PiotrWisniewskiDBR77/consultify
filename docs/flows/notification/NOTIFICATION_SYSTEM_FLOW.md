# FLOW-NOTIFICATION-001: Notification System

> **ID:** FLOW-NOTIFICATION-001 | **Status:** ✅ Complete | **Priority:** MEDIUM

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 70%     |
| **Zidentyfikowane luki** | 4       |
| **Priorytet naprawy**    | MEDIUM  |

## Purpose

Zarządzanie powiadomieniami: in-app notifications, email alerts, digest emails, i preference management.

## Triggers

| Trigger         | Opis                            |
| --------------- | ------------------------------- |
| System Event    | Billing, security, usage events |
| User Action     | Task assignment, mentions       |
| Schedule        | Daily/weekly digests            |
| Alert Threshold | Usage, health score alerts      |

## Outcomes

- Użytkownicy informowani o ważnych zdarzeniach
- Alerty dostarczane w odpowiednim czasie
- Preferencje respektowane
- Digest aggreguje mniej ważne powiadomienia

## Actors

| Aktor         | Rola                            |
| ------------- | ------------------------------- |
| System        | Generuje powiadomienia          |
| User          | Odbiera, zarządza preferencjami |
| Email Service | Wysyła emaile                   |
| Cron          | Scheduling digests              |

## Involved Modules

### Frontend

| Komponent        | Lokalizacja              | Odpowiedzialność         |
| ---------------- | ------------------------ | ------------------------ |
| NotificationBell | `src/components/layout/` | In-app notifications     |
| NotificationList | `src/components/`        | Lista powiadomień        |
| PreferencesView  | `src/views/settings/`    | Notification preferences |

### Backend

| Serwis/Route           | Lokalizacja            | Odpowiedzialność        |
| ---------------------- | ---------------------- | ----------------------- |
| notification.routes.ts | `server/src/routes/`   | Notification CRUD       |
| notificationService    | `server/src/services/` | Notification logic      |
| emailService           | `server/src/services/` | Email sending           |
| NotificationCron       | `server/src/cron/`     | Scheduled notifications |

### Database

| Tabela                     | Opis                 |
| -------------------------- | -------------------- |
| `notifications`            | In-app notifications |
| `notification_preferences` | User preferences     |
| `email_queue`              | Pending emails       |
| `notification_templates`   | Templates            |

## Sequence Diagram

```
┌──────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger    │     │ Notification │     │    Email    │     │  Database   │
│   (Event)    │     │   Service    │     │   Service   │     │             │
└──────┬───────┘     └──────┬───────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │                   │
       │ Event (e.g. task)  │                    │                   │
       │───────────────────>│  Check preferences │                   │
       │                    │───────────────────────────────────────>│
       │                    │<──────────────────────{prefs}          │
       │                    │                    │                   │
       │                    │ [if in-app enabled]│                   │
       │                    │───INSERT notification─────────────────>│
       │                    │                    │                   │
       │                    │ [if email enabled] │                   │
       │                    │ [if immediate]     │                   │
       │                    │───────────────────>│ SEND email        │
       │                    │                    │                   │
       │                    │ [if digest]        │                   │
       │                    │───────queue for digest────────────────>│
       │                    │                    │                   │
```

## Gap Analysis

### GAP-NOTIFICATION-001: Brak centralized notification preferences

| Atrybut              | Wartość                                                  |
| -------------------- | -------------------------------------------------------- |
| **Priorytet**        | HIGH                                                     |
| **Szacowany effort** | 4h                                                       |
| **Wpływ**            | Users nie mogą kontrolować jakie powiadomienia otrzymują |

**Problem:** Preferences są fragmentaryczne:

- Billing alerts w billing settings
- Security alerts w security settings
- Task notifications brak opcji
- Brak unified preference center

**Rozwiązanie:**

- Unified notification preferences page
- Categories: billing, security, tasks, team, system
- Per-category: in-app, email immediate, email digest, none

---

### GAP-NOTIFICATION-002: Brak digest email

| Atrybut              | Wartość                                   |
| -------------------- | ----------------------------------------- |
| **Priorytet**        | MEDIUM                                    |
| **Szacowany effort** | 4h                                        |
| **Wpływ**            | Email overload dla aktywnych użytkowników |

**Problem:** Każde powiadomienie = osobny email. Brak opcji digest (daily/weekly summary).

**Rozwiązanie:**

- Tabela `notification_digest_queue`
- Cron job wysyłający daily/weekly digest
- Template dla digest email

---

### GAP-NOTIFICATION-003: Brak real-time push dla in-app

| Atrybut              | Wartość                                              |
| -------------------- | ---------------------------------------------------- |
| **Priorytet**        | LOW                                                  |
| **Szacowany effort** | 6h                                                   |
| **Wpływ**            | Users muszą refresh żeby zobaczyć nowe powiadomienia |

**Problem:** In-app notifications wymagają poll lub refresh. Brak WebSocket push.

**Rozwiązanie:**

- WebSocket connection dla notifications
- Server-sent events jako fallback
- Polling jako ostateczność

---

### GAP-NOTIFICATION-004: Brak notification templates

| Atrybut              | Wartość                |
| -------------------- | ---------------------- |
| **Priorytet**        | LOW                    |
| **Szacowany effort** | 3h                     |
| **Wpływ**            | Inconsistent messaging |

**Problem:** Notification messages są hardcoded w różnych miejscach. Brak centralized templates.

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 4     |
| **HIGH Priority**   | 1     |
| **MEDIUM Priority** | 1     |
| **LOW Priority**    | 2     |
| **Total Effort**    | ~17h  |

## Notification Types Status

| Type                | In-App | Email | Status               |
| ------------------- | ------ | ----- | -------------------- |
| Billing alerts      | ✅     | ✅    | Working              |
| Security alerts     | ✅     | ⚠️    | Partial              |
| Task assignments    | ✅     | ❌    | In-app only          |
| Team invites        | ✅     | ✅    | Working              |
| Assessment complete | ✅     | ❌    | In-app only          |
| Usage alerts        | ✅     | ✅    | Working (GAP-AI-001) |

## Related Flows

- FLOW-SECURITY-001: Auth & Sessions (security alerts)
- FLOW-BILLING-001: Subscription Lifecycle (billing alerts)
- FLOW-CUSTOMER-001: Customer Success (health alerts)
