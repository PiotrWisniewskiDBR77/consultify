# ADMA Assessment Pack v3 — assessment → visuals → report/deck → initiatives (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** kanonicznie opisać, jak ADMA działa w Consultify analogicznie do DRD i SIRI:  
> (1) assessment (pytania + evidence), (2) graficzna prezentacja, (3) raport i prezentacja, (4) inicjatywy (roadmap).

## 0) Źródła kanoniczne (MUST)

Metodologia ADMA (public / program TranS4MErs):

- `knowledge/ADMA/ADMA_booklet v5_compressed.pdf` (kontekst i metodologia programu, fazy, przykłady)
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Scan_Results.pdf` (kanoniczny kształt wyników scan: tabela + spider + benchmark FoF)
- `knowledge/ADMA/ADMA_TranS4MErs_Sample_Transformation_Plan (1).pdf` (kanoniczny kształt outputu: transformation plan + implementation journey guide)

Product SSOT:

- Results/KPI governance: `docs/product/RESULTS_V3.md`
- Consulting tools flow: `docs/product/CONSULTING_TOOLS_V3.md` (Library → Sessions → Outputs → Initiatives)
- Evidence discipline: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`

As-is implementation anchors:

- UI editor: `src/components/assessment/adma/ADMAAssessmentEditor.tsx`
- Structure (runtime): `src/services/admaStructure.ts` (5 pillars / 12 dimensions / 1–5)
- Knowledge hints (runtime): `src/services/assessmentKnowledge/admaKnowledge.ts`
- Internal note (secondary): `wdrozenia/modules/assessment/13-ADMA-METHOD.md`

---

## 1) Canon vs runtime (ważne rozróżnienie)

### 1.1 Canon (metodologia)

W materiałach ADMA TranS4MErs wynik scan raportuje **7 Transformation Areas (T1–T7)** oraz benchmark **Factory of the Future (FoF)** (typowo 4/5 jako benchmark).

### 1.2 Runtime (aktualny UI)

W Consultify mamy “ADMA 2.0” jako **5 pillarów i 12 wymiarów**. To jest dobra struktura UX do pracy “jak DRD”, ale musi mieć jawne mapowanie do kanonicznych 7 transformacji (na potrzeby raportu/decku i zgodności z materiałami ADMA).

**SSOT decision (v3):**

- **W UI** prowadzimy assessment w 5 pillarach / 12 wymiarach (spójnie z DRD/SIRI mechaniką).
- **W outputach ADMA** (report/deck) pokazujemy też widok **7 transformacji** jako agregację (mapowanie jest jawne i wersjonowane).

### 1.3 Mapowanie 7 transformacji (T1–T7) → runtime (5 pillars / 12 dimensions)

To mapowanie jest **kontraktem systemowym** (wersjonowane) i służy do:

- raportowania “kanonicznego ADMA” w formie T1–T7,
- benchmark overlay FoF per T,
- priorytetyzacji i generowania inicjatyw.

**Mapping v1 (default):**

| ADMA transformation | Meaning (short) | Primary runtime pillar(s) | Primary runtime dimension candidates |
| --- | --- | --- | --- |
| T1 Advanced Manufacturing Technologies | urządzenia/technologie + UR/kompetencje | `smart_operations` | `production_tech` (+ częściowo `digital_investments`) |
| T2 Digital Factory | connected shopfloor, OT/IT, transparency, cyber, SSOT | `smart_operations`, `data_driven` | `production_it`, `data_collection`, `data_analytics` (+ governance w `digital_strategy`) |
| T3 ECO Factory | energia/materiały/circular/ESG | `smart_operations`, `data_driven` | `production_tech`, `data_collection` (+ KPI/monitoring w `data_analytics`) |
| T4 End-to-end Customer Focused Engineering | customer integration + co-creation + robust engineering | `smart_products` | `product_features`, `product_data` (+ strategy: `digital_strategy`) |
| T5 Human Centred Organisation | kompetencje, kultura, zmiana, organizacja | `strategy` | `digital_culture` (+ `digital_strategy`) |
| T6 Smart Manufacturing | real-time decisions, analytics, automation/closed-loop | `smart_operations`, `data_driven` | `production_it`, `data_analytics` (+ `production_tech`) |
| T7 Value Chain Oriented Open Factory | integracja ekosystemu i łańcucha wartości | `smart_supply`, `strategy` | `supply_integration`, `supply_visibility` (+ partnerstwo w `digital_strategy`) |

**Aggregation rule (default):**

- Score(Tx) = średnia ważona przypisanych wymiarów (wagi w mappingu; default 1.0).
- Jeśli brak danych w wymiarze → Tx = “unknown” (nie imputujemy).

### 1.4 Wagi (mapping weights) i reguły benchmark overlay (FoF)

**SSOT decision (v3):** wagi są jawne (wersjonowane) i służą wyłącznie do agregacji T1–T7.

#### 1.4.1 Wagi domyślne (v1)

> Uwaga: to są **wagi operacyjne** dla Consultify. Jeśli klient ma własny profil (np. “bardziej supply‑chain”), wagi mogą być dostrojone per sesja (jako parametr eksportu), ale domyślna tabela pozostaje kanoniczna.

- **T1 Advanced Manufacturing Technologies**
  - `production_tech`: 0.70
  - `digital_investments`: 0.30

- **T2 Digital Factory**
  - `production_it`: 0.45
  - `data_collection`: 0.35
  - `data_analytics`: 0.20

- **T3 ECO Factory**
  - `data_collection`: 0.40
  - `data_analytics`: 0.35
  - `production_tech`: 0.25

- **T4 End-to-end Customer Focused Engineering**
  - `product_data`: 0.55
  - `product_features`: 0.30
  - `digital_strategy`: 0.15

- **T5 Human Centred Organisation**
  - `digital_culture`: 0.70
  - `digital_strategy`: 0.30

- **T6 Smart Manufacturing**
  - `data_analytics`: 0.45
  - `production_it`: 0.30
  - `production_tech`: 0.25

- **T7 Value Chain Oriented Open Factory**
  - `supply_visibility`: 0.50
  - `supply_integration`: 0.35
  - `digital_strategy`: 0.15

#### 1.4.2 FoF benchmark overlay — reguły

- benchmark FoF jest **warstwą porównawczą** (nie wpływa na score),
- FoF może być:
  - stałą (np. 4.0/5), albo
  - profilem (T1..T7 różne wartości) jeśli klient/domena tak definiuje.

W raporcie/decku pokazujemy:

- `Company score` (current),
- `Target` (jeśli zdefiniowano),
- `FoF benchmark` (warstwa odniesienia),
- `Gap to FoF` = FoF - current.

---

## 2) Assessment UX (analogicznie do DRD/SIRI)

### 2.1 Układ ekranu (DRD-like)

- **Center**: pytania + scoring dla wybranego wymiaru (current + target) + evidence + notes.
- **Right panel (navigation)**:
  - Pillar → dimension list,
  - progress per pillar,
  - szybki skok do dimension.
- **Graphic mirror** (w workspace): radar/spider + gap bars + lista “lowest gaps”.

### 2.2 Zasady scoringu

- Skala: **1–5** (Newcomer → Expert) zgodnie z `admaStructure.ts` (runtime) i materiałami ADMA (scan report).
- Każdy wymiar ma:
  - `current`
  - `target` (opcjonalnie)
  - `evidence` (wymagane dla audytowalności; link/attachment + krótkie “dlaczego”)

### 2.3 Evidence discipline (MUST)

Nie wolno oceniać “z głowy”. Dla każdej oceny wymagamy co najmniej jednego z:

- evidence link / attachment,
- notatka z audytu (krótko: artefakt + gdzie go znaleźć),
- explicit “unknown / needs evidence” (nie podbijamy poziomu).

---

## 3) Wizualizacje (graphic presentation)

### 3.1 Widoki kanoniczne (v3)

1) **Radar/Spider** (5 pillarów) — szybkie “shape of maturity”.
2) **Gap bars** (current vs target) per pillar i per dimension.
3) **Heatmap/matrix** (optional v3/R1): dimensions × levels (jak DRD) dla nawigacji i kompletności.
4) **Benchmark overlay**:
   - FoF benchmark (np. 4/5) jako linia/warstwa porównawcza.

### 3.2 Widok 7 transformacji (raportowy)

W raportach i deckach pokazujemy:

- tabela T1–T7: score, benchmark FoF, gap,
- spider dla 7 transformacji (jak w sample scan results),
- priorytety: top 2–3 “priority areas”.

---

## 4) Outputy: raport + prezentacja

### 4.1 Raport ADMA (MD/PDF)

Minimalny układ (zgodny z sample “Scan Results” + “Transformation Plan”):

1) Executive Summary (avg maturity, target, top gaps, rekomendacje)
2) Scan Results Summary:
   - spider chart
   - tabela pillarów + tabela T1–T7 (benchmark FoF)
3) Priorytety transformacji (wybór 2–3 obszarów)
4) Transformation Plan:
   - opis current status
   - goals
   - suggested areas for improvement
5) Implementation Journey Guide:
   - plan działań + zasoby
   - measurement (KPI krótkoterminowe i długoterminowe)

### 4.2 Prezentacja (deck)

Deck to skrót raportu:

- 1 slajd: “overall maturity shape” (radar + avg)
- 1 slajd: “benchmark gap” (FoF vs company)
- 1–2 slajdy: “priority transformations” (top gaps + uzasadnienie)
- 1–2 slajdy: “initiatives roadmap” (fale 0–6 / 6–18 miesięcy)

---

## 5) Inicjatywy (roadmap) — jak generujemy listę

### 5.1 Reguła bazowa (propose→accept)

System generuje **propozycje** inicjatyw na bazie:

- największych gapów (current→target),
- krytyczności (jeśli dostarczymy “business priority”),
- zależności foundation → value.

### 5.2 Struktura inicjatyw ADMA (kanon)

Każda inicjatywa z ADMA musi zawierać:

- `source_type='assessment_adma'` + `source_id=<assessment_session_id>`
- powiązanie do pillar/dimension (+ opcjonalnie transform area T1–T7)
- owner rola
- KPI do trackingu (Results module):
  - przynajmniej 1 KPI outcome + 1 KPI driver (leading)
- evidence/assumptions: jawne (co wiemy, czego nie wiemy)

### 5.3 Typowe kategorie inicjatyw

- **Foundation**: data, integracje IT/OT, kompetencje, governance, cyber.
- **Value/use-cases**: konkretne usprawnienia (predictive maintenance, quality analytics, scheduling).
- **Sustainability** (Eco Factory): energia/CO2/odpady, metering, optymalizacja.
- **Customer/engineering**: digital thread, PLM/variant mgmt, VOC loop.

---

## 6) Tool Knowledge Bank (wektorowa baza wiedzy)

ADMA musi mieć własne packi:

- `knowledge/tool-kb/adma/methodology/v1/*.(pl|en).md`
- `knowledge/tool-kb/adma/qbank/v1/*.(pl|en).md`
- (R1) `knowledge/tool-kb/adma/initiatives/v1/*` — “gap → initiative patterns”
- (R1) `knowledge/tool-kb/adma/help/v1/*` — “chat coach + self-service playbook + video scripts”

Ingest do DB: `POST /api/ai-operations/knowledge/tool-packs/index`.

---

## 7) Chat Coach — kompletna instrukcja prowadzenia ADMA przez czat (SSOT)

### 7.1 Zasady rozmowy (kontrakt)

- Chat jest “facylitatorem” — prowadzi, pyta, pilnuje evidence, proponuje score.
- Chat **nigdy nie finalizuje** bez akceptacji użytkownika (propose→accept).
- Chat pilnuje, aby wynik był audytowalny:
  - dla każdego wymiaru: current + evidence,
  - dla target: uzasadnienie “po co”.

### 7.2 Kickoff (5–10 min) — skrypt

Chat musi zebrać:

- zakład / linia / obszar,
- uczestnicy (min. produkcja + IT/OT + supply + finance),
- horyzont targetu (np. 12–24 mies.),
- dostępne dane (systemy, KPI, raporty, audyty).

**Wiadomości czata (kanon):**

1) “Jaki jest zakres assessmentu (zakład/linia/proces) i jaki horyzont targetu?”
2) “Kto uczestniczy i kto jest ownerem decyzji (sponsor)?”
3) “Jakie macie artefakty/dowody: ERP/MES/WMS/PLM, KPI, audyty, diagramy architektury?”
4) “Czy robimy tylko current, czy też target i roadmapę?”

### 7.3 Pętla wymiarów (12 dimensions) — skrypt

Dla każdego wymiaru chat wykonuje tę samą sekwencję:

1) **Explain**: 1–2 zdania “co oceniamy w tym wymiarze”
2) **Ask**: 3–6 pytań diagnostycznych (z QBank)
3) **Evidence**: prośba o 1 dowód (link/attachment) + gdzie to znaleźć
4) **Propose score**: “Proponuję current=… bo …”
5) **Accept**: użytkownik potwierdza lub koryguje
6) **Target (optional)**: “Jaki target (1–5) na 12–24 mies. i dlaczego?”
7) **Note**: zapis “why” + “missing evidence” jeśli trzeba

### 7.4 Konsolidacja (10–15 min) — skrypt

Chat generuje:

- top 5 gapów (target-current),
- listę braków dowodowych,
- wstępne mapowanie do T1–T7 z benchmark FoF.

### 7.5 Inicjatywy (15–25 min) — skrypt

Chat:

- wybiera 2–3 priorytetowe transformacje (T),
- proponuje inicjatywy z packa `adma/initiatives`,
- dopina ownera i KPI (outcome+leading),
- ustala fale (0–6 / 6–18 / 18–36).

---

## 8) Video scripts — żeby dało się nagrać instruktaż (SSOT)

### 8.1 Film A — “ADMA self‑service w 20 minut”

**Cel:** użytkownik sam przechodzi: kickoff → scoring → summary → inicjatywy → export.

**Ujęcia (outline):**

1) Wejście do sesji ADMA i wybór zakresu
2) Jak działa skala 1–5 (current vs target)
3) Jak dodać evidence i notatkę
4) Jak czytać radar + gap bars
5) Widok T1–T7 + FoF benchmark
6) Generowanie inicjatyw + akceptacja
7) Export raportu i decku

### 8.2 Film B — “ADMA z konsultantem (warsztat 60–90 min)”

**Cel:** pokaz facylitacji + pracy na dowodach.

**Ujęcia (outline):**

1) Kickoff z rolami + zasada evidence-first
2) Przejście przez 2–3 wymiary “na żywo” (pokazać propose→accept)
3) Konsolidacja + rozwiązywanie sprzeczności
4) Priorytetyzacja transformacji
5) Roadmap waves + KPI

