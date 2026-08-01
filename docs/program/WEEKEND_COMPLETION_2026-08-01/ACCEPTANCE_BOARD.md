---
doc_id: weekend-acceptance-board-2026-08-01
truth_type: delivery-status
status: canonical
owner: codex
last_reviewed: 2026-08-01
---

# Board odbioru

## Statusy

`DISCOVERY → CONCEPT → READY → IN_IMPLEMENTATION → IN_REVIEW → RUNTIME_TEST →
OWNER_ACCEPTANCE → ACCEPTED`

Statusy końcowe alternatywne: `BLOCKED`, `DEFERRED`, `REJECTED`.

## P0 — przed odbiorem aplikacji

| ID | Zakres | Stan startowy | Bramka |
| --- | --- | --- | --- |
| `WK-P0-001` | stabilny baseline, build, typy i krytyczne testy | READY | revision i raport bazowy |
| `WK-P0-002` | logowanie, organizacja, role i tenant isolation | DISCOVERY | test pozytywny i negatywny |
| `WK-P0-003` | nawigacja 16 pozycji i brak martwych wejść | READY | smoke wszystkich pozycji |
| `WK-P0-004` | Chat — cztery znane regresje | READY | 74/74 testów celowanych |
| `WK-P0-005` | elastyczny Canvas → zatwierdzony wynik → owner lane | CONCEPT | pełny E2E + audit trail |
| `WK-P0-006` | My Work — praca przypisana i link do źródła | DISCOVERY | E2E zadania/decyzji |
| `WK-P0-007` | Interview — publish/assignment/response/approval | DISCOVERY | E2E lifecycle |
| `WK-P0-008` | Tools — pełny lifecycle SWOT | CONCEPT | E2E SWOT |
| `WK-P0-009` | Assessment — scoring/raport/handoff | DISCOVERY | E2E jednego frameworka |
| `WK-P0-010` | Initiative → Execution → Results | IN_IMPLEMENTATION | kanoniczne wejście Execution przyjęte; nadal potrzebny jeden spójny golden flow |
| `WK-P0-011` | Materials all — zapis, wznowienie, szablony i eksport | IN_IMPLEMENTATION | artifact foundation, Document share/restore, Workbook round-trip i Presentation CAS restore przyjęte; pozostają workbook versions/concurrency, Sheets actions i lifecycle E2E |
| `WK-P0-012` | Admin/Settings — guardy i krytyczne mutacje | DISCOVERY | RBAC + audit |
| `WK-P0-013` | migracje, backup i próbny restore | DISCOVERY | odtwarzalny raport |
| `WK-P0-014` | globalny smoke i decyzja release | BLOCKED | wszystkie wymagane P0 rozstrzygnięte |
| `WK-P0-015` | mapa fragmentów route→UI→API→service→data→test | READY | komplet dla 16 pozycji |
| `WK-P0-016` | wybór kanonicznych implementacji i freeze alternatyw | BLOCKED | decyzje keep/merge/redirect/archive |
| `WK-P0-017` | pierwszy pionowy pakiet scalający | BLOCKED | 10/10 bramki integracji |
| `OPS-DEMO-001` | kontrolowana promocja zaakceptowanego kandydata na Railway `demo` | ACCEPTED | revision `9917d25c75`, deployment `9ea5c9c8` `SUCCESS`, health/routes `200`, log smoke bez fatal/crash/error |

## P1 — ważne, ale nie blokuje ograniczonego odbioru

- Audits: jeden program, dowód, finding i raport;
- Finance: golden calculations i import;
- Partner Portal: izolacja partnera i referral;
- Organization: aktualność kontekstu i propagation;
- dostępność kluczowych podróży;
- obsługa błędów i pustych stanów;
- telemetryka krytycznych operacji.

## Cel środowiskowy

Werdyktem programu jest stabilny staging z pełnymi golden flows. Produkcyjny
deploy nie należy do zakresu tej fali i wymaga osobnej decyzji po odbiorze.

## P2 / świadome odroczenia

- Meeting pozostaje `soon`, dopóki nie ma zatwierdzonego MVP i runtime;
- pełna przebudowa wszystkich metod Tools;
- wszystkie zaawansowane tryby AI i integracje;
- redukcja historycznych 298 MB dokumentacji;
- migracja śledzonych artefaktów `uploads/out/knowledge`.

## Zasada priorytetu

Najpierw bezpieczeństwo i utrata danych, potem krytyczny przepływ biznesowy,
następnie spójność UX. Nie naprawiamy kosmetyki, gdy ten sam przepływ nie
zapisuje danych lub omija uprawnienia.
