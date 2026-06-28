# Plan wdrożenia — Assessment SIRI / DRD / ADMA (z dokumentów źródłowych)

> **Status:** Plan do realizacji · **Data:** 2026-06-28 · **Autor:** Claude (CTO)
> **Nadrzędne:** [`ASSESSMENT_CONCEPT_V4_2026-06-28.md`](ASSESSMENT_CONCEPT_V4_2026-06-28.md) (koncepcja) → ten dokument = **dokładny plan wdrożenia**.
> **Źródła kanoniczne (w repo):** `knowledge/DRD/` (książka „Digital Pathfinder"), `knowledge/SIRI/` (Assessor Training M1–M5, PM Whitepaper, OSA report, WEF 2022), `knowledge/ADMA/` (booklet, TranS4MErs Guide, Sample Scan Results, Sample Transformation Plan, case studies).
> **Zakres:** SIRI + DRD + ADMA (CMMI/LEAN później).

---

## 0. Zasady i IP (per framework)

| Framework | Właściciel | Licencja / IP | Konsekwencja wdrożenia |
|---|---|---|---|
| **DRD** | DBR77/Consultify (nasze) | własne | Pełna swoboda. Kanon = książka. |
| **SIRI** | EDB/INCIT, materiały TÜV SÜD | **Assessor Training = poufne, „All Rights Reserved"** | Odwzorowujemy **strukturę + nazwy + logikę formuły**; **NIE kopiujemy dosłownie** opisów band-ów ani treści szkoleniowej. Disclaimer „nie jest oficjalną oceną SIRI / OSA". |
| **ADMA** | European Commission (H2020) | **CC-BY 4.0** | Wolno odwzorować; wymagana **atrybucja** (Agoria/OldContinent + grant No. 101037866). |

Decyzja **D1** = „inspired-by" potwierdzona przez powyższe granice.

---

## 1. Rozjazdy kanon ↔ kod (zweryfikowane 2026-06-28)

### DRD
| Element | Kanon (książka) | Kod (`src/services/drdStructure.ts`) | Akcja |
|---|---|---|---|
| Osie | 7 | 7 ✅ | — |
| Obszary | 1A–1I (9) + 6×5 = **39** | komentarz „34" vs liczby sumujące do 39 | **reconcile** liczbę obszarów |
| Skale | 1–7 (oś1,4) · 1–5 (oś2,3,7) · **1–6 (oś5,6)** | oś5/6 spłaszczone do **1–5** | **D2a:** przywrócić 1–6 czy zostawić 1–5 (mapowanie 6→5)? |
| Picker label | „7 osi transformacji" | „8 key dimensions" (NewAssessmentModal) | **fix tekst** |
| Raport | jest w książce | **BRAK** template | **zbudować** |
| Mapa | maturity map | **BRAK** | **zbudować** |
| Efekty ekon. (krok 3) | ROI/payback w metodzie | brak | **dobudować** krok 3 |

### SIRI
| Element | Kanon | Kod (`src/services/siriStructure.ts`) | Akcja |
|---|---|---|---|
| Struktura 3-8-16 | 3 bloki/8 filarów/16 wym. | jest (16 prioritisationAreas) ✅ | weryfikacja nazw 16 wg M2 |
| Skala | Band 0–5 (bez sumowania) | `level: 0-5` ✅ | — |
| Prioritisation Matrix | formuła Impact Value = Wc·Cost + Wk·KPI + Wp·(BIC−AMS) | pole `prioritisationMatrix` istnieje, **formuła nie policzona** | **zaimplementować silnik** |
| Raport OSA | 10+ sekcji + benchmark 3B + Industry Card | template podstawowy | **rozbudować** do OSA-grade |
| Wizual | donut 3-8-16 + heatmapa band + PM | radar/heatmapa | **dodać donut 3-8-16** |

### ADMA
| Element | Kanon | Kod (`admaTransformations.ts`/`admaStructure.ts`) | Akcja |
|---|---|---|---|
| 7 transformacji | T1–T7 + podobszary (51 long / 22 quick) | T1–T7 + scoring ✅ | **zweryfikować podobszary** vs booklet |
| Skala | 1–5 | 1–5 ✅ | — |
| FoF benchmark | =4/5 wszystkie | jest | — |
| Benchmark peers | „Average Scan Responses" | brak bazy peers | **dodać** warstwę średniej |
| Scan Results visual | radar 7T (Company/FoF/Avg) + gap table | radar+FoF | **dodać** serię „avg" + gap table |
| Transformation Plan | osobny output (cele/akcje/KPI/efekty) | częściowo | **dobudować** strukturę planu |
| Atrybucja CC-BY | wymagana | brak | **dodać** stopkę atrybucji |

---

## 2. Plan per framework

### 2.1 DRD (flagowiec — największa dziura: brak outputu)

**Cel:** domknąć 3-krokowy „Digital Roadmap" (Diagnoza → Inicjatywy → Efekty ekonomiczne) + output.

- **D-1 Kanon i skale** — reconcile liczby obszarów (39); **decyzja D2a** o skali 1–6 (rekom.: przywrócić 1–6 dla oś5/6, bo kanon; UI radzi sobie kolorem/normalizacją). Plik: `src/services/drdStructure.ts`.
- **D-2 Picker fix** — „8 key dimensions" → „7 osi transformacji (39 obszarów)". Plik: `NewAssessmentModal.tsx` / `AssessmentModuleHub.tsx`.
- **D-3 Mapa dojrzałości (signature)** — heatmapa 7 osi × obszary (kolor = poziom/maks osi) + radar znormalizowany. Nowy: `src/components/assessment/maps/DRDAssessmentMap.tsx` + export w `maps/index.ts`.
- **D-4 Raport** — template wg książki: exec summary (dojrzałość % znormalizowana), mapa, profil osi, luki, roadmapa, efekty ekonomiczne. Nowy: `reports/templates/DRDReportTemplate.tsx` + export.
- **D-5 Qbank z książki** — wygenerować `knowledge/tool-kb/drd/qbank/v1/*` z pytań diagnostycznych per obszar (są w `11-DRD-METHOD.md` + książce). (DRD ma już qbank — zweryfikować kompletność per obszar.)
- **D-6 Krok 3: Efekty ekonomiczne** — per inicjatywa: szacunek ROI/payback → wpięcie do Finanse/Rezultaty. Backend: `assessmentInitiativeService.ts` + most do Finance.
- **D-7 Inicjatywy** — z luk current→target, max kilka/oś, foundation→value (DRD ma już mapping kategorii — dostroić do 7 osi).

### 2.2 SIRI (uzupełnić silnik priorytetyzacji + raport OSA)

- **S-1 Weryfikacja 16 wymiarów** — nazwy wg `Module 2` (Vertical/Horizontal Integration, Integrated Product Lifecycle, Shop Floor/Enterprise/Facility × Automation/Connectivity/Intelligence, Workforce L&D, Leadership, Inter/Intra Collaboration, Strategy & Governance). Plik: `siriStructure.ts`.
- **S-2 Prioritisation Matrix (silnik)** — zaimplementować Impact Value: `Wc·[DOR_c·Cost] + Wk·[DOR_k·KPI] + Wp·[BIC−AMS]`. Wejścia firmy: koszty %, top-5 KPI, horyzont, industry group (BIC). Wyjście: ranking 16 → top 4. Nowy: `src/services/siriPrioritisation.ts` + UI panel wejść (Annex C).
- **S-3 Raport OSA-grade** — sekcje: Overview SIRI, Scope, Results-AM (16 band + uzasadnienia), Results-PM (top 4), Insights-Sector (3B benchmark), Insights-Industry (performance card), Looking Ahead, Assessor Comments, Annexy A/B/C. Plik: `SIRIReportTemplate.tsx`. **Disclaimer „nie jest oficjalną OSA".**
- **S-4 Signature visual** — donut 3-8-16 + heatmapa band 0–5 (16 wierszy) + PM scatter (impact × effort). `SIRIAssessmentMap.tsx`.
- **S-5 TIER/LEAD** — wpiąć jako ramę narracyjną coacha i raportu (LEAD: Learn→Evaluate→Architect→Deliver).
- **S-6 Benchmark sektorowy** — model 3-zakresowy (Best-in-Class / Broad Middle / Bottom) — na start dane przykładowe/parametryzowane, docelowo z naszej bazy ocen.

### 2.3 ADMA (dostroić output do oficjalnych wzorów)

- **A-1 Weryfikacja podobszarów** — T1–T7 z podobszarami (T1: Strategy/Capabilities/Maintenance; T2: 2.1–2.4; … T7: 7.1–7.4), long 51 / quick 22. Plik: `admaStructure.ts`. Dodać tryb **quick vs long scan**.
- **A-2 Scoring** — śr. pytań → wynik transformacji → śr. 7 = overall (jest; zweryfikować zgodność z próbką: overall ~2.54 dla sample).
- **A-3 Scan Results (output 1)** — radar 7T z **3 seriami** (Twoja firma / FoF=4 / Average Scan Responses) + tabela „score | FoF | gap to FoF" sortowana. Pliki: `ADMAReportTemplate.tsx`, `ADMAAssessmentMap.tsx`.
- **A-4 Transformation Plan (output 2)** — osobny dokument: Exec summary, priorytety (1–2 transformacje), per priorytet: current status / goals / improvements / recommended actions; Implementation Journey (vision→tools→plan→KPI short/long). Nowy: `reports/templates/ADMATransformationPlanTemplate.tsx`.
- **A-5 Benchmark peers** — warstwa „Average Scan Responses" liczona z naszej bazy ocen ADMA (albo seed). Backend.
- **A-6 Atrybucja CC-BY** — stopka w raporcie/UI: „Based on ADMA methodology (EU H2020, grant 101037866), Agoria/OldContinent, CC-BY 4.0".

---

## 3. Warstwy przekrojowe (wspólne)

- **W-1 Workbench shell** — wspólna powłoka (`AssessmentToolShell.tsx`): nawigacja (osie/filary/transformacje + progress) · centrum scoring+evidence+notatki · graphic mirror (live). Editory: `drd/`, `siri/`, `adma/` AssessmentEditor.
- **W-2 Silnik scoringu** — ujednolicić agregację z poszanowaniem różnych skal (DRD mixed, SIRI band 0–5 bez rollup, ADMA 1–5 avg). `AssessmentController.ts` (gałęzie typów).
- **W-3 Silnik priorytetyzacji** — uogólniona macierz impact × effort; SIRI = pełna formuła Impact Value; DRD/ADMA = uproszczona (gap×waga). `src/services/*Prioritisation.ts`.
- **W-4 Output premium** — raport + deck (ten sam SoT), jakość Materiały/M17 (bić Gamma); export PDF + PPTX. Signature-visual per framework.
- **W-5 AI Coach** — grounding z qbanku per framework (toolSlug filter), 6 etapów (kickoff→area loop→consistency→summary→initiatives→export), propose→accept. Qbank PL+EN komplet dla 3.
- **W-6 Evidence discipline** — każdy score: dowód albo „needs evidence"; widoczne w nawigacji i raporcie.
- **W-7 Higiena** — wyczyścić śmieci E2E z demo-orgu; CMMI/LEAN „wkrótce/beta" w pickerze.

---

## 4. Fazowanie (sprinty)

- **Faza 0 — Higiena + audyt (0,5–1 dzień):** W-7; reconcile DRD obszary/skale (D-1); weryfikacja nazw SIRI 16 (S-1) i podobszarów ADMA (A-1). Decyzja D2a (skala 1–6).
- **Faza 1 — DRD flagowiec (3–5 dni):** D-2…D-4 (picker, mapa, raport) → DRD dowozi output end-to-end. **Kamień milowy: pierwszy pełny raport DRD na demo.**
- **Faza 2 — Output premium przekrojowo (3–4 dni):** W-4 + signature visuals (DRD heatmapa, SIRI donut 3-8-16, ADMA radar 3-serie). Raport+deck premium-grade.
- **Faza 3 — SIRI silnik PM + OSA (3–4 dni):** S-2, S-3, S-6 (Prioritisation Matrix + raport OSA + benchmark sektorowy).
- **Faza 4 — ADMA Scan+Plan (2–3 dni):** A-3, A-4, A-5, A-6 (Scan Results 3-serie + Transformation Plan + peers + atrybucja).
- **Faza 5 — DRD krok 3 ROI + inicjatywy (2–3 dni):** D-6, D-7; most do Finanse/Rezultaty.
- **Faza 6 — Coach + evidence + governance (2–3 dni):** W-5, W-6; qbank PL+EN komplet; propose→accept; video enablement.

Każda faza: kod → tsc/vitest → demo → odbiór Piotra (efekt: demo/screen/mockup, nie kod).

---

## 5. Pliki — mapa zmian (skrót)

**Nowe:**
`maps/DRDAssessmentMap.tsx` · `reports/templates/DRDReportTemplate.tsx` · `reports/templates/ADMATransformationPlanTemplate.tsx` · `src/services/siriPrioritisation.ts` · (opc.) `src/services/drdPrioritisation.ts` · `knowledge/tool-kb/drd|siri|adma/qbank+help` (uzupełnienia)

**Zmieniane:**
`src/services/drdStructure.ts` (obszary/skale) · `siriStructure.ts` (16 nazw + PM) · `admaStructure.ts` (podobszary + quick/long) · `admaTransformations.ts` · `reports/templates/{SIRI,ADMA}ReportTemplate.tsx` + `index.ts` · `maps/{SIRI,ADMA}AssessmentMap.tsx` + `index.ts` · `NewAssessmentModal.tsx`/`AssessmentModuleHub.tsx` (picker label + beta CMMI/LEAN) · `server/src/controllers/AssessmentController.ts` (scoring/PM) · `server/src/services/assessmentInitiativeService.ts` (DRD osie + ROI) · `AssessmentToolShell.tsx` (shell)

---

## 6. Decyzje do potwierdzenia

- **D1 — IP „inspired-by"** ✅ (potwierdzone granicami §0).
- **D2 — DRD = 7 osi** ✅ (z książki). **D2a** ✅ **ROZSTRZYGNIĘTE 2026-06-28: przywrócić 1–6** dla oś5 (Kultura) i oś6 (Cyber) — wierność książce. Wymaga korekty `drdStructure.ts` (levelCount 6 dla oś5/6) + treści poziomu 6 + normalizacji w mapie/raporcie.
- **D3 — kolejność** ✅ DRD flagowiec → output → SIRI → ADMA (Fazy 1–4).
- **D4 — per-framework signature-visuals** ✅ (rekom., w mockupach).
- **D7 [NOWE] — benchmark:** dane referencyjne (SIRI 3B / ADMA avg) — start na danych przykładowych/parametrach, docelowo z naszej bazy ocen? (rekom. tak).
- **D8 — warstwa graficzna** ✅ **ROZSTRZYGNIĘTE 2026-06-28: wspólny system SVG/HTML** na design-tokenach (nie recharts, nie hybryda). Trzy ruchy: (1) jeden system wizualny dla 3 frameworków, (2) dwa tryby z jednego źródła — roboczy (istniejący, ulepszony) + prezentacyjny (nowy, premium), (3) koniec crimson-leak (paleta per framework). AS-IS: mapy istnieją (`maps/{SIRI,ADMA,DBR77Lean,CMPractice}AssessmentMap.tsx`) ale niespójne tech (recharts/svg/tailwind) + crimson-leak + tylko tryb roboczy. Faza 2 = zbudować wspólny system + signature-visuals (DRD heatmapa-roadmap, SIRI donut 3-8-16 + macierz band, ADMA radar 3-serie).

---

## 7. Ryzyka

- **IP SIRI** — pilnować „inspired-by" (brak dosłownych band-ów z Assessor Training); disclaimer w raporcie.
- **Branch współdzielony** — git-races; commity chirurgiczne per ścieżka, weryfikacja HEAD przed reset.
- **Jakość outputu** — premium wymaga warstwy Materiały/M17 (deck composition) — synchronizować z tym programem.
- **Benchmark bez danych** — na starcie referencje przykładowe; oznaczyć jawnie, nie udawać realnego peer-benchmarku.
