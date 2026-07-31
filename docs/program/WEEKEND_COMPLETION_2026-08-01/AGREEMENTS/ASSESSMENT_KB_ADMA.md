---
document_id: ASSESSMENT-KB-ADMA
module: Assessment
method: ADMA
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# ADMA — baza wiedzy i komunikacja Workbencha

## 1. Prawda metodologiczna i model roboczy

Obecny Workbench modeluje 5 pillars i 12 dimensions na skali 1–5. Kanoniczny
output ADMA TranS4MErs pokazuje 7 Transformation Areas T1–T7 oraz benchmark
Factory of the Future. Obie warstwy są potrzebne, a mapowanie musi być jawne i
wersjonowane.

## 2. Źródła

- `knowledge/ADMA/ADMA_booklet v5_compressed.pdf` — kontekst/metoda;
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Scan_Results.pdf` — wynik T1–T7/FoF;
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Transformation_Plan (1).pdf` — plan;
- `knowledge/tool-kb/adma/qbank/v1/*` — bridge questions;
- `knowledge/tool-kb/adma/methodology/v1/*` — wiedza metodyczna;
- `knowledge/tool-kb/adma/initiatives/v1/*` — patterns inicjatyw;
- `src/services/admaStructure.ts` — 5 pillars/12 dimensions runtime;
- ADMA editor/map/report — obecna implementacja.

## 3. Wywiad i scoring

Jednostką roboczą jest dimension. Dla każdej zapisujemy current, opcjonalny
target, odpowiedzi, evidence i score decision. Obecny QBank jest bridge'em z
ogólnymi pytaniami dla poziomów 1/3/5; docelowo potrzebujemy pytań i atrybutów
dla wszystkich 12 dimensions × Levels 1–5.

Teresa nie wnioskuje poziomu tylko z obecności technologii. Sprawdza wdrożenie,
pokrycie, integrację, governance, mierzalny wpływ i ciągłe doskonalenie.

## 4. Grafika i agregacja

- primary work matrix: 12 dimensions × Levels 1–5;
- navigation grouping: 5 pillars;
- output mapping: T1–T7 z wersjonowanymi wagami;
- FoF jest overlay benchmarkiem i nie wpływa na company score;
- brak inputu daje unknown, nie imputowaną średnią;
- radar pokazuje osobno company, target, FoF i ewentualnie cohort average.

## 5. Komunikacja z KB

Retrieval używa `dimension_id + level + capability`. Po freeze aggregation
capability pobiera zatwierdzone 12D i mapping version, a następnie deterministic
engine wylicza T1–T7. Teresa może wyjaśnić wynik i przygotować proposal planu,
ale nie zmienia wagi ani benchmarku bez jawnej konfiguracji.

## 6. Krytyczne braki

- rozbudować QBank z bridge 1/3/5 do pełnych 12 × 5;
- zatwierdzić definicje atrybutów i evidence per dimension/level;
- wdrożyć i przetestować mapping/weights T1–T7;
- wersjonować FoF source/profile;
- spiąć initiatives pack z findings oraz provenance;
- doprowadzić report/deck do wzorca scan + transformation plan;
- dodać golden cases i test unknown/N/A.

## 7. Expected outputs

12D work matrix, 5-pillar summary, T1–T7 table/radar, FoF overlay, priority
transformations, Transformation Plan, report/deck i Initiative Proposal Drafts.
