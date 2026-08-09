# Plan realizacji Artifact Studio

## 1. Strategia

Nie wykonujemy big-bang rewrite. Rozwijamy istniejący `ExecutiveModuleShell`,
budujemy wspólne kontrakty i cienkie adaptery formatów. Modele domenowe TipTap,
deck/cards i workbook/grid pozostają niezależne.

Kolejność pilotów:

1. shared contracts i shell foundation;
2. PPT jako pilot przestrzenny;
3. DOC jako pilot długiej treści i governance;
4. XLSX po zbudowaniu brakującego fundamentu transakcyjnego;
5. cross-format parity;
6. legacy removal.

## 2. Pakiety pracy

### PKG-00 — Baseline i safety map

- current branch/HEAD i dirty-worktree map;
- runtime screenshots DOC/PPT/XLSX;
- routes, component/import, endpoint i feature-flag map;
- inventory wszystkich kontrolek `KEEP/MOVE/MERGE/REMOVE`;
- odtworzenie obecnych przepływów open/save/export/recovery.

Wyjście: baseline możliwy do powtórzenia, bez niewyjaśnionych awarii.

### PKG-01 — Shared contracts

Zamrozić:

- identity;
- autosave/conflict;
- lifecycle, classification, permissions;
- command definition i selection reference;
- panel mode;
- Teresa attachment i AI proposal;
- sources/data lineage;
- comments/review/approval;
- QA finding;
- versions/diff/restore;
- export job, async job i audit event;
- format adapter i responsive/focus.

Wyjście: schemat, state machine, permissions, audit, recovery i test każdego
kontraktu.

### PKG-02 — Command registry

- jeden rejestr command IDs;
- adaptery etykiet i selection predicates;
- wspólne aliasy context/kebab/keyboard;
- test duplikatów, orphan commands i niedozwolonych namespaces.

Wyjście: wszystkie zatwierdzone komendy dają się opisać bez duplikowania
handlerów.

### PKG-03 — Artifact Studio Shell

- jednoliniowe Menu 2;
- host dynamicznego Menu 3;
- jeden host lewego panelu;
- canvas adapter boundary;
- bottom bar;
- arbitraż przestrzeni, overflow, focus i overlays;
- Menu 1 pozostaje bez zmian.

Wyjście: component/visual tests 1920, 1440, 1280 i 1024.

### PKG-04 — Global Teresa bridge

- screen context;
- versioned selection chips;
- jump back do obiektu;
- proposal/diff/accept/reject/undo;
- permission i classification filtering;
- usunięcie lokalnych instancji AI z nowych ścieżek.

Wyjście: dokładnie jedna rozmowa i jedna prawa powierzchnia.

### PKG-05 — Governance foundation

- wspólne lifecycle i classification;
- comment parity;
- approval z zakazem self-approval i version binding;
- itemized QA;
- versions/restore z orphan anchors;
- draft/final export policy i audited override;
- public link tylko Public.

Wyjście: identyczne testy polityki dla wszystkich formatów.

### PKG-06 — PPT adapter pilot

- Menu 2/3 i left slides;
- selection adapter slajd/blok/tekst/tabela/wykres/obraz;
- bottom Teresa, Notes, zoom/fit;
- Sources/Comments/QA/History w lewym kontenerze;
- Present od bieżącego/od początku/Presenter;
- PPTX/PDF draft i final.

Nie usuwać legacy kill-switcha przed dowodem parytetu.

### PKG-07 — DOC adapter

- outline/section adapter;
- TipTap i block selection;
- dynamiczne formatowanie i context menus;
- bottom Teresa, outline, zoom/fit;
- połączone Sources, QA/Review i History;
- DOCX/PDF draft/final;
- usunięcie duplikatów `Document preview`, Download i lokalnego AI tylko w
  nowej ścieżce.

### PKG-08 — XLSX foundations

Przed pełnym UI:

- kanoniczny identity resolver dla workbook i tp_table;
- headless workbook controller;
- batch mutation API z baseVersion i idempotency;
- atomowe operacje, recalculation i rollback;
- revision store, undo/redo i restore;
- stabilne sheet/range anchors;
- comments, governance, QA i sources contracts;
- global Teresa selection bridge.

### PKG-09 — XLSX adapter i pionowe slices

- shell, formula bar, controlled grid i bottom bar;
- left Sheets/Sources/Comments/QA/Versions/Properties;
- kolejno: selection+clipboard, row/column structure, sheet structure,
  formatting, sort/filter/freeze, find/replace;
- każda rodzina command → backend → persistence → undo → tests;
- chart, merge, validation, conditional formatting, named ranges i PDF pozostają
  P1; pivot/macros/VBA/PowerQuery są OUT.

### PKG-10 — Cross-format acceptance

- wspólne command semantics, permissions, audit i recovery;
- transfer test;
- keyboard/a11y;
- current-SHA runtime i visual evidence;
- otwieranie realnych DOCX/PDF/PPTX/XLSX;
- realDB i failure/recovery paths.

### PKG-11 — Legacy decommission

Osobny pakiet dopiero po pełnym parity gate:

- route/import/reference scan;
- telemetry braku użycia;
- rollback rehearsal;
- usunięcie lokalnych AI, duplikatów toolbarów i Kimi chrome;
- zachowanie domenowych engine'ów i kompatybilnych endpointów.

## 3. Flagi

Minimalny model:

- shared shell/command/context/governance flags na etapie development;
- formatowe flagi DOC, PPT i XLSX;
- jedna autorytatywna flaga nowej ścieżki XLSX;
- rollout: dev → internal org → demo cohort → 10% → 50% → 100%;
- persistence i nowe endpointy pozostają backward compatible podczas rollbacku.

## 4. Kolejność zależności

```text
PKG-00 → PKG-01 → PKG-02 → PKG-03
                    ├──────→ PKG-04
                    └──────→ PKG-05

PKG-03/04/05 → PKG-06 PPT → PKG-10
PKG-03/04/05 → PKG-07 DOC → PKG-10
PKG-01/05    → PKG-08 XLSX → PKG-09 → PKG-10

PKG-10 + obserwowana stabilność → PKG-11
```

## 5. Priorytet realizacji

P0-A: baseline, contracts, registry, shell geometry, Teresa bridge.
P0-B: PPT pilot i governance parity.
P0-C: DOC adapter i source/review/export parity.
P0-D: XLSX foundations i profesjonalne minimum.
P0-E: transfer, real artifacts, rollout i legacy gate.

Nie rozpoczynać masowej implementacji przycisków przed PKG-01/02. Nie budować
trzech niezależnych shelli równolegle.
