# M17 „MATERIAŁY" — HANDOFF / MASTER (pełny kontekst + plan wdrożenia)

> **Po co ten dokument:** to jest SAMOWYSTARCZALNY punkt wejścia dla NOWEJ rozmowy (kończy się context window). Zawiera pełny kontekst + kompletny plan + analizę układu + spec piękna + jak wznowić. Nowy czat: **przeczytaj ten plik w całości, potem PLAN + STAN-PRACY, i wystartuj od „Jak wznowić" (§11).**
> **Dlaczego krytyczne:** to, JAK prezentujemy wyniki pracy, definiuje, czy ludzie płacą nasze faktury. To nie feature — to bramka biznesowa konsorcjum AI.

## 0. Mapa dokumentów (kolejność czytania)
1. **TEN plik** — kontekst + plan + układ + piękno + wznowienie.
2. [`M17-MATERIALY-PLAN.md`](M17-MATERIALY-PLAN.md) — fazy→taski→tabele (DoD/epiki/testy/UI).
3. [`M17-MATERIALY-STAN-PRACY-ODBIORY.md`](M17-MATERIALY-STAN-PRACY-ODBIORY.md) — dashboard tasków × 8 bramek (tracking ⬜🟡✅).
4. [`MATERIALS_MODULE_MASTER_SPEC`](../../docs/product/MATERIALS_MODULE_MASTER_SPEC.md) — system (13 sekcji).
5. [`DELIVERABLE_FORMATTING_SPEC`](../../docs/product/DELIVERABLE_FORMATTING_SPEC.md) — typografia/listy/tabele/fonty.
6. [`BUSINESS_PLAN_GENERATOR_SPEC`](../../docs/product/BUSINESS_PLAN_GENERATOR_SPEC.md) + [`DELIVERABLE_STANDARDS_AND_TOOLING`](../../docs/qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md) + [`DECK_COMPOSITION_REDESIGN`](../../docs/product/DECK_COMPOSITION_REDESIGN.md).

## 1. Wizja
Każdy projekt w końcu trzeba pokazać światu — moment, gdy konsultant składa wiedzę w **Excel / PowerPoint / raport Word**. „Materiały" = jeden moduł, który to robi w jakości najlepszego konsultanta na świecie: **(1) współpracuje z resztą systemu (czerpie z artefaktów), (2) prezentuje najlepsze dane najlepszym przekazem, (3) jest PIĘKNY** (brzydkich rzeczy nikt nie czyta, a brzydka faktura nie zostaje opłacona).

## 2. Stan obecny (2026-06-24)
**Faza F0 ZROBIONA** (na `feat/deliverables-w1`, zdeployowane na demo, część zweryfikowana live):
- **Konsolidacja sidebara 4→1 „Materiały"** (`ce5a96ee56`) → hub `ReportsAndPresentationsHub` = biblioteka-tabela (taby wszystkie/decki/raporty/tabele/szablony) + per-tab „Nowy".
- **Założenia startowe** `server/src/services/deliverables/deliverableDefaults.ts` (treść+grafika, resolver merge, 6/6 testów).
- **Backbone wiązki**: `bundleOrchestrator.ts` (buildSpine + generateBusinessPlan z pętlą naprawczą), `bundleGenerationRuntime.ts` (generateBundle), `bundleExportRuntime.ts` (DOCX+XLSX), `financialEngine.ts` (3-statement+CFO-review, 11/11), `assumptionsModel.ts`, `businessPlanSpine.ts`. Route `POST /api/deliverables/generations/business-plan` (za flagą).
- **Fixy żywe na demo:** materialize timeout 20s→120s (`6d8c1bf5e6`, deck 8/8 Exported live), **deck 4→10 slajdów łuk konsultanta** (`63d8ebf8a9`, live ✓), **Table Studio generuje** (`56d34d4ab4`+`5a5f2707de`, live ✓ 8/8 CSV), czyste tytuły (`156a48c271`).
- **Dowód jakości premium:** `docs/qa/deliverables/runs/2026-06-24-AI-readiness-PREMIUM.{docx,xlsx,md}` — realna treść klasy McKinsey (TAM/SAM/SOM, GTM, moat, ARR bridge).
- **204+ testów deliverables zielonych, tsc czysty.**
**Krytyczne: flaga `ENABLE_DELIVERABLES_PREMIUM` = OFF na demo** → użytkownik widzi PUSTE placeholdery („awaiting content"), bo mózg premium wyłączony. **Premium ON = realna treść (jak w dowodzie .docx).** Flip = jedyny bloker odsłonięcia jakości. To env Railway (akcja Piotra).

## 3. Architektura
`brief → AssumptionsModel (założenia/TAM-SAM-SOM/anti-patterns) → FinancialEngine (3-statement/CFO-review) → BundleOrchestrator (wspólny SPINE: hero-numbers identyczne, kanon sekcji, walidacja) → B4 tabela / B3 raport / B1 deck`. **SPINE = jedno źródło prawdy** → te same liczby w 3 formatach. Generatory: B1 `presentationLayoutDirectorService`, B3 `documentStructureGenerator`+`documentBlockContentGenerator`, B4 `tableSchemaGeneratorService`. Model: env `DELIVERABLE_LLM_PROVIDER/MODEL` (prod: Qwen3-235b tani; jakość: Sonnet). **Artefakt = output innych modułów** (insight/inicjatywa/decyzja/task/raport fin./KPI/4 idee/notatki) = treść materiałów.

## 4. Decyzje zamknięte (Piotr)
- Nazwa **„Materiały"**; format (deck/raport/tabela) = WYBÓR (system podpowiada), nie nawigacja; jednostka = jeden materiał (pakiet = opcja).
- 3 wejścia: czysty input→retrieval z org · upload pliku→parse · „Przygotuj narzędzie" z modułów→handoff.
- 2 triggery: ad-hoc · harmonogram (cron→artefakty→biblioteka+email).
- Live = DANE nie narracja; cykl `Draft→Review→Authorized→Sent(auto-lock)`; edycja warstwowa (merge); RBAC.
- Monetyzacja: kredyty/pakiety + dokup. Brand-ingestion: paleta+fonty teraz, klon layoutu v2. Harmonogram/email = rola.
- Template × Motyw × Formatowanie = 3 ortogonalne osie. **Nie potrzebujemy dodatkowego czata — Teresa jest jedynym czatem.**
- **Akceptacja 6 insightów CTO** (§ niżej) — wszystkie wchodzą do planu.

## 5. ANALIZA UKŁADU — jak wygrywamy z Gammą
**Formuła Gammy (i jej słabość):** ~8 powtarzalnych wzorców slajdu → decki są ładne, ale **samowtórne**:
(1) cover · (2) big-statement · (3) tekst+bullety z akcentem · (4) dwie kolumny tekst↔obraz · (5) full-bleed image · (6) siatka kart 2-4 · (7) kroki/timeline · (8) cytat/callout.
**Nasza przewaga = DWA ruchy:**
- **(A) Bogatszy arsenał archetypów** (≥20 vs 8), w tym konsultingowe: exec-summary (SCQA), KPI-dashboard (4-6 kafli), macierz 2×2/kwadrant, porównanie/before-after, **waterfall/bridge**, proces/swimlane, roadmap/Gantt-strip, hierarchia/piramida Minto, funnel, heatmap/RAG-grid, mapa/geo, diagram z adnotacjami, big-number+wykres, styled-table, logo-wall, divider, next-steps/CTA.
- **(B) KOMPOZYCJA zamiast wyboru** (Gamma-killer): AI nie wybiera „1 z N szablonów", tylko **komponuje slajd** z gramatyki: 12-kol grid + regiony-archetypy (hero/split-LR/grid-N/sidebar/band/full-bleed) + prymitywy bloków. → nieskończenie wiele układów dopasowanych do treści. Mamy już Krok 1a (B1 emituje `composition`) + 1b (FE honoruje); **Krok 2 = pełna gramatyka** (`DECK_COMPOSITION_REDESIGN.md`, GATED na dowodzie wizualnym). To jest realny „win układem", o który prosi Piotr.

## 6. SPEC PIĘKNA — wszystko „zajebiste", per format
Bez tego cała hydraulika nie sprzedaje. Piękno = bramka, nie ozdoba. Per oś:
- **Wykresy (think-cell-grade):** waterfall, bridge, mekko/marimekko, 2×2, harvey balls, RAG-grid, mostek — data-bound, spójna paleta, zero chartjunk, integralność (Tufte/IBCS). **To rdzeń konsultingu, ważniejsze od zdjęć.** Osobny silnik/standard wykresów = TASK.
- **Obrazy:** Image Router tierowany (stock → budget → premium FLUX.2/Imagen4/GPT-Image/nano-banana → wyspecjalizowane Ideogram-tekst/Recraft-wektor). VisionQA gate.
- **Kolory:** BIBLIOTEKA kuratorowanych palet (jak motywy Gammy), 60-30-10, semantyczne, brand-aware, dark/light. Dobór koloru pod format treści.
- **Piękny Excel (nie biedne tabele):** od razu motyw — themed header, banded rows, **conditional formatting (data-bars/color-scales/icon-sets)**, sparklines, formaty liczb, freeze, traffic-light. Propozycja schematu kolorystycznego OOTB.
- **Book-quality Word:** skala typograficzna, leading/measure, auto-TOC, running heads, pull-quotes, podpisy rysunków, opcjonalny inicjał — „jak dobry dokument niemalże książkowy", nie surowy Word.
- **Jeden rejestr motywu** (`theme = {fontPair, scale, palette, charts, listStyles, tableStyle}`) czytany przez 4 renderery (Word/PPT/Excel/web) → identyczne, piękne, spójne na każdej powierzchni. Brand klienta nadpisuje.

## 7. 6 INSIGHTÓW CTO (zaakceptowane) — wplecione w plan jako fazy F11-F14 + cross-cutting
1. **Wykresy/data-viz** → F11 (silnik wykresów think-cell-grade) + §6.
2. **Edycja outputu (WYSIWYG per format + inline AI)** → F12 (edytor deck/doc/table, edycja warstwowa).
3. **Round-trip do realnego Office** (otwiera się idealnie w MS/Google, nie „walid file") → F13 bramka fidelity.
4. **Współpraca + bezpieczeństwo share-linka** (komentarze/review/co-edit; link z wygaśnięciem/hasłem/dostępem) → F13.
5. **Telemetria jakości** (edit-rate/regen-rate/share/download/time-to-first-draft) → F14.
6. **First-run + seeding** (template'y + szybki brand-setup dla nowej org) → F14.

## 8. PLAN FAZAMI (F0–F14)
F0 ✅ Konsolidacja+założenia+backbone+fixy+eksport DOCX/XLSX. · **F1** defaulty w generatorach + **flip flagi premium** + beauty/content gate. · **F2** „Nowy"→panel z wyborem formatu + 3 wejścia. · **F3** Template×Motyw×Formatowanie + **gramatyka układu §5B** + biblioteka palet §6. · **F4** wyjścia: PPTX render + „pobierz komplet" + share-link viewer + in-app viewer. · **F5** źródła danych (konektory + formularze). · **F6** cykl życia/edycja-warstwowa/wersje/Live-binding. · **F7** harmonogram + email. · **F8** brand-ingestion. · **F9** Image Router tiery + Ideogram/Recraft + pakiety/kredyty. · **F10** inteligencja: księga faktów / provenance / warianty audytorium / pętla zwrotna. · **F11** silnik wykresów (think-cell-grade) — §6. · **F12** edytor WYSIWYG per format + inline AI. · **F13** Office round-trip fidelity + współpraca/komentarze + share-link security. · **F14** telemetria jakości + first-run seeding (template'y+brand).
Detal tasków + bramki = PLAN + STAN-PRACY (dashboard rozszerzony o F11-F14).

## 9. DoD globalny (7) — każdy task
front↔back (0 fasad) · security (0 P0/P1+test) · i18n PL/EN przez t() · tokeny (0 rose/hex) · §27 (FilterableTable+Menu) · E2E w PR-gate · zgodność z canon UI/UX. **+ bramka piękna (VisionQA) i content (0 placeholderów / 0 sprzecznych liczb).**

## 10. Ograniczenia (twarde)
- Flaga `ENABLE_DELIVERABLES_PREMIUM` domyślnie OFF = byte-identyczne (klienci nietknięci). Flip = env Railway demo (Piotr).
- **PROD (centerbeam) nietknięty bez osobnej, jawnej zgody.** Demo = gałąź `demo` (Railway auto-deploy).
- **Branch `feat/deliverables-w1` współdzielony z innymi agentami — git races REALNE** (np. M16/finance konflikt `v8/finance.routes.ts`). Commity chirurgiczne per ścieżka; przy konflikcie cudzego kodu — NIE ruszać, commitować przez izolowany `git worktree` z `origin/feat`.
- Harnessy PROD-safe: `DOTENV_IGNORE_LOCAL=1 + SKIP_DB_INIT=1 + DATABASE_URL→staging` (nigdy centerbeam). `tests/` gitignored → `git add -f`. CI tylko `tests/{unit,integration,components}`.
- Klucze (Anthropic/OpenRouter/Gemini) w `.env.staging.local` (gitignored) — harness je hydratuje.

## 11. JAK WZNOWIĆ (nowa rozmowa — pierwsze kroki)
1. **Przeczytaj:** ten plik → PLAN → STAN-PRACY. Sprawdź `git log` na `feat/deliverables-w1` (stan może się ruszyć — inni agenci).
2. **KROK ZEROWY = USTAL BAR:** renderowany **head-to-head** — nasz deck/raport/tabela (premium, np. temat VTS/Apator) OBOK Gammy/Worda/Airtable, ocena na oczy. To definiuje mierzalny bar piękna i zakotwicza „done" w realnym deliverable, który Piotr wysłałby klientowi. NIE budować szeroko, póki bar nieustalony.
3. **Odblokuj:** poproś Piotra o flip `ENABLE_DELIVERABLES_PREMIUM=true` na Railway demo (+ klucze obrazów). Bez tego F1+ nie pokażą jakości.
4. **Realizuj fazami** F1→F2→F3→F4→(F5-F14), task po tasku: kod+test+tsc → commit (worktree jeśli konflikt) → merge feat→demo → deploy → **odbiór Piotra (→F/→UI)** → odhaczasz w STAN-PRACY (⬜→🟡→✅) → następny. Zero przeskoków.
5. **Każdy task** trzyma 8 bramek + DoD-7 + bramkę piękna. Nigdy „generuje się"≠„jest piękne i prawdziwe".

## 12. Kluczowe pliki kodu (mapa)
Backend deliverables: `server/src/services/deliverables/{businessPlanSpine,assumptionsModel,financialEngine,bundleOrchestrator,bundleGenerationRuntime,bundleExportRuntime,deliverableDefaults}.ts` · generatory `presentationLayoutDirectorService.ts`, `documentStudio/*`, `tableSchemaGeneratorService.ts` · route `routes/deliverablesGenerations.routes.ts` · V8 `services/v8/artifactRegistryService.ts` (titleHint/materialize) · FE hub `components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` · studia `components/AIChat/KimiWorkspace/{KimiWorkspaceShell,PrezentacjeView,TabeleView}.tsx` + `DocumentStudio/` · sidebar `components/navigation/Sidebar/menuConfig.ts` · klient HTTP `services/api/baseClient.ts` (timeoutMs!) · obrazy `services/ai/deckVisualsService.ts` · render `documentStudio/documentDocxRenderer.ts`, `workbook/WorkbookBuilder.ts`, `report/pptx/*`.
Harnessy/dowody: `scripts/deliverables/{_dbr77-from-brief,_premium-sample,_verify-bundle}.mts` → `docs/qa/deliverables/runs/`.

## 13. Otwarte decyzje (do nodu Piotra w nowej rozmowie)
- Edycja: MVP inline-AI-edit czy pełny WYSIWYG? · Wykresy: bar think-cell-grade — osobny silnik. · Office-fidelity: test na realnym Office. · Współpraca/share-security: F13 czy wcześniej? · Domyślny motyw „Executive"? · 10 fontów OK? · Kolejność po F1 (proponuję F1→F2→F3→F4).
