---
doc_id: EXE-003
truth_type: operations
status: READY
owner: codex
product_owner: piotr
priority: P0
last_reviewed: 2026-08-01
---

# EXE-003 — Initiative → Execution golden contract

## Runtime evidence

- Execution pokazuje 13 aktywnych inicjatyw Atelier Toys;
- 11 jest jednocześnie oznaczonych przez EVM jako wysokie ryzyko `SPI 0`, podczas gdy
  tabela pokazuje alert `OK` — statusy ryzyka są wewnętrznie sprzeczne;
- wszystkie widoczne inicjatywy mają 0% i brak task count;
- Initiatives pokazuje 71 rekordów, historyczne dane i wielokrotne duplikaty
  `Offense/Defense/Repair/Conversion`, więc nie jest tym samym portfelem co Execution.

## Najkrótszy golden flow

`SCHEDULED initiative → START gate → EXECUTING → task todo/in_progress/review → approval
przez inną osobę → blocker/risk/decision → resolution → wszystkie taski terminalne → DONE`.

`/initiatives?open=<id>` i `/execution?open=<id>` muszą pokazywać te same taski,
decyzje, ryzyka i KPI.

## Pakiety wykonawcze

1. real HTTP integration contract na kanonicznych `/api/initiatives`, `/api/tasks`,
   `/api/decisions` i `/api/execution` z org isolation;
2. dedykowane submit/approve/reject dla task acceptance i zakaz self-approval;
3. DONE guard wymagający terminalnych tasków i braku pending gate decisions;
4. rozstrzygnięcie manual vs automatic BLOCKED/DONE;
5. tombstone niemontowanych/stub routerów oraz telemetria V8→legacy fallback;
6. jeden współdzielony lifecycle canon zamiast osobnych kopii FE/BE;
7. idempotentny cleanup duplikatów demo i spójność portfela Initiatives/Execution.

## Bramka

Nie przyjmować samego mockowanego service-lineage testu. Wymagane real handlers, DB
read-back, negatywne role/tenant tests i browser deep-link.

