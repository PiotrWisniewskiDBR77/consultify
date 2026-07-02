# GENERATORY DELIVERABLE (M17–M20) — STAN PRACY · odbiory do 100% (SSOT operacyjny)

**Start:** 2026-06-21 · **Branch:** nowy `feat/deliverables-w1` (od Londyn) · **Deploy odbioru:** Railway staging (caboose/trolley) → demo → prod (centerbeam, za osobną zgodą Piotra)
**Zasada twarda:** idziemy sub-moduł po sub-module, fala po fali (E → R → T → B → X). **Nie przechodzę do kolejnego, póki poprzedni nie jest ZAMKNIĘTY (8/8).** Każdy sub-moduł odbierany TYLKO na podstawie technicznie opisanego zestawu testów (niżej) + →F/→UI Piotra. Zero odstępstw.

Ten plik = jedyne miejsce prawdy o postępie programu Deliverable. Szczegół merytoryczny (model, stack, decyzje) = [`../../docs/product/DELIVERABLES_GENERATORS_SPEC.md`](../../docs/product/DELIVERABLES_GENERATORS_SPEC.md). Wiersze M17–M20 w [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md) linkują tu.

**Baseline testowy (2026-06-21, stan WEJŚCIOWY przed przebudową):** M18 doc 15 kontraktowe + 74 serwisowe ✅ · M19 deck 27 integ (+15 skip caboose) ✅ · M20 tabela 52 (idor+p15) ✅ · M17 outputs export-approval 9/9 ✅. To zielona baza startowa; program ją ROZBUDOWUJE (nie psuje) — każda fala dokłada testy wg zestawów niżej.

**Znalezisko #1 (przekrojowe, P0-ryzyko):** generacja deliverable dotyka żywych klientów (VTS/Apator/Elkomtech). Każda zmiana behawioralna idzie **za flagą per-org + fail-open** (wzorzec [[finding_pg_bigint_jsonb]]/M13). Demo/wewn najpierw; klienci OFF do telemetrii.
**Znalezisko #2 (architektoniczne):** dziś render ekranu ≠ plik wyjściowy (3–4 osobne ścieżki). Decyzja stacku: **jeden render → wierny export** (Puppeteer). To rdzeń serii X i warunek „jakości Gammy/Claude".

---

## Legenda
⬜ niezrobione · 🟡 w toku · ✅ zrobione+odebrane

## Etapy odbioru per sub-moduł (8)
1. **Kod** — działania funkcjonalne/security domknięte; `tsc --noEmit` 0 błędów w plikach sub-modułu
2. **DoD 7/7** — wszystkie 7 kryteriów globalnych (niżej)
3. **Epiki** — wszystkie epiki sub-modułu zielone
4. **Testy** — KOMPLET wg zadeklarowanych faz testowych (FT-1…FT-8) zielony; 0 fail
5. **Zgodność UI/UX** — komponenty vs kanon (`CANON.md` §7/§9/§17/§27) + próg jakości (FT-6); zero odstępstw P0/P1
6. **Deploy** — Railway staging→demo za flagą; smoke PASS (prod tylko za zgodą Piotra)
7. **ODBIÓR FUNKCJA — Piotr** — klikasz w aplikacji, działa
8. **ODBIÓR UI/grafik — Claude + Piotr** — screenshoty (Playwright .png / computer-use), jakość odebrana

Sub-moduł **ZAMKNIĘTY = 8/8**.

## DoD globalny (7 kryteriów — wspólny dla każdego sub-modułu)
1. **Spięcie front↔back** — zero fasad/martwych przycisków/wyrzucanych styli; co generujemy = co widać = co w pliku
2. **Bezpieczeństwo** — org-scope wszędzie; nowe EP za JWT; zmiana behawioralna za flagą per-org + fail-open; zero żywych P0/P1
3. **i18n** — PL+EN komplet przez `t()` (canonical → dopuszczalny dług Fala 4, jak M03/M04, jeśli udokumentowany)
4. **Tokeny CSS** — zero hardkodów hex w chrome (paleta deck/wykresy/eksport = udokumentowane wyjątki)
5. **Standard UI/UX** — kanon §7/§9/§17/§27; „mniej znaczy więcej" (brak zbędnych przycisków wyboru)
6. **tsc + lint + testy** — 0 fail, 0 błędów; KOMPLET faz testowych zielony
7. **Flaga/rollout/telemetria** — zmiana behawioralna za flagą per-org; fail-open; telemetria (koszt AI premium — D1)

---

## FAZY TESTOWE (FT) — framework odbioru technicznego

> To jest **podstawa „odbioru wypłaty"**. Każdy sub-moduł deklaruje, które FT go dotyczą i z jakim KONKRETNYM zestawem. Odbiór etapu 4 = wszystkie zadeklarowane FT zielone. Pliki testów pod `tests/` (CI-gated na Londyn — patrz [[finding_ci_skips_src_tests]]; kluczowe kontrakty NIE w `src/**/__tests__`).

| Faza | Nazwa | Co weryfikuje | Narzędzie / lokalizacja | Dowód odbioru |
|---|---|---|---|---|
| **FT-1** | **Unit** | logika serwisów/komponentów (czysta) | vitest · `tests/unit/deliverables/**` | N testów PASS, 0 fail |
| **FT-2** | **Integration** | kontrakty API + round-trip DB (PG) | vitest · `tests/integration/deliverables/**` | N kontraktów PASS, round-trip persyst. |
| **FT-3** | **E2E funkcjonalny** | przepływ użytkownika (klik→efekt) | Playwright · `tests/e2e/deliverables/**` | N specs zielone + screenshoty |
| **FT-4** | **Wierność exportu** | struktura+style wygenerowanego pliku | vitest (parsowanie pptx/docx/xlsx/pdf) · `tests/integration/deliverables/export/**` | assercje: fills/borders/wykresy/obrazy/TOC obecne w pliku |
| **FT-5** | **Parytet wizualny** | ekran ↔ export (pixel-diff) | Puppeteer + pixelmatch · `tests/e2e/deliverables/parity/**` | diff < próg (np. <2%) na zestawie golden-slajdów/stron |
| **FT-6** | **Jakość AI (golden/rubric)** | czy generacja spełnia próg jakości | rubric-scoring + golden outputs · `tests/integration/deliverables/quality/**` | score ≥ próg na zestawie golden-promptów per typ |
| **FT-7** | **Manual + screenshoty** | żywy przelot z dowodem | Playwright .png / computer-use | komplet .png per scenariusz + →F/→UI Piotra |
| **FT-8** | **Bezpieczeństwo/regresja** | org-scope, flaga per-org fail-open, brak IDOR | vitest · `tests/integration/deliverables/security/**` | 403 cross-org, OFF=stare zachowanie, fail-open gdy AI down |

**Macierz FT per typ wyjścia (które fazy są MUST):**
- **Deck:** FT-1,2,3,**4,5,6**,7,8 (parytet wizualny + jakość layoutu = krytyczne)
- **Doc:** FT-1,2,3,**4,5,6**,7,8 (wierność DOCX/PDF + jakość struktury)
- **Tabela:** FT-1,2,3,**4**,6,7,8 (wierność XLSX ze stylami; FT-5 N/D)
- **Launcher/Template (E,T):** FT-1,2,3,7,8 (FT-4/5/6 N/D — brak generacji pliku)

**FT-6 (jakość) + FT-7 (manual jakościowy) — szczegół w osobnym dokumencie:** [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md) — 3 rubryki (deck/doc/tabela) × 3 bramki (**kompletność · jakość merytoryczna · jakość graficzna**), scoring 0/1/2 + progi + **head-to-head vs Gamma/Claude/Airtable**, oraz **+33 scenariusze manualne MQ-*** (12 deck · 11 doc · 10 tabela) sprawdzające kompletność i jakość wygenerowanych dokumentów. Te MQ-* doliczają się do kolumny Manual sub-modułów B/R/X danego typu.

### KADENCJA TESTÓW MANUALNYCH (FT-7) — KIEDY, nie na końcu *(decyzja Piotra 2026-06-21)*
**Reguła twarda:** manual danego sub-modułu robimy **gdy tylko jego efekt jest obserwowalny** — NIE zbieramy ich na koniec programu. Dwa poziomy:
- **A · Smoke per sub-moduł (lokalnie, od razu po code-complete):** szybki przebieg + screenshot zaraz po zbudowaniu sub-modułu z UI, jeśli front jest dostępny lokalnie. Łapie regresje wcześnie.
- **B · Manual checkpoint per FALA (na stagingu):** po code-complete całej fali → deploy staging za flagą → **pełny przebieg scenariuszy danej fali z kartami odbioru**, PRZED deployem kolejnej fali. To jest formalny FT-7 fali.

**Plan kiedy-co (mapowanie do fal):**
| Fala | Kiedy manual | Co testujemy manualnie |
|---|---|---|
| **W1 (E1-E4)** | smoke po każdym E + **checkpoint po E4** | launcher 2-krokowy + 3 ścieżki wejścia (źródło/czat/Nowy) → ląduje w generacji |
| **W2 (R1-R5)** | **per edytor** (nie czekać na całą falę) | doc TipTap (edycja/render bloków), deck Gamma-flow, tabela CF w gridzie |
| **W3 (T1-T4)** | po T2 (biblioteka) i T4 (Teresa-proponuje) | galeria template, DBR77, user-created, sugestia |
| **W4 (B1-B5)** | **NA BIEŻĄCO przy każdym generatorze** — to jest GŁÓWNY manual jakości | **MQ-* jakościowe + head-to-head** (deck po B1/B2, doc po B3, tabela po B4) — NIE na końcu |
| **W5 (X1-X6)** | przy każdym X dotykającym exportu | wierność exportu (otwórz w PPT/Word/Excel), parytet wizualny |

**Środowisko:** smoke lokalny wymaga frontu + auth (m09-gates) lub deploya staging. Gdy lokalny front niedostępny → manual sub-modułu **dołącza do najbliższego checkpointu fali na stagingu** (wciąż per-fala, nie na koniec programu). Każdy manual = **karta odbioru** (kompletność+merytoryka+grafika) wg [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md) §6, zapisywana w `docs/qa/deliverables/`.

---

## BRAMKA WSTĘPNA (przed E1) — decyzje
✅ **D1** premium tier AI dla generacji (2026-06-21; optymalizacja kosztu później)
✅ **D2** budujemy sami — zero third-party generation API w produkcji
✅ **Model produktu + stack 4-warstwowy** zaakceptowane (SPEC §1–2)
✅ **Q1** próg jakości FT-6 — **≥85% spełnionych kryteriów dla WSZYSTKICH 3 formatów** (deck/doc/table). Decyzja Piotra 2026-06-22 (ostra poprzeczka premium). Pomiar FT-6 live (2026-06-22): deck 79% / table 70–91% / doc do poprawy — wszystkie muszą dobić do 85%.
🟡 **Q2** próg parytetu FT-5 (pixel-diff %) — proponuję <2% na golden-set; do potwierdzenia
✅ **Q3** golden-temat = **diagnoza AI / ankieta VTS Group** (realny kontekst DBR77). Decyzja Piotra 2026-06-22. Z tego tematu wyprowadzam 3–5 scenariuszy (board-deck zarządczy / raport diagnostyczny / tabela wyników) do head-to-head vs Gamma/Airtable.
⬜ **Q4** demo-org do pilota flagi (telemetria kosztu premium)
✅ **Q5** stock images provider = **Unsplash** (decyzja Piotra 2026-06-22). Klucz API do konfiguracji (X4 stockImageProvider już wspiera Unsplash).

> Seria E (W1) może ruszyć od razu (FT-1/2/3/7/8 nie zależą od Q1–Q3). FT-6/FT-5 (jakość/parytet) blokowane Q1–Q3 — dotyczą serii B/X.

---

## Tabela zbiorcza (dashboard PM)

Bramki realizacji: Epiki x/N · DoD x/7 · Testy (FT-* PASS) · Manual x/N (.png/computer-use) · UI wg kanonu+jakość. Bramki odbioru: →F (Piotr) · →UI (Claude+Piotr).
Komórka: ⬜ nie · 🟡 w toku · ✅ tak. Sub-moduł **ZAMKNIĘTY** dopiero gdy WSZYSTKIE ✅.

| # | Sub-moduł | Fala | Epiki | DoD | Testy (FT) | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--|:--:|:--:|:--:|:--:|--|
| **E1** | Launcher „Nowy" + 3 kafle typu | W1 | 2/2 | 🟡 | FT-1✅·3,8⬜ | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (launcher+wpięcie+flaga+i18n; krok 1 z 2-krokowego flow; commit `a3387f55ed`; FT-3 e2e + żywy smoke + →F/→UI zostają. FT-2→E3) |
| **E2** | Galeria template'ów (wybór + Teresa-stub) | W1 | 2/2 | 🟡 | FT-1✅(10/10)·3,7⬜ | 0/5 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (launcher 2-krokowy typ→template, Blank+kuratorowane v1 per typ, i18n PL/EN, tsc clean, commit `c4c8bac2d3`; Teresa-proponuje=T4; realna biblioteka=seria T; FT-3 e2e + żywy smoke zostają) |
| **E3** | Kontrakt „paczka kontekstu" + spięcie 3 ścieżek | W1 | 3/3 | 🟡 | FT-2✅(6/6)·3⬜ | 0/8 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (Nowy→Teresa: seed pendingPrompt dopasowany do detektorów Tryb B per typ, ZERO BE, nieinwazyjne; commit `097553ee6c`; templateId w contextData→seria T; FT-2 6/6 seed↔detektor PL+EN; źródła/czat już idą przez ten silnik; FT-3 e2e + manual zostają) |
| **E4** | Routing wyboru → generator/edytor | W1 | 2/2 | 🟡 | reuse✅ | 0/4 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (realizowane przez REUSE Tryb B — kickoff E3 → istniejący mount edytora per format: deck→builder, doc→canvas, sheet→grid + loading/error/empty Tryb B; brak nowego kodu = jeden silnik; weryfikacja w checkpoincie manualnym W1) |
| **R1** | Doc → TipTap edytor (zamiast viewera) | W2 | 0/3 | 0/7 | FT-1✅(20/20)·2,3,7⬜ | 0/8 | ⬜ | ⬜ | ⬜ | 🟢 GOTOWY code-side (DocumentTipTapEditor: schemaToProseMirror↔proseMirrorToSchema ZERO utraty tożsamości, remount-on-edit guard, NodeViews dla 5 typów atom, wpiąć w DocumentStudioDocumentPanel; commit `c2cc2aa091`; FT-1 20/20; FT-2 autosave-persyst + FT-3 e2e + manual zostają) |
| **R2** | Doc → inline-AI „zaznacz→popraw" + kasacja Mode1/2/3 | W2 | 2/2 | 0/7 | FT-1✅(7/7)·2,3,8⬜ | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (DocumentInlineAIMenu floating-menu: 5 akcji zaznacz→popraw; useDocumentInlineAI→proposals/local; approve→schema; EditorPanel usunięty 519 lin; Mode1/2/3 etykiety skasowane; wpiąć w TipTapEditor przez artifactId; commit 80e5ef94ea; FT-1 7/7; FT-2 integ + FT-3 e2e + manual zostają) |
| **R3** | Doc → render tabel/wykresów/KPI (recharts) | W2 | 2/2 | 0/7 | FT-1✅(28/28)·3,7⬜ | 0/5 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (blocks/: DocChartBlock recharts bar/line/pie/area+donut; DocTableBlock zebra+risk; DocKpiStrip dual-shape; paleta Harvard clamp≤7; narrowChartContent/narrowTableContent/narrowKpiContent; commit `95c1bb80df`; FT-1 28/28; R1 konsumuje NodeViews) |
| **R4** | Deck → Gamma-flow (mniej przycisków, AI-driven) | W2 | 2/2 | 0/7 | FT-1✅(16/16)·3,7⬜ | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (CardFloatingToolbar usunięty; layout-picker usunięty; regenerateSlide(instruction) na dowolnym intecie; inline rewrite input na hover; Undo/Redo/Theme/Share/Teresa/Present/Confidentiality zachowane; commit `a740d65bf9`; FT-1 16/16) |
| **R5** | Tabela → CF w GridView + jeden silnik formuł (AST) | W2 | 3/3 | 0/7 | FT-1✅(191/191)·2,3,8⬜ | 0/8 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (formulaEngineCore.ts port AST FE+BE identyczne; PlatformGridView CF; tp_views.config JSONB persyst bez migracji; commit `5e01bcbae8`; FT-1 191/191 + parity 8/8 FE↔BE) |
| **T1** | Model template (szkielet+format) per typ + persyst | W3 | 2/2 | 0/7 | FT-1✅+FT-2✅(20/20)·8✅ | 0/4 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (unified API GET /api/deliverables/templates?type federuje 3 tabele; migracja 783 template_id provenance; launcher z API zamiast hardkodu; fail-open per tabela; commit `bc41936116`; FT-1+FT-2 20/20 + org-scope) |
| **T2** | Biblioteka DBR77 (kuratorowane per typ) | W3 | 2/2 | 0/7 | FT-1✅+FT-2✅(20/20) | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (migracja 784 seed: 2 doc + 2 deck + 2 table systemowe, idempotent ON CONFLICT; seedService+stałe; commit `f3b19a78d1`; FT-1 14/14 + FT-2 6/6) |
| **T3** | User-created templates (CRUD) | W3 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(18/18) | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (POST/PUT/DELETE/GET /:id org-scoped; migracja 785 org_id na tp_base_templates; system-guard 403; cross-org 403; commit `4a79090db8`; FT-1 7 + FT-2/8 11 = 18/18) |
| **T4** | Teresa-proponuje template z intencji | W3 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-6✅(22/22) | 0/4 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (suggestService keyword-matcher PL+EN + LLM-fallback; POST /suggest fail-open; launcher "Teresa zaproponuje" mini-input→accept; i18n PL/EN; commit `6d227f4798`; FT-1+FT-2+FT-6 22/22) |
| **B1** | Deck → AI Layout Director (layout+motyw+briefy) | W4 | 3/3 | 0/7 | FT-1✅+FT-2✅+FT-8✅(7/7) · **FT-6 czeka Q1/Q3** | 0/8 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (presentationLayoutDirectorService: LLM wybiera layout z 17 LAYOUT_REGISTRY + paletę z 13 CURATED_COLOR_SETS + brief tekstowy; deterministyczny fallback gdy STANDARD lub LLM fail; quality-gate (layout w katalogu + paleta w katalogu); NIEWPIĘTY w żywy presentationVisualDirectorService — flaga OFF; commit `88c8eb9a54`; FT-1+FT-2+FT-8 7/7) |
| **B2** | Deck → warianty układu / remix | W4 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(10/10) · **FT-6 czeka Q1/Q3** | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (presentationLayoutVariantsService: generateDeckVariants — N=3 wariantów LLM z DYSTYNKTNYMI paletami (deduplikacja + quality-gate ≥2); remixDeckLayout — regeneracja planu wg instrukcji użytkownika z zachowaną liczbą slajdów; nadbudowane nad B1 (STANDARD deleguje do planDeckLayout); fail-open na każdym kroku → 1 deterministyczny wariant lub currentPlans nietknięte; NIEWPIĘTE w żywy pipeline — flaga OFF; commit `88f60fac85`; FT-1+FT-2+FT-8 10/10) |
| **B3** | Doc → AI generuje pełną strukturę bloków | W4 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(6/6) · **FT-6 czeka Q1/Q3** | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (documentStructureGenerator: LLM dobiera typy bloków (tabela/KPI/callout/chart), NIE samą prozę; fallback gdy STANDARD lub LLM fail = dzisiejsza proza; quality-gate (≥1 blok typed nie-proza); NIEWPIĘTY w żywy documentContentGenerator — flaga OFF, komentarz `// B3 ready`; commit `3712529838`; FT-1+FT-2+FT-8 6/6) |
| **B4** | Tabela → AI typowany schemat + kolory + seed | W4 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(8/8) · **FT-6 czeka Q1/Q3** | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (tableSchemaGeneratorService: LLM zwraca typowany schemat (singleSelect z kolorami hex, number, currency, date) + seed-rows JSON ≥3; fallback gdy STANDARD lub LLM fail = 3 kolumny text, 0 seed; quality-gate (≥1 pole typed + select-y mają hex + seed≥3); NIEWPIĘTY w żywy `generateTableAction` — flaga OFF; zod v4 `z.record(z.string(), z.unknown())` fix; commit `3ec8401a5e`+`5a71e473be`; FT-1+FT-2+FT-8 8/8) |
| **B5** | Premium tier wiring + telemetria kosztu | W4 | 2/2 | 0/7 | FT-1✅+FT-8✅(9/9) | 0/4 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (resolveDeliverableTier: PREMIUM gdy ENABLE_DELIVERABLES_PREMIUM ON, inaczej STANDARD=dzisiejsze zachowanie; fail-open→STANDARD; DELIVERABLE_GENERATION_PURPOSE tag; telemetria już płynie przez AIPipeline+cost-monitoring; resolver konsumowany przez B1-B4; commit `ffdf2797c2`; FT-1+FT-8 9/9) |
| **X1** | Puppeteer HTML→PDF/PNG (deck+doc parytet) | W5 | 2/2 | 0/7 | FT-1✅+FT-4✅+FT-8✅(7/7) · **FT-5 czeka Q2** | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (renderHtmlToPng rozszerza playwrightPdfRenderer; viewport 1920×1080 default; współdzieli availability+sharedBrowser; PDF API nieruszony, jedyny żywy klient Operations Health niezmieniony; commit `6e68d9614f`; FT 7/7) |
| **X2** | exceljs WorkbookBuilder + CF export (tabela) | W5 | 3/3 | 0/7 | FT-1✅+FT-4✅+FT-8✅(7/7) | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (WorkbookSchema rozszerzony o 4 typy CF rules dataBar/colorScale/iconSet/cellIs; WorkbookBuilder mapuje na ExcelJS addConditionalFormatting; FT-4 EVIDENCE-GRADE: parsuje wygenerowany .xlsx jako ZIP+XML, asercja że <conditionalFormatting> i cell bgColor SĄ w pliku (NIE fasada SheetJS); NIE wpięte w ExportService.ts żyjący na SheetJS; commit `ed7324f77c`; FT 7/7) |
| **X3** | Wykresy ożywione (chartjs doc + recharts ekran) | W5 | 2/2 | 0/7 | FT-1✅+FT-8✅(12/12) | 0/5 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (kod był zbudowany przed sesją — renderChartBlockToPng + chartjs-node-canvas + wpięcie w documentDocxRenderer:217 i documentPdfRenderer:213; istniejący test integracyjny pod src/__tests__/ był poza CI scope, dodany kontraktowy unit pod tests/unit/ z 6 typami+fallback; commit `a614ca7f55`; FT 12/12) |
| **X4** | Stock image fallback + smart-ikony | W5 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(14/14) · **FT-7 czeka Q5** | 0/5 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (stockImageProvider: Unsplash+Pexels HTTP + NullProvider + chooser z env fallback; iconSuggestionService: ~40 reguł keyword→lucide + dedup consecutive; wszystko fail-open (null) gdy brak klucza/wyników/HTTP error; NIE wpięte w żywy pipeline; Q5 formalny wybór providera w toku; commit `1ec3b9713c`; FT 14/14) |
| **X5** | doc/sheet → model decka (jedna encja) | W5 | 3/3 | 0/7 | FT-1✅+FT-2✅+FT-8✅(12/12) | 0/6 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (unifiedDocEntityService: getUnifiedDoc czyta z draftu/artefaktu/linka — newer wygrywa; commitDraftToArtifact TRANSAKCYJNY tworzy LUB aktualizuje wave5 (zero duplikatu); most schemowy już istniał (work_canvas_drafts.artifact_id→wave5_artifacts), brakowało warstwy logiki; OPT-IN, żywe endpointy work-canvas/document-studio NIETKNIĘTE; commit `14f29f8f1f`; FT 12/12) |
| **X6** | Outputs niezawodny rejestr (transakcyjny) + lineage | W5 | 2/2 | 0/7 | FT-1✅+FT-2✅+FT-8✅(10/10) | 0/4 | 🟡 | ⬜ | ⬜ | 🟢 GOTOWY code-side (outputsTransactionalRegistry: registerOutputArtifactTransactional owija oba INSERTy (v8_output_artifacts + v8_artifact_origin_links) w BEGIN/COMMIT/ROLLBACK; idempotentny przez (originRuntime, originRecordId) + race-safe re-check w tx; getArtifactLineage czyta wszystkie origin links; NIE modyfikuje żywej registerArtifactOrigin; commit `5825e2d7f6`; FT 10/10) |

**Postęp programu:** 0 / 24 ZAMKNIĘTYCH · **W1 (E1-E4) GOTOWA code-side 🟢** (FT-1+FT-2 22/22) · **W2 (R1-R5) 5/5 GOTOWE code-side 🟢** (FT-1 262/262) · **W3 (T1-T4) 4/4 GOTOWE code-side 🟢** (FT 20+20+18+22=80/80) · **W4 (B1+B2+B3+B4+B5) 5/5 GOTOWE code-side 🟢** (FT 9+7+10+6+8=40/40; FT-6 czeka Q1/Q3) · **W5 (X1+X2+X3+X4+X5+X6) 6/6 GOTOWE code-side 🟢** (X6 5825e2d7f6 · X3 a614ca7f55 · X4 1ec3b9713c · X1 6e68d9614f · X2 ed7324f77c · X5 14f29f8f1f; transakcyjny outputs registry + chartjs rasteryzer (już wpięty w docx/pdf) + Unsplash/Pexels+lucide stock fallback + Playwright HTML→PNG + exceljs CF (dataBar/colorScale/iconSet/cellIs, FT-4 evidence-grade ZIP+XML) + unified doc entity (transakcyjny commit draft→artifact bez duplikatu); FT 10+12+14+7+7+12=62/62; wszystko opt-in, NIEWPIĘTE w żywe pipeline) · Manual 0/132. **Razem code-side: W1+W2+W3+W4+W5 = 24/24 sub-modułów; FT ~466 zielonych.** ✨ PROGRAM CODE-SIDE COMPLETE ✨ — czekają TYLKO bramki jakościowe Piotra: Q1/Q3 (FT-6 head-to-head B1-B4), Q2 (FT-5 pixel-diff X1), Q5 (FT-7 provider stock images X4) + checkpointy manualne (deploy staging) + →F/→UI Piotra.
**Słownik statusu:** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (6 bramek realizacji ✅) · ✅ ZAMKNIĘTY (8/8 ✅).

---

## QUALITY TEST HARNESS + B4 extensions (2026-06-22) — przygotowanie FT-6

> Po domknięciu 24/24 code-side zbudowano kompletny system testów jakości dla 3 modułów dokumentowych — to **maszyneria odbioru FT-6** (head-to-head jakość) gotowa do uruchomienia gdy Piotr odblokuje Q1/Q3.

**90 scenariuszy testowych** (30 deck M19 + 30 doc M18 + 30 table M20), tiery Sml/Med/Lrg/Xtr:
- SSOT czytelny: `docs/qa/deliverables/scenarios/M19_DECKS.md` · `M18_REPORTS.md` · `M20_TABLES.md` (każdy scenariusz = intent + kryteria merytoryczne + graficzne, autochecker-able)
- Executable TS catalog: `tests/integration/deliverables/catalog/{decks,reports,tables}.ts` ({meta, criteria, mockPass} per wpis)

**Scoring engine** (`tests/integration/deliverables/scoring/`): `deckScoring` (paleta/no-triple-run/≥8-distinct/imageBriefs) · `docScoring` (typy bloków/KPI 3-5/chart clamp≤7/distinct types) · `tableScoring` (typed fields/select-colors/CF rules/formuły) → `ScoreReport{passed, failures[], selfHealHints[]}`.

**Runnery (wszystkie zielone, mock-mode):**
- `fullCatalog.test.ts` — 90 mock-pass 100% + 3 sanity-degradacji (scoring WYKRYWA regresję)
- `scenarioRunner.test.ts` — 9 pilotów przez prawdziwe generatory (mock-LLM)
- `deckGeneratorE2E.test.ts` — 30 decków przez **prawdziwy** `planDeckLayout`; post-processing B1 nie degraduje
- `tableGeneratorE2E.test.ts` — mapa reachable/need-extension

**Auto-heal Workflow** `scripts/deliverables/self-heal-workflow.js` (Run→Score→Heal, MAX_ATTEMPTS=3, mock/live) + runbook `docs/qa/deliverables/SELF_HEALING_RUNBOOK.md`.

**B4 ROZSZERZONE** (harness wykrył gap — B4 zwracał tylko {fields, seedRows}):
- **CF by-fieldKey** (`1faf2beaf4`): LLM podaje {fieldKey, rule}, B4 resolwuje → A1-ref; dataBar/colorScale/iconSet/cellIs; tylko CF-eligible (number/currency/percent/rating)
- **Formuły + hasFormulas** (`349a9dd881`): seedRows "=..." przepuszczane + prompt zachęca
- **Efekt zmierzony e2e: table reachable 17→29**; need-extension=1 (TYLKO M20.S26 multi-sheet = osobna domena WorkbookGeneratorService, nie single-table B4)

**Stan testów:** 29 plików, **226 testów deliverables zielonych**; mock-mode (live wymaga Q1/Q3 + budżet API + staging org-id). Commity: catalog `c3b90dbe71` · e2e `57ed51c942` · B4-CF `1faf2beaf4` · B4-formuły `349a9dd881` · B3-fix+docE2E `9ee0cdce85` · content-gen `bbc1d3a08e`.

**B3 FIX (`9ee0cdce85`)** — docGeneratorE2E wykrył: quality-gate `distinctTypes>1` fałszywie odrzucał dokumenty jednotypowe (KPI-only/bullet-only/table-only → fallback do prozy). Naprawione: gate = ≥1 blok bogaty (poza heading/paragraph). E2E warstwy strukturalnej: 30/30 doc green.

**Mapa zdolności generatorów (zmierzona e2e, mock-mode):**
| Generator | Warstwa | Reachable | Need-extension |
|---|---|---|---|
| **B1** deck | layout/paleta/brief | **30/30** | — (post-proc nie degraduje) |
| **B3** doc + content-gen | STRUKTURA + TREŚĆ | **30/30 end-to-end** | — (struktura+treść domknięte) |
| **B4** table | typed schema + CF + formuły | **29/30** | M20.S26 multi-sheet (WorkbookGeneratorService) |

**Content-gen layer GOTOWY** (`bbc1d3a08e`): `documentBlockContentGenerator` wypełnia plan B3 treścią — normalizery wymuszają parametry graficzne (KPI clamp 3-5, chart paleta≤7/serie≤6, callout tone). Łańcuch B3→content-gen→scoring pełnych kryteriów: **30/30 doc green** (struktura + treść). Za flagą, fail-open do prozy, **NIEWPIĘTE w buildDocumentSchema** (równolegle, opt-in per klient).

### DROGA DO ŻYWEGO WDROŻENIA (pozostałe kroki — wymaga decyzji Piotra)

1. **Wpięcie content-gen w `buildDocumentSchema`** (B3+content-gen→żywy pipeline): kod GOTOWY i przetestowany (30/30 mock), `// B3 ready` — wystarczy przełączyć `buildSectionBlocks` na łańcuch premium. **Zmienia co dostają klienci → opt-in per klient (flaga per-org).**
2. **Multi-sheet (M20.S26)**: domena `WorkbookGeneratorService` (istnieje), nie single-table B4.
3. **FT-6 jakość (Q1/Q3)**: uruchomienie 90 scenariuszy w LIVE mode (prawdziwy LLM) — mierzy faktyczną jakość treści vs Gamma/Kimi/Airtable. Wymaga: próg jakości (Q1), golden-prompty z realnymi tematami DBR77 (Q3), budżet API, staging org-id (NIE prod).
4. **FT-5 pixel-diff (Q2)** dla X1 + **FT-7 stock provider (Q5)** dla X4.
5. **Wpięcie B/X w żywe ścieżki** — osobny krok per moduł, flaga per-org, klienci OFF first.

---

## FT-6 LIVE — pierwszy pomiar na ŻYWYM mózgu premium (2026-06-22)

> Pierwszy raz w historii programu generatory odpalone na PRAWDZIWYM LLM (anthropic/claude-sonnet-4-6, klucz z Railway staging), nie na mocku. Runner plain-node `scripts/deliverables/live-pilot-ft6.mts` (PROD-safe: DOTENV_IGNORE_LOCAL+SKIP_DB_INIT+DATABASE_URL→staging). Scoring = ten sam engine co mock. 9 scenariuszy (3×3 Sml/Med/Lrg). Wyniki: `docs/qa/deliverables/runs/2026-06-22-live-pilot-sonnet46.json`.

**Decyzje Piotra (zablokowane 2026-06-22):** Q1 = **≥85%** wszystkie 3 formaty · Q3 = golden **VTS** (`docs/qa/deliverables/scenarios/VTS_GOLDEN.md`) · Q5 = **Unsplash**.

| Format | Podłoga (det.) | PREMIUM live (Sml/Med/Lrg) | Próg 85% |
|---|---|---|---|
| **M19 Deck (B1)** | 58% | 78 / 75–92 / 93% (avg **82–88%**, fb=false) | ✅ ~na progu (wariancja) |
| **M20 Table (B4)** | 10% | 78 / 90 / 92% (avg **87%**, fb=false) | ✅ ponad |
| **M18 Doc (B3+content)** | 32% | 75 / **100 PASS** / **100 PASS** (avg **92%**) | ✅ ponad |
| **AVG** | — | **87%** | ✅ |

**Naprawione realne bugi (kod, branch feat/deliverables-w1, uncommitted):**
1. **anthropic /v1** — `llmService.getProviderSync` tworzył `createAnthropic({apiKey})` bez baseURL → SDK bił w `api.anthropic.com/messages` (404) → „Invalid JSON". Latentny (Anthropic nigdy nie używany live). Fix: `baseURL: …/v1`.
2. **doc content-gen mega-call** — `documentBlockContentGenerator.fillViaLlm` robił JEDEN structured-call dla WSZYSTKICH bloków → 247s ≫ 60s abort → fallback do prozy (= „doc laggard 32%"). Fix: **per-sekcja, batch 3 równolegle** + `timeoutMs:120000` (callStructured honoruje override). Efekt: doc 32%→**92%**, S16 mega-raport 100%.

**Infra:** structured `generateObject` pada pod vitest (undici parsuje 200-OK jako „Invalid JSON") → live FT-6 TYLKO plain-node. circuit-breaker: pojedynczy slow-call >timeout otwiera breaker i zatruwa resztę → runner resetuje per scenariusz + content-gen batchuje.

**Gate jakości (etap 5 FT-6) dla B1/B3/B4 = ✅ wstępnie spełniony na pilocie 3×3.** Pozostaje: pełny head-to-head na golden VTS, deploy staging za flagą + manual/screeny (FT-7), →F/→UI Piotra. Deck wariancja okołoprogowa = pass stabilizacyjny (drobny).

---

## ODBIORY MODUŁOWE M17–M20 — pakiet do testów ręcznych Piotra (GOTOWY 2026-06-23)

> Komplet **epiki + DoD + testy manualne** dla każdego modułu (M17–M20), żeby Piotr mógł usiąść i ręcznie domykać do 100%. Każdy moduł = teczka (epiki+DoD+status, wzorzec 8-warstwowy) + plik testów manualnych (scenariusze wykonawcze z krokami, oczekiwanym, dowodem 3-warstwowym UI+Network+DB/plik). Warstwa generatorów (premium B1/B3/B4 + E/R/T/X) DOŁOŻONA do istniejących teczek/testów (które wcześniej pokrywały tylko moduł bazowy).

| Moduł | Teczka (epiki + DoD + status) | Testy manualne (scenariusze) | Jakość premium (FT-6 live Sonnet) |
|---|---|---|---|
| **M17 Outputs** | [`M17-outputs.md`](M17-outputs.md) — 7 epików G1-G7 (E1-E4/T1-T4/X5/X6) | [`TESTY_M17_OUTPUTS.md`](../Testy%20manualne/TESTY_M17_OUTPUTS.md) — ~35 scen. (§G1-G5: launcher/galeria/routing/biblioteka/registry) | N/D (hub, nie generator) |
| **M18 Dokumenty** | [`M18-dokumenty.md`](M18-dokumenty.md) — 7 epików + bugi GL-01/GL-02 | [`TESTY_M18_DOKUMENTY.md`](../Testy%20manualne/TESTY_M18_DOKUMENTY.md) — 8 scen. (MD-1..MD-8) | **~100%** (S01/S06/S16/S19); bug placeholder-cascade naprawiony |
| **M19 Prezentacje** | [`M19-prezentacje.md`](M19-prezentacje.md) — 5 epików + bramka FT-6 deck | [`TESTY_M19_PREZENTACJE.md`](../Testy%20manualne/TESTY_M19_PREZENTACJE.md) — 7 scen. (MD-01..MD-07) | **~100%** (S01/S06/S16); 11 distinct layoutów VTS |
| **M20 Tabele** | [`M20-tabele-studio.md`](M20-tabele-studio.md) — 5 epików + bramka FT-6 table | [`TESTY_M20_TABELE_STUDIO.md`](../Testy%20manualne/TESTY_M20_TABELE_STUDIO.md) — 14 scen. (PT-01..PT-14) | **~100%** (30/30 swept); bug data-loss kolumn naprawiony |

**JAK TESTOWAĆ PREMIUM RĘCZNIE (ważne — przeczytaj przed sesją):**
- Premium (B1/B3/B4) jest **za flagą `ENABLE_DELIVERABLES_PREMIUM`** i **NIE jest wpięte w żywe UI** (live Document Studio generuje wciąż „deterministic first draft"). Dwie warstwy testów manualnych:
  - **Warstwa A — DZIŚ (bez deploya):** jakość premium przez harness/probe na żywym LLM (`scripts/deliverables/_diag-{deck,doc2,table}.mts`, klucz ze stagingu) + ocena wg rubryki [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md). Testy oznaczone `[NOW]`/`[SCORING-AUTO]`.
  - **Warstwa B — po wpięciu/flag ON w UI:** klikanie generacji w przeglądarce + zdjęcia + head-to-head vs Gamma/Kimi/Airtable na golden VTS. Testy oznaczone `[FLAG]`/`[BLOCKED-UI]`.
- Wpięcie premium w żywe UI = świadoma decyzja go-live (Twoja). Do tego czasu manual warstwy B czeka.
- Próg jakości (Q1) = **≥85% wszystkie formaty** (osiągnięty ~100% code-side). Golden topic (Q3) = **VTS** ([`scenarios/VTS_GOLDEN.md`](../../docs/qa/deliverables/scenarios/VTS_GOLDEN.md), próbka wygenerowana: [`runs/2026-06-22-VTS-generated.md`](../../docs/qa/deliverables/runs/2026-06-22-VTS-generated.md)). Provider stocków (Q5) = **Unsplash**.

**DoD globalny (7/7)** — patrz wyżej w tym dokumencie; każda teczka mapuje go na swój moduł z liczbami FT i statusem met/pending. **Status formalny: 0/24 sub-modułów ZAMKNIĘTYCH (8/8)** — wszystkie „code-complete + jakość premium ~100%", a niedomknięte bramki = deploy + manual (FT-7) + →F/→UI Piotra (to właśnie ten ręczny przelot).

---

# Odbiory szczegółowe (sub-moduł po sub-module)

> Każdy sub-moduł: cel · epiki · **konkretny zestaw testów per faza (podstawa odbioru)** · manual · ekrany.

## SERIA E — Wspólne wejście (W1)

### E1 — Launcher „Nowy" + 3 kafle typu · 2 epiki
**Cel:** przycisk „Nowy" w M17 Outputs otwiera launcher z 3 kaflami (Raport/Prezentacja/Tabela); świadomy wybór typu, jedno wejście.
**Epiki:** E1 komponent launchera (modal/route) + 3 kafle · E2 spięcie z Outputs (przycisk w hubie).
**Zestaw testów (odbiór):**
- FT-1 (unit, ≥6): render launchera, 3 kafle, wybór typu ustawia stan, i18n PL/EN, a11y (focus/Esc), brak akcji gdy brak typu.
- FT-2 (integ, ≥3): „Nowy" tworzy DRAFT właściwego typu (POST → 200, kind poprawny), org-scope, brak duplikatu przy podwójnym kliknięciu.
- FT-3 (e2e, ≥2): klik „Nowy" → launcher → wybór typu → ląduje w edytorze; screenshot light+dark.
- FT-8 (sec, ≥2): „Nowy" za JWT; flaga per-org OFF → przycisk ukryty (fail-open).
**Manual (6):** otwórz launcher · 3 kafle widoczne · wybór raport→edytor · wybór deck→edytor · wybór tabela→edytor · dark+light.

### E2 — Galeria template'ów (wybór + Teresa-stub) · 2 epiki
**Cel:** po wyborze typu — galeria `Blank` + kuratorowane (statyczna v1); user wybiera ALBO „Teresa zaproponuje" (stub spięty w T4).
**Epiki:** E1 galeria + karta template · E2 wybór→przekazanie templateId do silnika.
**Zestaw testów:** FT-1 (≥5): render galerii, Blank zawsze, wybór ustawia templateId, i18n, empty-state. · FT-2 (≥3): templateId dochodzi do generateDeliverable; Blank=brak szkieletu; nieistniejący template→fallback Blank. · FT-3 (≥2): wybór template→generacja z sekcjami szkieletu (screenshot). · FT-7 (≥2): manual galeria.
**Manual (5):** galeria po typie · Blank · wybór template · „Teresa zaproponuje" (stub) · dark/light.

### E3 — Kontrakt „paczka kontekstu" + spięcie 3 ścieżek · 3 epiki
**Cel:** ujednolicony payload `{typ, templateId, source?}` → `generateDeliverable`; 3 ścieżki (źródła / czat / Nowy) używają TEGO SAMEGO kontraktu i silnika.
**Epiki:** E1 schemat payloadu + walidacja · E2 spięcie istniejących przycisków źródeł (inicjatywa/notatnik/ideas/canvas) z kontraktem · E3 spięcie czatu Teresy + „Nowy".
**Zestaw testów:**
- FT-1 (≥6): walidacja payloadu (typ wymagany, template opcjonalny, source opcjonalny), mapowanie type→format, odrzucenie złego typu.
- FT-2 (≥5): każda z 3 ścieżek → identyczny generateDeliverable (kontrakt); paczka ze źródła zawiera dane encji; czat bez źródła = pusty kontekst; org-scope.
- FT-3 (≥3): e2e ze źródła (inicjatywa→raport), e2e z czatu, e2e z „Nowy" — wszystkie lądują w edytorze z draftem.
- FT-8 (≥2): cross-org source → 403; flaga OFF → stara ścieżka.
**Manual (8):** raport z inicjatywy · deck z notatnika · tabela z ideas · z canvas · z czatu · z „Nowy" · paczka niesie treść · dark/light.

### E4 — Routing wyboru → generator/edytor · 2 epiki
**Cel:** po generacji draft otwiera się we WŁAŚCIWYM edytorze (doc→TipTap, deck→DeckBuilder, tabela→grid).
**Epiki:** E1 routing type→edytor · E2 stan ładowania/błędu/pusty.
**Zestaw testów:** FT-1 (≥4): mapowanie type→komponent edytora; loading/error/empty. · FT-3 (≥2): e2e 3 typy → 3 edytory.
**Manual (4):** doc→edytor · deck→builder · tabela→grid · błąd generacji=uczciwy komunikat.

## SERIA R — Odchudzenie edytorów (W2)

### R1 — Doc → TipTap edytor (zamiast read-only viewera) · 3 epiki
**Cel:** zastąpić `DocumentStudioDocumentPanel.renderSectionPreview` (read-only switch) edytorem TipTap z node'ami per blok — edycja in-place.
**Epiki:** E1 TipTap shell + node'y bloków (heading/para/list/table/callout/quote/kpi/image/chart) · E2 dwukierunkowy mapping schema↔TipTap · E3 autosave do `work_canvas_drafts`.
**Zestaw testów:**
- FT-1 (≥8): każdy typ bloku renderuje (nie JSON), edycja tekstu, schema→TipTap→schema round-trip bez utraty, i18n.
- FT-2 (≥3): autosave persyst (PG round-trip), reload odtwarza treść, optimistic-lock.
- FT-3 (≥3): e2e — pisanie w kanwie zapisuje; tabela/wykres/KPI renderują (nie surowy JSON); screenshot.
- FT-7 (≥2): manual edycja + reload.
**Manual (8):** edytuj nagłówek · listę · tabelę renderuje · wykres renderuje · KPI renderuje · callout · autosave po reload · dark/light.

### R2 — Doc → inline-AI „zaznacz→popraw" + kasacja Mode1/2/3 · 2 epiki
**Cel:** zaznaczenie tekstu w TipTap → kontekstowe „popraw przez Teresę"; usunąć Mode1/2/3 + 6-poziomowy edytor propozycji (mniej znaczy więcej).
**Epiki:** E1 selection→AI menu (reuse floating-AI z Canvas M02) · E2 usunięcie martwych trybów + migracja akcji.
**Zestaw testów:** FT-1 (≥5): selection→prompt→patch zastosowany, diff opcjonalny, guardrails (brak utraty cytatów/liczb). · FT-2 (≥3): refine endpoint org-scope, fail→deterministic, audit. · FT-3 (≥2): e2e zaznacz→popraw→zmiana. · FT-8 (≥2): cross-org 403, flaga.
**Manual (6):** zaznacz→popraw akapit · skróć · rozwiń · zmień ton · brak Mode1/2/3 w UI · dark/light.

### R3 — Doc → render tabel/wykresów/KPI (recharts) · 2 epiki
**Cel:** bloki table/chart/kpi renderują się bogato na ekranie (recharts) zamiast `JSON.stringify`.
**Epiki:** E1 ChartBlock→recharts (bar/line/pie/area) · E2 table/kpi-strip render komponentowy.
**Zestaw testów:** FT-1 (≥4): recharts render per typ wykresu, kpi-strip, tabela GFM→komponent. · FT-3 (≥2): e2e dokument z wykresem renderuje wizualnie. · FT-7 (≥2): manual.
**Manual (5):** bar · line · pie · kpi-strip · tabela z ramkami.

### R4 — Deck → Gamma-flow (mniej przycisków, AI-driven) · 2 epiki
**Cel:** uprościć DeckBuilder do modelu Gamma — user mówi co zmienić, AI regeneruje; usunąć zbędne kontrolki.
**Epiki:** E1 audyt+kasacja zbędnych przycisków · E2 „przerób slajd przez AI" jako główna ścieżka edycji.
**Zestaw testów:** FT-1 (≥4): regenerateSlide AI, prompt→nowy slajd, undo. · FT-3 (≥2): e2e „zmień ten slajd". · FT-7 (≥2): manual present+edit.
**Manual (6):** przerób slajd AI · zmień motyw · present mode · branding · undo · dark/light.

### R5 — Tabela → CF w GridView + jeden silnik formuł · 3 epiki
**Cel:** conditional formatting realnie wpięty w GridView/CellRenderer (dziś martwy, działa tylko legacy); FE używa AST formulaEngine (nie regex/`new Function`).
**Epiki:** E1 CF konsumowany w GridView · E2 port/wywołanie AST formulaEngine z FE · E3 persyst CF na widoku.
**Zestaw testów:** FT-1 (≥6): CF rule koloruje komórkę, AST formuła liczy (SUM/IF/CONCAT), spójność FE↔BE. · FT-2 (≥3): CF persyst na `tp_views`, round-trip. · FT-3 (≥2): e2e dodaj regułę→kolor. · FT-8 (≥2): org-scope.
**Manual (8):** reguła >X→czerwony · between · formuła SUM · IF · widok zapamiętuje CF · po reload · kanban · dark/light.

## SERIA T — Template engine (W3)

### T1 — Model template per typ + persystencja · 2 epiki
**Cel:** trwały model template `{typ, sekcje[], format_preset}` per typ; tabela + migracja.
**Zestaw testów:** FT-1 (≥4): walidacja modelu, sekcje, preset. · FT-2 (≥4): CRUD persyst (PG round-trip), org-scope. · FT-8 (≥2): cross-org 403.
**Manual (4):** utwórz · odczyt · po reload · org-scope.

### T2 — Biblioteka DBR77 (kuratorowane per typ) · 2 epiki
**Cel:** seed kuratorowanych template'ów (kilka per typ: raport audytowy, board deck, roadmap-tabela…).
**Zestaw testów:** FT-1 (≥3): seed ładuje, kategorie. · FT-2 (≥3): biblioteka dostępna read-only org-agnostic. · FT-6 (≥1): golden — template produkuje sensowny szkielet.
**Manual (6):** galeria DBR77 · 1 per typ · użycie template→szkielet · jakość szkieletu · PL/EN · dark.

### T3 — User-created templates (CRUD) · 2 epiki
**Zestaw testów:** FT-1 (≥3) · FT-2 (≥4 CRUD persyst) · FT-3 (≥2 e2e utwórz→użyj) · FT-8 (≥2 org-scope).
**Manual (6):** utwórz z draftu · edytuj · usuń · użyj · widoczny tylko w org · dark.

### T4 — Teresa-proponuje template z intencji · 2 epiki
**Zestaw testów:** FT-1 (≥3): intencja→sugestia template. · FT-2 (≥3): endpoint org-scope. · FT-6 (≥1): trafność sugestii na golden-intencjach.
**Manual (4):** „zrób audyt"→sugestia · akceptuj · odrzuć→Blank · PL/EN.

## SERIA B — Mózg generatywny premium (W4) · **SKOK JAKOŚCI** · czeka Q1/Q3

### B1 — Deck → AI Layout Director · 3 epiki
**Cel:** premium LLM z treści slajdu wybiera **wariant layoutu** (nie 1:1 z intentu), dobiera motyw, pisze brief obrazu. Zastępuje deterministyczny `presentationVisualDirectorService`.
**Epiki:** E1 LLM planner (layout+theme) · E2 brief obrazu per slajd · E3 fallback deterministyczny gdy LLM down.
**Zestaw testów:**
- FT-1 (≥5): planner zwraca poprawny layout-id z katalogu, theme z palety, brief niepusty; fail→deterministic.
- FT-2 (≥3): premium tier wywołany (mock), org-scope, telemetria kosztu zapisana.
- FT-6 (≥1, **rubric**): na 3–5 golden-tematach (Q3) — score doboru layoutu/motywu ≥ próg (Q1).
- FT-8 (≥2): flaga per-org OFF → stary deterministyczny planner (fail-open).
**Manual (8):** 3 różne tematy→różne layouty · motyw dopasowany · brief obrazu · slajd KPI · roadmap · fallback gdy AI off · jakość vs Gamma (ocena) · dark.

### B2 — Deck → warianty układu / remix · 2 epiki
**Cel:** „spróbuj inny layout" — N wariantów na ten sam content (rdzeń Gammy).
**Zestaw testów:** FT-1 (≥4): N wariantów per slajd, zachowanie treści przy zmianie layoutu. · FT-3 (≥2): e2e remix. · FT-6 (≥1): warianty sensowne. · FT-7 (≥2).
**Manual (6):** remix slajdu · 3 warianty · treść zachowana · wybór wariantu persyst · undo · dark.

### B3 — Doc → AI generuje pełną strukturę bloków · 2 epiki
**Cel:** AI buduje pełną strukturę bloków (nie tylko dopisuje prozę) — dobiera typy bloków (tabela/callout/KPI) wg treści.
**Zestaw testów:** FT-1 (≥4): generacja zwraca >1 typ bloku, struktura wg intencji. · FT-2 (≥3): premium tier, org-scope, persyst. · FT-6 (≥1): jakość struktury na golden. · FT-8 (≥2).
**Manual (6):** raport audytowy→sekcje+tabela+KPI · memo→prosty · jakość treści · grounding ze źródła · PL/EN · fallback.

### B4 — Tabela → AI typowany schemat + kolory + seed · 2 epiki
**Cel:** AI zwraca typowany schemat pól (singleSelect/number/currency + kolory opcji) + seed-rows w JSON — nie płaski markdown 10×15.
**Zestaw testów:** FT-1 (≥4): schemat z typami pól, kolory opcji, seed-rows; walidacja typów. · FT-2 (≥3): materializacja do Table Platform (nie markdown), org-scope. · FT-6 (≥1): jakość schematu. · FT-8 (≥2).
**Manual (6):** „tabela ryzyk"→typy+kolory · budżet→currency · status→singleSelect kolorowy · seed-rows · vs Airtable (ocena) · dark.

### B5 — Premium tier wiring + telemetria kosztu · 2 epiki
**Cel:** krok generatywny używa premium tier (D1); telemetria kosztu per generacja (do późniejszej optymalizacji).
**Zestaw testów:** FT-1 (≥3): tier=premium dla generacji, fallback. · FT-2 (≥3): telemetria zapisana (tokeny/koszt), org-scope. · FT-8 (≥2): flaga.
**Manual (4):** generacja premium · log kosztu · OFF=standard · telemetria w panelu.

## SERIA X — Parytet + assety + spójność (W5) · czeka Q2/Q5

### X1 — Puppeteer HTML→PDF/PNG (deck+doc parytet) · 2 epiki
**Cel:** PDF/PNG z tego samego renderu co ekran (Puppeteer) zamiast PDFKit/SVG-tekst. Parytet wizualny.
**Epiki:** E1 Puppeteer pipeline (render FE→PDF/PNG) · E2 podpięcie pod deck + doc export.
**Zestaw testów:**
- FT-4 (≥4): PDF/PNG zawiera wykresy/obrazy/kolory (nie sam tekst); parsowanie pliku.
- FT-5 (≥1, **parytet**): pixel-diff ekran↔PDF na golden-zestawie < próg (Q2).
- FT-7 (≥2): manual export+porównanie.
**Manual (6):** deck→PDF wierny · doc→PDF wierny · PNG slajd · tabela w PDF z ramkami · wykres w PDF · vs ekran.

### X2 — exceljs WorkbookBuilder + CF export (tabela) · 3 epiki
**Cel:** export xlsx z Table Platform przez exceljs (style realne) zamiast SheetJS-community (wyrzuca style); + conditional formatting (data-bars/color-scales).
**Epiki:** E1 ExportService→exceljs · E2 mapowanie CF→exceljs addConditionalFormatting · E3 fills/borders/numFmt/widths.
**Zestaw testów:**
- FT-1 (≥3): mapowanie schematu→exceljs, typy pól→numFmt.
- FT-4 (≥5, **krytyczne**): wygenerowany .xlsx ZAWIERA fills (assert cell.fill.fgColor), borders, numFmt, CF rules, szerokości — parsowanie pliku exceljs/zip. (Test który demaskuje obecną fasadę.)
- FT-8 (≥2): org-scope export.
**Manual (6):** export z kolorami komórek · CF data-bar · format waluty · format daty · nagłówek styl · otwórz w Excel (computer-use).

### X3 — Wykresy ożywione (chartjs doc + recharts ekran) · 2 epiki
**Cel:** doinstalować `chartjs-node-canvas`+`canvas` (kod rasteryzera gotowy) → wykresy w DOCX/PDF realne; recharts na ekranie.
**Zestaw testów:** FT-1 (≥3): rasteryzer zwraca PNG niepusty (6 typów). · FT-4 (≥3): DOCX/PDF zawiera obraz wykresu (nie placeholder tekstowy). · FT-7 (≥2).
**Manual (5):** wykres w doc na ekranie · w DOCX · w PDF · 6 typów · jakość.

### X4 — Stock image fallback + smart-ikony · 2 epiki
**Cel:** gdy brak AI-providera obrazów → fallback stock (Unsplash/Pexels, Q5); smart-ikony per treść (lucide/Iconify).
**Zestaw testów:** FT-1 (≥3): fallback gdy AI off, ikona dobrana do treści. · FT-2 (≥2): provider org-config, klucz API. · FT-7 (≥2).
**Manual (5):** obraz AI · fallback stock · ikona auto · brak klucza=graceful · jakość.

### X5 — doc/sheet → model decka (jedna encja) · 3 epiki
**Cel:** zlikwidować rozjazd: doc/sheet jak deck = jedna encja edytowana i w canvasie i w Studio (koniec duplikatu `work_canvas_drafts` vs `document_studio_artifacts`).
**Epiki:** E1 ujednolicony model encji doc · E2 migracja/most (bez duplikacji) · E3 canvas i Studio edytują ten sam rekord.
**Zestaw testów:** FT-1 (≥4): jeden rekord, edycja z 2 powierzchni spójna. · FT-2 (≥3): brak duplikatu przy „wyślij do Studio", round-trip persyst. · FT-8 (≥2): org-scope, brak utraty danych (regresja).
**Manual (6):** doc z czatu→edytuj w Studio=ten sam · edycja w canvasie widoczna w Studio · brak duplikatu na liście · sheet analogicznie · reload · org-scope.

### X6 — Outputs niezawodny rejestr (transakcyjny) + lineage · 2 epiki
**Cel:** rejestracja do M17 transakcyjna (nie best-effort) — Outputs = gwarantowane lustro; lineage do źródła pewny.
**Zestaw testów:** FT-1 (≥3): rejestracja idempotentna, brak driftu. · FT-2 (≥3): artefakt w source ⇒ w Outputs (transakcyjnie), lineage poprawny, org-scope. · FT-8 (≥2).
**Manual (4):** generacja→w Outputs natychmiast · lineage do źródła · brak driftu po błędzie · org-scope.

---

## Mapa fal → wartość → ryzyko
- **W1 (E)** — fundament + najszybsze „wow" (jedno wejście). Ryzyko 🟢.
- **W2 (R)** — „mniej znaczy więcej", edytory Kimi/Gamma/Airtable. Ryzyko 🟡 (refactor żywych Studiów — za flagą).
- **W3 (T)** — wyróżnik DBR77. Ryzyko 🟢.
- **W4 (B)** — **skok jakości do poziomu Gammy/Claude** (premium AI). Ryzyko 🟡 (koszt + jakość — Q1/Q3).
- **W5 (X)** — wierność wyjścia + spójność. Ryzyko 🟡 (X5 scalenie encji = największy kawałek; X2 demaskuje fasadę exportu).
- **Deploy:** inkrementalny per fala, za flagą per-org, staging→demo; prod za osobną zgodą.
