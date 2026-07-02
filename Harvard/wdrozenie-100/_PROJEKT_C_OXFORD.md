# PROJEKT C — OXFORD · filar KOMPETENTNI („myśli jak konsultant")

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
| Q-bank z mapowaniem pytanie→wymiar→poziom | 🟡 | ✅ | ✅ |
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
| 2 | Wdrożenie: raporty assessmentów ×3 | ⬜ |
| 3 | Wdrożenie: outputy tooli (szablon executive summary z rationale) | ⬜ |
| 4 | Wdrożenie: analizy finansowe (interpretacje→wnioski z driverami i trendem) | ⬜ |
| 5 | Wdrożenie: raport/deck generatorów (narracja, nie sklejka sekcji) | ⬜ |
**Licznik O2: 0/5 ✅**

## O3 — Q-BANKI GŁĘBOKIE (19 tooli — zamknięta lista)
Wzorzec: drabinka poziomów z rozgałęzieniami + dyscyplina dowodów + „insight staircase" (skąd wniosek).
| Tool | Stan | Tool | Stan |
|---|---|---|---|
| Dynamic SWOT (WZORZEC) | 🟡 **ZBUDOWANY** (Fable `2626347b33`, 42/42 testów): q-bank drabinkowy 4-poziomowy z rozgałęzieniami (niszowa siła vs core-competency) · insight staircase z wymuszoną dekompozycją tez parasolowych · napięcia SO/WO/ST/WT liczone deterministycznie z zaakceptowanych elementów · ruchy z obowiązkowym trade-offem i wariantem odrzuconym (W2) · bramka dowodowa („Deklaracja—niepotwierdzone") · 3 decyzje dla Piotra — czeka merge+odbiór | SOP Builder | ⬜ |
| Market Forces (Porter) | ⬜ | A3 Problem Solving | ⬜ |
| Value Chain | ⬜ | SMED Planner | ⬜ |
| Capability Mapper | ⬜ | DMS Builder | ⬜ |
| Ambition Decomposer | ⬜ | Inventory Autopilot | ⬜ |
| Focus & Trade-offs | ⬜ | AI Discovery | ⬜ |
| Narrative Engine | ⬜ | Pain Explorer | ⬜ |
| Growth Paths (Ansoff) | ⬜ | RPA Scanner | ⬜ |
| Portfolio Priority | ⬜ | Process Automation | ⬜ |
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
| 1 | Profile referencyjne DRD (min. 3 branże: automotive/produkcja/usługi) | ⬜ |
| 2 | Benchmark finansowy per branża (zakresy wskaźników zamiast uniwersalnych ±15%) | ⬜ |
| 3 | Źródła i aktualizacja (skąd dane, kto odświeża) | ⬜ |
**Licznik O6: 0/3 ✅**

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
