# FLOW-ANALYTICS-001: Custom Reports & Analytics

> **ID:** FLOW-ANALYTICS-001 | **Status:** ✅ Complete | **Priority:** MEDIUM

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 75%     |
| **Zidentyfikowane luki** | 3       |
| **Priorytet naprawy**    | MEDIUM  |

## Purpose

Generowanie raportów i analytics: dashboards, custom reports, scheduled exports, i data visualizations.

## Triggers

| Trigger         | Opis                       |
| --------------- | -------------------------- |
| Dashboard View  | User otwiera dashboard     |
| Report Generate | User generuje raport       |
| Schedule Run    | Scheduled report execution |
| Export Request  | Export do PDF/Excel        |

## Outcomes

- Dashboards z real-time data
- Custom reports wygenerowane
- Scheduled exports dostarczone
- Data insights available

## Actors

| Aktor      | Rola                    |
| ---------- | ----------------------- |
| User       | Przegląda analytics     |
| Admin      | Tworzy custom reports   |
| System     | Agreguje dane, generuje |
| SuperAdmin | Konfiguruje metrics     |

## Involved Modules

### Backend

| Serwis/Route        | Lokalizacja                      |
| ------------------- | -------------------------------- |
| analyticsService    | `server/src/services/`           |
| reportService       | `server/src/services/`           |
| analytics.routes.ts | `server/src/routes/`             |
| SnapshotService     | `server/src/services/analytics/` |

### Database

| Tabela                | Opis                  |
| --------------------- | --------------------- |
| `report_definitions`  | Custom report configs |
| `report_schedules`    | Scheduled reports     |
| `analytics_snapshots` | Historical data       |
| `metrics_cache`       | Cached metrics        |

## Gap Analysis

### GAP-ANALYTICS-001: Brak drill-down w dashboards

| Priorytet  | MEDIUM |
| ---------- | ------ |
| **Effort** | 6h     |

**Problem:** Dashboard metrics nie mają drill-down do szczegółów.

---

### GAP-ANALYTICS-002: Report builder ograniczony

| Priorytet  | LOW |
| ---------- | --- |
| **Effort** | 8h  |

**Problem:** Custom report builder ma ograniczone opcje wizualizacji i filtrowania.

---

### GAP-ANALYTICS-003: Brak data export API

| Priorytet  | LOW |
| ---------- | --- |
| **Effort** | 4h  |

**Problem:** Brak API do bulk data export dla integracji z BI tools.

---

## Summary

| Total Gaps       | 3    |
| ---------------- | ---- |
| **Total Effort** | ~18h |

## Related Flows

- FLOW-CUSTOMER-001: Customer Success (health metrics)
- FLOW-BILLING-001: Subscription analytics
