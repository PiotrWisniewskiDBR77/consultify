---
doc_id: RES-001
truth_type: operations
status: ACCEPTED_PARTIAL
owner: codex
product_owner: piotr
priority: P0
depends_on: UI-UX-GATE-0
last_reviewed: 2026-07-31
---

# RES-001 — kanoniczna trasa Results

## Rezultat części A

`/results` jest jedyną trasą montującą Results Hub. Historyczne `/benefits` i
`/kpi-okr` są redirect-only aliasami, zachowującymi query oraz hash. Oba dawne AppView
emitują `/results`, a reverse mapping wskazuje deterministycznie właścicielski widok
`BENEFITS_REALIZATION`, zamiast zależeć od kolejności wpisów o tym samym URL.

Wewnętrzne handoffy z Initiatives, lifecycle, Chat/action handler, demo rail i RouterSync
prowadzą już bezpośrednio do `/results`; historyczne aliasy służą wyłącznie starym
bookmarkom i zewnętrznym deep-linkom, nie bieżącej nawigacji produktu.

Identyfikator capability `MODULE_BENEFITS`, API i nazwy tabel pozostają bez zmian.

## Odbiór 2026-07-31

Decyzja dla route authority: **GO**.

- route identity, dwa legacy aliases i preservation: `7/7 PASS`;
- celowane testy mapowania Results: `4/4 PASS`;
- wspólna regresja Finance canonical route: `2/2 PASS`;
- frontend `npm run type-check`: PASS;
- brak migracji i zmian danych.

## Dlaczego status jest częściowy

Cały `RES-001` nie jest jeszcze przyjęty. `ResultsKpiScorecardsView` zapisuje scorecards
przez generic Goals API, mimo że backend V8 posiada osobny `kpi_scorecards`. Część B musi
przepiąć UI na jeden owner store i udowodnić: jedna tabela KPI, wiele scorecardów,
brak konkurencyjnego zapisu i pełny reopen.
