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
| `WK-P0-011` | Materials all — zapis, wznowienie, szablony i eksport | BLOCKED | staging: deck `Ready/11` otwiera się jako `0` slajdów; Documents i Sheets mają po `0` artefaktów; naprawa i ponowny lifecycle w `MAT-006B` |
| `WK-P0-012` | Admin/Settings — guardy i krytyczne mutacje | DISCOVERY | RBAC + audit |
| `WK-P0-013` | migracje, backup i próbny restore | DISCOVERY | odtwarzalny raport |
| `WK-P0-014` | globalny smoke i decyzja release | BLOCKED | wszystkie wymagane P0 rozstrzygnięte |
| `WK-P0-015` | mapa fragmentów route→UI→API→service→data→test | READY | komplet dla 16 pozycji |
| `WK-P0-016` | wybór kanonicznych implementacji i freeze alternatyw | BLOCKED | decyzje keep/merge/redirect/archive |
| `WK-P0-017` | pierwszy pionowy pakiet scalający | BLOCKED | 10/10 bramki integracji |
| `OPS-DEMO-001` | kontrolowana promocja zaakceptowanego kandydata na Railway `demo` | ACCEPTED | revision `9917d25c75`, deployment `9ea5c9c8` `SUCCESS`, health/routes `200`, log smoke bez fatal/crash/error |
| `OPS-DEMO-002` | publiczne wejście Try demo | BLOCKED | modal działa, lecz kanoniczne konta demo są odrzucane; administratorskie wejście techniczne działa |
| `OPS-DEMO-003` | recovery i namespaced fixtures | READY | utwardzić backup/restore i additive cleanup przed mutującymi E2E |

## P1 — ważne, ale nie blokuje ograniczonego odbioru

- Audits: jeden program, dowód, finding i raport;
- Finance: golden calculations i import;
- Partner Portal: izolacja partnera i referral;
- Organization: aktualność kontekstu i propagation;
- dostępność kluczowych podróży;
- obsługa błędów i pustych stanów;
- telemetryka krytycznych operacji.

## Odkrycia stagingowe wymagające naprawy

| ID | Zakres | Status | Dowód / następny krok |
| --- | --- | --- | --- |
| `MAT-006B` | Presentation lifecycle | BLOCKED | listowy `Ready/11` ≠ builder `0`; naprawić kanoniczną zawartość seeda i powtórzyć E2E |
| `FIN-005` | Finance demo coherence | BLOCKED | obce dane DBR77/Apator, odrzucone importy, duplikaty, surowe daty i niedostępny value engine |
| `OPS-DEMO-002` | Demo entry auth | BLOCKED | landing → Try demo nie wpuszcza kanonicznego konta Atelier Toys |
| `RES-005` | Results demo coherence | READY | rdzeń 127/127 PASS, ale staging miesza DBR77 z Atelier i ma legacy/scorecard split-brain |
| `EXE-003` | Initiative → Execution contract | READY | portfele 71 vs 13, duplikaty i sprzeczne EVM HIGH vs alert OK |
| `OPS-DEMO-003` | Recovery hardening | READY | obecny in-place restore nie jest bezpieczną bramką mutujących testów |

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
