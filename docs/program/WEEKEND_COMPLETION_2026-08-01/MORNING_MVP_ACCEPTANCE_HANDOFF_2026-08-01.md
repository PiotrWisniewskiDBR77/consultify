---
doc_id: morning-mvp-acceptance-handoff-2026-08-01
truth_type: delivery-status
status: canonical
owner: codex
product_owner: piotr
last_reviewed: 2026-08-01
---

# Poranny handoff do odbioru MVP

## Werdykt wykonawczy

Repozytorium ma bezpieczny, przetestowany fundament artefaktów oraz kanoniczne wejścia
do Finance, Results i Execution. Nie oznacza to jeszcze odbioru całego MVP. Kolejny etap
to pionowe golden flows na Railway `demo`, wykonywane zgodnie z
[`MASTER_EXECUTION_PLAN.md`](MASTER_EXECUTION_PLAN.md), bez dotykania produkcji.

## Co zostało przyjęte

| Obszar | Przyjęty rezultat | Dowód |
| --- | --- | --- |
| Artifact foundation | registry/envelope, kanoniczne typy, content read-back, ETag, source lineage, Canvas authority, Wave5 quarantine i publish quorum | `CORE-ART-001..007` |
| Materials / Document | Library otwiera realny share handoff; checkpoint i restore wykonują canonical read-back | `MAT-002`, `MAT-005A` |
| Materials / Workbook | real-route create→edit/formula→reopen→XLSX read-back | `MAT-003A` |
| Materials / Presentation | restore wymaga oczekiwanej wersji, stale write zwraca `409`, wynik jest ponownie odczytywany | `MAT-006A` |
| Finance | `/finance` jest jedynym ownerem UI, `/economics` redirect-only | `FIN-001` |
| Results | `/results` jest jedynym ownerem UI, aliasy są redirect-only | `RES-001A` |
| Execution | `/execution` jest jedynym ownerem UI, aliasy i handoffy zachowują stan | `EXE-001` |
| Initiatives | `/initiatives` jest jedynym mountem, aliasy zachowują stan, domyślny widok to List/table | `INI-001 route slice` |
| Execution snapshot | read-only initiative/milestone/task/decision snapshot z tenant scope i provenance | `EXE-002A1` |

Pełny wykaz commitów i zmienionych kontraktów znajduje się w historii gałęzi;
status funkcji jest utrzymywany w
[`MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md`](MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md).

## Jawne blokady i ograniczenia

1. `FIN-003A` ma zaimplementowany test realnego importu, ale jego lokalny runner został
   wycofany jako bramka odbiorowa. Test trzeba przepiąć na kontrolowany fixture i
   cleanup w PostgreSQL Railway environment `demo`.
2. `RES-001B` wymaga migracji ze scorecardów opartych o Goals do kanonicznego V8
   `kpi_scorecards`; nie wolno zgadywać, czy historyczne rekordy są jednorazowe.
3. Materials nadal nie ma pełnego E2E Document/Presentation, wersji Workbook,
   concurrency oraz kompletu akcji Sheets.
4. Pion `Initiative → Execution → Results → Finance actual` nie jest jeszcze
   odebrany jako jeden flow.
5. Assessment, Tools, Interview, My Work i Chat pozostają w ledgerze jako częściowe;
   obecność ekranów i endpointów nie jest dowodem golden flow.
6. Assessment ma rozpoznany kanon pięciu powierzchni, lecz Library nie jest jeszcze
   domyślnym wejściem, a DRD Form→save→reopen→Matrix wymaga realizacji `ASM-001A`.

## Pierwsza kolejka odbioru

1. `MAT-006B` i `MAT-005B`: pełne lifecycle E2E z export/share/revoke.
2. `FIN-003B`: realny import statement na PostgreSQL Railway `demo`.
3. `RES-001B`: inwentaryzacja danych i bezpieczny plan jednej prawdy scorecardów.
4. `INI-001..006` + `EXE-002A`: Candidate, role, approval, portfolio/roadmap i wspólny
   management snapshot bez tworzenia kolejnego store.
5. `FLOW-001`: Initiative → Execution → KPI → Finance actual z pełnym lineage.
6. Następnie `ASM`, `TLS`, `INT`, `MW` i `CHAT` według mapy bottom-up.

## Poranny protokół

1. potwierdzić revision oraz stan aplikacji i usług w Railway `demo`;
2. uruchomić bramki SSOT, linków, typów oraz celowane testy przyjętych paczek;
3. wykonać golden flows na `demo.consultify.ai` i zachować screenshoty/identyfikatory;
4. każdą funkcję oznaczyć `GO`, `FIX` albo `NO-GO` w Acceptance Board;
5. testy lokalne traktować wyłącznie jako development gate, nie evidence odbiorowe;
6. produkcja pozostaje poza zakresem i wymaga oddzielnej decyzji.

## Recovery i ochrona pracy

- przyjęte paczki są rozdzielone na małe commity i mogą być odwracane osobno;
- nie wykonano push ani deployu;
- nie usuwano historycznych materiałów repozytorium;
- zastane, niezwiązane zmiany w `.claude`, `Harvard`, plikach audytowych,
  `dev-render` i `tmp` pozostają poza zakresem commitów;
- testy stagingowe muszą fail-closed, jeżeli kontekst Railway nie wskazuje jawnie na
  project `consultify` i environment `demo`.
