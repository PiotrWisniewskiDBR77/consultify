# FLOW-CUSTOMER-001: Customer Success Lifecycle

> **ID:** FLOW-CUSTOMER-001 | **Status:** ✅ Complete | **Priority:** HIGH

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 80%     |
| **Zidentyfikowane luki** | 4       |
| **Priorytet naprawy**    | MEDIUM  |

## Purpose

Zarządzanie pełnym cyklem życia klienta od onboardingu przez aktywne użytkowanie, expansion, renewal aż po potencjalny churn. System wspiera proaktywne działania customer success team.

## Triggers

| Trigger                    | Opis                                       |
| -------------------------- | ------------------------------------------ |
| New Subscription           | Nowa subskrypcja uruchamia onboarding flow |
| Lifecycle Stage Transition | Ręczna lub automatyczna zmiana etapu       |
| Health Score Alert         | Spadek health score poniżej progu          |
| Renewal Approaching        | 30/60/90 dni przed renewal                 |
| Playbook Activation        | Uruchomienie playbooku przez CSM           |

## Outcomes

- Klient przechodzi przez etapy lifecycle z odpowiednim wsparciem
- Health score jest obliczany i monitorowany
- Playbooki są wykonywane automatycznie/manualnie
- CSM ma pełny widok na klienta i może podejmować działania

## Actors

| Aktor                          | Rola                                   |
| ------------------------------ | -------------------------------------- |
| Customer Success Manager (CSM) | Zarządza klientami, wykonuje playbooki |
| System                         | Automatyczne przejścia, alerty         |
| SuperAdmin                     | Konfiguruje etapy i playbooki          |
| Customer (Admin)               | Końcowy beneficjent działań            |

## Involved Modules

### Frontend

| Komponent             | Lokalizacja                       | Odpowiedzialność    |
| --------------------- | --------------------------------- | ------------------- |
| CustomerDetailView    | `src/views/superadmin/customers/` | Szczegóły klienta   |
| CustomerJourneyView   | `src/views/superadmin/customers/` | Lifecycle journey   |
| CustomerListView      | `src/views/superadmin/customers/` | Lista klientów      |
| PlaybookExecutorPanel | `src/views/superadmin/customers/` | Wykonanie playbooka |
| HealthScoreWidget     | `src/components/`                 | Widget health score |

### Backend

| Serwis/Route           | Lokalizacja                                              | Odpowiedzialność             |
| ---------------------- | -------------------------------------------------------- | ---------------------------- |
| SuperAdminController   | `server/src/controllers/SuperAdminController.ts`         | Customer lifecycle endpoints |
| CustomerSuccessService | `server/src/services/customerSuccessService.ts`          | Notes, health check logic    |
| ChurnAnalyticsService  | `server/src/services/analytics/ChurnAnalyticsService.ts` | Churn prediction             |
| superadmin.routes.ts   | `server/src/routes/superadmin.routes.ts`                 | API endpoints                |

### Database

| Tabela                           | Opis                            |
| -------------------------------- | ------------------------------- |
| `customer_lifecycle_stages`      | Definicje etapów lifecycle      |
| `customer_lifecycle_transitions` | Historia przejść między etapami |
| `customer_success_playbooks`     | Definicje playbooks             |
| `customer_success_notes`         | Notatki CSM                     |
| `customer_health_scores`         | Historia health score           |
| `organizations`                  | Dane organizacji/klientów       |

## Sequence Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐     ┌──────────┐
│ SuperAdmin  │     │   API       │     │ CustomerSuccess │     │ Database │
│   (CSM)     │     │  Routes     │     │    Service      │     │          │
└──────┬──────┘     └──────┬──────┘     └───────┬─────────┘     └────┬─────┘
       │                   │                    │                    │
       │  GET /customers   │                    │                    │
       │──────────────────>│   getCustomers()   │                    │
       │                   │───────────────────>│   SELECT FROM      │
       │                   │                    │───────────────────>│
       │                   │<──────────────────────────organizations │
       │<──────────────────────────────────────────customers list    │
       │                   │                    │                    │
       │ POST /transition  │                    │                    │
       │──────────────────>│ transitionOrg()    │                    │
       │                   │───────────────────>│   INSERT INTO      │
       │                   │                    │───────transitions──>│
       │                   │                    │   [check triggers] │
       │                   │                    │───────────────────>│
       │                   │<──────────────────────playbook check    │
       │<─────────────────────────transition complete                │
       │                   │                    │                    │
       │ GET /health/:id   │                    │                    │
       │──────────────────>│ getHealthCheck()   │                    │
       │                   │───────────────────>│   CALCULATE score  │
       │                   │                    │───────────────────>│
       │<────────────────────────────────────health score + metrics  │
       │                   │                    │                    │
```

## Integration Points

### 1. Billing → Customer Success

- **Type:** Data Dependency
- **Status:** ✅ Working
- **Details:** Subscription data wpływa na lifecycle stage

### 2. Analytics → Health Score

- **Type:** Data Dependency
- **Status:** ⚠️ Partial
- **Details:** Metryki użycia powinny wpływać na health score

### 3. Customer Success → Notifications

- **Type:** Action Trigger
- **Status:** ❌ Missing
- **Details:** Brak automatycznych powiadomień przy zmianach

### 4. Playbooks → Tasks

- **Type:** Action Trigger
- **Status:** ⚠️ Partial
- **Details:** Playbooki tworzą zadania, ale brak automatycznego follow-up

---

## Gap Analysis

### GAP-CUSTOMER-001: Brak automatycznych playbook triggers

| Atrybut              | Wartość                                 |
| -------------------- | --------------------------------------- |
| **Priorytet**        | HIGH                                    |
| **Szacowany effort** | 4h                                      |
| **Wpływ**            | Playbooki muszą być uruchamiane ręcznie |

**Problem:** System wymaga ręcznego uruchamiania playbooks. Brak automatycznych triggerów przy:

- Spadku health score
- Przejściu do konkretnego etapu
- Zbliżającym się renewal

**Rozwiązanie:**

```typescript
// server/src/services/playbookTriggerService.ts
interface PlaybookTrigger {
  id: string;
  playbookId: string;
  triggerType: 'health_score_drop' | 'stage_transition' | 'renewal_approaching';
  condition: Record<string, any>;
  isActive: boolean;
}

async function checkAndExecuteTriggers(orgId: string, event: TriggerEvent): Promise<void> {
  const triggers = await db.all(
    `SELECT pt.*, p.* FROM playbook_triggers pt
         JOIN customer_success_playbooks p ON pt.playbook_id = p.id
         WHERE pt.is_active = 1 AND pt.trigger_type = ?`,
    [event.type]
  );

  for (const trigger of triggers) {
    if (evaluateCondition(trigger.condition, event)) {
      await executePlaybook(trigger.playbook_id, orgId);
    }
  }
}
```

**Pliki do modyfikacji:**

- `server/src/services/playbookTriggerService.ts` (NEW)
- `server/src/controllers/SuperAdminController.ts`
- Database migration for `playbook_triggers`

---

### GAP-CUSTOMER-002: Health score calculation nie jest zintegrowany z usage metrics

| Atrybut              | Wartość                                                 |
| -------------------- | ------------------------------------------------------- |
| **Priorytet**        | MEDIUM                                                  |
| **Szacowany effort** | 3h                                                      |
| **Wpływ**            | Health score nie odzwierciedla rzeczywistego engagement |

**Problem:** Health score jest obliczany manualnie lub na podstawie ograniczonych danych. Nie uwzględnia:

- Częstotliwości logowań
- Użycia kluczowych funkcji
- Response time do support tickets
- NPS/satisfaction score

**Rozwiązanie:**

```typescript
// server/src/services/healthScoreService.ts
interface HealthScoreFactors {
  loginFrequency: number; // 0-100, waga: 20%
  featureAdoption: number; // 0-100, waga: 25%
  supportHealth: number; // 0-100, waga: 15%
  billingHealth: number; // 0-100, waga: 20%
  engagementTrend: number; // 0-100, waga: 20%
}

async function calculateHealthScore(orgId: string): Promise<number> {
  const factors = await gatherHealthFactors(orgId);

  return Math.round(
    factors.loginFrequency * 0.2 +
      factors.featureAdoption * 0.25 +
      factors.supportHealth * 0.15 +
      factors.billingHealth * 0.2 +
      factors.engagementTrend * 0.2
  );
}
```

**Pliki do modyfikacji:**

- `server/src/services/healthScoreService.ts` (NEW)
- `server/src/controllers/SuperAdminController.ts` - integrate

---

### GAP-CUSTOMER-003: Churn prediction nie jest zintegrowany z alertami

| Atrybut              | Wartość                              |
| -------------------- | ------------------------------------ |
| **Priorytet**        | MEDIUM                               |
| **Szacowany effort** | 2h                                   |
| **Wpływ**            | CSM nie dostaje proaktywnych alertów |

**Problem:** `ChurnAnalyticsService` istnieje, ale:

- Nie wysyła automatycznych alertów
- Nie integruje się z dashboard notifications
- Brak eskalacji dla high-risk customers

**Rozwiązanie:**

- Dodać cron job sprawdzający churn risk daily
- Wysyłać alerty email/in-app dla high-risk customers
- Integracja z notification system

**Pliki do modyfikacji:**

- `server/src/cron/ChurnAlertCron.ts` (NEW)
- `server/src/services/analytics/ChurnAnalyticsService.ts`

---

### GAP-CUSTOMER-004: Brak email notifications przy stage transitions

| Atrybut              | Wartość                             |
| -------------------- | ----------------------------------- |
| **Priorytet**        | LOW                                 |
| **Szacowany effort** | 2h                                  |
| **Wpływ**            | CSM musi ręcznie monitorować zmiany |

**Problem:** Gdy klient przechodzi między etapami lifecycle, brak automatycznego powiadomienia do:

- Assigned CSM
- Account manager
- Customer (opcjonalnie)

**Rozwiązanie:**

- Hook w `transitionOrganization` wysyłający email
- Template emaila dla stage transition
- Configurable notification preferences

**Pliki do modyfikacji:**

- `server/src/controllers/SuperAdminController.ts` - add email trigger
- `server/src/templates/emails/` - add template

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 4     |
| **HIGH Priority**   | 1     |
| **MEDIUM Priority** | 2     |
| **LOW Priority**    | 1     |
| **Total Effort**    | ~11h  |

## Recommendations

1. **Immediate (Week 1):** Implement GAP-CUSTOMER-001 (playbook triggers) - największy impact na productivity
2. **Short-term (Week 2):** Implement GAP-CUSTOMER-002 (health score) + GAP-CUSTOMER-003 (churn alerts)
3. **Later:** GAP-CUSTOMER-004 (email notifications) jako nice-to-have

## Related Flows

- FLOW-BILLING-001: Subscription Lifecycle (stage transitions na podstawie billing)
- FLOW-NOTIFICATION-001: Notification System (integracja alertów)
- FLOW-ANALYTICS-001: Custom Reports (health score w raportach)
