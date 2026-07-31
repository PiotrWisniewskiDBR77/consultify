---
doc_id: CORE-ART-001
truth_type: operations
status: FIX
owner: codex
product_owner: piotr
priority: P0
last_reviewed: 2026-07-31
---

# CORE-ART-001 — jeden Artifact envelope

## Problem

Artifact registry, artifact runs, content envelope oraz publish/review używają częściowo różnych zbiorów typów i lifecycle. Przykładowo backend registry rozpoznaje rodzinę `template`, klient artifact runs nie; backend origin runtime posiada `sheet_template`, `document_template` i `work_canvas`, a klient ich nie zna; publish semantics wprowadza `finance_output` i `results_artifact` obok output types registry. Dalsza integracja modułów bez mapy zwiększy rozjazd.

## Oczekiwany rezultat

Jedna kompatybilna definicja tożsamości Artifact i jawne mapowanie content/run/publish, potwierdzone testami bez migracji destrukcyjnej.

## Zakres audytu

- `server/src/types/artifactRegistry.ts`;
- `src/services/api/artifactRuns.ts`;
- `server/src/types/publishReviewSemantics.ts`;
- `src/types/artifactContent.ts`;
- artifact routes/services i testy;
- konsumenci Materials/Chat/Finance/Results wyłącznie do mapowania.

## Poza zakresem

- zmiana technologii Excel;
- przebudowa edytorów Document/Deck/Workbook;
- masowe rename tabel/kolumn lub tras;
- usuwanie starych artifact types;
- zmiana UI poza koniecznym adapterem w późniejszej paczce.

## Kryteria audytu

1. Powstaje macierz wszystkich rodzin, output types, origin runtimes, content formats, run statuses i publish states.
2. Każda różnica ma ownera i decyzję: canonical/alias/adapter/deprecated.
3. Proponowana migracja jest addytywna i zachowuje stare rekordy.
4. Wskazane są testy tenant scope, create/read/version/approve/publish/reopen.
5. Nie wykonano mutacji repo poza dokumentem raportowym zatwierdzonym przez Codex.

## Następna paczka

Po werdykcie `GO`: `CORE-ART-002` implementuje minimalny shared contract/adapters i testy. Przy `FIX`: audyt wraca z konkretnymi brakami. Przy `NO-GO`: najpierw snapshot/migration proof danych.

## Recovery

Pierwsza faza jest read-only. Implementacja ma być additive, za adapterem i bez usuwania kolumn/enums. Rollback polega na wycofaniu adaptera, nie na odtwarzaniu danych.

## Wynik audytu

Werdykt: `FIX`. Kod nie został zmieniony.

1. Klient nie zna `template` oraz origin runtimes `sheet_template`, `document_template`, `work_canvas`, które dopuszcza serwer.
2. Klient `ArtifactRunRecord` nie zna zwracanego przez backend `operationContract`.
3. `ArtifactRecord` wymaga `isDraft`, ale `ArtifactRecordSchema` go nie waliduje.
4. Persisted artifact run i Execution Spine są dwoma źródłami statusu; UI część statusów wylicza, API może zwrócić stan nieaktualny biznesowo.
5. Retry nie ma bezpiecznej macierzy stanów i mutuje rodzica przed utworzeniem potomka.
6. Preflight jest informacyjny — `materialize` nie wymaga `passed`.
7. Registry, publish i content posiadają trzy nakładające się ontologie bez exhaustive mappera.
8. Content envelope ma równoległe definicje klient/serwer, a factory może oznaczyć pustą projekcję jako `synced`.
9. Publish może przejść do published po pojedynczym gate bez dowodu kompletnego quorum.

## Kolejność napraw

`CORE-ART-002 contract parity → CORE-ART-003 effective lifecycle/retry/preflight → CORE-ART-004 type/content mapper → CORE-ART-005 review quorum`.
