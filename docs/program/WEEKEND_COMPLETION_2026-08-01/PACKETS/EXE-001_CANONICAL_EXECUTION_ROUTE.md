---
doc_id: EXE-001
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: UI-UX-GATE-0
last_reviewed: 2026-07-31
---

# EXE-001 — kanoniczny entry point Execution

## Problem

`/execution` montowało legacy wrapper, a `/implementation` osobno montowało ten sam
`ExecutionHub`. Sidebar i część deep-linków kierowały do historycznej nazwy, przez co
moduł miał dwóch właścicieli URL, gate i breadcrumb.

## Rezultat

- `/execution` jest jedyną trasą montującą `ExecutionHub`;
- `/implementation` jest redirect-only aliasem zachowującym query i hash;
- `/rollout` przekierowuje do `/execution?tab=rollout`, zachowuje pozostałe parametry
  i hash oraz nadpisuje jedynie historyczny `tab`;
- historyczne Execution AppView emitują `/execution`, a reverse mapping wskazuje jeden
  widok właścicielski;
- sidebar, copy-link, Results handoff, pilot fallback, Chat/action handler i initiative
  deep links prowadzą bezpośrednio do kanonicznej trasy;
- API, dane, statusy, Manager AI i initiative document pozostają bez zmian.

## Odbiór 2026-07-31

Decyzja: **GO**.

- canonical/legacy/rollout route contract: `5/5 PASS`;
- wspólna regresja Finance/Results route authority: `7/7 PASS`;
- frontend `npm run type-check`: PASS;
- brak migracji i zmian API.

## Następna bramka

`EXE-002` ma scalić plan/task/milestone/role/resource/risk/change/decision w jeden
management spine z read-backiem. `FLOW-001` musi udowodnić closure→Results→Finance actual.
