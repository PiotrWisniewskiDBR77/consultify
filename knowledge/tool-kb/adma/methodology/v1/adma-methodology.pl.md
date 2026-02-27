# ADMA — Methodology Pack (v1, PL)

## Pack meta

- **tool_slug**: `adma`
- **pack_type**: `methodology`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `knowledge/ADMA/ADMA_booklet v5_compressed.pdf` (Agoria/OldContinent/EC, CC-BY 4.0)
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Scan_Results.pdf` (format wyników + benchmark)
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Transformation_Plan (1).pdf` (format transformation plan)
- Runtime UX structure: `src/services/admaStructure.ts`
- Internal note (secondary): `wdrozenia/modules/assessment/13-ADMA-METHOD.md`

## Audience + use

- **Used by**: AI + raport/deck generator + assessment UI hints
- **Do not use for**: “zgadywanie” poziomów bez evidence

---

## Sections (chunk-friendly)

### [section_id:overview] Czym jest ADMA (TranS4MErs)

- ADMA wspiera transformację firm produkcyjnych w kierunku “Factory of the Future”.
- Typowy przebieg programu (z materiałów ADMA) obejmuje:
  - Vision & Ambition
  - Registration & Scan
  - Transformation Plan
  - Implementation Plan / Journey Guide

### [section_id:scan_output] Kanoniczny kształt wyników scan

W sample “Scan Results” wynik zawiera:

- average maturity score (np. 2.54/5) + target score,
- tabela transformacji (T1–T7): score, FoF benchmark (często 4/5), gap,
- opis dla każdej transformacji: sens + elementy dojrzałości w perspektywie poziomów.

### [section_id:transformations] 7 obszarów transformacji (T1–T7)

W raportowaniu ADMA występuje 7 obszarów:

- **T1: Advanced Manufacturing Technologies**
- **T2: Digital Factory**
- **T3: ECO Factory**
- **T4: End-to-end Customer Focused Engineering**
- **T5: Human Centred Organisation**
- **T6: Smart Manufacturing**
- **T7: Value Chain Oriented Open Factory**

> Uwaga: w Consultify runtime UI działa na 5 pillarach/12 wymiarach.  
> Raport ADMA w systemie musi umożliwić widok T1–T7 jako agregację (mapowanie jawne i wersjonowane).

Mapowanie v1 (kontrakt systemowy) opisuje:

- `docs/product/ADMA_ASSESSMENT_PACK_V3.md` §1.3

### [section_id:priority_areas] Priorytetyzacja (Transformation Plan)

W sample “Transformation Plan” priorytety są wybierane po przeglądzie scan i rozmowie (scan review):

- identyfikacja najwyższych/najniższych obszarów,
- dopasowanie do strategii i potrzeb biznesowych,
- wybór 1–3 “priority areas”,
- opis current status, goals, suggested improvements,
- “Implementation Journey Guide” + KPI (0–6 i 6–18 miesięcy).

### [section_id:evidence] Evidence discipline (MUST)

W Consultify:

- każda ocena current/target musi mieć evidence albo jawne “unknown/needs evidence”,
- “scan results” bez evidence nie może automatycznie generować inicjatyw jako “prawdy” (tylko propozycje).

