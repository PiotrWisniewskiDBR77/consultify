# Final Implementation Contract — Kalendarz (Position 2/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Praca z terminami + koordynacja z kalendarzami innych aplikacji.
- **Primary users**: operatorzy i użytkownicy planujący pracę (PMO/manager/consultant).
- **Success metric**: realna interoperacyjność (identity, recurrence, sync, permissions) + „PMO-grade time surface” zamiast dekoracyjnej zakładki.

## 2. Scope
### 2.1 In-scope
- Integracja z kalendarzami zewnętrznymi i spójny model czasu dla obiektów app (task/decision/initiative milestone/meeting).
- Sync semantics (pull/push/bidir gdzie deklarowane), incremental updates, conflict-safe writes.

### 2.2 Out-of-scope / non-goals
- Budowa pełnego kalendarza jako osobnego produktu (nie zastępujemy vendorów).

### 2.3 Assumptions
- Integracja credential/runtime jest spójna z `Integracja` (position 1) i szerzej z `Synchronizacja`.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md`
- Benchmark: `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
- Readiness/SSOT: `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`, `docs/product/MYWORK_CALENDAR_V1_SSOT.md`

## 4. Softs inspirations (benchmark apps / standards)
- **Primary**: `Google Calendar` (developer surface), `Outlook / Microsoft 365` expectations (wprost w benchmarku).
- **Standards**: `CalDAV`, `iCalendar`, `iTIP` (to jest kluczowy „benchmark”, nie tylko UI).

## 5. Product contract (user-facing)
### 5.1 Primary flows
- Zobacz „one time surface”: widzę razem commitments z app + external events.
- Zdarzenia zewnętrzne: read + (gdzie deklarowane) write/update z zachowaniem identity i recurrence.

### 5.2 UI surfaces / entry points
- MyWork calendar jako kanoniczna powierzchnia czasu; overlay dla obiektów aplikacji.

### 5.3 States and transitions
- event state: external/internal, editable authority, recurrence parent/child, sync checkpoint.

### 5.4 Error model / degraded modes
- Różnicujemy: brak uprawnień, expired OAuth, conflict, partial sync, stale data.

## 6. Data + API contract (engineering-facing)
- Kontrakt wymaga: stable IDs, recurrence linkage, incremental sync cursor, conditional writes, permission gradients.

## 7. Evidence plan (DoD)
- End-to-end: connect → initial sync → incremental sync → update event → conflict scenario → recovery.
- Dowód: staging runbook z realnym providerem (Google; Microsoft jeśli dostępne w deklarowanym zakresie).

## 8. Delivery plan
- Packetizacja zgodnie z planem szczegółowym.

## 9. Risks / open questions / decisions
- Ryzyko: traktować sync jako export-only; brak recurrence correctness; brak jasnych permission gradients.

## 10. Evidence ledger (fill after delivery)
- PRs / staging proof / test runs:

