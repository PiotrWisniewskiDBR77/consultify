---
module_id: MODULE_INITIATIVES
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Initiatives — aktualny kontrakt funkcjonalny

## Cel

Initiatives zamienia insight, problem lub rekomendację w zarządzalną propozycję
zmiany z właścicielem, uzasadnieniem, priorytetem i decyzją. Jest właścicielem
inicjatywy do momentu kontrolowanego przekazania jej do Execution.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `INI-F-001` | Lista, filtry i widoki inicjatyw | AS-IS |
| `INI-F-002` | Utworzenie i karta inicjatywy | AS-IS |
| `INI-F-003` | Ocena, priorytetyzacja i roadmapa | AS-IS / partial |
| `INI-F-004` | Portfolio i zależności | AS-IS / partial |
| `INI-F-005` | Governance i decyzje | AS-IS / partial |
| `INI-F-006` | Transfer do Execution | partial |

## Przepływ i dane

Źródło tworzy draft inicjatywy; właściciel uzupełnia problem, rezultat,
zakres, koszty, korzyści, ryzyka i zależności; następuje ocena i decyzja.
Zatwierdzona inicjatywa może utworzyć wykonanie z trwałym linkiem zwrotnym.
Własnością modułu są inicjatywa, business case inicjatywy, scoring i decyzja
portfelowa; wykonanie i rzeczywiste wyniki należą do kolejnych modułów.

## AI, role i integracje

Teresa może tworzyć draft, wykrywać duplikaty, proponować scoring i zależności,
ale nie zatwierdza inicjatywy. Autor, właściciel, reviewer i decydent mają
oddzielne akcje. Wejścia pochodzą z Chat, Interview, Tools, Assessment i
Audits; wyjścia prowadzą do Execution, Results, Finance i Materials.

## AS-IS

`/initiatives` montuje hub, a `/roadmap`, `/portfolio` i `/roi` tworzą aktywną
rodzinę tras. Lifecycle i warstwa write-truth są obecne. Mapowanie sidebara
używa historycznego identyfikatora portfolio, co wymaga pilnowania spójności.
Szeroki pakiet V8 zawiera zarówno runtime, jak i aspiracje.

## TO-BE i luki

Docelowo każda inicjatywa ma pełne lineage, wersjonowany business case,
porównywalny scoring, jawne decyzje i idempotentny transfer do Execution.

- potwierdzić aktualne statusy i dozwolone przejścia;
- zweryfikować role akceptacji, akcje masowe i konflikty edycji;
- udowodnić transfer bez duplikatów oraz link zwrotny;
- rozdzielić runtime od niewdrożonych elementów V8;
- dodać E2E od źródła insightu do rozpoczęcia Execution.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`,
`INITIATIVE_CARD_SYSTEM_CONTRACT.md`, lifecycle/write-truth i API planning.
