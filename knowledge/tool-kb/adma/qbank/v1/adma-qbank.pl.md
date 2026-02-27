# ADMA — QBank Pack (v1, PL)

## Pack meta

- **tool_slug**: `adma`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Scan_Results.pdf` (obszary transformacji + benchmark)
- Runtime UI structure: `src/services/admaStructure.ts` (5 pillars / 12 dimensions)
- Runtime knowledge: `src/services/assessmentKnowledge/admaKnowledge.ts`
- SSOT: `docs/product/ADMA_ASSESSMENT_PACK_V3.md`

## Audience + use

- **Used by**: UI + AI (tool-scoped retrieval)
- **Do not use for**: scoring bez evidence

---

## Sections (chunk-friendly)

### [section_id:global_rules] Zasady globalne (MUST)

- Skala: **1–5**.
- Każdy wymiar oceniamy:
  - **current** (jak jest),
  - **target** (dokąd chcemy dojść w 12–24 mies.) — opcjonalnie,
  - **evidence** (artefakty) — wymagane do audytowalności.

### [section_id:qbank] Pytania (uniwersalne) per wymiar

> Bridge pack: zestaw pytań, który działa dla każdego wymiaru (12D) i wymusza spójność.

#### [level:1] Level 1 — Newcomer

- **3 pytania (tak/nie)**:
  - Czy proces/obszar działa głównie manualnie i bez standardów cyfrowych?
  - Czy brak właściciela (rola/osoba) i kadencji przeglądu tego obszaru?
  - Czy nie mamy danych/metryk, które pozwalają mierzyć wynik w czasie?
- **Evidence**: brak SOP/systemu, ręczne rejestry, brak dashboardów.

#### [level:3] Level 3 — Intermediate

- **3 pytania (tak/nie)**:
  - Czy obszar jest zdigitalizowany w kluczowych krokach i realnie używany “na co dzień”?
  - Czy są podstawowe integracje/przepływy danych między funkcjami (bez ręcznego przepisywania)?
  - Czy decyzje są podejmowane na bazie danych (dashboardy, review rytm)?
- **Evidence**: logi użycia systemów, dashboardy KPI, opis integracji, przykłady decyzji.

#### [level:5] Level 5 — Expert

- **3 pytania (tak/nie)**:
  - Czy mamy skalowalną, zintegrowaną praktykę (nie punktowe pilotaże)?
  - Czy istnieje pętla ciągłej optymalizacji (predict/optimize) z mierzalnym wpływem?
  - Czy obszar ma mechanizmy innowacji (roadmap, eksperymenty, standardy wdrożeniowe)?
- **Evidence**: portfolio wdrożeń, KPI przed/po, governance, standardy i audyty.

### [section_id:common_mistakes] Najczęstsze błędy

- “Mamy narzędzie” = “jesteśmy na poziomie 4” (bez użycia i skali).
- Brak evidence → zawyżanie poziomów.
- Ocena oparta o jedną osobę zamiast konsolidacji (scan review).

