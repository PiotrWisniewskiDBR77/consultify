# PROJEKT C — OXFORD · filar KOMPETENTNI („myśli jak konsultant")

## STAN FAKTYCZNY 2026-07-15 (audyt żywego runtime)

**Oxford ~80% kodowo** — wąskie gardło = odbiór Piotra (sesja B6, prompt-book `_ODBIOR_HARVARD_B6_PROMPTBOOK.md` gotowy). Nocne bundle na demo (commit e8cc969e2d):
- **O3**: 6 tooli pogłębionych (SWOT, Porter, Value Chain, Ansoff, Portfolio Priority, Growth Paths)
- **O2**: 12 walidatorów wniosków
- **O4**: finance-advisory (liniaria, założenia)
- **O5**: rejestr promptów (25 sekcji inicjatyw)
- **O6**: benchmark branżowy (9 branż, profile referencyjne)

Fala 1 wiringu O4/O5 (commit a4c479aa09), fala 2 O5 guidance parity (commit 3fbef633c4).

⚠️ **Uwaga:** sekcje poniżej mogą zaniżać stan faktyczny — dotyczy to zwłaszcza O1 (raport DRD istnieje, czeka merge) i O3 (seria tooli już zbudowana). Weryfikuj runtime w demo, nie checkboxy poniżej.

---

> **Nadrzędny:** `_FINISZ_MASTER_PLAN.md` · **Misja:** wypełnić aplikację wiedzą konsultingową DBR77 — serce przewagi („Harvey wygrał nie interfejsem, tylko tym, że zna prawo").
> **Miara ✅ (jedyna):** dokument/output, który **Piotr podpisałby własnym nazwiskiem przed klientem** — oceniany przez pryzmat **Zasady Konsultanta HBS** (absolwent HBS, MBA, 10 lat praktyki: „czy tak pracowałby z klientem, żeby klient był zadowolony, a skuteczność zagwarantowana?"). Ocena na sesji odbiorowej, nie deklaracja agenta.
> **Wolność technologii:** prezentacja wyników NIE jest przywiązana do obecnego canvasu/wykresów — HTML klasy wydawniczej, profesjonalne biblioteki wizualizacji, programowy PPTX, dedykowane widoki per metodyka. Najlepsze narzędzie do zadania.
> **WZORZEC PILOTAŻOWY = Dynamic SWOT (wskazanie Piotra):** jeden tool doprowadzony do pełni trzech filarów naraz (merytoryka O3 + mechanika H3.1 + grafika world-class, w razie potrzeby nową technologią) — dowód „tak wygląda tool klasy Consultify", od którego rozjeżdżamy resztę.
> **Zaplecze:** ~260 istniejących specyfikacji (V8/generatory/formuły) zmapowanych do Oxfordu — egzekucja, nie pisanie od zera. Stan na 2026-07-01 (bazowy audyt: Tools 3/5 · Assessmenty 2.5-3.5/5 · Finanse 2.5/5).

## DEFINICJA KOŃCA
OXFORD = ✅ gdy: DRD + SIRI + ADMA + **top-5 tooli** + analiza finansowa + 3-pak generatorów produkują outputy podpisywalne przez Piotra; standard wniosków obowiązuje w całej apce; mózg AI (prompty) zarządzany jako zasób.

## O1 — KANONY METODYCZNE (macierz framework × element)
| Element | DRD (flagowiec) | SIRI | ADMA |
|---|---|---|---|
| Kanon (wymiary/poziomy — dokument) | 🟡 **`DRD_CANON.md` v1.0 GOTOWY** (Fable 2026-07-01: 7 osi×39 obszarów pomiar / 8D komunikacja, skala I-V behawioralna, 32 ścieżki N→N+1, scoring jawny, profile ref. 3 branż; rozstrzygnięte 2 rozjechane mapy → SSOT=FE+2 korekty; +`DRD_REPORT_SPEC.md` 8 sekcji HTML→PDF; **5 decyzji P1-P5 czeka na Piotra**; qbank potwierdzony jako wydmuszka 0/39 → plan ~690 pytań) — czeka odbiór | ✅ (16D, fidelity) | ✅ (7T) |
| Q-bank z mapowaniem pytanie→wymiar→poziom | 🟡 **KOMPLET 7 OSI ZBUDOWANY 2026-07-02 (3 partie Sonnet): 699 pytań behawioralnych z dowodami** (osie 1-2: 264 · 3-4: 180 · 5-7: 255; testy strukturalne 190+523+272) — z wydmuszki 0/39 do pełnego frameworka w jeden dzień; czeka merge+przegląd Fable+odbiór | ✅ | ✅ |
| Scoring/agregacja | 🟡 | ✅ | ✅ |
| Benchmark (BIC/FoF/własny) | ⬜ | ✅ | 🟡 (próg FoF do potwierdzenia) |
| **Raport (wnioskowy!)** | 🟡 **GENERATOR ZBUDOWANY** (`25d794e314`, 17/17 testów): pipeline scores→model→SVG→HTML A4 print-CSS, radar+macierz 39 obszarów, karty luk wg formuły, zero crimson, przycisk w DRDAuditReportView; **próbka `docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html`** (zweryfikowana wizualnie+PDF). TODO jawne: narrator LLM (kontrakt gotowy, stub deterministyczny) · 8. wymiar po decyzji P1 — czeka merge+odbiór Piotra | 🟡 (opisowy→wnioskowy) | 🟡 (opisowy→wnioskowy) |
| Mapa/radar | ⬜ **P0** | ✅ | ✅ |
| Ścieżka dojrzałości N→N+1 („co zrobić, by przejść wyżej") | ⬜ | ⬜ | ⬜ |
| Generator inicjatyw z wyniku (impact×effort ranking) | 🟡 | ⬜ | ⬜ |
| CMMI/LEAN: uczciwe „wkrótce" (bez sesji) | — | — | — → H3.7 |
**Licznik O1: 7/24 ✅**

## O2 — STANDARD WNIOSKÓW (CONCLUSION_LAYER_STANDARD)
| # | Element | Stan |
|---|---|---|
| 1 | SSOT standardu: „co jest → co znaczy → co robić najpierw (impact×effort) → jaki efekt" (rodzeństwo CARD_CONTENT_FORMULA) | 🟡 **`docs/standards/CONCLUSION_LAYER_STANDARD.md` v1.0 GOTOWY** (Fable: formuła K1-K4, reguły R1-R6 z falsyfikowalnością, warianty W1-W5, kontrakt prompt-ready z 12 walidatorami maszynowymi, DoD „test podpisu partnera", 3 przykłady before/after na realnych powierzchniach) — czeka na zatwierdzenie Piotra |
| 2 | Wdrożenie: raporty assessmentów ×3 | 🟡 SIRI+ADMA ZBUDOWANE (`0211daa262`, 19/19): exec summary z werdyktem K1-K4 („Connectivity hamuje przejście — sufit bloku Technologia"), karty top-3 luk, **ADMA: pasek „Droga do FoF≥4"** (które T poniżej progu i o ile); deterministyczne, liczby z silnika, zero crimson. DRD = własny generator (osobna pozycja). Czeka merge+odbiór |
| 3 | Wdrożenie: outputy tooli (szablon executive summary z rationale) | ⬜ |
| 4 | Wdrożenie: analizy finansowe (interpretacje→wnioski z driverami i trendem) | ⬜ |
| 5 | Wdrożenie: raport/deck generatorów (narracja, nie sklejka sekcji) | ⬜ |
**Licznik O2: 0/5 ✅**

## O3 — Q-BANKI GŁĘBOKIE (19 tooli — zamknięta lista)
Wzorzec: drabinka poziomów z rozgałęzieniami + dyscyplina dowodów + „insight staircase" (skąd wniosek).
| Tool | Stan | Tool | Stan |
|---|---|---|---|
| Dynamic SWOT (WZORZEC) | 🟡 **ZBUDOWANY** (Fable `2626347b33`, 42/42 testów): q-bank drabinkowy 4-poziomowy z rozgałęzieniami (niszowa siła vs core-competency) · insight staircase z wymuszoną dekompozycją tez parasolowych · napięcia SO/WO/ST/WT liczone deterministycznie z zaakceptowanych elementów · ruchy z obowiązkowym trade-offem i wariantem odrzuconym (W2) · bramka dowodowa („Deklaracja—niepotwierdzone") · 3 decyzje dla Piotra — czeka merge+odbiór | SOP Builder | ⬜ |
| Market Forces (Porter) | 🟡 ZBUDOWANY (`fe3944f74f`, 29 testów, wzorzec SWOT zaadaptowany: drabinki per siła z intensityDelta · staircase ze sterownikami · silnik syntezy 5-sił→werdykt branży · W2 trade-offy; lekcje adaptacji spisane — W2-walidator = przenośny klocek na resztę top-5) | A3 Problem Solving | ⬜ |
| Value Chain | 🟡 ZBUDOWANY (`d7229f5d76`, 39/39): drabinka koszt/wartość per ogniwo (dowód MUSI nazwać obie strony: duży-koszt-mała-wartość=tnij ≠ mały-koszt-duża-wartość=chroń) · silnik mapy marży + ranking dźwigni (koszt×dojrzałość×wpływ) · W2 wyspecjalizowany (outsource bez nazwania oddanej kontroli = fail) · integracja wstecznie-kompatybilna | SMED Planner | ⬜ |
| Capability Mapper | ⬜ | DMS Builder | ⬜ |
| Ambition Decomposer | ⬜ | Inventory Autopilot | ⬜ |
| Focus & Trade-offs | ⬜ | AI Discovery | ⬜ |
| Narrative Engine | ⬜ | Pain Explorer | ⬜ |
| Growth Paths (Ansoff) | 🟡 ZBUDOWANY (`3fbb3af7b0`, 14/14): drabinka 4-szczeblowa per ćwiartka · silnik atrakcyjność×wykonalność → ranking+sekwencja („najpierw penetracja, dywersyfikacja odroczona KOSZTEM tempa") · W2-walidator · integracja wstecznie-kompatybilna z żywym runtime. Ustanawia wzorzec `src/config/<metoda>/` (SWOT-kanon = kandydat na wsteczny refactor) | RPA Scanner | ⬜ |
| Portfolio Priority | 🟡 ZBUDOWANY (`c40afe5ce3`, 40/40): drabinka z wymuszonym źródłem · guard „invented-number" (30% bez dowodu=flaga) · macierz 2×2 + sekwencja topologiczna zależności + budżet-cap z kosztem alternatywnym · W2 · import realnych inicjatyw orga | Process Automation | ⬜ |
| Risk & Uncertainty | ⬜ | | |
**Licznik O3: 0/19 ✅** · Kolejność: wzorzec SWOT → top-5 (SWOT, Porter, Ansoff, Value Chain, Portfolio Priority — **wybór CTO, do potwierdzenia/zmiany przez Piotra**) → reszta.

## O4 — FINANSE JAKO DORADZTWO
| # | Element | Stan |
|---|---|---|
| 1 | Architektura business case: assumptions → model → scenariusze → rekomendacja (narracja) | ⬜ |
| 2 | Scenariusze biznesowe nazwane (dźwignie, nie ±15%) + edytor założeń + widok porównawczy | ⬜ |
| 3 | Value tree benefitu (savings/growth/risk — rozkład, ocena ryzyka per komponent) | ⬜ |
| 4 | Współzależności inicjatyw (sekwencje, synergie, budżet portfela) | ⬜ |
| 5 | Guidance parametrów (WACC/stopy per branża zamiast sztywnych defaultów) | ⬜ |
| 6 | Analiza sprawozdań: trend + driver + prognoza (nie tylko wskaźnik+komentarz) | ⬜ |
| 7 | Realized-vs-projected post-mortem (dlaczego nie wyszło: rynek vs egzekucja) | ⬜ |
**Licznik O4: 0/7 ✅**

## O5 — BIBLIOTEKA PROMPTÓW AI (mózg jako zarządzany zasób)
| # | Element | Stan |
|---|---|---|
| 1 | Prompty sekcji inicjatyw (25 sekcji — po fixie klucza zweryfikować TREŚĆ każdej) | 🟡 AUDYT+PODNIESIENIE GOTOWE (worktree `2132be90b9`, Sonnet): tabela ocen 25 sekcji, **12 przepisanych wg INITIATIVE_FORMULA+CONCLUSION_LAYER** (kluczowe odkrycie: financialAnalysis/financialImpact wprost ZAPRASZAŁY LLM do zmyślania kwot — „estimate rough range"; teraz twardy zakaz + wsad z silnika); RAID/gates/comments/control zostały (4-5/5); 9 sekcji-paneli bez promptu = decyzja Piotra; po deployu weryfikować DANE w DB |
| 2 | AI-guidance per framework DRD/SIRI/ADMA (D-H) | ⬜ |
| 3 | Briefy generatorów doc/deck/sheet (jakość wsadu = jakość outputu) | 🟡 |
| 4 | Persona Teresy — przegląd merytoryczny (język konsultanta, nie asystenta) | ⬜ |
| 5 | Rejestr promptów: jedno miejsce, wersjonowanie, właściciel | ⬜ |
| 6 | Jakość zestawów pytań Wywiadu (szablony/formularze M10 — pytania klasy konsultanta, nie ankieta HR) — **złapane macierzą pokrycia** | ⬜ |
**Licznik O5: 0/6 ✅**

## O6 — BENCHMARKI I PROFILE BRANŻOWE
| # | Element | Stan |
|---|---|---|
| 1 | Profile referencyjne DRD (min. 3 branże: automotive/produkcja/usługi) | 🟡 ZBUDOWANE (Sonnet, worktree a322b4, 7/7 testów): 3 branże × 8 wymiarów {typical, leader} + narrative PL/EN + disclaimer „expert-hypothesis-v1, kalibracja od n≥10"; smaczki: D7-usługi typical II („tajemnica zawodowa chroniona antywirusem i dobrymi chęciami"), D6-procesowa sufit III („nie dotykaj działającej instalacji"). NIE wpięte w raport — czeka decyzja P3 Piotra |
| 2 | Benchmark finansowy per branża (zakresy wskaźników zamiast uniwersalnych ±15%) | ✅ JUŻ ZBUDOWANE wcześniej (audyt 07-14, worktree oxford-o6-benchmark odkrył — commit `917aaef042` z 07-03, ZANIM ta lista mówiła „⬜"): `server/src/services/financeIndustryBenchmarks.ts` — 9 branż (industrial-manufacturing/retail-ecommerce/professional-services/software-saas/logistics-transport/construction/hospitality-food-service/healthcare/generic) × 13 rodzin wskaźników (marże, ROE/ROA, płynność, dźwignia, rotacje, przychód/FTE), {p25,mediana,p75} + `source`+`asOf`+`confidence`. Realnie wpięte w 3 callerów: `ratioAnalysisService.computeRatios` (org-benchmark wygrywa, branżowy fallback zamiast uniwersalnego ±15%), `financeConclusionService`, `financeReportSectionService`. 35+9=44/44 testów (`tests/unit/finance/financeIndustryBenchmarks.test.ts` + `ratioAnalysisServiceBenchmarkFallback.test.ts`) |
| 3 | Źródła i aktualizacja (skąd dane, kto odświeża) | ✅ DOMKNIĘTE (07-14, oxford-o6-benchmark): per-band `source`+`asOf`+`confidence` już istniały; dodano brakujące „kto odświeża" (`FINANCIAL_BENCHMARK_REFRESH_OWNER`) + jawny disclaimer wzorem O6.1 (`FINANCIAL_BENCHMARK_DISCLAIMER`, „n ≥ 10", `expert-hypothesis-v1`) + skonsolidowane `sourceMetadata` na każdym `getRatioBenchmark()`/`benchmarkFinancial()` wyniku + wpięte do `ComputedRatio.benchmark` (disclaimerPl/En, refreshOwnerPl/En) w `ratioAnalysisService`. Dodano `benchmarkFinancial()` (pozycja below-p25/in-range/above-p75 + interpretacja) i most O4↔O6 (`financeIndustryClassToBenchmarkIndustry`) |
**Licznik O6: 2/3 ✅ (poz.1 czeka na decyzję P3 Piotra — wpięcie w raport, nie brak roboty)**

**DOWÓD 07-19 (pozycje 2+3, REJESTR O6.2/O6.3 🟡→✅):** `oxford-o6-benchmark` (77691e2771/6d06a04739)
potwierdzony jako ANCESTOR `origin/demo` (merge-base = tip gałęzi) — już zmergowany, brak potrzeby
forward-portu. Nowy acceptance test `tests/acceptance/o6-benchmark-financial.e2e.test.ts` (prefiks
`odbior--o6--`, real Postgres :5443, real HTTP przez `verifyToken`+`finance-statements.routes.ts`):
`GET /:id/ratios` na realnym statement (CURRENT_ASSETS/CURRENT_LIABILITIES → 0.9x, celowo poniżej
branżowego p25=1.1x) zwraca benchmark z p25/median/p75 1:1 zgodne z `INDUSTRY_BENCHMARK_PROFILES`
(nie fabrykowane), `disclaimerPl/En`+`refreshOwnerPl/En` niepuste i cytujące n≥10/DBR77, plus
bezpośrednie wywołanie `benchmarkFinancial()` z tą samą wartością daje zgodny werdykt `below-p25`.
2/2 PASS + 35/35 istniejący unit PASS. Bramki: server tsc 146/204 0-nowych, esbuild/eslint czyste.

## O7 — STANDARDY TREŚCI
| # | Element | Stan |
|---|---|---|
| 1 | CARD_CONTENT_FORMULA egzekwowana w kartach insightów/inicjatyw (walidator) | 🟡 |
| 2 | INITIATIVE_FORMULA w generatorze inicjatyw | 🟡 |
| 3 | Jakość języka outputów PL/EN (ton konsultanta) | ⬜ |
**Licznik O7: 0/3 ✅**

## O8 — POMOC I EDUKACJA (warunek Spotify-demokratyzacji)
| # | Element | Stan |
|---|---|---|
| 1 | „Dlaczego to pytanie" — hinty edukacyjne w assessmentach/toolach | ⬜ |
| 2 | Help content aktualny do nowych przepływów (productHelpDigest) | 🟡 |
| 3 | Słownik pojęć konsultingowych dla nie-konsultanta | ⬜ |
**Licznik O8: 0/3 ✅**

## KOLEJNOŚĆ I BRAMKI
1. **O1-DRD raport+mapa** (P0 reputacyjne) → sesja: „czy podpisałbyś?" — to jest wzorzec jakości całego Oxfordu.
2. O2.1 standard wniosków (SSOT) → wdrożenia O2.2-5 falami.
3. O3 wzorzec SWOT → top-5 → reszta. Równolegle O5 (prompty) i O4 (business case).
4. O6-O8 domykają.
Bramka każdego strumienia = sesja Piotra z pytaniem-miarą. Bez podpisu nie ma ✅.

**OXFORD RAZEM: 7/70 ✅ (10%)** — najmłodszy projekt, największa dźwignia wartości. Aktualizacja 2026-07-01: +O5.6 (pytania Wywiadu, z macierzy pokrycia).
