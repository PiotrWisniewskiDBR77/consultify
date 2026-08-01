---
document_id: ASSESSMENT-KB-SIRI
module: Assessment
method: SIRI
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# SIRI — baza wiedzy i komunikacja Workbencha

## 1. Prawda metodologiczna

SIRI ocenia zakład produkcyjny w 3 building blocks, 8 pillars i kanonicznych 16
dimensions. Każdy dimension otrzymuje Band 0–5. Model danych musi zachować 16D;
8 pillars służy grupowaniu i agregacji, nie zastępuje wyników wymiarów.

## 2. Źródła

- `knowledge/SIRI/[SIRI Assessor Training] Module 2 1.pdf` — framework/matrix;
- `knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf` — prowadzenie oceny;
- `knowledge/SIRI/SIRI-PM Whitepaper.pdf` — TIER i Prioritisation Matrix;
- `knowledge/tool-kb/siri/qbank/v1/*` — obecny bridge QBank;
- `src/services/siriStructure.ts` — 8D runtime + 16 prioritisation areas;
- SIRI editor/map/report services — obecna implementacja.

Źródła licencjonowane mają jawne use restrictions i nie mogą być swobodnie
przepisywane do publicznych outputów.

## 3. Scoring

- uczestnicy uzasadniają Band informacją i evidence;
- nie ma leapfroggingu: wyższy Band wymaga poprzednich;
- zasada 80/20 ocenia, czy atrybuty występują w wystarczającej części scope;
- Assessor prowadzi, sugeruje i rekomenduje;
- finalną decyzję Band podejmują uprawnieni uczestnicy/approver;
- brak dowodu pozostaje jawny.

Te reguły muszą być deterministycznymi fixtures, nie samym promptem Teresy.

## 4. Dwie kolejne macierze

1. Assessment Matrix: 16 dimensions × Bands 0–5; daje zamrożony obraz current.
2. Prioritisation Matrix: uruchamiana po freeze i oparta na TIER, kosztach, KPI,
   benchmarku/relative gap oraz horyzoncie/weighting zgodnie z wersją metody.

Nie wolno łączyć wyboru Band z priorytetyzacją w jednym formularzu.

## 5. Wywiad

Workbench prezentuje dimension, definicje Bandów, sample statements i pytania.
Teresa prosi o opis procesu, systemów i dowodów, obserwuje pokrycie scope oraz
sprawdza sąsiednie Bandy. Plant tour/observation może być osobnym Evidence Item.

## 6. Komunikacja z KB

Exact retrieval używa `dimension_id + band + capability`. Odpowiedź zawiera
definition/attributes, sample statements, pytania, evidence expectation,
no-leapfrog/80:20 warnings oraz source refs. Prioritisation capability dostaje
zamrożone 16D; nie może korzystać z niezatwierdzonego proposal score.

## 7. Krytyczne braki

- przebudować persistence z 8D na 16D source-of-truth;
- zdefiniować jawne 16D → 8 pillars aggregation;
- rozbudować obecny ogólny QBank do pytań per dimension × Band;
- zakodować 80/20 i no-leapfrog validation;
- odseparować Assessment Matrix od Prioritisation Matrix;
- zweryfikować implementację formuły PM, wagi, benchmarki i legal notices;
- dostosować report/deck do 16D provenance.

## 8. Expected outputs

16D Assessment Matrix, 8-pillar summary, evidence/limitations, Prioritisation
Matrix, selected focus dimensions, report/deck i Initiative Proposal Drafts.
