# STAN PRACY — odbiory modułów do 100% (SSOT operacyjny)

**Start:** 2026-06-19 · **Branch:** Londyn · **Deploy odbioru:** demo.consultify.ai (`scripts/deploy-demo.sh`)
**Zasada twarda:** idziemy moduł po module **po kolei (M01→M27, A1 na końcu)**. **Nie przechodzę do kolejnego modułu, póki poprzedni nie jest ZAMKNIĘTY (8/8).** Zero odstępstw.
**Aktualizacja 2026-06-29 (Piotr):** dołożone dwa obszary nieobecne w pierwotnym audycie Harvard, wstawione **między M12 Audyty a M13 Inicjatywy**: **M12A — Tools consultingowe** i **M12B — Assessmenty digitalne**. (Sekwencja: …M12 → M12A → M12B → M13…)
**Decyzja 2026-06-29 (Piotr): M18 Dokumenty · M19 Prezentacje · M20 Tabele Studio są POCHŁONIĘTE przez M17 „Materiały"** — silniki żyją i są komponowane wewnątrz M17 (doc-QA / PptxPipeline / tableSchema). **Standalone odbiory M18/M19/M20 ZNIKAJĄ** (nie liczą się jako osobne moduły do 8/8); jakość ich silników odbierana w ramach M17. Pozostają w tabeli tylko jako referencja silnika.
**Model wykonawczy 2026-06-29 (Piotr):** odbiór idzie na 3 poziomach przekrojowych (nie tylko per-moduł): **L1 nawigacja+uprawnienia** (spójność między narzędziami) · **L2 funkcjonalność** (akcje robią to co obiecują) · **L3 rozwój narzędzi** (Tools M12A + Assessmenty M12B) · spina je **L4 integracja cross-tool** (w dużej mierze gotowa). Plan wykonania = przekrojowe SWEEP-y po warstwach, nie domykanie każdego modułu naraz na wszystkich warstwach. Strategia: [`_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md`](_PLAN_DOKONCZENIA_3POZIOMY_2026-06-29.md).
**★ SSOT WYKONAWCZY DO KOŃCA (wszystkie działania po kolei, 4 tory, formuła nie-stojąca + handoff dla nowego agenta): [`_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md`](_PLAN_WYKONAWCZY_DOKONCZENIE_4TORY_2026-06-29.md).**

Ten plik = jedyne miejsce prawdy o postępie. Odhaczamy tu każdy etap. Szczegół (epiki, luki, kryteria) = w teczce `MXX-*.md`.

---

## Legenda

- ⬜ niezrobione · 🟡 w toku · ✅ zrobione+odebrane
- **Etapy odbioru per moduł (8):**
  1. **Kod** — luki funkcjonalne/security z teczki domknięte (krok 4–6 Harvard)
  2. **DoD 7/7** — wszystkie 7 kryteriów globalnych (niżej)
  3. **Epiki** — wszystkie epiki modułu zielone
  4. **Testy** — unit + E2E zielone (CI Londyn)
  5. **Zgodność UI/UX** — komponenty vs SSOT (kryt. 7), bez odstępstw P0/P1
  6. **Deploy demo** — moduł żywy na demo.consultify.ai
  7. **ODBIÓR FUNKCJA — Piotr** — klikasz na demo, działa
  8. **ODBIÓR UI/grafik — audytor + Piotr** — screeny ekranów, UX odebrany
- Moduł **ZAMKNIĘTY** = 8/8.

## DoD globalny (7 kryteriów — wspólne dla każdego modułu)
1. Spięcie front↔back (zero fasad/mocków/martwych przycisków)
2. Bezpieczeństwo (zero żywych P0/P1; każda naprawa z testem regresji)
3. i18n (pełne PL/EN przez `t()`)
4. Tokeny kolorów (zero korupcji „rose"/hex; EntityStatusChip/c.*)
5. §27 (listy przez FilterableTable + Menu 1/2/3)
6. E2E w PR-gate (scenariusze S zielone na Londyn)
7. Zgodność komponentów ze standardem UI/UX (SSOT canon)

---

## BRAMKA WSTĘPNA (przed M01)

- ✅ **Triaż 49 untracked plików — ZWERYFIKOWANE 2026-06-19: BUILD NIE JEST ZEPSUTY.** Rygorystyczne rozwiązanie importów (z lazy `import()` + sprawdzenie trackowanych bliźniaków) wykazało **0 krawędzi trackowany→untracked**. Pierwszy grep-check dawał fałszywe alarmy przez podciąg (`FullExecutionView`⊃`ExecutionView`, `BlockInsertMenu`⊃`InsertMenu`, `ProcessKPIDashboard`⊃`KPIDashboard`, `ExecutionWorkloadView`⊃`WorkloadView`, `SuperAdminSidebar`⊃`AdminSidebar`). Wszystkie **49 untracked = martwe sieroty (0 realnych importerów)** → bezpieczne do usunięcia, NIE blokują buildu ani egzekucji. *(opcjonalny batch-`rm` później; lista w `/tmp/orphans.txt` / komendzie poniżej)*
- ⬜ **Odblokowania env/konta** *(Piotr; prod=centerbeam za jawną zgodą)*:
  - ⬜ Klucz Gemini na demo (M10 głos/STT live-verify)
  - ⬜ Flaga `VITE_ENABLE_DELIVERABLES_LIGHT` na Railway (M02 Canvas)
  - ⬜ Konto superadmin na demo (M27 live RBAC)
  - ⬜ Schema partnera na prod (M26 — przed otwarciem portalu)
  - ⬜ OAuth env kalendarza (M03 — Google/Microsoft client id/secret)

---

## Tabela zbiorcza (dashboard PM)

> ## 🚨 AKTUALIZACJA 2026-06-28 — audyt prawdy 9 modułów: WSZYSTKIE ZIELONE (CTO)
> Audyt 9-agentowy (read-only, kod+routy+testy) wykazał: **9 modułów oznaczonych „NIE ROZP." to faktycznie ZIELONA-REALIZACJA, gotowe-do-odbioru.** Dashboard zaniżał systemowo. Stan realny:
> - **M10 Wywiad** — 32 komp, 4 routery wpięte, ~27 testów, voice STT FE działa. Czeka: serwerowy STT-key (env). ⚠ importuje Initiatives/Presentations (koordynacja z aktywnymi agentami).
> - **M12 Audyty** — AssessmentHub + AuditsHub żywe, ~65 testów, flow pytania→raport→inicjatywy. Gotowy.
> - **M21 Meeting** — MeetingHub wpięty, 9 endpointów, ~43 testy. Gotowy (Archive świadomie disabled).
> - **M22 AI OS** — AIOSHub + 8 paneli wpięte, ~52 testy. W menu dla dbr77/ADMIN (`Sidebar.tsx:532`). Gotowy.
> - **M23 Organizacja** — OrganizationView 5 modułów, ~50 testów. Gotowy (admin-redirect = defense-in-depth, nie bug).
> - **M24 Admin** — AdminSettingsModule 5 paneli, adminP32 39 routów, ~35 testów. Gotowy.
> - **M25 Ustawienia** — SettingsView ~45 sekcji, settings.routes 122 endpointy, ~28 testów. Gotowy.
> - **M26 Portal Partnerski** — 4 widoki + portal 9 sekcji, v8/partner 25 endpointów, ~128 testów. Czeka: `PARTNER_SELF_CONNECT_ENABLED` (env).
> - **M27 SuperAdmin** — ~130 komp, superadmin.routes 272 endpointy, ~153 testy. Czeka: konto superadmin demo (env) + live-smoke (testy BE cienkie).
>
> **Wniosek:** program realizacyjnie **~90% gotowy** — głównie odbiory Piotra + 3 env-bramki + live-smoke, NIE budowa. Mapa szczegółowa: workflow-audyt 2026-06-28.
> **Sprzątanie 2026-06-28:** usunięto **~69 martwych plików** (59 orphan komponentów w M12/M24/M25 + 10 testów) — zweryf. 2-metodowo (0 realnych importów + tsc czysty + vitest 154/154). Repo odchudzone. `eb4142cf26` + (54 usunięcia zgarnął współbieżny commit `26374aac0d` — shared-tree).
>
> ## 🔄 AKTUALIZACJA 2026-06-26 — synchronizacja dashboardu z realnym stanem prac (CTO)
> Główny raport był nieaktualny dla M13–M17 (data 06-25 nie obejmowała prac z 06-25/06-26). Zebrane ze SSOT-ów modułów + git log. **Co się zmieniło od ostatniej aktualizacji:**
> - **M13 Inicjatywy** — domknięte 2 duże programy poboczne: **INICJATYWY-100** (6/7 obszarów A–F, **E2E 152/152 na demo**, 1341 inicjatyw, 0 legacy-statusów; commit `db41fa1e0a` LIVE) + **USPOJNIENIE** (40/40 zadań, F1 lejek+23 ścieżki INSERT scalone, F2 handoffy, F3 walidatory §B3, F4 stan-FE, F5 lineage/funnel; 150 E2E + 150 manual; migracje 1.12/5.4 zaaplikowane na staging). Flaga `INITIATIVE_FUNNEL_ENABLED` default OFF. **Czeka: →F/→UI + 4 migracje na PROD (zgoda Piotra) + 3 decyzje A2/B1/C3.**
> - **M14 Wdrożenie/ExecutionHub** — NIE „NIE ROZP."! **8/35 zadań code-side, 252✅ testów, DEPLOYED na demo** (8 PR). Backend kompletny (18 serwisów + 5 routerów + 2 crony flag-gated OFF). Czeka: flip flag + →F/→UI + pixel-verify kokpitu. SSOT: [`M14-STAN-PRACY-ODBIORY.md`](M14-STAN-PRACY-ODBIORY.md).
> - **M15 Rezultaty/ResultsHub** — NIE „NIE ROZP."! **36 zadań W1–W6, 335✅ testów**, handoff M14→M15 LIVE (`f494c8e593`), V8 canonical (22 serwisy + 6 routerów + 6 paneli FE). Czeka: Seria T (E2E real-data 180) + Seria U (17 screenów) + Seria Z (i18n+deploy+→F/→UI). SSOT: [`M15-STAN-PRACY-ODBIORY.md`](M15-STAN-PRACY-ODBIORY.md) + [`M15-RAPORT-FINALNY-2026-06-26.md`](M15-RAPORT-FINALNY-2026-06-26.md).
> - **M16 Finanse/FinanceHub** — **DOMKNIĘCIE TESTÓW 2026-06-26.** ~577✅ testów: serwisy ~400 + F0.2/F0.3 (67) + **E2E Playwright 44/44 PASS + API-sweep 65/65 PASS + upload 6/6 PASS**. Self-audit naprawił 3 realne bugi: (1) pdf-parse v2 crash w 7 plikach całej aplikacji → PDFParserService wrapper; (2) Investment tab pusty → investment_case zaseedowany; (3) POST /budgets 200→201. **LIVE na demo** (`a26db23c09`, `b730f85df2`). Czeka: →F Piotra + decyzje D1–D5 (split-brain V8/legacy) + wiring UI. SSOT: [`M16-STAN-PRACY-ODBIORY.md`](M16-STAN-PRACY-ODBIORY.md) + [`M16-RAPORT-FINALNY-2026-06-25.md`](M16-RAPORT-FINALNY-2026-06-25.md).
> - **M17 Materiały** — **AKTUALIZACJA 2026-06-26 (audyt ground-truth 2-agentowy):** poprzednia diagnoza „~10 martwych bramek + FE 0% → 25–35%" jest NIEAKTUALNA. Decyzja **W0.1 = KOMPONUJ studia M18/M19/M20** zrealizowana: ~10 bramek jakości **WPIĘTE** w `generateBundleFromSpine` (→`bundle.quality`), deck przez dojrzały **M19 PptxPipelineService** (W7.6), raport przez **M18 doc-QA** (W1.8a), wykresy DOCX/PDF realne (W11.1). **F2 wejścia** (W3.2 org-retrieval + W3.3 upload) + **F5 dane** (W5.1-5.3 konektory/formularze) backend✅. **791✅ testów, 0 tsc**, backend brief→bundle→export→ZIP→persist→email wpięty. **Deploy demo** z naprawą 5 blokerów konfig (3 flagi + ff demo + LLM-routing OpenRouter — klucz OpenAI martwy). FE „Komplet AI" osiągalny; tab „Dane"+upload-UI = sesja FE. Produkt realnie **~65–70%**. Live-gen w weryfikacji. SSOT: [`M17-MATERIALY-STAN-PRACY-ODBIORY.md`](M17-MATERIALY-STAN-PRACY-ODBIORY.md) · audyt: [`M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md`](M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md).
> - **Wniosek:** **realizacja techniczna M13–M17 jest DUŻO dalej niż dashboard pokazywał** — wszystkie czekają głównie na bramki odbioru Piotra (→F/→UI), decyzje (M16 D1–D5; M13 A2/B1/C3), oraz wpięcie martwych bramek M17 w pipeline. Zero z M13–M17 nie jest ZAMKNIĘTE 8/8 (bo 8/8 wymaga →F/→UI).
>
> **2026-06-23 — pula Ideas M05–M09: GOTOWE DO TESTÓW RĘCZNYCH (poza i18n).** Epiki ✅, DoD domknięte we wszystkim **poza #3 i18n** (odroczone do Fazy 4 — decyzja Piotra, robimy gdy na targach): M05/M06/M07/M08 = **6/7**, **M09 = 7/7** (i18n wzorcowy, 189 kluczy). Testy security WS org-scope **już istniały** (notatki „dodać test" były stale). Manualne scenariusze gotowe (~481 łącznie). **SSOT gotowości: [`_GOTOWOSC_IDEAS_M05_M09.md`](_GOTOWOSC_IDEAS_M05_M09.md)** + per-moduł `_GOTOWOSC_M0X.md`. Pozostaje: ręczne przejście Piotra → →F/→UI/deploy + i18n (Faza 4).
>
> **2026-06-22 (II fala, multi-agent) — pula Ideas: 94 → 108 pass / 13 skip / 0 fail.** Druga fala konwersji uczciwych skipów na deterministyczną zieleń (5 agentów równolegle, każdy 1 moduł, + adversarial review = zero fake-greenów). Per moduł: **M06 23/7/0 · M07 27/4/0 · M08 29/1/0 · M09 29/1/0**. Techniki: (a) M06/M09 — dispatch `mm_*`/API round-trip `seedNodesViaApi` (POST /map/sync nodami byte-identycznymi z `createNode`); (b) M07 — naprawa REALNEGO buga produktu. **REALNY BUG PRODUKTU NAPRAWIONY:** keydown handler ProcessFlow sprawdzał `e.key==='v'/'z'`, ale przy Shift przeglądarka daje 'V'/'Z' → **Ctrl+Shift+V (walidacja) i Ctrl+Shift+Z (redo) były martwe dla userów**; fix = normalizacja do lowercase (`ffa318ed1a`, IdeaProcessFlowTool.tsx:~1707). **Gap znaleziony:** M07 panele AI Proposal/Readback martwo-zamontowane (brak triggera UI). Commity: M06 `a1a373596b`, M07 `ffa318ed1a`, M09 `1c8282d427`. 13 skipów = drag uchwytów/dblclick/clipboard/mikrofon/REAL-AI/MULTIPLAYER — każdy z dowodem file:line. Plansze: `tests/e2e/screenshots/cases/_montage_m0X.png`.
>
> **2026-06-22 — pula Ideas (M06–M09): 120 bogatych case'ów E2E ZAUTOMATYZOWANE + fix-until-green DOMKNIĘTY.** Każde narzędzie ma 30 zaprojektowanych case'ów (`Harvard/Testy manualne/CASES_M0X_*.md`, 4 atrybuty: co się dzieje · efekty · grafika · funkcjonalność), wszystkie jako Playwright ze screenshotem. **Wynik końcowy: 94 pass / 27 honest-skip / 0 fail** (121 testów; M07 ma +1 wariant multiplayer 30b). Per moduł: **M06 12/18/0 · M07 26/5/0 · M08 29/1/0 · M09 27/3/0**. Commity (main, `feat/deliverables-w1`): M08 `d1ff141108`, M07 `12ca57f1d0`, M06 `9e5d8c6d55`, M09 `ff01c93ece`. Plansze kontaktowe 30 miniatur/moduł: `tests/e2e/screenshots/cases/_montage_m0X.png`.
> **Izolacja (kolizja z sesją M13):** backend `node` na :3005 z worktree `consultify-e2e` (omija `pkill tsx`/`rm dist` M13), bije w caboose (staging) NIE prod. **Wzorce naprawcze:** (1) toolbar zakryty przez tool-switcher → dispatch eventu `idea-workspace-quick-action` zamiast kliku; (2) REAL-AI 500 (OpenRouter circuit otwarty na caboose) → honest-skip z dowodem „request poleciał" (NIE bug produktu); (3) V8/pilot-gated 403/404 → honest-skip; (4) whiteboard persyst = poll po debounced autosave (anti-race jak M07). **Honest-skip ≠ fałszywy green** — wszystkie z dowodem `file:line`/statusem.
> **REALNY BUG PRODUKTU znaleziony (zgłoszony, NIE naprawiony — prod UI routing, czeka decyzji):** świeży deep-link do idei whiteboard potrafi wyrenderować **Process Flow** zamiast Whiteboard (race montażu: `activeTool=externalActiveTool??internalActiveTool` IdeaMapWorkspace.tsx:361; process_flow wygrywa, seeduje węzeł z tytułu, autosave'uje preferredTool=process_flow; MyWorkHub.tsx:1386 nie odświeża per-doc toola). Dotyka realnych userów. Fix precyzyjny w MyWorkHub (NIE useIdeaMapSync). Powód honest-skip MC-09-04/08.
>
> **2026-06-21 — pula Ideas (M05–M09): Manual odblokowany i zweryfikowany live.** Przyczyną „padów testów" NIE były bugi aplikacji, tylko **infrastruktura E2E**: (1) 128× register-demo per moduł kładło backend/DB → **cache sesji** (register RAZ); (2) viewport 1280→**1680** (węzły react-flow klikalne po fitView); (3) **martwy frontend :3000** podczas żonglowania serwerami → wszystko „nie renderowało" (po restarcie OK); (4) M09 register-demo 400 = **stały email** kolidujący między runami → nonce per-run; (5) selektory szukające EN regionu przy PL sesji → regex EN|PL. **Równoległość zwalidowana: workers=2 + cache = bezpieczny sufit caboose** (workers=3 timeoutuje DB).
> **Stan po nocy:** **M05 ✅ · M08 ✅ 20/20 · M09 ✅ 4/4** (zweryfikowane live, oba serwery). **M06** = kod+harness zahartowany (agent: selektory + 5 luk produktowych — funkcje zbudowane ale nieosiągalne z UI: BatchConvert/convert→Prezentacja/Timeline/3D/TimeHeatmap), finalny clean-run pending. **M07** = live-run w toku. **Realny bug aplikacji znaleziony+naprawiony:** ProcessFlow używał v12 propów react-flow (`edgesReconnectable`/`onReconnect`) na v11 → DOM-warning + martwy edge-reconnect → `edgesUpdatable`/`onEdgeUpdate`. Analiza UI/UX puli: `_ANALIZA_UIUX_IDEAS_2026-06-21.md`. Commity na `feat/m13-depth-fala1` (GitHub).
>
> **2026-06-21 (dzień, sesja CTO) — M07 domknięty + M06 odblokowany + M13 Depth posunięty:**
> - **M07 P0 data-loss NAPRAWIONY+ZWERYFIKOWANY.** Finalny root cause to NIE „2 syncy" tylko `useIdeaMapSync`: success-path czyścił `queuedPayloadRef=null` bezwarunkowo zanim `finally` go odczytał → deferred payload zakolejkowany w trakcie await ginął → 0 węzłów po reloadzie. Fix: czyść ref tylko gdy `=== payload` (`b8626b01b1`). **Live: §3 persist + §4.2 props + §6.1 edge-persist = 3/3 zielone** (prod-build path). Radiuje na M06/M08/M09 (wspólny hook).
> - **M06: 2 root-cause'y TEST-INFRA (nie bugi aplikacji)** kładły 127 testów headless: (1) mock-DB SELECT ignorował `LOWER(email)=LOWER(?)` → register-demo 400 na 2.+ emailu; (2) demo-session read-only → 403 `DEMO_READ_ONLY` na `/map/sync` (persist-scenariusze padały mimo działającego canvasa client-side). Fix: predykat `LOWER()` + harness mintuje non-demo token przez bootstrap (`39380c9ded`). **m06-live 4/4 zielone** (było 2/4). Pełny suite re-run w toku.
> - **M13 Depth code-side:** **W5 Gantt drag-reschedule** (pointer-events, PUT `/api/pmo/tasks/:id`, optymistyczny UI) + **K4 AI-fill** (hypothesis/OKR/lessons-learned). **Headless S1/S2/S3 = 3/3 zielone**. Branch `feat/deliverables-w1` → wszystko na demo.
> - Sesja na branchu `feat/deliverables-w1`; wszystkie commity wmerge'owane do `demo` (Railway deploy w locie).

**Bramki realizacji** (czy zrobione): **Epiki** x/N · **DoD** x/7 · **Kod** (testy automatyczne zielone w CI) · **Manual** x/N (scenariusze manualne) · **UI** wg standardu (kryt. 7).
**Bramki odbioru** (czy odebrane): **→F** = odbiór funkcji (Piotr) · **→UI** = odbiór UI/grafik (audytor + Piotr).
Komórka: ⬜ nie · 🟡 w toku · ✅ tak. Moduł **ZAMKNIĘTY** dopiero gdy WSZYSTKIE bramki ✅ (Epiki N/N, DoD 7/7, **Kod ✅, Manual N/N**, UI ✅, →F ✅, →UI ✅).
- **Kod:** liczba = testów automatycznych PASS (`tests/` unit/integ/component); ✅ = pełny zestaw modułu zielony.
- **Manual x/N:** N = scenariusze ze spec [`../Testy manualne/`](../Testy%20manualne/) (łącznie **1954**); x = **wykonane w Playwright z KOMPLETEM wymaganych screenshotów**. Dowód = spec `tests/e2e/` + zapisane pliki `.png` (1 screenshot na scenariusz min.). Live-klik bez zapisanego artefaktu Playwright ≠ zaliczony Manual.

| # | Moduł | Faza | Epiki | DoD | Kod | Manual | UI | →F | →UI | Ekr. | Status |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| M01 | Czat | 2 | 5/5 | 7/7 | 285✅ | ✓live+7E2E | ✅ | ✅ | ✅ | 20 | ✅ ZAMKNIĘTY |
| M02 | Canvas | 3 | 6/6 | 7/7 | 199✅ | 20/20 | ✅ | ✅ | ✅ | 16 | ✅ ZAMKNIĘTY |
| M03 | My Work — organizer | 2/3 | 6/6 | 6/7 | 848✅ | 39/39 | ✅ | ✅ | ✅ | 15 | ✅ ZAMKNIĘTY (Piotr przyjął M1–M4 w całości 2026-06-21; OAuth/sync → M25/L-11 nie-bloker; część elementów wróci po inicjatywach) |
| M04 | Notatnik | 3 | 6/6 | 6/7 | 284✅ | 65/72 E2E | ✅ | ✅ | ✅ | 16/16 | ✅ ZAMKNIĘTY |
| M05 | Ideas — Zarządzanie | 1 | 7/7 | 6/7 | 40✅ | ✅ 0 fail (live 06-21) | ✅ | 🟡 | 🟡 | 12 | 🟢 DO ODBIORU (re-weryf. live 2026-06-21 workers=2 — zielony; czeka →F/→UI/deploy Piotra) |
| M06 | Ideas — Mind Map | 1/3 | 7/7 | 6/7 | 230✅ | 🟢 **Cases 23/7/0** (06-22 II fala) · 12/18 (I) | 🟡 | ⬜ | ⬜ | 16 | 🟢 BLISKO ODBIORU — **2 root-cause'y test-infra naprawione** (`39380c9ded`): mock-DB `LOWER(email)=LOWER(?)` (register-demo 400 → kładło 127 testów) + demo read-only 403 (harness mintuje non-demo bootstrap). **Pełny suite workers=2 = 57 pass / 5 fail / 66 skip** — 5 faili WSZYSTKIE test-infra/known: §20.3 [KNOWN-MOCK], §22.1/22.2 activity-feed [DB/endpoint poza mockiem], §23.1 Teresa [KNOWN-GAP], §4.2 delete `outside-of-viewport` (flake harnessu, nie bug). **4 z 5 luk produktowych WPIĘTE** (`d027ca5865`: Timeline/3D/TimeHeatmap/BatchConvert → Cmd+K paleta; 5. convert→Prezentacja już osiągalna przez export-menu). Zostaje →F/→UI |
| M07 | Ideas — Process Flow | 2/3 | 6/6 | 6/7 | 36✅ | ✅ **Cases 27/4/0** (06-22 II fala) · 3/3 (live) | 🟡 | ⬜ | ⬜ | 12 | 🟢 DO ODBIORU — **REALNY BUG PRODUKCYJNY NAPRAWIONY+ZWERYFIKOWANY** (2026-06-21): §3 persist-after-reload był = **data-loss w `useIdeaMapSync`**. Root cause finalny: success-path czyścił `queuedPayloadRef=null` *bezwarunkowo* zanim `finally` go odczytał → deferred payload (P2 zakolejkowany przez 2. call w trakcie await) ginął cicho → 0 węzłów po reloadzie. Fix: czyść ref tylko gdy `=== payload` który właśnie zapisaliśmy (`b8626b01b1`). **Live-verify: §3 + §4.2 + §6.1 = 3/3 zielone** (write-access harness, prod-build path). Radiuje na M06/M08/M09 (wspólny hook). Czeka →F/→UI/deploy |
| M08 | Ideas — Table | 4 | 5/5 | 6/7 | 195✅ | ✅ **Cases 29/1/0** (06-22) · 20/20 (06-21) | ✅ | ⬜ | ⬜ | 17 | 🟢 DO ODBIORU (re-weryf. live 2026-06-21 = 20/20 + fix bilingual region; czeka →F/→UI/deploy) |
| M09 | Ideas — Whiteboard | 1 | 6/6 | 7/7 | 65✅ | ✅ **Cases 29/1/0** (06-22 II fala) · 4/4 (live) | ✅ | ⬜ | ⬜ | 11 | 🟢 DO ODBIORU (re-weryf. live 2026-06-21 = 4/4; root-cause register-demo email + fix react-flow v11 prop; czeka →F/→UI/deploy) |
| M10 | Wywiad | 1 | 0/6 | 0/7 | ⬜ | 0/75 | ⬜ | ⬜ | ⬜ | 28 | ⬜ NIE ROZP. |
| M12 | Audyty | 3 | 0/5 | 0/7 | ⬜ | 0/49 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M12A | Tools consultingowe | — | 🟡 std | — | 🟡 częśc. | ⬜ | 🟡 | ⬜ | ⬜ | ~? | 🟡 KONCEPCJA + częściowa realizacja — **NIEOBECNY w audycie Harvard** (dodany 2026-06-29 na żądanie Piotra). Standard zdefiniowany (V1/V3/V8) + ref-impl **Dynamic SWOT**; katalog **31 frameworków (14 Active / 17 in-dev)**; szkielet doktryny `src/config/consultingToolsStandard.ts`. SSOT: [`CONSULTING_TOOLS_STANDARD_V1`](../../docs/product/CONSULTING_TOOLS_STANDARD_V1.md) · [`TOOLS_V8_SSOT`](../../docs/product/TOOLS_V8_SSOT.md) · [`TOOLS_CATALOG_V3`](../../docs/product/TOOLS_CATALOG_V3.md). Decyzja Piotra 2026-06-28: wypracować koncepcję domknięcia (merytoryczne/szybki-efekt/ładne/cały-kontekst). |
| M12B | Assessmenty digitalne | — | 🟡 V4 | — | 🟡 częśc. | ⬜ | 🟡 | ⬜ | ⬜ | ~? | 🟡 KONCEPCJA w realizacji (V4) — **najstarsze narzędzie, dziś najsłabsze**; rozdzielony od M12 Audyty (dodany 2026-06-29). Picker+forma dla 5 frameworków (DRD/SIRI/ADMA/CMMI/LEAN); **zakres fali = SIRI+DRD+ADMA** (CMMI/LEAN „wkrótce"). LUKI: raport/mapa transformacji + klasa wizualna outputów (DRD bez raportu/mapy; CMMI/LEAN wydmuszki). SSOT: [`ASSESSMENT_CONCEPT_V4`](../../docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md) + [`ASSESSMENT_IMPLEMENTATION_PLAN`](../../docs/product/ASSESSMENT_IMPLEMENTATION_PLAN_2026-06-28.md). D1 „inspired-by" (IP SIRI/ADMA) potwierdzona. |
| M13 | Inicjatywy | 2 | 15/16 depth | — | 🔵 | **152/152 E2E demo** (INICJATYWY-100) + 20/~121 (depth) | 🟡 | ⬜ | ⬜ | 38 | 🔵 3 PROGRAMY: **M13 DEPTH** ([`M13-STAN-PRACY-ODBIORY.md`](M13-STAN-PRACY-ODBIORY.md)) 15/16 sub-modułów · **INICJATYWY-100** ([`../INICJATYWY-100-STAN-PRACY-ODBIORY.md`](../INICJATYWY-100-STAN-PRACY-ODBIORY.md)) 6/7 obszarów A–F, **E2E 152/152 demo** `db41fa1e0a`, 1341 inicjatyw 0 legacy · **USPOJNIENIE** ([`../USPOJNIENIE-STAN-PRACY-ODBIORY.md`](../USPOJNIENIE-STAN-PRACY-ODBIORY.md)) 40/40, lejek+handoffy+walidatory, 150 E2E+150 manual, migracje na staging. Flagi default OFF. Czeka: →F/→UI + 4 migracje PROD + decyzje A2/B1/C3. **Postęp 2026-06-21:** Serie G(5/5)+R(W2 5/5)+**W5 Gantt drag**+**Calendar drag**+**K4 AI-fill**+**Serie C konsolidacja** code-side. **Manual gate: `m13-manual.spec.ts` 14/14 zielone + 38 screenów** (§1/§2 26-sekcji/§3/§4/§5/§6/§11) → [`_ANALIZA_UIUX_M13_2026-06-21.md`](_ANALIZA_UIUX_M13_2026-06-21.md). **Regresja 7/7** (M07 data-loss lock + W5 + K4). **P1 NAPRAWIONY+UDOWODNIONY** (`973138a3a3`): DRAFT/utworzone inicjatywy znikały z Kanban → DRAFT+PENDING_REVIEW na początku `ACTIVE_STATUSES`, kolumna „DRAFT" z kartami widoczna (s1a-P1-draft-visible-kanban, 6 kart); **manual 20/20**. Reszta scenariuszy (cross-module/AI-gen/pilot/DB) poza headless → backlog. Branch `feat/deliverables-w1`→demo |
| M14 | Wdrożenie | 2/4 | 8/35 | ✅ | 252✅ | 0/~50 | 🟡 | ⬜ | ⬜ | 18 | 🔵 PROGRAM M14 (osobny SSOT: [`M14-STAN-PRACY-ODBIORY.md`](M14-STAN-PRACY-ODBIORY.md)) — backend kompletny (18 serwisów+5 routerów+2 crony OFF), **252/252 testów**, **DEPLOYED na demo** (8 PR). Czeka: flip flag + pixel-verify kokpitu + →F/→UI |
| M15 | Rezultaty | 2 | W1–W6 ✅ | ✅ | **551✅** | ✅ **4/4 E2E + 180 manual** | ✅ | ⬜ | ⬜ | 17 | 🟢 GOTOWY DO ODBIORU (SSOT: [`M15-RAPORT-FINALNY-2026-06-26.md`](M15-RAPORT-FINALNY-2026-06-26.md)) — Seria D 11/11 fasad zlikwidowanych, **551/551 testów**, E2E 4/4, manual 180/180 (RUN4), 92 klucze i18n, deploy `6e4f16df29` LIVE. DoD 7/7 ✅. Czeka: →F/→UI Piotra (flagi URL, caveat seed danych) |
| M16 | Finanse | 2 | F0✅ F1–F9🟡 | ✅ | ~577✅ | **44 E2E + 65 API ✅** | 🟡 | ⬜ | ⬜ | 22 | 🔵 PROGRAM M16 (osobny SSOT: [`M16-STAN-PRACY-ODBIORY.md`](M16-STAN-PRACY-ODBIORY.md)) — 48 zadań/9 faz, ~70% backend realny. **E2E 44/44 PASS · API-sweep 65/65 PASS · upload 6/6 PASS** (2026-06-26). Fix pdf-parse v2 (7 plików), POST /budgets 201, Investment tab zaseedowany. **LIVE na demo** (commit `a26db23c09`). Czeka: →F Piotra + decyzje D1–D5 (split-brain V8/legacy) + wiring UI |
| M17 | Materiały (Outputs) | 3 | F0–F11 🟢 | 🟡 | 791✅ | 🟡 demo | 🟡 | ⬜ | ⬜ | 11 | 🔵 PROGRAM MATERIAŁY — osobny SSOT: [`M17-MATERIALY-STAN-PRACY-ODBIORY.md`](M17-MATERIALY-STAN-PRACY-ODBIORY.md) · audyt: [`M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md`](M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md). **AKTUALIZACJA 2026-06-26 (audyt ground-truth 2-agentowy, plik:linia):** ~10 bramek jakości JUŻ NIE martwe — **WPIĘTE w `generateBundleFromSpine`** (beauty/content/factbook/provenance/warianty + **M18 doc-QA** + **M19 deck-gate** + anti-patterns → `bundle.quality`). Decyzja **W0.1 = KOMPONUJ studia**: deck przez dojrzały **M19 PptxPipelineService** (W7.6), raport przez **M18 doc-QA** (W1.8a), **wykresy w DOCX/PDF realne** (W11.1 `@napi-rs/canvas`). **F2 wejścia**: W3.2 org-retrieval + W3.3 upload→parse backend✅; **F5 dane**: W5.1/5.2/5.3 konektory+formularze backend✅ + FE-klient. Backend brief→bundle→export→ZIP→persist→email **wpięty end-to-end**, **0 tsc**. **Deploy demo**: 5 blokerów konfig naprawione (3 flagi + ff demo + LLM-routing na zdrowego OpenRoutera, bo klucz OpenAI martwy). FE: „Komplet AI" w launcharze osiągalny; **tab „Dane" + upload-UI = sesja FE** (martwe w UI). Produkt realnie **~65–70%**. **Live-gen w weryfikacji** (chained test). Czeka: live-confirm + reszta FE + →F/→UI |
| M18 | Dokumenty | 1 | 6/6 | 6/7 | 15+74✅ | 0/72 | ✅ | ⬜ | ⬜ | 7 | 🟢 GOTOWY code-side (real. 5/5 zweryf. 2026-06-21; #3 i18n→Fala4; czeka deploy+flaga V8+dowody żywe+→F/→UI). **2026-06-26: silnik `documentQaService` (10-kat) + docx-renderer KOMPONOWANY przez M17** (W1.8a) + **wykresy DOCX/PDF teraz realne** (W11.1 `documentChartRasterizer` + `@napi-rs/canvas`) |
| M19 | Prezentacje | 3/4 | 0/4 | 0/7 | ⬜ | 0/81 | ⬜ | ⬜ | ⬜ | 21 | 🟡 SILNIKI ŻYWE, STUDIO STANDALONE NIE ODEBRANE. **Korekta 2026-06-26 (audyt):** „NIE ROZP." było błędne — **dojrzałe silniki M19 są ŻYWE i KOMPONOWANE przez M17**: `PptxPipelineService` (17 intencji, BCG layouty, branding) generuje deck wiązki (W7.6), `RulesEngine.validateReport` = strukturalny gate decka (W1.8b). Czego brak: standalone Studio Prezentacji jako odebrany moduł (UI/DoD/→F osobno) |
| M20 | Tabele Studio | 1 | 0/4 | 0/7 | ⬜ | 0/95 | ⬜ | ⬜ | ⬜ | 13 | 🟡 SILNIKI ŻYWE, STUDIO STANDALONE NIE ODEBRANE. **Korekta 2026-06-26 (audyt):** silniki Tabel ŻYWE i KOMPONOWANE przez M17 — `tableSchemaGenerator` (tabela wiązki) + Table Platform `connectorFramework`/`FormService` (W5 dane→tabela materiału). Czego brak: standalone Studio Tabel jako odebrany moduł (UI/DoD/→F osobno) |
| M21 | Meeting | 3/4 | 0/4 | 0/7 | ⬜ | 0/59 | ⬜ | ⬜ | ⬜ | 8 | ⬜ NIE ROZP. |
| M22 | AI OS | 1 | 0/5 | 0/7 | ⬜ | 0/92 | ⬜ | ⬜ | ⬜ | 9 | ⬜ NIE ROZP. |
| M23 | Organizacja | 1 | 0/5 | 0/7 | ⬜ | 0/80 | ⬜ | ⬜ | ⬜ | 6 | ⬜ NIE ROZP. |
| M24 | Admin | 3 | 0/6 | 0/7 | ⬜ | 0/53 | ⬜ | ⬜ | ⬜ | 5 | ⬜ NIE ROZP. |
| M25 | Ustawienia | 2/3 | 0/5 | 0/7 | ⬜ | 0/71 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M26 | Portal Partnerski | 4 | 0/5 | 0/7 | ⬜ | 0/70 | ⬜ | ⬜ | ⬜ | 18 | ⬜ NIE ROZP. |
| M27 | SuperAdmin | 3 | 0/5 | 0/7 | ⬜ | 0/89 | ⬜ | ⬜ | ⬜ | 60 | ⬜ NIE ROZP. |
| A1 | Affiliate (descoped) | — | — | — | — | 0/31 | — | — | — | 0 | ⬜ rm orphan |

> **Korekta 2026-06-20:** kolumna „Testy" rozdzielona na **Kod** (automaty) i **Manual** (Playwright+screenshoty). Dotychczasowe „manual" M04 (6/54) było live-klikiem bez artefaktów Playwright → zresetowane do 0/54 (do wykonania jako spec `tests/e2e/` + .png). Liczby Kod zachowane.

**Status modułu (słownik PM):** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (6 bramek realizacji ✅, czeka na →F/→UI) · ✅ ZAMKNIĘTY (wszystkie 6 ✅).

**Postęp programu (zamknięte 8/8):** **4 / 27 — M01–M04 ✅ ZAMKNIĘTE.** ⚠️ **ALE realizacja techniczna jest znacznie dalej** (stan 2026-06-26): **9 kolejnych modułów ma zieloną realizację code-side i czeka GŁÓWNIE na odbiory Piotra (→F/→UI):** Ideas M05–M09 (🟢 do odbioru, live 06-21) · M13 Inicjatywy (3 programy: DEPTH 15/16 + INICJATYWY-100 152/152 E2E demo + USPOJNIENIE 40/40) · M14 (252✅, na demo) · M15 (335✅, handoff live) · M17 (791✅, premium ON demo). **M16 domknięte testami (44 E2E + 65 API + 6 upload), LIVE na demo — czeka →F Piotra.** Łącznie ~**2300+ testów zielonych** w realizacji M05–M17. Nieodebrane bo 8/8 wymaga kliknięć Piotra na demo. Szczegóły rozjazdów = notka „🔄 AKTUALIZACJA 2026-06-26" nad tabelą.

**Postęp programu (M01–M04 baza zamknięcia):** **M01–M04 ✅ ZAMKNIĘTE (Piotr przyjął wątek M1–M4 w CAŁOŚCI 2026-06-21).** Podstawa akceptacji: pełne pokrycie automatyczne (M01 285+7E2E · M02 173 · M03 848 · M04 149, wszystkie zielone) + kod żywy na demo.consultify.ai (deploy 2026-06-21) + decyzja wykonawcza Piotra (testy szersze niż przejście manualne). Decyzja Piotra: część elementów (np. Wizard insightów, integracja inicjatyw) wróci PO domknięciu rozwoju inicjatyw — nie blokuje zamknięcia M1–M4 na teraz. M03 →F formalnie przyznany 2026-06-21. · bramki realizacji: Epiki M01 5/5, M02 6/6, M03 6/6, M04 6/6 · DoD M01 **7/7** (#7 a11y+dark live + responsywność headless E2E 2026-06-20), M02 **7/7** (#4 paleta = met + dług Visual Quality, decyzja Piotra 2026-06-20), M03 6/7 (#3 i18n canonical→Faza 4), M04 6/7 (#7 a11y/dark→Faza4/→UI) · Testy automaty M01 285✅ + 7 headless E2E composera (2026-06-20) + M02 **173✅** (2026-06-20) + M03 **262✅** (34 pliki, 0 fail, 2026-06-20) + M04 **149✅** (notebook 73 client + 76 server, 2026-06-20) (manual 0/1954) · UI M01 ✅ (i18n+dark live), M02 ✅ (i18n live PL+EN, dark; paleta=dług VQ), M03 ✅ (5 powierzchni żywych, dark+light czysty, Manager crash fixed), M04 ✅ (§27 A-tier biblioteka, slim ProgressChip + RightRail + Living Notebook FE 5-komponentów live). **Blokery odbioru po stronie Piotra:** M01 — commit working-tree (fix i18n 2 locale + nowy headless spec `tests/e2e/smoke/m01-composer-manual-e2e.spec.ts` + raport manual) + deploy demo fixu i18n; M02 — ✅ ODEBRANY przez Piotra 2026-06-20; pozostaje 1 operacyjny krok (NIE-blokujący): deploy na demo = flagi Railway (`VITE_ENABLE_DELIVERABLES_LIGHT`+`ENABLE_DELIVERABLES_LIGHT`) + redeploy; **M03 — ✅ working-tree committed (`ff5120cb21`); BLOKERY: zgoda na deploy Londyn→demo + OAuth kalendarza (L-07) = env Railway po stronie Piotra**; **M04 — ✅ working-tree committed (`f34f9cdffa`), 16/16 screenshotów gotowe; BLOKERY: zgoda na deploy Londyn→demo + →F + →UI Piotra**.

---

## 🔬 MACIERZ 4 POZIOMÓW — AS-IS, skan z KODU 2026-06-29 (ground-truth)

> **Pomiar całości** (6 równoległych agentów, `plik:linia`), konserwatywnie: **✅ tylko gdy zweryfikowane w kodzie; gated/niepewne → 🟡 lub ❓.** Mierzy 4 warstwy odbioru (model Piotra): **L1** nawigacja+uprawnienia · **L2** funkcjonalność (realny backend vs fasada) · **L3** rozwój (tylko Tools/Assess) · **L4** integracja cross-tool. **Ta macierz jest świeższa niż per-modułowe sekcje niżej — przy rozbieżności wierz macierzy.**

| Moduł | L1 nawig+upr | L2 funkcja | L3 rozwój | L4 integ | Główny fakt / caveat (z kodu) |
|---|:--:|:--:|:--:|:--:|---|
| M01 Czat | ✅ | ✅ | — | ✅ | realny SSE chat + wiring canvas/studia/my-work. Brak @mention w samym czacie. |
| M02 Canvas | ✅ | ✅ | — | ✅ | TipTap+autosave realne; handoff do studiów. (orphan: `WorkCanvasShell`) |
| M03 My Work (Inbox/Tasks/Decisions) | 🟡 | ✅ | — | 🟡 | L1: pilot-gating tabów niejasny. L4: convert→initiative UI **niewpięty** w taby (`ConvertToMenu` istnieje, nieużyty). |
| M04 Notatnik | 🟡 | ✅ | — | ✅ | L1: permission-gate taba notebook niejasny. L4 bogaty (mention/backlinks/convert); canvas↔note = copy-on-expand (brak live-sync). |
| M05 Ideas-Zarządzanie | ✅ | ✅ | — | ✅ | lista realny DB CRUD + foldery; bramka beta+pilot. |
| M06 Mind Map | ✅ | ✅ | — | ✅ | kanoniczny graf, rail w pełni obsłużony, anty-race persist. |
| M07 Process Flow | ✅ | ✅ | — | ✅ | data-loss naprawiony; martwy `wb_add_frame` usunięty. |
| M08 Table | ✅ | ✅ | — | ✅ | **★ T2.2 NAPRAWIONE 2026-06-29** (`166421b3f5`): rail emituje `tbl_undo/redo` (był `mm_*`→martwa mind-mapa), `useTableQuickActions` je obsługuje, tabela emituje `tbl-undo-state`→rail pokazuje realny stan. Test 4/4 (`5ed6b41bd2`), `vite build`✅, live demo gitSha `166421b3f5`. Live-click na canvasie = przy odbiorze Piotra (bramka Ideas). |
| M09 Whiteboard | ✅ | ✅ | — | ✅ | facilitation/voting; convert z `whiteboardContext`. |
| *Ideas L4 wspólny* | | | | 🟡 | convert = **REAL** (6 celów live, 7 „wkrótce"); **Export→Outputs/Materiały = STUB OFF** (świadomy, L-05). |
| M10 Wywiad | ✅ | ✅ | — | ✅ | **★ KOREKTA: P0 STT NAPRAWIONY** (dual zapis `voiceTranscript`+`answerText`, interim-merge). Zalecane live-verify server-STT (OpenAI key) na prodzie. |
| M12 Audyty | ✅ | 🟡 | — | 🟡 | ta sama powierzchnia co M12B (assessment). |
| **M12B Assessmenty** | ✅ | 🟡 | 🟡 | 🟡 | **OSIĄGALNE 3/5** (DRD+SIRI+**ADMA**). **★ ADMA ODBRAMKOWANY 2026-06-29 (T3A, `48d22bccab`)** — był `coming_soon` mimo pełnej integracji (frameworkRegistry: editor/map/report/knowledgeBase=true; zweryf. przed flipem) → `available`. CMMI = wydmuszka (brak `cmmiKnowledge.ts`, knowledgeBase=false). LEAN = struktura bez warstwy doradczej. AI-triage = **display-only** (LLM niezweryf. → D-H). **★ KOREKTA: „DRD bez raportu/mapy" = FAŁSZ**. |
| **M12A Tools** | ✅ | 🟡 | 🟡 | 🟡 | **1 tool e2e-pewny (Dynamic SWOT)**; ~13 z runtime ale **output niezweryfikowany**; ~15 stuby/read-only. „14 Active/17 in-dev" **optymistyczne** (in-dev = stuby bez planu). Brak licensing/role-gate na toole. |
| M13 Inicjatywy | ✅ | ✅ | — | 🟡 | „dwa Gantty/dwa źródła zależności" = **ROZWIĄZANE** (oba czytają `task_dependencies`). L4: M13→M14 statusowy nie encja; materialize generuje pliki ale **bez rejestru Outputs**. |
| M14 Wdrożenie (ExecutionHub) | 🟡 | ✅ | — | 🟡 | L1: **5 flag OFF** ukrywa gotowe funkcje (Intelligence/What-If/Rollout/Benefits). L4: **M14→M15 handoff ZERO wywołań = martwy**; „PDF" eksport = faktycznie Markdown. |
| M15 Rezultaty | ✅ | ✅ | — | 🟡 | V8 ~38 endpointów realne. L4: pomost M14→M15 (benefits-register) realny ale **za flagą `m14Handoff` = OFF**. |
| M16 Finanse | 🟡 | ✅ | — | ✅ | closed beta. V8 żywy; **split-brain: Valuations+Budgets idą TYLKO legacy** `/economics/*`. Export-do-Outputs ❓ (finalny krok nieprześledzony). |
| M17 Materiały | ✅ | 🟡 | — | 🟡 | pipeline backend **REALNY** (brief→bundle→export→ZIP→persist). **★ tab „Dane"/connectors OŻYWIONY 2026-06-29 (T4.3, `0d85388a8b`)** — `DataSourcesTabContent` w RAP hub (Połącz źródło + Zbierz przez formularz), test 5/5, build✅; wizualny odbiór na demo. Email tylko w cron (nie z launchera). 2 flagi (`VITE_…LIGHT` + `ENABLE_DELIVERABLES_PREMIUM`) muszą być ON. |
| ↳ M18/M19/M20 silniki | — | — | — | — | **ŻYWE i komponowane przez M17** (doc-QA / PptxPipeline / tableSchema). Odbiory standalone ZNIKAJĄ. |
| *L4 globalne* | | | | ✅ | link-graph+backlinks, convert (7 celów), `mywork-open-item`, `artifactLinks` = **wszystko REAL, end-to-end**. |
| M21 Meeting | ✅ | ✅ | — | ✅ | najpełniejszy z platformy; backend+DB realny; 1 uczciwy martwy „Archive" (coming soon). |
| M22 AI OS | 🟡 | 🟡 | — | ❓ | **dbr77-internal, PODWÓJNA bramka env** (`VITE_INTERNAL_TOOLS_ENABLED` + `ENABLE_V8_GLOBAL`) → dla klienta w prod zwykle **OFF/niewidoczny**. Nie ✅ bez live-verify. |
| M23 Organizacja | ✅ | ✅ | — | ✅ | backend realny (shimy→`organization/`); sekcje admina delegują do M24. |
| M24 Admin | ✅ | ✅ | — | ✅ | 5 paneli API-backed (`adminP32` 77KB). 2 orphany martwe (`AdminInitiativeCreatorPanel`, `InterviewAssignmentsPanel`). |
| M25 Ustawienia | ✅ | 🟡 | — | ✅ | **mieszane: ~8 paneli AI/Voice/Memory = fasada/read-only** (UI bez persist). Reszta realna. |
| M26 Portal Partnerski | 🟡 | ✅ | — | ✅ | widoczny w UI **tylko gdy `connected:true`**; backend 102KB realny + fallbacky. |
| M27 SuperAdmin | ✅ | ✅ | — | ✅ | backend 158KB realny. Nie wszystkie 22 podsekcje zsamplowane (część ❓). |

### Wnioski przekrojowe (mapują się na 3 poziomy Piotra — gdzie jest realna praca)
- **L1 (nawigacja+uprawnienia) — rozproszone, nie krytyczne.** Konkretne rozjazdy: **M08 rail-undo martwy**, **M03/M04 niejasny pilot/permission-gate**, **M14/M15 funkcje ukryte za flagami OFF** (gotowy kod niewidoczny), M22/M26 nietypowe/zbramkowane wejścia. Sweep L1 = ujednolicić wzorzec (mamy go z Notatnika) + **przegląd flag** (co włączyć na demo).
- **L2 (funkcjonalność) — najmocniejsza warstwa.** Backend prawie wszędzie REALNY/DB (V8). Fasady są **lokalne**: M17 tab „Dane", M25 panele AI/Voice. Niepewność systemowa: czy migracje wgrane na demo/prod (osobny `db:migrate`).
- **L3 (rozwój Tools+Assess) — TU jest realny duży build.** Tools: **1/~31 pewny e2e**. Assessmenty: **2/5 osiągalne**. To jedyna warstwa z dużą luką merytoryczną — i serce produktu konsultingowego.
- **L4 (integracja) — najsłabsza systemowo.** Kręgosłup M13→M14→M15→M16 jest **statusowo/lifecycle-centryczny, nie encja-centryczny**; **M14→M15 handoff martwy** (zero wywołań); **eksport-do-Outputs rozjechany** (M13 materialize bez rejestru, M14 „PDF"=MD, M15/M16 = nawigacja). Pojedyncze integracje (link-graph/convert/mention) = realne; brak spójnego „jeden deliverable → rejestr Outputs".

### ★ Korekty do raportu (był ~miesiąc nieaktualny)
1. **M10 Wywiad P0 STT = NAPRAWIONY** (raport/pamięć mówiły „żywy P0"). Pozostaje tylko live-verify server-STT na prodzie.
2. **M12B: „DRD bez raportu/mapy" = BŁĄD** — DRD jest jednym z dwóch najpełniejszych. Realnie osiągalne 2/5 (DRD+SIRI), nie 5.
3. **M22 AI OS to wewnętrzne narzędzie dbr77** (podwójna bramka env), nie funkcja klienta — wcześniej „NIE ROZP." bez tej nuancji.
4. **M14→M15 handoff jest martwy** (`emitResultsHandoffEvent` zero wywołań) — wcześniej liczony jako „handoff live".
5. **M17 tab „Dane"** (connectors/forms) = martwy w FE mimo realnego backendu.
6. **Dużo gotowego kodu ukryte za flagami OFF** (M14/M15) — żywy użytkownik widzi szczuplejszą apkę niż jest.

---

## Odbiory szczegółowe (moduł po module)

> Każdy moduł: 8 etapów + linia DoD. Odhaczamy `⬜→✅`, wpisujemy datę/kto przy odbiorach 7–8.

### M01 — Czat · Faza 2 · 5 epików · 20 ekranów
**Status:** ✅ **ZAMKNIĘTY (8/8) — 2026-06-20** (Piotr zaakceptował; realizacja + odbiory domknięte). *Opcjonalnie później: dedykowany audyt UX 20 ekranów (audytor) — nie blokuje.*

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/02/05/07/08/09/10 ZAMKNIĘTE, L-04/06 false-pos; sierota `CodeInterpreter/` usunięta (L-05) |
| 2 | DoD 7/7 | ✅ | #1 front↔back · #2 security · #3 i18n(0 bare) · #4 tokeny(rose 0) · #5 §27 N/D · #6 M01-gate green · **#7 UI/UX: a11y+dark zweryf. live + responsywność zweryf. headless E2E (390px, 0 overflow) 2026-06-20** |
| 3 | Epiki 5/5 | ✅ | E1 rdzeń · E2 język(10/10) · E3 reasoning(9/9) · E4 Tryb B(33/33+2/2)+A(6/6), **C odroczony BETA** · E5 closeout |
| 4 | Testy — automaty + manual live + headless E2E | ✅ | **Automaty:** 51 plików / 285 PASS, 0 fail (2026-06-20). **Manual:** skrypt `TESTY_M01_CZAT.md` (3 przyciski +/✎/👥 + przekrojowe) przejrzany NA ŻYWO — rdzeń PASS, 0 defektów rdzenia M01. **Headless E2E (NOWE 2026-06-20): `tests/e2e/smoke/m01-composer-manual-e2e.spec.ts` 7/7 PASS** (E2E_MODE+mock DB+mock AI; S1 AddFiles+walidacja URL, S2 ToolsMenu, S3 CoThinker, S4 i18n-guard/a11y/izolacja/responsywność) — deterministyczny, repeatable. Raport [`docs/qa/RAPORT_MANUAL_M01_2026-06-20.md`](../../docs/qa/RAPORT_MANUAL_M01_2026-06-20.md). 1 finding cross-module (M25 routing) + caveaty środowiskowe (drift staging). Pozostałe (branch/export/share/revoke/głos, upload natywny) = →F Piotra |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | komponenty zgodne (composer single-border 5/5, rose 0); **i18n leak NAPRAWIONY 2026-06-20** (5 kluczy PL-fallback w EN + 14 EN-fallback w PL → wszystkie przez `t()` w PL+EN locales; zweryf. live EN „HOW TERESA SHOULD ANSWER" + PL „JAK TERESA MA ODPOWIADAĆ"/„Dodaj do projektu"); **dark-mode czysty zweryf. live** (wszystkie menu czatu); a11y keyboard-nav live = →UI |
| 6 | Deploy na demo | ✅ | `SUCCESS demo/1475849a` — M01 live na demo.consultify.ai |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ✅ | **Zaakceptowany 2026-06-20.** ✅ AddFilesMenu (Add link + walidacja URL, Recent) · ✅ ToolsMenu (5 trybów+badge+TTS+Response style+Add to project) · ✅ Co-Thinker (6 person+pill+exclusion+Clear) · ✅ E2E flag→backend (Deep Thinking + Agent Audit Layer) · ✅ tytuł auto-gen · ✅ język PL→PL · ✅ SSE+persyst. + headless E2E 7/7 |
| 8 | **ODBIÓR UI/grafik — Piotr** | ✅ | **Zaakceptowany 2026-06-20** (decyzja Piotra). dark ✅ + a11y ✅ (Esc/focus-ring/role) live + responsywność ✅ (headless E2E 390px, 0 overflow); dowody menu w sesji. *Dedykowany audyt UX 20 ekranów = opcjonalny późniejszy pass, nie blokuje.* |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ✅ | **2026-06-20 — Piotr zaakceptował, przechodzimy dalej.** |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny 5✅§27(N/D) 6✅E2E(M01-gate) 7✅UI/UX(a11y+dark live + responsywność headless E2E, 2026-06-20) · 📁 [M01-czat.md](M01-czat.md)
🔴 **KRYTYCZNY FIX (2026-06-19, `42bee38044`):** czat padał na 400 „Invalid schema generate_deliverable type:None" — ai SDK v6 `tool()` wymaga `inputSchema` nie `parameters` (`llmService.ts`). ZNALEZIONY przez uruchomienie (testy mockowały SDK). Live-verified: polskie pytanie→polska odpowiedź+9 RAG. **= prawdopodobny P0 Elkomtechu „brak odpowiedzi" → MUSI na demo+prod.** [[finding_chat_inputschema_sdk_v6]]
✅ **i18n-leak NAPRAWIONY (2026-06-20):** 19 brakujących kluczy menu czatu (`ToolsMenu`/`WorkModeMenu`/`AddFilesMenu`) dopisane do `public/locales/{pl,en}/translation.json` — m.in. `aiChat.menu.steeringHeading/steeringSubtitle/customSet`, `aiChat.conversation.addToProject(+RequiresConversation)`, `aiChat.workMode.title`, `modes.showReasoning.tooltip`, voiceStyle/addLink/manageIntegrations itd. Zweryf. live EN+PL (oba kierunki). ⚠ **w working tree — czeka na commit+deploy demo (zgoda Piotra).**
⚠ Bloker wspólnego PR-gate: 4 faile `Wave5ArtifactRuntimePanel` (M22) — osobny task, nie M01.

### M02 — Canvas · Faza 3 · 6 epików · 16 ekranów
**Status:** ✅ **MODUŁ ODEBRANY przez Piotra + WDROŻONY NA DEMO (2026-06-20)** — 8/8: realizacja 6/6 + →F + →UI odebrane; commit `58d6e2e06f` żywy na https://demo.consultify.ai (build SUCCESS). ⚠ Jedyny pozostały krok (NIE blokuje odbioru, decyzja Piotra „deploy teraz, flagi później"): ustawić na Railway demo `VITE_ENABLE_DELIVERABLES_LIGHT`+`ENABLE_DELIVERABLES_LIGHT` + 2. deploy → Canvas triada ON.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | 11 luk zamkniętych/FP (L-02/04/05/06/08/09/10/13/14/15 + L-11 i18n); odroczone świadomie: L-01 Tryb C→BETA, L-03 runtime→Fala 2 (guard 36/36 zamknięty), L-07 picker→backend B-1, L-12 paleta→Visual Quality |
| 2 | DoD **7/7** (#4 paleta = met + dług VQ, decyzja Piotra 2026-06-20) | ✅ | #1 front↔back · #2 security (9/9 cap + S7 cross-org 403, **bez IDOR**) · #3 i18n (L-11, 66 kluczy; live PL+EN) · #4 tokeny **met** (hex 0; ~168 util palety = tracked dług Visual Quality P3) · #5 §27 N/D · #6 M02-gate green |
| 3 | Epiki 6/6 | ✅ | E1 kręgosłup(Tryb B 33/33) · E2 generacja · E3 security · E4 odporność · E5 kanon(i18n) · E6 testy(40/40+3/3) — C/picker/paleta odroczone |
| 4 | Testy — automaty zielone + manual-schema E2E (Playwright headed, live app) | ✅ | **(a) Unit/integ 173 PASS / 0 fail** (15 plików, 2026-06-20): `unbackedCanvasClaim` 36/36, `canvas/*`, `AIChat/*`, `WorkCanvasDocumentPanel` 33/33 + `handoffMount` 2/2, `work-canvas.routes` 40/40, `deliverablesGenerations.generate-format` 3/3, `canvasMaterializeCrossOrg` 3/3. **(b) Manual schema TESTY_M02 zautomatyzowana w Playwright — 13/13 PASS** (headed, live app :3000/:3001→trolley, auth register-demo), `tests/e2e/smoke/m02-canvas-manual.spec.ts`: §1 tytuł+autosave-blur · +New menu · „…"+Dock/Markdown wspólne źródło · file-actions+save-state · history; §1.3/1.4 capability-gating (output/promote/share disabled+reason, 0 żądań); §2 toolbar (bold/italic/underline/strike/code/highlight + H1-3/listy/task/blockquote/table + undo/redo); §3 floating AI menu na zaznaczeniu; §4 autosave debounce + reload-recovery (persyst do DB); §7A deliverables route enabled (≠404=flaga ON); §7 dark+light bez błędów konsoli. **Poza zasięgiem demo-auth (capability):** pełna generacja czat→canvas doc/deck/sheet (wymaga cap owner DBR77 — zweryf. live w sesji Chrome). **(c) CAŁY zestaw canvas headless = 26/26 PASS** (2026-06-20): 13 `m02-canvas-manual` + 6 zmodernizowanych `work-canvas-*` (split 5, core-flow 2, deeplink 1, editor-flow 1, manual-preflight 3, research-lineage 1). Naprawione w trakcie: core-flow save-readback (czekaj na realny request autosave przed `saved`; reload-recovery = autorytatywny test persyst., bo `GET /drafts/:id.contentMd` to snapshot mogący odstawać od strumienia wersji), editor-flow preview/revise (optimistic-lock — apply na 1. preview), 6 legacy zmodernizowanych do chat-shell (`/chat?workCanvas=1&draftId=`, suppress FirstRunOnboarding przez intercept `GET /api/preferences`). 1 flake środ. (`auth/register-demo` Timeout 15s pod obciążeniem) → ✅ na re-run. ⚠ Równoległa sesja edytowała te same pliki + restartowała serwery → przejściowy 401-wipeout; rekomendacja: jedna sesja naraz. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | i18n ✅ live (PL shell „Porozmawiaj z Teresą" + EN; panel render-test); dark-mode czysty (canvas/edytor/slajdy live); ~168 util palety = dług Visual Quality (P3, decyzja Piotra: liczone jako met); pełne screeny 16 ekr. = →UI audytor |
| 6 | Deploy demo | ✅ | **WDROŻONE 2026-06-20** — commit `58d6e2e06f` na Londyn→origin/demo (`./scripts/deploy-demo.sh`, Railway demo env), build **SUCCESS**, żywe na **https://demo.consultify.ai** (`/` + `/api/health` = 200). ⚠ **Canvas triada nadal OFF** do czasu ustawienia flag Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT` build-time FE + `ENABLE_DELIVERABLES_LIGHT` runtime BE) + 2. deploy (VITE = build-time, wypalane przy buildzie) — decyzja Piotra: deploy teraz, flagi później. |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ✅ | **ODEBRANE przez Piotra (2026-06-20).** Podstawa: live-verify (Claude, localhost:3000 + backend dev na trolley) — handoff czat→canvas · generacja **doc** (rich PL, grounded 3 źródła, `POST /generations`→200) · **deck** (CanvasPresentationView, 5 slajdów+branding DBR77) · autosave-persyst po reload · artifact switcher reload-safe · komunikat uczciwy (NIE halucynacja); **sheet** = ta sama ścieżka (generate-format 3/3); + manual schema 26/26 PASS (Playwright). Piotr uznał za odebrane. |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ✅ | **ODEBRANE przez Piotra (2026-06-20).** Pakiet 10 ekr. na dysku `docs/qa/screens/m02-canvas-2026-06-20/` (capture spec `tests/e2e/smoke/m02-canvas-ui-capture.spec.ts`, light+dark): panel+edytor, MD view, menu „…", New Canvas templates, historia wersji, capability-gating strips, **floating AI menu + render tabeli GFM (siatka)**, dark menu, dark split + README (mapa 16-ekr.). Ekrany capability (deck 5 slajdów+branding, doc rich-PL+tabela kosztów, plan-checklist) zweryfikowane live owner DBR77. UX odebrany. |
| ✔ | **ZAMKNIĘTY (8/8)** | ✅ | **MODUŁ ODEBRANY przez Piotra + WDROŻONY NA DEMO 2026-06-20** (`58d6e2e06f` → demo.consultify.ai, build SUCCESS). Pozostaje tylko: flagi Railway demo + 2. deploy → Canvas triada ON (decyzja Piotra). |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny(met+dług VQ) 5✅§27(N/D) 6✅E2E(M02-gate) 7✅UI/UX(i18n+dark live) · 📁 [M02-canvas.md](M02-canvas.md) · 🔑 [flaga Railway](M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md)

### M03 — My Work organizer · Faza 2/3 · 6 epików · 15 ekranów
**Status:** ✅ **ZAMKNIĘTY (8/8) — 2026-06-21** (Piotr przyjął wątek M1–M4 w całości). Realizacja + odbiory domknięte; część elementów (kalendarz OAuth/sync) wróci po inicjatywach jako nie-bloker. ⚠ KRYTYCZNY FIX żywy (Manager crash) — patrz niżej.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/04/05/06/08/10 ZAMKNIĘTE (z teczki) + **NOWY P1 crash Manager NAPRAWIONY na żywo** (`AIOperatorOverviewCard` renderował `nextMilestone:{name,targetDate}` jako React-child → error-boundary; fix: koercja do stringa `name · data`); odroczone świadomie: L-02/03 INERT, L-07 OAuth=BLOCKED-ON-ENV (Piotr), L-09 design D-03, L-11 i18n→Faza4 |
| 2 | DoD 6/7 (#3 i18n canonical → Faza 4 sweep) | ✅ | #1 front↔back ✅ (5 powierzchni żywe, 0 dead-CTA, Manager crash fixed) · #2 security ✅ (L-01 `requireRole` `my-work.routes.ts:7974` + decisionsRole.security + org-guards) · #4 tokeny ✅ (rose 0; light danger-fill czysty żywo) · #5 §27 ✅ (sticky-thead+persistKey done; FilterableTable 24-tab sweep=DP-9 Faza4) · #6 E2E ✅ (262 M03 PASS) · #7 UI/UX ✅ (dark+light czysty żywo); #3 i18n 🟡 bilingual przez inline działa (EN zweryf. żywo), canonical `t()` sweep = L-11 Faza 4 |
| 3 | Epiki 6/6 | ✅ | E1 integralność(cross-org) · E2 crash landing(L-06) · E3 wartość(L-01/02/04) · E4 kalendarz connect(L-07 CTA; OAuth env) · E5 in-context(L-08, test 6/6) · E6 kanon(sticky+persistKey; i18n→Faza4) |
| 4 | Testy — automaty zielone (PEŁNY SWEEP my-work/*) | ✅ | **848 testów PASS / 118 plików / 0 fail** w całym zakresie M03 (tsc exit 0; jedyne błędy tsc = A1 orphan `AffiliateDashboardView.tsx`, poza M03). Rdzeń: 262 (FE 118 + BE 139 + ExecutiveDashboard + regresja nextMilestone 3). **Naprawione 9 zdryfowanych testów/luk:** 2× mock i18n `{defaultValue}` (DecisionsList/MyTasksList) · stale mock route `decisions.remind` (`getCreatedTasks`/`transitionWorkflow`/`requireOrgAccess`) · **2× fail-closed (home/link-graph) — brak `requireRole` w mocku auth** · `TestFactory.createDecision` (brak metody → 22 testy decision-management odblokowane) · `decision-management` concurrent (zły endpoint `/approve`→`PATCH /:id/decide`) · **🔧 PROD-ROBUSTNESS: `DecisionController.getDecisions` — subquery `decision_impacts` bez guardu kasowała CAŁĄ listę decyzji do `[]` przy schema-drift** (queryAll połykał błąd) → guard `getTableColumns` (jak `escalation_level`); regresja = `decisions.test.js` 6/6 bez tej tabeli. Poza M03 (pre-existing, inny moduł): economicsFlow(M16)·integracja(integr)·my-work-presence(Ideas)·harvardModuleContract(M07/A1)·pilotAccess·SUBMIT_INTERVIEW(M10 deliberate)·v2.routes(DB-infra adapter `iris_test`). **39 scenariuszy manualnych = Twój →F** |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | §27 tabele renderują żywo (Inbox 256/Tasks 200/Decisions 5: Status/Priority/Due/Assignee, sort, filtry kolumn, kebab); EntityStatusChip+DueChip czyste; **dark+light zweryf. żywo** (0 danger-fill leak); honest kalendarz integ (Google/Outlook „Coming soon"+ICS, zero fake Connect); FilterableTable-sweep+i18n = Faza 4 |
| 6 | Deploy na demo | ✅ | committed `ff5120cb21`; kod żywy na demo.consultify.ai (deploy 2026-06-21) |
| 7 | **ODBIÓR FUNKCJA — Piotr** (39 scenariuszy, demo) | ✅ | **Przyjęty 2026-06-21** (Piotr, decyzja wykonawcza dla M1–M4 w całości). Podstawa: 848 testów PASS + 39/39 headless E2E z kompletem screenshotów + 5 powierzchni zweryfikowanych żywo + kod na demo. Pełny ręczny przebieg 39 scenariuszy = opcjonalny, nie blokuje |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | 🟡 | **KOMPLET graficzny do zatwierdzenia: 5 powierzchni × jasny/ciemny = 10 zdjęć** (`docs/qa/screens/m03-theme-2026-06-20/{light,dark}-{inbox,calendar,tasks,decisions,manager}.png`, spec `tests/e2e/smoke/m03-theme-capture.spec.ts`, z zaseedowaną treścią). Light+dark czysty (0 danger-fill leak — „Critical" = neutralna kropka, nie wypełniony pill); Manager renderuje pełny dashboard w obu trybach (fix crashu trzyma). + 39 zdjęć funkcjonalnych headless. Finalna akceptacja UX = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ✅ | **2026-06-21 — Piotr przyjął M1–M4 w całości, przechodzimy do M17–M20.** |

DoD: 1✅front↔back 2✅security 3🟡i18n(canonical→Faza4) 4✅tokeny 5✅§27(sticky+persistKey; FilterableTable→Faza4) 6✅E2E(848 PASS/0 fail) 7✅UI/UX(dark+light żywo) · 📁 [M03-my-work-organizer.md](M03-my-work-organizer.md)
🎬 **MANUAL HEADLESS E2E (Playwright, 2026-06-20): 39/39 ZALICZONE z kompletem screenshotów.** Spec `tests/e2e/smoke/m03-mywork-acceptance.spec.ts` — **39/39 PASS headless** (chromium, ~4 min, retries=2; real staging-DB round-trip via register-demo + API seed; onboarding-redirect suppressed). Komplet 39 screenshotów `docs/qa/screens/m03-headless-2026-06-20/s{1.1..6.4}-*.png`. Pokrycie wg spec `TESTY_M03_MOJA_PRACA.md`: §1 hub/nav 4/4 (deep-link ?taskId, doc-tabs persist po reload, AI-shell) · §2 Inbox 10/10 (triage/snooze/bulk endpointy, presety+liczniki, filtry, widoki, AI-shell, detal) · §3 Calendar 7/7 (tryby, unified feed, **honest integ**, create-event POST /v8, reschedule etag, day-load) · §4 Tasks 8/8 (status-change PUT+reload-persist, inline-edit priorytetu+weryfikacja API, widoki/Kanban, filtry, bulk-delete-persist, new-task, detal, **★§4.8 Link Graph v3 [DB]: edge decision→task w backlinkach + delete nie wskrzesza**) · §5 Decisions 6/6 (approve PATCH /decide+persist, Timeline ukryty potwierdzony, filtry, **remind** [naprawiony 500], new, detal) · §6 Manager 4/4 (gating ADMIN + **regresja crashu AIOperator**, karty, decision-queue, refresh). Mutacje przez udokumentowany endpoint → reload UI → asercja trwałości.
🔧 **PROD-ROBUSTNESS FIX #2 (2026-06-20, working tree):** `DecisionController.getDecisions` zawierał subquery `(SELECT … FROM decision_impacts …)` BEZ guardu. Przy schema-drift (tabela `decision_impacts` nieobecna na niedomigrowanym env) cały SELECT rzucał błąd, a `queryHelpers.queryAll` połykał go do `[]` → **lista decyzji CICHO pusta dla wszystkich** (klasa [[finding_staging_schema_drift_v8_404]] / „graceful-[] maskuje błąd"). Fix: guard `hasDecisionImpacts = getTableColumns('decision_impacts').has('is_blocker')` → subquery albo `0` (wzorzec jak istniejący `hasEscalationLevelCol`). Regresja: `decisions.test.js` 6/6 zielone (test-env nie ma tej tabeli = dowód guardu). Zweryf. żywo: Decisions renderuje 5 decyzji po reloadzie backendu. Dotyka wszystkich konsumentów GET /decisions (M03/M13/M16) — happy-path bez zmian (subquery identyczny gdy tabela jest).
🔧 **PROD-ROBUSTNESS FIX #3 (2026-06-20, working tree — ZNALEZIONE przez headless §5.4):** `POST /api/decisions/:id/remind` zwracał **500 `relation "notification_preferences" does not exist`** na env bez tej tabeli (DatabaseInitializer jej nie tworzy). `notificationService.getPreferences` rzucał zamiast wpaść w istniejącą gałąź defaults. Fix: try/catch wokół `SELECT … notification_preferences` → zwraca defaults (jak dla braku wiersza). Zweryf. żywo: remind 500→**200**. Regresja = headless e2e §5.4 (na staging bez tej tabeli = dokładna repro). Dotyka wszystkich konsumentów `notificationService.getPreferences`. *(Uwaga: bare-schema SQLite ma głębszy drift w `send()` — osobny, poza tym fixem.)*
🔴 **KRYTYCZNY FIX (2026-06-20, committed `ff5120cb21`):** Manager (Executive Dashboard) **padał na error-boundary „Coś poszło nie tak"** dla ownera. Przyczyna: `AIOperatorOverviewCard.tsx:323` renderował `plan.nextMilestone` surowo, a stary plan zapisany w DB (`ai_operator_plans.plan_json`) ma legacy-kształt `{name,targetDate}` (obiekt) zamiast stringa → `Objects are not valid as a React child`. Fix: defensywna koercja na warstwie prezentacji (obiekt→`name · data`, string→string, brak→„None") + test regresji 3/3 (`AIOperatorOverviewCard.nextMilestone.test.tsx`). **ZNALEZIONE przez uruchomienie żywe** (testy nie pokrywały tej powierzchni). Zweryf. żywo: Manager renderuje pełny dashboard, „NEXT MILESTONE: Process Automation · 20/03/2026", console 0 błędów. ✅ committed `ff5120cb21`; czeka tylko deploy demo (zgoda Piotra).
🎨 **ODBIÓR UI ✅ (2026-06-21, Piotr zatwierdził):** 3 ostatnie odstępstwa naprawione: (1) `InboxContent.tsx` `<th>` `text-xs font-medium` → `text-[11px] font-semibold dark:text-slate-400` (§3.2 kanon); (2) `UserProfileMenu.tsx` topbar chip — usunięty podwiersz `rola · org` (§7 topbar-standard); (3) `ModuleMenu3.tsx` aktywny chip — DECYZJA F rozstrzygnięta: crimson delicatnie (`bg-primary-500/10 border-primary-500/50 text-primary-800`) dla `MENU_2_TAB_ACTIVE`, `MENU_3_CHIP_ACTIVE`; `MENU_3_BADGE_ACTIVE` = `bg-primary-500/20`. Zweryf. live preview (inspect computed: `rgba(168,45,73,0.10)`). **10 screenshotów light+dark** = `docs/qa/screens/m03-theme-2026-06-20/*.png`. Zero odstępstw od kanonów. ⬜ czeka: Deploy demo + →F (Piotr na demo.consultify.ai).

#### 📋 BACKLOG M03 — otwarte pozycje (stan 2026-06-21)

> Po domknięciu bramek realizacji (6/6), deploya na demo i audytów UI/preview/kebab, **żadna pozycja poniżej nie blokuje odbioru →F** — to świadome długi i kroki po stronie Piotra. Tabela = jedno miejsce prawdy o tym, co zostaje „na potem", z konkretną lokalizacją i decyzją.

| ID | Pozycja | Typ | Prio | Lokalizacja | Status / decyzja | Następny krok / bloker |
|----|---------|-----|:--:|-------------|------------------|------------------------|
| **B-01** | **→F — odbiór 39 scenariuszy** | bramka odbioru | **P1** | `demo.consultify.ai` (M03) | ⬜ czeka na Piotra | Klik-test 5 powierzchni (Inbox/Calendar/Tasks/Decisions/Manager) na demo → ostatni krok do **8/8** |
| **B-02** | **PV-4 — Inbox → `TableWithPreviewLayout`** | refactor (dług arch.) | P2 | `InboxContent.tsx:3241-3332` | ⏸️ świadomy dług (decyzja Piotra 2026-06-21) | Spec gotowy (footer-in-body + `sticky bottom-0`, 1 instancja stanu). Footguny: id `_key`vs`id`, 2 handlery wiersza. **Nie ruszać bez weryfikowalnego live Inboxu** (harness był zaklejony na Ideas). Osobny ticket |
| **B-03** | **L-11 — synchronizacja zewnętrzna** (kalendarze + taski + chmury-do-czata) | feature / env | P2 | M25 `integrationOAuthEngine.ts` · [M25-ustawienia.md](M25-ustawienia.md) | ⬜ otwarta, po stronie Piotra | Sekrety provider-app w Google Cloud Console + Azure (`GOOGLE_/MICROSOFT_CLIENT_ID/SECRET/CALLBACK_URL`) + redirect-URI demo. **Nie-bloker** — kalendarz działa bez (eventy wewn. + ICS) |
| **B-04** | **DoD #3 — i18n canonical `t()` sweep** | dług i18n | P2 | `src/components/MyWork/*` | 🟡 Faza 4 (precedens M03/M08) | Konwersja residualnych `isPl?` ternary → `t()`. Bare-missing=0 ✅, funkcjonalnie PL/EN ✅ (EN zweryf. live) — porządkowanie, nie funkcja |
| **B-05** | **§27 / DP-9 — `FilterableTable` 24-tab sweep** | dług arch. | P2 | my-work/* + cross-moduł | 🟡 Faza 4 | sticky-thead + persistKey już done; pełna konsolidacja `ResizableTable`→prymitywy = osobna faza (§2.2 kanonu) |

**Opis priorytetów:**
- **P1 (B-01)** — jedyna pozycja na ścieżce krytycznej do zamknięcia M03 (8/8). Wszystko inne jest poza nią.
- **P2 długi (B-02, B-04, B-05)** — świadome, udokumentowane, z lokalizacją i spec'iem; realizacja w dedykowanych Fazach/ticketach, nie w bieżącym odbiorze. Każdy ma uzasadnienie „dlaczego nie teraz": PV-4 = niewidoczny zysk + footguny + brak weryfikacji live; i18n/§27 = porządkowanie zaplanowane na Fazę 4.
- **P2 zewnętrzne (B-03)** — czeka na sekrety/decyzje poza moim zakresem (reguła: sekrety zgłaszam, nie ustawiam); konwerguje w M25 jako hub synchronizacji.

**Zasada:** pozycja schodzi z backlogu tylko z dowodem (commit + weryfikacja live) lub świadomą decyzją właściciela. Nic nie znika po cichu. *(Z tej sesji już zeszły: 8/9 findingów preview+kebab — `915550f82b`+`e41b25d82a`; meta-pille §4.1 i AI-widget→SSOT = ✅.)*

---

### M04 — Notatnik · Faza 3 · 6 epików · 16 ekranów
**Status:** ✅ **ZAMKNIĘTY (8/8) — 2026-06-20** (Piotr zaakceptował →F + →UI; deploy demo zweryfikowany żywo). *Opcjonalnie później: i18n `t()` sweep (L-11) → Faza 4.*

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01 handoff REALNY INSERT (convert-path, zweryf. live niżej) · L-02/L-03 rail+ProgressChip (`a69b953b06`) · L-04 Menu3 L2 · L-05 search project_members · L-06 heurystyka jawna · L-07 FALSE-POS · L-10 cross-user fix · **L-08 sieroty `KnowledgePulse.tsx`+`notebook/InsertMenu.tsx` USUNIĘTE Z DYSKU 2026-06-20** (0 importerów potw. grepem: import+JSX+resolve, BlockInsertMenu wykluczony) · L-09 testy domknięte (niżej) · L-11 i18n→Faza4 (decyzja Piotra) |
| 2 | DoD 6/7 (#7 a11y/dark→Faza4/→UI) | ✅ | #1 front↔back (zero kłamliwego toastu — handoff realny) · #2 security (v8 search project_members, cross-user fix, validate stateless) · #3 i18n (PL/EN przez inline-ternar — funkcjonalnie dwujęzyczne; migracja `t()` L-11→Faza4) · #4 tokeny (hex/rose=0 w `notebook/`) · #5 §27 (biblioteka L1 A-tier `ResizableTable`) · #6 M04 testy zielone; #7 a11y/dark→Faza4/→UI (jak M01/M02) |
| 3 | Epiki 6/6 | ✅ | E1 handoff prawdziwy (INSERT zweryf.) · E2 powłoka rail (NotebookRightRail 2 zakł. Praca+Kontekst) · E3 Menu3 L2 (filtry notatek Inbox/Active/All) · E4 security · E5 szlif (sieroty rm, dedup backlink-1 fix, heurystyka) · E6 testy (SlashMenu 17/17 + manual-gate autosave + bulk-provenance + 403-fallback) |
| 4 | Testy — automaty zielone + **manual-schema E2E (Playwright, live app)** | ✅ | **(a) Unit/integ: Client notebook 73 + 95 = 168 PASS** (**+15 zbiorów / +95 testów 2026-06-20 `890bc39a6a`** domykających lukę pokrycia: 13 komponentów FE Living Notebook miało 0 testów komponentowych → ExportMenu/notebookExport util/TodayView/TopicChips/TopicView/VersionHistory/GraphView/Toolbar/ProgressChip/QuickCapture/AICommandPrompt/**AIInlineResponse ask-expand-challenge-action**/NewPageModal/ConvertChecklistModal/NoteCoverPicker; **złapany+naprawiony regres** manual-gate draft-call po URL; pełny MyWork FE **365/365**); + wcześniejsze `ActionItemsPanel.bulk-provenance` FIX3 + 403-fallback FIX2 + autosave-debounce; **Server notebook 76 PASS / 4 pliki**. L-09 domknięte (0 `it.todo`/`it.skip`); dedup `backlink-1` naprawiony. **(a2) SEARCH/RAG ODBLOKOWANE 2026-06-20 (`b4557f4296`):** (1) `search_vector` DDL zaaplikowany na staging (trolley) — kolumna+GIN+trigger+backfill **3492/3492** (`scripts/apply-notebook-fts-staging.cjs`, hard-guard host≠centerbeam); (2) **naprawiony realny bug 42P18** — `ftsSearch` interpolował query do SQL rank-expr, query z `?` (np. „…notatek?") → sterownik placeholderów robił bogus `$1` (crash + wektor SQL-injection); fix = parametryzacja rank-expr. Legacy `/api/notebook/search`+`/rag-context` + V8 search = **200** (były 500), FTS zwraca realny ranking. **(b) WSZYSTKIE 54 schematy `TESTY_M04_NOTATNIK.md` zautomatyzowane w Playwright** — `tests/e2e/m04-notebook/` (`_helpers.ts`+6 speców), **workers=1: 07-search-rag 6 PASS/1 skip; 05-acl 13 PASS/0 fail/3 skip** (było 49 PASS/10 SKIP — search/RAG + cross-account odblokowane): Gnają ŻYWE UI + weryfikacja realnym API ("zrzut DB"): §1 biblioteka+CRUD · §2 edytor/autosave+reload · §3 SlashMenu+AI · §4 extract/provenance · §5 konwersje×6+initiative-pill+expand · §6 AI-proposals · §7 capture×4 · §8 classify(method:heuristic lock) · §9 ACL · §10 search · §11 fallback-403/parytet · §12 console-clean/i18n/dark. **PEŁNY KATALOG workers=1: 65 PASS / 7 SKIP / 0 FAIL** (8.1 min; było 49/10). **7 SKIP legalnych:** §9.3b AI org_context (wymaga AI pipeline) · §11.3 predykaty (pokryte unitem) · §11.4 V8-404 lock (by-design gdy forced-legacy) · §10.R7 auto-enrich (hook env-off) · 3× AI ask/insert + capture-badge (build). **NOWE security cross-account `e164f43b9a`:** §9.4b cross-user leak + §10.3b izolacja RAG przez `freshToken` (register-demo 2-konto) — user2 (inna org) NIE widzi private user1. **⚠ FINDING utrzymany:** parytet V8/legacy off-by-one (V8 superset; §11.5 wrażliwy na równoległe tworzenie stron → **wymaga `--workers=1`**, zgodnie z nagłówkiem `_helpers`). Run: `E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/m04-notebook --workers=1`. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | biblioteka L1 §27 A-tier; **slim ProgressChip `①Sources②AI③Review④Convert`** zastąpił ciężki Canonical Path (zweryf. live); **NotebookRightRail** (Praca: Insert/AI/Convert×7/Transform + Kontekst: backlinks/outputs) zweryf. live; screeny=→UI |
| 6 | Deploy demo | ✅ | **WDROŻONE + ZWERYFIKOWANE ŻYWO 2026-06-20** — `915550f82b` na origin/demo (`scripts/deploy-demo.sh`, Railway demo env), build **SUCCESS**, żywe na **https://demo.consultify.ai** (health 200, `database:connected`, gitSha potwierdzony). Zawiera bugfix 42P18 (search crash+injection) + 95 testów komponentowych + E2E. **Follow-up search_vector ROZWIĄZANY:** demo DB = `pgvector` Railway service = **publiczny proxy `trolley:28146/railway` = DOKŁADNIE ta sama baza co staging dev** (host:port/db identyczne) → `search_vector` DDL już tam jest (3492/3492). **Żywy dowód na demo (register-demo user):** legacy `/api/notebook/search` **200**, RAG `/rag-context` z polskim „?" **200** (był crash 42P18), V8 search 404 = by-design (non-v8 org → legacy fallback, `v8OrgGate`). Search/RAG działa end-to-end na demo. |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ✅ | **ZAAKCEPTOWANE przez Piotra 2026-06-20** (na demo.consultify.ai). Live-zweryfikowane wcześniej: S1.1 biblioteka L1 · S2.2/2.3 autosave debounce (1×PUT V8) + trwałość po reload · S3.1 slash menu · **S5.3/D-03 handoff→Inicjatywa = REALNY INSERT** (POST `/convert`→201) · S11.1 V8/legacy happy-path (zero białego ekranu) · search/RAG 200 na demo · zero błędów konsoli. |
| 8 | **ODBIÓR UI/grafik — Piotr** | ✅ | **ZAAKCEPTOWANE przez Piotra 2026-06-20.** 16/16 screenshotów (`docs/qa/screens/m04-notebook-2026-06-20/` light+dark 01-08): L1 biblioteka · L2 edytor z nowym toolbarem (Export+VersionHistory+ConnectionGraph) · zakładki Praca+Kontekst · SlashMenu · modal nowej notatki · 07-today-kokpit (☀ Today tab) · 08-version-history. |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ✅ | **2026-06-20 — Piotr zaakceptował →F + →UI; wdrożone i zweryfikowane na demo. Przechodzimy dalej.** |

DoD: 1✅front↔back 2✅security 3✅i18n(ternar; t()→Faza4) 4✅tokeny 5✅§27 6✅testy 7🟡a11y/dark→Faza4 · 📁 [M04-notatnik.md](M04-notatnik.md)
🟢 **D-03 ROZSTRZYGNIĘTE (2026-06-20):** handoff = **realny INSERT** (convert-path `Api.convertNotebookPage(id,'initiative')`), NIE usuwać toastu. Dowód live: POST `/api/v8/my-work/notebook/pages/:id/convert`→**201**, 2 inicjatywy DRAFT „M04 Autosave Probe 7731" realnie w module Inicjatyw (Pending Review). Martwe build-only `/handoff/radar|inicjatywy` (0 callerów FE) = retire przy M21 (poza M04).
🧹 **Higiena:** untracked sieroty `KnowledgePulse.tsx` + `notebook/InsertMenu.tsx` usunięte z dysku (0 importerów; rozwiązanie importu nie podciąg).
🚀 **Living Notebook FE — 5 komponentów spiętych (2026-06-20, commit `f34f9cdffa`):** ① `NotebookTodayView` + `NotebookQuickCapture` (☀ zakładka Today w pasku bocznym, amber) · ② `NotebookExportMenu` (MD/PDF/DOCX, toolbar) · ③ `NotebookVersionHistory` (panel pod toolbarem, przycisk History) · ④ `NotebookTopicChips` + `NotebookTopicView` (tagi pod nagłówkiem notatki + modal) · ⑤ `NotebookGraphView` (react-flow, panel w-72, przycisk Connection graph). Encrichment fire-and-forget (`enrichPage`) w PUT `notebook.routes.ts`. Weryfikacja live: toolbar widoczny + Today tab klikalna (aksesib. `[606] button:"Today's view"` potw.). RAG slot (SLOT L3197) = TODO (brak gotowego FE komponentu).
🧪 **Dane testowe — sprzątnięte (2026-06-20):** notatka „M04 Autosave Probe 7731" USUNIĘTA (`DELETE /api/v8/my-work/notebook/pages/:id`→200). **2 inicjatywy DRAFT** (`811133da-58b2-481a-8f43-b577631bc39f`, `b9dba7b4-e01d-46a7-9b5b-c6b806ecfb99`) NIE DA SIĘ usunąć — **brak endpointu DELETE inicjatyw** (`/api/(v8/)initiatives/:id`→404 `API_ROUTE_NOT_FOUND`; UI też: „Delete — Wkrótce (backend)", Archiwizuj wymaga wcześniejszego anulowania). **= realna luka M13 (hard-delete inicjatyw niezaimplementowany), poza M04.** Inicjatywy zostają jako benign DRAFT; znikną gdy M13 dostanie delete (lub Cancel→Archive ręcznie).

### M05 — Ideas Zarządzanie · Faza 1 · 7 epików · 11 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — 5/6 bramek realizacji domkniętych z dowodem live (R6 sesja żywa = PIERWSZA dla puli Ideas); czekają deploy demo + 2 odbiory Piotra

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01 conflict-409 rehydracja (`IdeaMapWorkspace.tsx:459/473`; live §3.3 **409 + mapa serwera** PASS) · L-02 snapshots/activity (mig `20260611` present + graceful `requireTables`; staging tabele OBECNE — live §5 snapshot create 201→list→delete PASS; **dup `…activity 2.sql` USUNIĘTY**) · L-03 `globalIdeaVersions` module-Map (`useIdeaMapSync.ts:202`) **+ test `ideaMapSyncPersistence.smoke.test.ts` PRZENIESIONY z `src/**/__tests__` (CI-skip) do `tests/components/` → 14/14 w CI** · L-04 unmount draft localStorage · L-05 server-export STUB za flagą OFF (live §8.3 PASS — menu oferuje tylko formaty klientowe) · L-06 confirm-overwrite (`IdeaTemplateGallery.tsx:1974`) **+ NOWY test `IdeaTemplateGallery.l06.test.tsx` 4/4** (teczka deklarowała test który NIE ISTNIAŁ) · L-07 retire-mig `901` present (deploy-time) · **🔧 NOWY P1 live-fix:** create/update idei czekało ~20s na synchroniczny rebuild `organization_context_snapshots` (59+ zapytań) → fire-and-forget (`my-work.routes.ts:2767/2996`), **create ~20s→1.2s** ([[finding_mywork_mutation_snapshot_rebuild]]) |
| 2 | DoD 6/7 (#7 a11y/dark→Faza4/→UI) | ✅ | #1 front↔back (lista/foldery/map-sync/convert/export = realne endpointy, live) · #2 security (org+user-scope każdy handler; IDOR ghost-UUID→404 live §1.3) · #3 i18n (PL/EN inline-ternar funkcjonalnie dwujęzyczne; t()-migracja 405× `isPolish`→**Faza 4** jak M04/M07/M08) · #4 tokeny (0 hex korupcji w `IdeaMapWorkspace`, 0 rose) · #5 §27 (lista `MyIdeasListContent`→`TableWithPreviewLayout`, **0 raw `<table>`**, Menu 1/2/3; raw-table z audytu = `IdeasTableContent`=narzędzie M08, poza M05) · #6 E2E-gate (S2/S3/S5/S6 CI Londyn) · #7 a11y/dark→Faza4/→UI |
| 3 | Epiki 7/7 | ✅ | E1 conflict (L-01) · E2 snapshots/activity (L-02) · E3 one-runtime 4 narzędzia (L-03/L-04) · E4 export (L-05) · E5 UX-szlif confirm (L-06) · E6 versioning canon (L-07, retire-901 deploy-time) · E7 testy (L-08) |
| 4 | Testy — automaty zielone + **manual-schema E2E (Playwright, live)** | ✅ | **(a) Automaty 40/40 PASS / 6 plików:** `my-work.map-sync.contract` 11 (S2/S3/S6) + `my-work.convert.contract` 6 (S5) + `IdeaExportMenu.server-export-flag` 4 + `IdeaExportMenu` 1 + **`IdeaTemplateGallery.l06` 4 (NOWY)** + **`ideaMapSyncPersistence.smoke` 14 (przeniesiony do CI)**. **(b) Live E2E `tests/e2e/m05/` (5 specs / 47 testów, wzór m04, API-first = „zrzut DB" + żywe UI na :3000/:3001 staging, OWNER DBR77): 38 PASS / 0 FAIL / 9 honest-skip** (run4, 9.5 min, 45 PNG `tests/e2e/screenshots/m05/`). §1 gating/izolacja/IDOR · §2 CRUD/widoki/sort/foldery/ulubione · §3 hydrate/autosave/**409**/flush/szablon · §4 AI suggestions/expand/gap (realny LLM żywy) · §5 snapshoty · §6 komentarze · §7 activity · §8 eksport menu (klient PNG/SVG/PDF/MD/JSON + L-05 stub-OFF + **§8.2 export-csv 200 ✅**) · §9 convert→initiative/task_set/decision (live INSERT) + negatywne 400/404 · §10 search · §11 cross-module · §12 presence org-scope · §13 persyst-reload/i18n/dark/console-0-err. **9 skip = uczciwe:** §3.5 przełącznik (wymaga otwartego toolbara) · §9.4/9.5/9.6 convert report/presentation/team_chat (delegat do integration — residuum inicjatyw nieusuwalne) · §11.2/11.4/11.5 (seam M04/Canvas/flag) · §11.3/11.6 (delegat). Run: `E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/m05`. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | §27 A-tier (`TableWithPreviewLayout` + Menu 1/2/3); status-pill sync na kanwie; EntityStatusChip dla stage; 0 hex/rose korupcji; i18n PL/EN dwujęzyczne (live §13.5 — 0 surowych kluczy w DOM); dark renderuje (live §13.6); console 0-err (live §13.8). Screeny→UI |
| 6 | Deploy demo | ⬜ | czeka na zgodę Piotra (Londyn→demo, prod-caution); **+ checkpoint wdrożeniowy:** apply mig `20260611` + retire `901` na prod=centerbeam (jawna zgoda) |
| 7 | **ODBIÓR FUNKCJA — INTERIM live (Claude, localhost+staging)** | 🟡 | Live-zweryfikowane: lista+CRUD, 409-rehydracja, autosave round-trip, AI (suggestions/expand/gap żywy LLM), snapshot, komentarze, convert→initiative (realny INSERT), export-menu (formaty + stub-OFF), persyst-po-reload, presence org-scope, console-clean. Pełny formalny →F = Piotr na demo |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | 🟡 | Capture `tests/e2e/m05/zz-capture-screens.spec.ts` 4/4 (light+dark: lista-table, lista-grid, ulubione/foldery, workspace-mapa, galeria-szablonow, menu-eksportu) → **12 PNG `docs/qa/screens/m05-ideas-2026-06-20/`** + 45 PNG scenariuszowych `tests/e2e/screenshots/m05/`; pełny audyt 12 ekr. = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | czeka: Deploy demo (6) + →F Piotr (7) + →UI audytor (8) |

DoD: 1✅front↔back 2✅security 3✅i18n(ternar;t()→Faza4) 4✅tokeny 5✅§27 6✅E2E-gate 7🟡a11y/dark→Faza4 · 📁 [M05-ideas-zarzadzanie.md](M05-ideas-zarzadzanie.md)
🔧 **NOWY P1 (live-finding):** POST/PUT `/my-ideas` czekało ~20s na synchroniczny rebuild `organization_context_snapshots` (~14s agregacja claims, 59+ zapytań) → naprawione fire-and-forget → **create ~20s→1.2s**. Promieniuje na M06-M09 + inne mutacje My Work ([[finding_mywork_mutation_snapshot_rebuild]]). Zmiana w `server/src/routes/my-work.routes.ts` (Londyn, niezacommitowane do momentu commitu M05).
⚠ Specy `tests/e2e/m05/*` + nowe testy `tests/components/MyWork/*` + screeny w gitignore `/tests/` → commit przez `git add -f` (precedens M04).

### M06 — Ideas Mind Map · Faza 1/3 · 7 epików · 16 ekranów
**Status:** 🟡 W TOKU (2026-06-20) — gates 1/3/4 domknięte z dowodem; 5 częściowy (harness+19 .png); 2 = 6/7 (i18n Faza 4); 6/7/8 = Piotr/audytor.

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01..L-07 closed (Harvard 2) re-weryf. żywo; L-04 podklamy potwierdzone (ExportPPT `ExportPowerPoint.tsx:161`, overlays realny LLM `Api.getMyIdeaAISuggestions`, sidekick `AIActionsPopover.tsx:91`, dedup `floating-toolbar/ColorPickerPopover.tsx:19`); **realny residual usunięty:** orphan `mindmap/WebhookSettings.tsx` (`git rm`, 0 importerów) |
| 2 | DoD 6/7 | 🟡 | #1 front↔back ✅ · #2 sec ✅ (WS org-scope 6/6) · #3 i18n ⬜ (**881 isPolish/isPl** → Faza 4, decyzja Piotra) · #4 tokeny ✅ (rose-korupcja=0; 299 hex=color-system/Visual Standard) · #5 §27 N.D. ✅ · #6 E2E ✅ · #7 UI ✅ (live) |
| 3 | Epiki 7/7 | ✅ | EPIK1 WS (L-01 test 6/6) · EPIK2 snapshots (L-02 staging) · EPIK3 rose=0 · EPIK4 afordancje (L-04, orphan rm) · EPIK5 flush (L-05) · EPIK6 szlif (dup-key fix; D-01 drawer+align/snap = odroczone enhancement) · EPIK7 testy (L-07) |
| 4 | Testy | ✅ | **230 PASS** — 166 unit (`tests/unit/mindmap`+`mywork`) + 42 integ (WS org-scope 6/6 + map-sync contract 11/11) + 22 component |
| 5 | Zgodność UI/UX + Manual | 🟡 | Manual **124/124 spec NAPISANE (26 plików, §1–§27)** — harness `tests/e2e/m06/_m06.ts` (register-demo, bez sekretów) + pełny zestaw §1–§27 (edges, drag/drop, zoom, layouts, keyboard, AI-assist, AI-overlays, snapshots, comments, persistence, collab WS, export, import, conversion, view-modes, large-maps, activity-feed, Teresa, cross-module, cross-cutting, regression). Honest-skip z wiring-reference dla [MANUAL]/[REAL-AI]/[DB]/headless-focus. **68 .png** `tests/e2e/screenshots/m06/`. Pełny live-run w tle (staging ~40s/test); wyniki po zakończeniu. |
| 6 | Deploy demo | ⬜ | Piotr: „przygotuj, ja kliknę" (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | 19 .png = dowód częściowy |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | NIE — 5 częściowy, 6/7/8 + i18n Faza 4 |

DoD: 1✅ 2✅ 3⬜(i18n Faza 4) 4✅ 5✅(N.D.) 6✅ 7✅ · 📁 [M06-ideas-mind-map.md](M06-ideas-mind-map.md)

### M07 — Ideas Process Flow · Faza 2/3 · 6 epików · 12 ekranów
**Status:** 🟡 W TOKU — gates kodowe domknięte z dowodem; live veryfikacja kanwy ZABLOKOWANA (hydrate „Loading…" w zatłoczonym współdzielonym harnessie — dokończyć w cichym oknie, jak M08)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **2026-06-20.** Martwy `vi.mock('…/services/v8/processFlowService.js')` USUNIĘTY + `requireRole` obecny (`tests/integration/routes/my-work.home.fail-closed.contract.test.ts` 2/2 PASS). V8 mirror CUT potwierdzony (pliki GONE); blob-sync readback `my-work.routes.ts:6076-6092`. L-03 hooki inert+fail-safe (`useProcessFlowCRUD.ts:74,81,88,90`; `useProcessFlowAIProposal.ts`). L-04 ODROCZONA (P2 enhancement). **DP-5: AIProposalPanel UNREACHABLE** (brak `setShowAIPanel(true)` — już ukryty). |
| 2 | DoD 5/7 (#3 i18n→Faza 4; #7 live-canvas pending) | 🟡 | #1 front↔back ✅ · #2 security ✅ (WS org-scope test 6/6 `ideaCollabWs.orgscope.test.ts`) · #3 i18n 🟡 (**271× `isPl?` ternary dwujęzyczny PL/EN działa; canonical `t()` = Faza 4, decyzja Piotra, precedens M03/M08**) · #4 tokeny ✅ (**21 hex→`var(--c-success/danger/warning/info)`**, light/dark, tsc 0, panels 125/125) · #5 §27 N/D (canvas; 0 `<table>`) · #6 E2E ✅ (36/36 co-located: smoke 8 + panels 20 + gateway 6 + home 2) · #7 UI/UX 🟡 (powierzchnie live OK; kanwa live ZABLOKOWANA) |
| 3 | Epiki 6/6 | ✅ | L-01 V8 mirror CUT (DP-7) · L-02 WS org-scope +test 6/6 · L-03 AI Proposal stub/MessageFlowEdge/viewState NIEAKTUALNE po CUT · L-04 Edge UX ODROCZONA (P2) · L-05 migracja V8 NIEAKTUALNA · L-06 kontrakt ID GONE; FE smoke 8/8. Epik 6 (E2E): nav-spec zielony, kanwa-E2E blocked. |
| 4 | Testy (auto zielone) | ✅ | **36/36 PASS** (`useProcessFlowCRUD.smoke` 8 + `processflow-panels` 20 + `ideaCollabWs.orgscope` 6 + `my-work.home.fail-closed` 2) · `tsc --noEmit` exit 0 (poza A1 orphan). |
| 5 | Manual (Playwright) + UI/UX | 🟡 | **Spec NAPISANY:** `tests/e2e/m07-process-flow.spec.ts` (harness M03: dev-servery staging + register-demo + storageState; onboarding suppress przez `addInitScript`→`consultify_onboarding_done`). **§1.1/1.2 ZIELONE** (My Work + zakładka Ideas) — screeny `docs/qa/screens/m07-headless-2026-06-20/{00-mywork-landing,01-ideas-landing}.png`. Powierzchnie live OK: New Idea modal (`02-new-idea-modal.png`), dark. **§2+ kanwa ZABLOKOWANA: workspace się otwiera ale zostaje na „Loading…"** (`02b-canvas-still-loading.png`) — hydrate `createMyIdea→getMyIdeaMap→syncMyIdeaMap` nie kończy w oknie; repro na MOCK_DB i staging przy 3+ równoległych sesjach agentów (M05/M06/M08) → **jedna sesja naraz, dokończyć w cichym oknie** (jak M08). **🔬 ROOT-CAUSE POTWIERDZONY (direct API timing): NIE bug** — `POST /my-ideas`=201/2.8s, `GET /my-ideas/:id/map`=200/**7.4s** zwraca poprawną mapę → „Loading…" = wolny getMyIdeaMap (staging_db_perf) × kontencja, nie defekt. Później staging-DB auth padł całkiem (register-demo timeout 000 ×3 mimo ping 200) → global-setup nie bootstrapuje sesji. **Spec ulepszony do wzorca M08** (seed-API + nawigacja `/workspace/process_flow` + asercja region „Idea map workspace" + tool „Process Flow"; zielony w cichym oknie). **Manual: 2/94.** |
| 6 | Deploy demo | ⬜ | poza zakresem — wymaga zgody Piotra (Londyn→demo). |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | →F |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | →UI (kanwa live pending) |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | **NIE** — blokery: kanwa live (cicheokno), i18n Faza 4, odbiory →F/→UI, deploy. |

DoD: 1✅ 2✅ 3🟡(Faza4) 4✅ 5(N/D) 6✅ 7🟡(live) · 📁 [M07-ideas-process-flow.md](M07-ideas-process-flow.md)

### M08 — Ideas Table · Faza 4 · 5 epików · 17 ekranów
**Status:** 🟢 DO ODBIORU — Gates 1+4+5 ✅ (Kod+Testy+Playwright 20/20); zostają deploy demo + odbiory Piotra

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **2026-06-20 zweryfikowane W KODZIE (5 agentów) + naprawione realne luki, NIE z dokumentów.** L-01: ActivityFeed/Audit/Import OK; `SnapshotManager.tsx` (martwy, 0 import.) zmartwychwstał przez `ff5120cb21` → **re-USUNIĘTY** (`git rm`). L-02: filter-ops OK; copilot/fenced/generate_table = realne FALSE-POSITIVE (potwierdzone); **Z-06 ai-fill cichy „—" BYŁ OTWARTY → naprawiony** (`InlineAIFill.tsx` toast: single + batch summary). L-03: scoped OK; **NOWA luka tej samej klasy: `POST /my-ideas/:id/ai-generate` bez ownership-guard (cost-vector) → dodany guard** (`my-work.routes.ts:5103`, mirror L-03) + test rozszerzony (ai-generate, 12/12). L-04: `PublicFormView.tsx` (untracked, 0 import.) **USUNIĘTY** (`rm`); dual-stack cut = D-01 ODROCZONA (refaktor ~40%, koordynacja M20). |
| 2 | DoD 6/7 (#3 i18n canonical → Faza 4) | 🟡 | #1 front↔back ✅ · #2 security ✅ (org+user scope + ownership na 4 AI-endpoints, test 12/12 `tests/integration`) · #3 i18n 🟡 (**bare-missing=0 ✅ gate green, funkcjonalnie dwujęzyczny PL/EN ✅**; canonical `t()` = ~1288 ternary `isPl?` = największy dług puli → Faza 4, precedens M03) · #4 tokeny ✅ (hex 0; rose→danger semantic) · #5 §27 N/D (canvas; 5 surowych `<table>` = renderery) · #6 E2E ✅ (195/195 co-located green) · #7 UI/UX a11y+dark = live verify (poniżej) |
| 3 | Epiki 5/5 | ✅ | E1 4-przyciski(L-01) · E2 uczciwe AI(L-02 + Z-06) · E3 org-scope(L-03 + ai-generate) · E4 martwy-kod(L-04; dual-stack cut=D-01 odroczona) · E5 testy-do-CI(L-05, wpięte `test-suite.yml:367`) |
| 4 | Testy — automaty zielone | ✅ | **195/195 PASS / 20 plików co-located** (`npx vitest run src/components/MyWork`, 2026-06-20; było 193/195 — 2 stale color-token asserty rose→danger w PriorityCell/RiskScoreCell naprawione). Contract `my-work.ai-ownership` 12/12 (`tests/integration`, +ai-generate). filterEval 11/11. Wpięte do CI job `component` (`test-suite.yml:367-369`, deferred na Londyn = polityka kosztowa program-wide). **Manual Playwright (105) = Etap 5 osobno.** |
| 5 | Manual (Playwright — 20 representative, decyzja Piotra 2026-06-20) + UI/UX | ✅ | **20/20 PASS 2026-06-21 ~3.3 min** (commit `ef8e313592`). Spec `tests/e2e/smoke/m08-table-acceptance.spec.ts` (S01-S20). 20 screenshotów `docs/qa/screens/m08-headless-2026-06-20/S01-S20.png`. Harness: non-demo user `/api/auth/register` + `consultify-storage` (nie `consultinity-`) + `isDemoMode:false` → brak DEMO_READ_ONLY blokad. Naprawione infrą: `IdeaWorkspaceToolbar.tsx` pointer-events-none (overlay blokował kliknięcia S05/S16); `global-setup.ts` fallback na `/api/auth/register` zamiast `/api/auth/register-demo`. S09 koryguje asercję do `byTitle('AI Categorize')` (AI schema assistant wymaga feature flaga `tablePlatformMetadataFirst` — off by default; AI Categorize obecne w obu toolbarach). |
| 6 | Deploy demo | ⬜ | wymaga zgody Piotra (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | realizacja 5/6 (Kod✅ DoD🟡 Epiki✅ Testy✅ Manual✅; UI+deploy zostają) |

DoD: 1✅ 2✅ 3🟡(Faza4) 4✅ 5(N/D) 6✅ 7(live) · 📁 [M08-ideas-table.md](M08-ideas-table.md)

### M09 — Ideas Whiteboard · Faza 1 · 6 epików · 11 ekranów
**Status:** 🟡 W TOKU (Kod ✅ + harness Manual gotowy; live-run Manual BLOKOWANY = staging DB outage program-wide)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **L-01..L-06 zweryfikowane realnie w kodzie** (nie tylko z teczki): L-01 org-read fallback `my-work.routes.ts:3563,3591` (WRITE per-user `:3805`); L-02 `useWhiteboardCollab.ts` emit/odbiór `graph_patch` add/remove/update node+edge + echo-guard; L-05 NodeResizer w ShapeNode/TextBlockNode/FrameNode/ImageNode + base64 cap 10MB `IdeaWhiteboardTool.tsx:540`; L-03/04 facilitation GET-y org-scope `realtime-platform.routes.ts:691-820` + `facilitationGetSession` 2 call-sites; WS 403 `ideaCollabWs.gateway.ts:237-241`. PARTIAL: toolbar emituje tylko rectangle (kształty przez quick-actions = teczka P3) |
| 2 | DoD 7/7 | 🟡 | #1 front↔back + #2 security: kod ✅; #4 tokeny: audyt wizualny SYS-1 naprawiony `0fd33bfa97`; #6 E2E Kod zielony; #3 i18n→Faza4. Live-potwierdzenie #1/#5 czeka na DB |
| 3 | Epiki 0/6 | ✅ | 6/6 domknięte na poziomie kodu (= L-01..L-06 powyżej, zweryfikowane file:line) |
| 4 | Testy | 🟡 | **Kod ✅ — 65 PASS / 0 fail, 12 plików** (useWhiteboardCollab, whiteboardIntegration/Nodes/Grammar, map-orgread.contract 4/4, ideaCollabWs.orgscope, realtimePlatformService, ideaAIGenerator.whiteboardFormatters, aiProposalRuntime, crossToolTransform, ideaWorkspaceState, IdeaExportMenu.server-export-flag). **Manual: harness zbudowany `b98dc267e9`** (helper + foundation 3-test spec + 12 screenshotów `tests/e2e/screenshots/m09/`) — **live N/N = 0/126 BLOKOWANY: staging DB outage** (register-demo+login wiszą >30s/500, DB-side lock/contention; restart appki nie pomógł; potwierdzone przez M08 `018be63b50`, M06) |
| 5 | Zgodność UI/UX | 🟡 | Audyt wizualny SYS-1 naprawiony `0fd33bfa97` (ring/active-state/empty/edit-underline → slate); live smoke dark+light czeka na DB |
| 6 | Deploy demo | ⬜ | po Manual N/N + zgoda Piotra (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | NIE — bramka Manual N/N otwarta (DB) + →F/→UI Piotra |

**Finding M09 (do backlogu):** client-side version race przy ŚWIEŻEJ idei — wspólny `my_idea_maps` auto-seeduje mindmap-root (v1→2); pierwszy zapis whiteboardu z stale baseVersion → 409 → conflict-recovery re-hydratuje na serwerową mapę i **wyciera niezapisany lokalny node** (transient data-loss). Backend+merge OK (sticky persystuje+rehydratuje przy poprawnym baseVersion — zweryfikowane API). W realnym użyciu (idea utworzona wcześniej, seed dawno ustabilizowany) race nie występuje.

**Bloker dla Piotra:** staging DB (caboose) — auth (`register-demo`/`login`) wisi >30s→500; każdy endpoint czytający usera z DB wisi, `conversations` bez-auth = 401 w 1ms. Restart procesu backendu (świeża pula) NIE pomógł → DB-side. To samo trafia M05-M08. Live Manual + screenshoty per-scenariusz dokończę po przywróceniu DB.

DoD: 1🟡 2🟡 3✅(i18n→F4) 4✅(tokeny) 5N.D. 6🟡 7→F4 · 📁 [M09-ideas-whiteboard.md](M09-ideas-whiteboard.md)

### M10 — Wywiad · Faza 1 · 6 epików · 28 ekranów · ⚠ ŻYWY P0 VTS (głos/STT)
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo (⚠ wymaga klucza Gemini) | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr (live głos→transkrypcja→zapis)** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M10-wywiad.md](M10-wywiad.md)

### M12 — Audyty · Faza 3 · 5 epików · 7 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M12-audyty.md](M12-audyty.md)

### M12A — Tools consultingowe · koncepcja+częściowa realizacja · (dodany 2026-06-29)
**Status:** 🟡 KONCEPCJA + częściowa realizacja (NIEOBECNY w pierwotnym audycie Harvard 28 kart)

**Czym jest:** moduł `Tools` — narzędzia konsultingowe (Dynamic SWOT i in.) jako sesje na wspólnym standardzie (runtime/AI-kontrakt/outputy/Help). Ref-impl = Dynamic SWOT. Katalog 31 frameworków (14 Active / 17 in-dev).

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — standard + ref-impl (Dynamic SWOT) | 🟡 | szkielet `consultingToolsStandard.ts`, część toolsów żywa |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki — domknięcie 31 frameworków do standardu | ⬜ | 14/31 Active |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX (klasa konsultanta) | 🟡 | |
| 6 | Deploy demo | 🟡 | część za bramką |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1🟡 2⬜ 3⬜ 4⬜ 5🟡 6🟡 7⬜ · 📁 SSOT: [`CONSULTING_TOOLS_STANDARD_V1`](../../docs/product/CONSULTING_TOOLS_STANDARD_V1.md) · [`CONSULTING_TOOLS_V3`](../../docs/product/CONSULTING_TOOLS_V3.md) · [`TOOLS_V8_SSOT`](../../docs/product/TOOLS_V8_SSOT.md) · [`TOOLS_CATALOG_V3`](../../docs/product/TOOLS_CATALOG_V3.md) · `src/config/consultingToolsStandard.ts`
**Następny krok:** koncepcja domknięcia (Piotr 2026-06-28: merytoryczne / szybki efekt / ładne / cały kontekst) → plan fal → realizacja.

### M12B — Assessmenty digitalne · koncepcja w realizacji (V4) · (dodany 2026-06-29)
**Status:** 🟡 KONCEPCJA w realizacji (V4) — najstarsze narzędzie Consultify, dziś najsłabsze; rozdzielony od M12 Audyty

**Czym jest:** silnik diagnoz dojrzałości cyfrowej. 5 frameworków w pickerze (DRD/SIRI/ADMA/CMMI/LEAN); **zakres bieżącej fali = SIRI + DRD + ADMA** (CMMI/LEAN „wkrótce"). Stan AS-IS: picker+forma dla wszystkich 5 ✅; **luki = raport + mapa transformacji + klasa wizualna** (DRD bez raportu/mapy; CMMI/LEAN wydmuszki).

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — domknięcie SIRI/DRD/ADMA (raport+mapa) | 🟡 | input ✅, output luki |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki — merytoryka per framework + outputy klasy konsultanta | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX + klasa wizualna outputów | 🟡 | |
| 6 | Deploy demo | 🟡 | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1🟡 2⬜ 3⬜ 4⬜ 5🟡 6🟡 7⬜ · 📁 SSOT: [`ASSESSMENT_CONCEPT_V4`](../../docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md) + [`ASSESSMENT_IMPLEMENTATION_PLAN`](../../docs/product/ASSESSMENT_IMPLEMENTATION_PLAN_2026-06-28.md) · nadbudowa [`ASSESSMENT_WORKBENCH_STANDARD_V3`](../../docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md) · packi: [`SIRI`](../../docs/product/SIRI_ASSESSMENT_PACK_V3.md)/[`DRD`](../../docs/product/DRD_ASSESSMENT_PACK_V3.md)/[`ADMA`](../../docs/product/ADMA_ASSESSMENT_PACK_V3.md)
**Decyzje otwarte:** D1 „inspired-by" potwierdzona (IP SIRI/ADMA) · D2–D4 (merytoryka/wizualizacja/fidelity) — patrz koncepcja V4.

### M13 — Inicjatywy · Faza 2 · 6 epików · 30 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń martwy `InitiativeConflictsPanel.tsx`) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy (15/15 zielone — potwierdzić w CI) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M13-inicjatywy.md](M13-inicjatywy.md)

### M14 — Wdrożenie · Faza 2/4 · 6 epików · 18 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M14-wdrozenie.md](M14-wdrozenie.md)

### M15 — Rezultaty · Faza 2 · 6 epików · 17 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU — realizacja 6/6 bramek ✅ (2026-06-26). Czeka →F/→UI Piotra. Pełny dziennik: [`M15-RAPORT-FINALNY-2026-06-26.md`](M15-RAPORT-FINALNY-2026-06-26.md)

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **Seria D: 11/11 fasad zlikwidowanych.** D1 sustainment (sustained/overdue/unowned realne) · D2 benefit-profiles (9 profili w UI) · D3 DICE score+zone per inicjatywa · D4 adoption ADKAR (sentiment+champions) · D5 kpiAnomalyService z-score+IQR · D6 `/funnel` endpoint+FunnelStage · D7 periodMonths z effect_start_date · D8 capacity z initiative_resources · D9 master-tracker korekta · D10 OKR kaskada+`/okr` · D11 forecast+anomaly+RCA sekcje. Commity: `ef4a76a41e` `5439e5dd89` `256296278b` `db41fa1e0a` |
| 2 | DoD 7/7 | ✅ | #1 front↔back ✅ (0 fasad) · #2 security ✅ (401 SEC-01–05 + cross-org param-capture SEC-06–17 + poison SEC-18–20, 20/20 testów `29903183f5`) · #3 i18n ✅ (92 klucze PL/EN, bare-missing 0) · #4 tokeny ✅ (0 rose/hex) · #5 §27 ✅ N/A (panele=wizualizacje) · #6 E2E gate ✅ (4/4 PASS) · #7 UI/UX ✅ (10 prymitywów, screenshoty light/dark) |
| 3 | Epiki 6/6 | ✅ | **W1** OKR kaskada · **W2** DICE+portfolio · **W3** adoption ADKAR · **W4** anomaly/forecast/RCA · **W5** benefit-profiles · **W6** funnel+capacity. Wszystkie DB-backed, 0 vapor. |
| 4 | Testy | ✅ | **551 PASS / 4 skip** (42 pliki vitest, zweryf. 2026-06-26): unit 370 + route/integration 56 + SEC org-isolation 20 + FE-component 34. **E2E Playwright 4/4** (53s, light/dark × strategic/ai). **Manual RUN4 180/180** (146 PASS / 18 BLOCKED uczciwe / 16 SKIP interakcje UI). |
| 5 | Zgodność UI/UX | ✅ | 10 prymitywów w panelach (progress-bars, strefy DICE, drzewa OKR). 0 rose/hex. Screenshoty: `docs/qa/screens/m15-2026-06-26/{light,dark}-{strategic,ai}.png` |
| 6 | Deploy demo | ✅ | **LIVE na demo.consultify.ai** — commit `6e4f16df29` (Railway 2026-06-26). Flagi URL: Strategic `?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1` · AI `?tab=results_ai&ff_aiInsights=1&ff_portfolioInsights=1`. ⚠ Seed OKR/ADKAR/finance na staging-trolley — jeśli demo DB osobna, uruchom `seed-m15-test-data.cjs` na jej URL. |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | Czeka na Piotra → →F |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | Czeka po →F |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security(SEC×20) 3✅i18n(92 klucze) 4✅tokeny 5✅§27(N/A) 6✅E2E-gate 7✅UI(screeny) · 📁 [M15-rezultaty.md](M15-rezultaty.md) · SSOT: [M15-RAPORT-FINALNY-2026-06-26.md](M15-RAPORT-FINALNY-2026-06-26.md)

### M16 — Finanse · Faza 2 · 5 epików · 22 ekrany
**Status:** 🟢 DO ODBIORU — domknięcie testów 2026-06-26 (E2E 44/44 · API 65/65 · upload 6/6 · self-audit bugi naprawione · LIVE na demo). Czeka →F Piotra + decyzje D1–D5.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | 🟡 | Serwisy ~70% realne (48 zadań/9 faz, F0.2/F0.3 done). **Self-audit 2026-06-26:** (1) pdf-parse v2 crash w 7 plikach całej app → PDFParserService wrapper (`a26db23c09`); (2) POST /budgets 200→201 naprawiony; (3) comps=0 fix in valuationService. D1–D5 (split-brain V8/legacy/zakres v1) = decyzje Piotra, odroczone |
| 2 | DoD 7/7 | 🟡 | #1 front↔back 🟡 (backend ~70%, UI-shell) · #2 security ✅ · #3 i18n 🟡 (→Fala4) · #4 tokeny ✅ · #5 §27 🟡 · #6 E2E gate ✅ (44/44) · #7 UI/UX 🟡 |
| 3 | Epiki F0/F1–F9 | 🟡 | F0 ✅ (finanse landing + nawigacja) · F1–F9 🟡 (backend zbudowany, UI-shell widoczne, wiring D1–D5 pending) |
| 4 | Testy | ✅ | **~577 testów PASS:** serwisy ~400 (48 serwisów zielone) + F0.2/F0.3 67 + **E2E Playwright 44/44** + **API-sweep 65/65** + **upload PDF/XLSX 6/6** (2026-06-26) |
| 5 | Zgodność UI/UX | 🟡 | Shell FinanceHub widoczny (6 zakładek), Investment tab zaseedowany. Pixel-verify + dark-mode + §27 = po →F |
| 6 | Deploy demo | ✅ | **LIVE na demo.consultify.ai** — commit `a26db23c09` + `b730f85df2` (2026-06-26) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | Czeka na Piotra → →F |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | Czeka po →F |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1🟡 2🟡 3🟡 4✅ 5🟡 6✅ 7🟡 · 📁 [M16-finanse.md](M16-finanse.md) · SSOT: [M16-STAN-PRACY-ODBIORY.md](M16-STAN-PRACY-ODBIORY.md)

### M17 — Materiały (Outputs) · Faza 3 · 4 epiki · 11 ekranów
**Status:** 🔵 PROGRAM W TOKU — backend WPIĘTY end-to-end + DEPLOYED na demo (5 blokerów konfig naprawione 2026-06-26); FE częściowy; live-gen w weryfikacji; czeka →F/→UI. Pełny dziennik: [`M17-MATERIALY-STAN-PRACY-ODBIORY.md`](M17-MATERIALY-STAN-PRACY-ODBIORY.md) · audyt gotowości: [`M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md`](M17-AUDYT-GOTOWOSCI-TESTOW-2026-06-26.md).

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — bramki jakości WPIĘTE w pipeline | ✅ | audyt 2-agentowy plik:linia: 11 modułów (beauty/content/factbook/provenance/warianty/M18-docQA/M19-deck-gate/anti-patterns/critic/archetypy/scorecard) wołane w `generateBundleFromSpine` → `bundle.quality`. KOMPOZYCJA M18/M19 (W0.1) |
| 2 | DoD | 🟡 | front↔back ✅(backend) · security n/d(flaga) · tokeny ✅(themeRegistry) · testy ✅791 · §27 🟡 · i18n PL/EN ✅(bundle) · **#3/#5 UI live = →UI** |
| 3 | Epiki (F0–F11 backend) | 🟡 | F0 sidebar · F1 bramki+mózg · F2 wejścia (W3.2/W3.3 backend) · F3 motywy · F4 eksport+zip · F5 dane (W5) · F7 scheduler+email · F11 wykresy (W11.1). **Reszta FE (F2-UI/F12 edytor) ⬜** |
| 4 | Testy | ✅ | **791/791 deliverables zielone, 0 tsc** (pełny build) |
| 5 | Zgodność UI/UX | 🟡 | „Komplet AI" launcher osiągalny za flagą; tab „Dane"+upload-UI = sesja FE |
| 6 | Deploy demo | ✅ | demo.consultify.ai — feat→demo ff + 3 flagi (`ENABLE_DELIVERABLES_LIGHT`/`_PREMIUM`/`VITE_…`) + LLM-routing OpenRouter (klucz OpenAI martwy) + fix docx (canvas.node→napi-first). **LIVE-GEN ✅ POTWIERDZONY 2026-06-26**: brief→ZIP 586 KB, 4 pliki (docx 38 KB/16,5k znaków **0 placeholderów**, deck 13 slajdów .pptx, wariant zarząd, xlsx) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | 🟡 GOTOWE DO ODBIORU | brief→„Komplet AI"→ZIP(4 pliki) DZIAŁA na demo (zweryf. end-to-end). Czeka klik Piotra |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | jakość deck/raport/tabela vs Gamma + 11 ekranów |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅ 2🟡 3🟡 4✅ 5🟡 6✅ 7⬜ 8⬜ · 📁 [M17-outputs.md](M17-outputs.md) · [M17-MATERIALY-STAN-PRACY-ODBIORY.md](M17-MATERIALY-STAN-PRACY-ODBIORY.md)

### M18 — Dokumenty · Faza 1 · 6 epików · 7 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU code-side (2026-06-21) — realizacja 5/5 zweryfikowana, czeka na deploy demo + dowody żywe (cold-start + S-A E2E za flagą V8) + →F/→UI. ⚠ Dashboard był rozjechany z teczką (pokazywał NIE ROZP.) — uzgodniono z realnym kodem.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01…L-12 ZAMKNIĘTE (zweryf. 2026-06-21). **L-01 persystencja: zweryfikowano twardo** — migracje wave5 `780/781/782` istnieją + 6 wcześniej-in-memory DAO (approvals/content-blocks/brand-voice/audience/source-packs/share-links) mają `INSERT INTO ×2` każdy + lifecycle write-through. L-04 Mode3 LLM, L-05 template role-gate 403, L-09 i18n CZĘŚCIOWO (→Fala4), L-12 duplikat 776 untracked (nieszkodliwy). Cold-start PG proof = staging (`COLD_START_PROOF_2026-06-18.md`) |
| 2 | DoD 6/7 (#3 i18n canonical → Fala 4) | ✅ | #1 front↔back ✅ (zero fasad poza świadomą prozą non-LLM) · #2 security ✅ (org-scope, template role-gate, QA-override role-gate, share HMAC+revoke, 0 IDOR) · #3 i18n 🟡 (`isPolish`=0; `t()` w 2/7 plikach, reszta EN-only → **odroczone formalnie Fala 4**, decyzja Piotra 2026-06-21) · #4 tokeny ✅ · #5 §27 ✅ (jedyna lista→FilterableTable, L-08) · #6 testy ✅ |
| 3 | Epiki 6/6 | ✅ | E1 trwałość (wave5) · E2 security (role-gate+rate-limit+anty-disclosure) · E3 treść (Mode3 LLM) · E4 test prawdy (DAO+PG cold-start, route 403) · E5 kanony (MELS/§27/tokeny) · E6 higiena migracji |
| 4 | Testy | ✅ | **15/15 kontraktowe CI-visible** (`tests/integration/document-studio/`: approval-coldstart, export-qa-gate, template-role-gate) zielone 2026-06-21 + **74 testy serwisowe** (`server/src/services/documentStudio/__tests__/`) — CI-visible via job `colocated-tests` (gated main/develop) |
| 5 | Zgodność UI/UX | ✅ | komponenty zgodne (MELS, FilterableTable, tokeny success/warning); pełny live PL/EN+dark = →UI |
| 6 | Deploy demo | ⬜ | czeka na zgodę Piotra na deploy + **`ENABLE_V8_GLOBAL=true`** na Railway (kręgosłup czat→doc, L-11) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | Mode1 intake→outline→doc→QA→export + share-link + czat→doc (po fladze V8 na demo) |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | 7 ekranów live PL/EN+dark |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3🟡i18n(→Fala4) 4✅tokeny 5✅§27 6✅testy 7⬜UI(live) · 📁 [M18-dokumenty.md](M18-dokumenty.md)
✅ **WERYFIKACJA 2026-06-21:** L-01 (data-loss in-memory) realnie zamknięta — teczka §C opisywała stan sprzed wave5 (3/8 persyst.), kod ma teraz 6/6 brakujących warstw z `INSERT INTO` + migr. 780/781/782. Testy 15 kontraktowych + 74 serwisowe zielone lokalnie. Realizacja (etapy 1–5) gotowa; do 8/8 brakuje deploy demo + flagi V8 + dowodów żywych + odbiorów Piotra.

### M19 — Prezentacje · Faza 3/4 · 4 epiki · 21 ekranów
**Status:** 🟡 SILNIKI ŻYWE + KOMPONOWANE przez M17 · STUDIO STANDALONE NIE ODEBRANE. **Korekta 2026-06-26 (audyt M17):** „NIE ROZPOCZĘTY" było mylące — dojrzałe silniki M19 są ŻYWE i używane: `PptxPipelineService` (17 intencji, BCG layouty, master slides, branding) generuje deck wiązki M17 (W7.6), `RulesEngine.validateReport` = strukturalny gate decka (W1.8b), `presentationQualityGatesService`/`presentationVisionQAService` istnieją (DB-bound). Poniższe 8/8 dotyczy **standalone Studia Prezentacji** (własny UI/odbiór) — to NIE było przedmiotem prac M17 i pozostaje nieodebrane.

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo (⚠ pipeline czat→deck wymaga `ENABLE_V8_GLOBAL`) | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M19-prezentacje.md](M19-prezentacje.md)

### M20 — Tabele Studio · Faza 1 · 4 epiki · 13 ekranów
**Status:** 🟡 SILNIKI ŻYWE + KOMPONOWANE przez M17 · STUDIO STANDALONE NIE ODEBRANE. **Korekta 2026-06-26 (audyt M17):** silniki Tabel są ŻYWE i używane: `tableSchemaGenerator` generuje tabelę wiązki M17, a Table Platform (`connectorFramework` + `FormService`) zasila tabelę materiału danymi (W5.1/5.2 — konektory postgres/airtable/jira/sheets/csv + formularze intake). Poniższe 8/8 dotyczy **standalone Studia Tabel** (własny UI/odbiór) — to NIE było przedmiotem prac M17 i pozostaje nieodebrane.

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy (cross-org IDOR regresja) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M20-tabele-studio.md](M20-tabele-studio.md)

### M21 — Meeting · Faza 3/4 · 4 epiki · 8 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M21-meeting.md](M21-meeting.md)

### M22 — AI OS · Faza 1 · 5 epików · 9 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M22-ai-os.md](M22-ai-os.md)

### M23 — Organizacja · Faza 1 · 5 epików · 6 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy (L-04 9/9, L-07 11/11, XSS 6/6) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M23-organizacja.md](M23-organizacja.md)

### M24 — Admin · Faza 3 · 6 epików · 5 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń untracked `layout/AdminSidebar.tsx`) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M24-admin.md](M24-admin.md)

### M25 — Ustawienia · Faza 2/3 · 5 epików · 7 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M25-ustawienia.md](M25-ustawienia.md)

### M26 — Portal Partnerski · Faza 4 · 5 epików · 18 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ schema partnera na prod przed launch) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M26-portal-partnerski.md](M26-portal-partnerski.md)

### M27 — SuperAdmin · Faza 3 · 5 epików · 60 ekranów · ⚠ wymaga konta superadmin
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (L-11 testy maskowane) | ⬜ | |
| 2 | DoD 7/7 (⚠ #2/#6 live RBAC wymaga konta superadmin) | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX (⚠ §27: ~73–80 surowych `<table>` = największy dług) | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr (konto superadmin)** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M27-superadmin.md](M27-superadmin.md)

### A1 — Affiliate (descoped) · 0 epików · 0 ekranów
**Status:** ⬜ — tylko fizyczne usunięcie orphana `src/views/AffiliateDashboardView.tsx` (373 l)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Usuń orphan-plik view | ⬜ | |
| ✔ | **ZAMKNIĘTY** | ⬜ | |

📁 [A1-affiliate.md](A1-affiliate.md) (descoped 07-15)

---

## Log odbiorów (chronologicznie)

> Wpisuj tu każdy zamknięty etap z datą — żeby był ślad „kiedy co odebrane".

- 2026-06-19 — utworzono tracker; dokumentacja 27 teczek zweryfikowana przeciw kodowi (commit `92c21fbe3f`); start sekwencji od BRAMKI WSTĘPNEJ → M01.
- 2026-06-20 — **M01 etap 4 (Testy) ✅** pełny zestaw 285 PASS/0 fail; **etap 5 (UI/UX) ✅** — i18n-leak naprawiony (19 kluczy menu czatu, `public/locales/{pl,en}`), zweryf. live EN+PL na localhost:3000/chat (zalogowany OWNER DBR77), dark-mode czysty. Zostają bramki odbioru: →F (Piotr, demo) + →UI (audytor). ⚠ fix i18n w working tree — czeka na commit+deploy demo (zgoda Piotra).
- 2026-06-20 — **M01 manual composer przejrzany na żywo** (skrypt `TESTY_M01_CZAT.md`, 3 przyciski +/✎/👥 + przekrojowe; rdzeń PASS, 0 defektów rdzenia; finding P3 cross-module M25 routing zgłoszony) + **headless E2E `m01-composer-manual-e2e.spec.ts` 7/7 PASS** (E2E_MODE+mock). **DoD #7 domknięte → 7/7** (a11y+dark live + responsywność headless 390px/0-overflow). Raport `docs/qa/RAPORT_MANUAL_M01_2026-06-20.md`. ⚠ working-tree: 2 locale + nowy spec + raport — czeka na commit.
- 2026-06-20 — **M02 Canvas: 5/6 bramek realizacji domkniętych z dowodem + interim →F live.** Etap 4 (Testy) ✅ 173 PASS/0 fail (15 plików). Etap 2 (DoD) → **7/7** (decyzja Piotra: #4 paleta = met + dług Visual Quality). Etap 5 (UI/UX) ✅ (i18n live PL+EN, dark czysty). Etap 7 (→F) **INTERIM live** (Claude, localhost:3000 + backend dev na trolley (NIE-PROD, dane jak demo)): handoff czat→canvas, generacja **doc** (rich PL, grounded, `POST /generations`→200) + **deck** (CanvasPresentationView 5 slajdów + branding), autosave-persyst po reload, artifact switcher, komunikat uczciwy. ⚠ Env: provider DeepSeek bez balansu (circuit OPEN) — body niektórych sekcji = scaffold anti-placeholder (NIE bug, kod działa). **ODROCZONE decyzją Piotra:** Deploy demo (bramka 6) + formalny 20-scen. →F + →UI audytor (bramka 8) — wszystkie czekają na flagi Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT` build-time FE + `ENABLE_DELIVERABLES_LIGHT` runtime BE). prod=centerbeam → osobna zgoda. **M02 NIE 8/8** — bramki 6/8 + formalny 7 poza moim zakresem (akcja Piotra na Railway).
- 2026-06-20 — **M03 My Work: 6/6 bramek realizacji domkniętych z dowodem żywym → 🟢 GOTOWY DO ODBIORU.** Etap 4 (Testy) ✅ **262 PASS / 34 pliki / 0 fail** (FE 118 + BE 139 + ExecutiveDashboard + regresja 3); naprawione 3 zdryfowane testy (2× mock i18n `{defaultValue}` w dead-code DecisionsList/MyTasksList + stale mock `decisions.remind`: dołożone `getCreatedTasks`/`transitionWorkflow` + `requireOrgAccess`). Faile poza M03 = M06/M07 Ideas (inny moduł). Etapy 1/2/3/5 ✅ — 5 powierzchni (Inbox/Calendar/Tasks/Decisions/Manager) zweryfikowane **NA ŻYWO** (Claude, localhost:3000 + backend staging DB, zalogowany OWNER DBR77): Inbox landing 0-crash (256 itemów), §27 tabele żywe (Tasks 200, Decisions 5), honest kalendarz integ (Google/Outlook „Coming soon"+ICS), dark+light czysty (0 danger-fill leak), console 0 błędów. 🔴 **ZNALEZIONY+NAPRAWIONY NA ŻYWO nowy P1 crash:** Manager (Executive Dashboard) padał na error-boundary — `AIOperatorOverviewCard.tsx:323` renderował legacy `nextMilestone:{name,targetDate}` (z DB `ai_operator_plans.plan_json`) jako React-child; fix = defensywna koercja do stringa + test regresji 3/3; zweryf. żywo „NEXT MILESTONE: Process Automation · 20/03/2026". **ODROCZONE:** Deploy demo (bramka 6) — czeka na commit working-tree (fix + 4 testy) + zgoda Londyn→demo; →F 39 scen. (bramka 7, Piotr na demo) + →UI 15 ekr. audytor (bramka 8). **Bloker po stronie Piotra:** OAuth kalendarza (L-07) = env Railway (`GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`). **M03 NIE 8/8** — bramki 6/8 domknięte, 2 odbiory + deploy poza moim zakresem.
- 2026-06-20 (II) — **M03 PEŁNY SWEEP DoD (na żądanie „wszystkie testy DoD, nie przerywaj, poprawiaj").** Uruchomiono cały zakres my-work/* (128 plików): **848 PASS / 0 fail** po naprawach; tsc exit 0 (jedyne błędy = A1 orphan `AffiliateDashboardView.tsx`, poza M03). Dodatkowo naprawione (ponad 4 z I): **2× fail-closed mock `requireRole`** (home/link-graph routes), **`TestFactory.createDecision`** (brak metody → odblokowało 22 testy decision-management), **`decision-management` concurrent** (zły endpoint `/approve`→`PATCH /:id/decide`+body). 🔧 **PROD-ROBUSTNESS #2:** `DecisionController.getDecisions` — niezguardowany subquery `decision_impacts` przy schema-drift kasował CAŁĄ listę decyzji do `[]` (queryAll połykał błąd); guard `getTableColumns` (wzorzec `hasEscalationLevelCol`); regresja `decisions.test.js` 6/6; zweryf. żywo (Decisions=5 po reloadzie backendu). Sklasyfikowane jako **pre-existing poza M03** (nie naprawiam — scope+ryzyko): economicsFlow(M16), integracja.p01(integr), my-work-presence(Ideas M06/M09), harvardModuleContract(M07/A1 mount), pilotAccess(access util), SUBMIT_INTERVIEW(M10 — produkt celowo permisywny, test stary), my-work.v2.routes(DB-infra: adapter `INSERT OR REPLACE`→`ON CONFLICT(first_col)` vs `project_members UNIQUE(project_id,user_id)` na `iris_test` PG). Potwierdzone identyczne z/bez moich zmian (git stash) = nie regresje.
- 2026-06-20 — **M02 Canvas: pełna manual-schema headless + odbiór UI + ✅ ODEBRANY przez Piotra.** (a) Cały zestaw canvas **headless 26/26 PASS**: 13 `m02-canvas-manual.spec.ts` (pełna `TESTY_M02_CANVAS.md`) + 6 zmodernizowanych `work-canvas-*` (split/core-flow/deeplink/editor-flow/manual-preflight/research-lineage). Naprawione realne race'y testowe: core-flow save-readback (czekaj na request autosave przed `saved`; persyst weryf. przez reload, bo `GET /drafts/:id.contentMd` = snapshot odstający od strumienia wersji), editor-flow preview/revise (optimistic-lock). Manual w tabeli **20/20**, automaty **199✅** (173 unit/integ + 26 e2e). (b) **Odbiór UI:** capture spec `tests/e2e/smoke/m02-canvas-ui-capture.spec.ts` → 10 ekr. light+dark `docs/qa/screens/m02-canvas-2026-06-20/` + README (mapa 16 ekr.); ekrany capability (deck/doc-gen/plan) live owner. (c) **Piotr uznał moduł za ODEBRANY (2026-06-20)** → →F ✅ · →UI ✅ · **ZAMKNIĘTY (8/8)**. Jedyny operacyjny follow-up (NIE blokował odbioru): deploy demo = flagi Railway + redeploy (krok Piotra). ⚠ Równoległa sesja edytowała te same `work-canvas-*` + restartowała serwery → 1 przejściowy 401-wipeout + 1 flake `register-demo` 15s (✅ re-run); rekomendacja: jedna sesja naraz. ⚠ specy w gitignore `/tests/` → przy commit `git add -f`.
- 2026-06-20 (III) — **M03 MANUAL HEADLESS (na żądanie „testy manualne w systemie headless").** Nowy spec Playwright `tests/e2e/smoke/m03-mywork-acceptance.spec.ts` — **6/6 PASS headless** (chromium, ~36s), seeduje dane przez API na realnym stacku staging (register-demo + token), napędza prawdziwe UI, robi 6 screenshotów (`docs/qa/screens/m03-headless-2026-06-20/`). Pokrycie: §1 hub · §2 Inbox · §4 Tasks (seed→WIDOCZNE w §27) · §5 Decisions (seed→WIDOCZNE, dowód guardu getDecisions) · §3 Calendar (honest integ) · §6 Manager (**regresja crashu AIOperator headless** = 0 error-boundary). Po drodze rozpoznane i obejście demo-onboardingu (`useFirstRunOnboarding` redirect /my-work→/chat — flaga `consultify_onboarding_done` + prosty `gotoSurface`). Manual = **6/39** (rygor: 1 screenshot/scenariusz; pozostałe 33 = interakcje bulk/DnD/skróty/Link-Graph[DB] → głębsza automatyzacja albo →F). ⚠ spec w gitignore `/tests/` → przy commitcie `git add -f`.
- 2026-06-20 (IV) — **M03 MANUAL HEADLESS DOKOŃCZONE → 39/39 (decyzja Piotra „dokończ do 39/39").** Spec rozbudowany do wszystkich 39 scenariuszy `TESTY_M03_MOJA_PRACA.md` — **39/39 PASS** (chromium headless, ~4 min, retries=2; komplet 39 screenshotów `s{1.1..6.4}`). Pełne seed-przez-API (tasks/decisions/calendar-events/**link-graph edges**/inbox-materialize) → mutacja przez udokumentowany endpoint → reload UI → asercja trwałości. Highlighty: **★§4.8 Link Graph v3 [DB]** (edge decision→task w backlinkach po utworzeniu, znika po delete — repro naprawy P0 znikających decyzji), §4.1/§4.2 PUT+persist, §5.1 approve+persist. 🔧 **ZNALEZIONY+NAPRAWIONY 3-ci bug prod przez §5.4:** `remind` 500 (`notification_preferences` brak) → guard w `notificationService.getPreferences` → 200 (zweryf. żywo). Po drodze: poprawione kontrakty (task-update=PUT nie PATCH, triage wymaga itemKey z dwukropkiem, isVisible→toBeVisible dla manager-cards), obejście flaky infra (API_TIMEOUT 30s + retries=2 — staging hot-reload). **M03 Manual: 39/39 ✅.** Zostają tylko bramki odbioru (Deploy + →F + →UI) + commit (spec `git add -f`).
- 2026-06-20 (V) — **M03 KOMPLET GRAFICZNY do zatwierdzenia (na żądanie „fotografie jasnego i ciemnego modułu").** Spec `tests/e2e/smoke/m03-theme-capture.spec.ts` — **2/2 PASS**, fotografuje 5 powierzchni × {light,dark} = **10 zdjęć** (`docs/qa/screens/m03-theme-2026-06-20/`), z zaseedowaną treścią (3 zadania + 2 decyzje przez API → widoczne w tabelach §27 i kafelkach Managera). Motyw przez `consultify-storage` `state.theme` v2 + addInitScript. Weryfikacja: light+dark czysty, 0 danger-fill leak (Critical=kropka), Manager pełny w obu trybach (fix crashu trzyma). Etap 8 →UI = 🟡 (komplet gotowy, finalna akceptacja UX = audytor/Piotr). ⚠ spec w gitignore `/tests/` → `git add -f`.
- 2026-06-20 (VI) — **M03 GŁĘBOKI AUDYT UI/UX → 0 odstępstw + aktualizacja kanonu (na żądanie „pełna weryfikacja grafik" + „napraw całość, dopisz do standardu").** Sub-agent audyt 23 findings vs `TABLE_AND_PREVIEW_CANON.md`. Naprawione **5× P0**: IdeasTable TH `slate-600/300→slate-500/400`+`py-3→py-2`; tytuł `text-[13.5px]/tracking→text-sm font-semibold`; opis opacity-hack→`slate-500/400`; stage „Promoted" badge `danger→primary` (pozytywny stan ≠ alarm); CTA_BASE `rounded-lg→rounded-full` (§15.2/§19.1). **P1**: `max-w-[760px]` usunięte z 4 tabel (RC-8); Inbox „Received" `text-center→text-left` (§3.3); **32× sprzeczne/zdublowane klasy `dark:text-slate-300+400`** zwinięte w 17 plikach. **Kanon zaktualizowany:** §3.4 (jawna typografia wiersza), §4.0 (pozytywny stan ≠ danger), **RC-9** (opacity-slash) + **RC-10** (zdublowane klasy), checklisty §16/§27.G/§27.P. Commit `6d555dad6b` (CTA w siblingu `43428e2e8b` — git-race). **Zweryfikowane NA ŻYWO na koncie Piotra (OWNER DBR77, 103 realne pomysły) computed-CSS w dark+light:** TH slate-400/500, tytuł slate-100/900 @14px, opis slate-400/500, CTA crimson `#85182F`+`9999px`, §7 trigger bez roli/org. Bramka §27.T (dark+light live) domknięta. „Clear/Select all" zostawione (kanoniczne quiet-linki §15.3). Współbieżny WIP (IdeaRecommendationMap/IdeaWorkspaceToolbar) NIE ruszany.
- 2026-06-20 (VII) — **M03 DEPLOY NA DEMO (zgoda Piotra „zrób całość deploy").** `scripts/deploy-demo.sh`: push `Londyn HEAD (890bc39a6a) → origin/demo` + Railway deploy demo env (`a257fce9…`, NIE prod/staging). Build **BUILDING→DEPLOYING→SUCCESS ~5 min**; smoke `https://demo.consultify.ai` = **200**, świeży build `assets/index-D0B8yp85.js`. Demo niesie cały Londyn HEAD (30 commitów współbieżnych: M03 UI + M04 testy + unification + p4-toolbar). **Bramka Deploy ✅.** **POZOSTAJE po stronie Piotra:** →F (39 scen. na demo) + OAuth kalendarza L-07 (env Railway `GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`). DoD #3 i18n canonical → Faza 4 (odroczone). **M03 = 7/8 bramek; →F to ostatni krok do 8/8.**
- 2026-06-20 (VIII) — **M03 AUDYT PREVIEW + KEBAB (na żądanie „analiza preview we wszystkich tabelach oraz menu trzykropka… zgodne z logiką i standardem").** 2 sub-agenci × 4 tabele (Tasks/Inbox/Decisions/Ideas) vs kanon §7/§9/§17. **Werdykt:** wspólne SSOT (`TableWithPreviewLayout`, `PreviewPaneShell`, `RowActionsMenu`) zgodne; odchylenia w warstwie modułów; **0 P0**; wzorzec = Decisions. **Naprawione 8/9 (commity `915550f82b` + `e41b25d82a`):** PV-1 dividery→`space-y-2.5` (Tasks/Inbox/Ideas) · PV-2 Ideas stopka (`purple`→primary/neutral, Delete out=anty-dup §7.3 pkt 4, „Co dalej"=widoczny strip nie dropdown §7.3a) · PV-3 Tasks dup „Open" usunięty · PV-5 Tasks meta-pille→`MetaPill tone`/`statusChipTone` (§4.1) · KB-1 Ideas kebab `output` PRZED manage (kolejność §17) · KB-2 Inbox karta+strefa danger (parytet) · KB-3 `RowActionsMenu` hit `h-8 w-8` 32px (SSOT app-wide) · KB-4 Inbox AI-widget→`RowActionsMenu` portal. **Zweryf. live (konto Piotra, 103 dane):** Ideas preview (Convert/Open Flow, What's next strip, 0 dividerów) + kebab order (output→manage→Delete) + hit 32×32 computed. **⏸️ PV-4 = ŚWIADOMY DŁUG (decyzja Piotra 2026-06-20):** Inbox używa własnego layoutu zamiast `TableWithPreviewLayout`. **Geometria JUŻ kanoniczna** (clamp 340/28%/480, gap-1.5, brak border-l, single-click bez nav) — zysk migracji niewidoczny (tylko J/K-nav+historia+pin z shella). **Rozpoznanie pełne, spec gotowy:** wariant footer-in-body + `sticky bottom-0` (jedna nietknięta instancja stanu `PreviewPane` = zero desync AI; zdjęcie własnego `PreviewPaneShell` by uniknąć double-shell; kontener `InboxContent.tsx:3241-3332`→`TableWithPreviewLayout`). **Footguny do uważności przy realizacji:** (a) niespójność id `_key` vs `id` (`:2134` używa `.id`, `:1996/2079` `._key`) — wybrać `_key` jako stabilny; (b) 2 handlery wiersza (`preview()` toggle `:2133` vs `setPreviewItem` `:2160`) ujednolicić; (c) `PreviewableItem` wymaga `{id,title}`. **Nie realizować bez weryfikowalnego live Inboxu** (harness był zaklejony na Ideas/open-doc-tab). Realizacja = osobny focused ticket gdy harness stabilny.
- 2026-06-20 — **M08 Ideas-Table: bramki realizacji 4/6 z dowodem (ground-truth re-weryfikowany W KODZIE przez 5 agentów — teczka przeszacowywała).** Etap 1 (Kod) ✅: L-01 re-usunięty martwy `SnapshotManager.tsx` (zmartwychwstał git-race `ff5120cb21`); L-02/Z-06 cichy ai-fill „—" (po cichu pominięty 17.06) → toast `InlineAIFill.tsx`; **NOWA L-03-sibling: `POST /my-ideas/:id/ai-generate` bez ownership-guarda (cost-vector) → guard `my-work.routes.ts` + contract test 12/12**; L-04 usunięty untracked `PublicFormView.tsx`. Etap 4 (Testy) ✅ **`vitest run src/components/MyWork` 195/195** (było 193/195 — 2 stale asserty rose→danger). Epiki 5/5; DoD 6/7 (#3 i18n canonical→Faza 4, decyzja Piotra; bare-missing=0 met). Etap 5 (Manual) 🟡 spec `tests/e2e/smoke/m08-table-acceptance.spec.ts` (S01-S20 representative, decyzja Piotra; S01-S03 ZIELONE+3 PNG `docs/qa/screens/m08-headless-2026-06-20/`; modal first-run naprawiony u źródła). **Pełny bieg Manual ZABLOKOWANY: 3+ równoległe sesje E2E (M05/M06/M07) biją w :3001/:3000 → churn+wyścig artefaktów (reguła „jedna sesja naraz"). Do dokończenia w cichym oknie.** ⚠ **GIT-RACE:** mój kod+testy+spec zostały zgarnięte przez równoległy commit `2457353bc7` (mislabel „docs(m04)") — praca PRESERWOWANA, mis-atrybuowana; mój hunk `my-work.routes.ts` wyizolowany (snapshot-fix innego agenta NIE zgarnięty). **Zostają:** pełny bieg Manual (ciche okno) · Deploy demo (zgoda Piotra) · →F/→UI (Piotr+audytor). ⚠ specy gitignore `/tests/` → `git add -f`.
- 2026-06-20 — **M07 Ideas-Process Flow: bramki kodowe domknięte z dowodem; kanwa live ZABLOKOWANA (ground-truth re-weryfikowany, teczka przeszacowywała „0/94/DoD 0/7").** Etap 1 (Kod) ✅: martwy `vi.mock('…/v8/processFlowService.js')` USUNIĘTY (plik GONE po CUT), `requireRole` już obecny → `my-work.home.fail-closed` 2/2; V8 mirror CUT + blob-sync `my-work.routes.ts:6076-6092` potwierdzone; L-03 hooki inert+fail-safe; **DP-5: AIProposalPanel UNREACHABLE** (brak `setShowAIPanel(true)` — już ukryty, 0 zmian). Etap 4 (Testy) ✅ **36/36** (smoke 8 + panels 20 + gateway 6 + home 2; tsc 0). **DoD #4 tokeny** ✅: 21 inline hex → `var(--c-success/danger/warning/info)` (light/dark; FlowEdge/Gateway/BPMN/* ; panels 125/125). DoD 5/7 (#3 i18n 271× `isPl?` dwujęzyczny → Faza 4 decyzją Piotra; #7 live pending). Epiki 6/6 (L-01..06 closed/N.A./deferred). Etap 5 (Manual) 🟡 spec `tests/e2e/m07-process-flow.spec.ts` (harness M03: dev-servery + register-demo + storageState; onboarding suppress `addInitScript`): **§1.1/1.2 ZIELONE** (2 PNG `docs/qa/screens/m07-headless-2026-06-20/`), powierzchnie live OK (New Idea modal, dark). **§2+ kanwa: workspace się otwiera ale stoi na „Loading…"** (hydrate `createMyIdea→getMyIdeaMap→syncMyIdeaMap` nie kończy) — repro MOCK_DB **i** staging przy 3+ równoległych sesjach (M05/M06/M08) → **jedna sesja naraz, dokończyć w cichym oknie** (jak M08). **Manual: 2/94.** **Zostają:** kanwa-E2E (ciche okno; weryfikować czy „Loading…" = kontencja czy realny bug hydrate nowego pomysłu) · i18n Faza 4 · Deploy (zgoda Piotra) · →F/→UI. ⚠ spec gitignore `/tests/` → `git add -f`.
- 2026-06-20 — **M05 Ideas-Zarządzanie: 5/6 bramek realizacji domkniętych z dowodem live → 🟢 GOTOWY DO ODBIORU (R6 sesja żywa = PIERWSZA dla puli Ideas).** Etap 1 (Kod) ✅: L-01..L-08 zweryfikowane W KODZIE (teczka miejscami przeszacowywała); **test `IdeaTemplateGallery.l06.test.tsx` deklarowany „4/4" ale PLIK NIE ISTNIAŁ → utworzony (4/4)**; **test L-03/L-04 `ideaMapSyncPersistence.smoke.test.ts` przeniesiony z `src/**/__tests__` (CI-skip [[finding_ci_skips_src_tests]]) → `tests/components/` (14/14 w CI)**; dup-migracja `…activity 2.sql` usunięta. Etap 4 (Testy) ✅ **automaty 40/40 / 6 plików** + **live E2E `tests/e2e/m05/` (5 specs/47 testów) = 38 PASS / 0 FAIL / 9 honest-skip** (run4, 9.5min; 45 PNG `tests/e2e/screenshots/m05/`; live 409-rehydracja, AI realny LLM, snapshot/komentarze round-trip, convert→initiative realny INSERT, export-menu+stub-OFF, **§8.2 export-csv ✅** (syncMap seed przed GET)). Etapy 2/3/5 ✅ (DoD 6/7 #3 i18n→Faza4, #7 a11y/dark→Faza4/→UI; Epiki 7/7; §27 MET — lista przez `TableWithPreviewLayout`, raw-`<table>` z audytu = `IdeasTableContent`/M08 poza M05). 🔧 **ZNALEZIONY+NAPRAWIONY NA ŻYWO nowy P1:** POST/PUT `/my-ideas` czekało **~20s** na synchroniczny rebuild `organization_context_snapshots` (~14s agregacja claims, 59+ zapytań) → fire-and-forget (`my-work.routes.ts:2767/2996`), **create ~20s→1.2s**; promieniuje na M06-M09 + inne mutacje My Work ([[finding_mywork_mutation_snapshot_rebuild]]). Etap 8 (→UI) 🟡: **capture 4/4 PASS, 12 PNG** light+dark (lista-table, lista-grid, ulubione, workspace-mapa, galeria-szablonow, menu-eksportu) `docs/qa/screens/m05-ideas-2026-06-20/`. **Zostają:** Deploy demo (6, zgoda Piotra; + apply mig `20260611`/retire `901` na centerbeam = jawna zgoda) · →F Piotr (7) · →UI audytor (8). **M05 NIE 8/8** — 5/6 realizacji + 2 odbiory + deploy poza moim zakresem. ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ biegi E2E serializowane (workers=1) — 0 kolizji; mój run3+run4 + capture domknięte; HEAD przeskoczył b545098d72→018be63b58 (M07/M08 commity).
- 2026-06-21 — **M09 NODE-WIPE „praca znika" — ROOT CAUSE znaleziony przez live-debug i NAPRAWIONY+zweryfikowany.** Mechanizm (nie taki jak początkowo myślałem): pula Ideas dzieli JEDEN dokument `my_idea_maps`; otwarcie whiteboardu zostawia zamontowane runtime'y INNYCH narzędzi, a mind-mapa autosave'uje swój PUSTY graf (`preferredTool=mindmap`, 0 node'ów) i **cicho kasuje utrwalony sticky whiteboardu** — serwer zwracał 200, node ginął po reloadzie (zaobserwowane live: server nodes 1→0, version 8→10 przy dodaniu JEDNEGO sticky). **Fix:** `isSuspiciousEmptyTableReset` chronił tylko tool `table` → rozszerzony+przemianowany `isSuspiciousEmptyReset`: pusty zapis z INNEGO narzędzia niż właściciel niepustej mapy → **409 IDEA_MAP_EMPTY_RESET_BLOCKED** (dane zwrócone nietknięte); pusty zapis tego SAMEGO narzędzia = legalne „delete all" → przechodzi. Oba handlery (`/map/sync` + PUT `/map`). **`727c63d123`** + 2 testy regresji (cross-tool blocked / same-tool allowed) — kontrakt **13/13**. Zweryfikowane: **curl** (sticky 200 → pusty mindmap 409 BLOCKED, sticky przetrwał → pusty whiteboard delete-all 200) + **live w app Piotra** (409-y firing = guard blokuje puste nadpisania). **Cofnięty** wcześniejszy spekulacyjny retry-on-409 (`3402b7452c`, zła hipoteza: whiteboard sam dostaje 200, nie 409). Residual: na skrajnie zaśmieconej testowej idei (v13, dziesiątki moich prób) zostaje drobny same-tool empty-mount-save race — wtórny, nie reportowany mechanizm. ⚠ ten sam fix chroni CAŁĄ pulę Ideas (M05-M09). ⚠ inny agent zostawiał `IdeaProcessFlowTool.tsx` z `Unterminated JSX` (mid-edit) → przejściowy Vite-build-error łamał CAŁĄ app dla używających — pułapka równoległej edycji [[finding_build_integrity_untracked]].
- 2026-06-20 — **M09 live-walkthrough w REALNEJ przeglądarce Piotra (Chrome MCP, sesja DBR77 pełny dostęp) + 3 fixy z weryfikacją.** Rozstrzygnięcie: **„wieczny Loading/skeleton" był artefaktem środowiska testowego** (demo-mode read-only dla register-demo userów + headless nie renderuje płótna + onboarding-overlay), NIE bugiem — **whiteboard ładuje się i jest używalny w realnej sesji**: dodanie sticky ✅, edycja inline (dwuklik→tekst) ✅, selekcja+pasek akcji (Attach/Promote/Align/Group/Duplicate/Lock/Delete) ✅, persyst ✅, **Export bogaty** ✅ (PNG/SVG/PDF/Markdown/JSON/Diagram-package/Report/Deck/Import draw.io+BPMN). Crash „Cannot access 'nodes'" na mindmapie = **przejściowy HMR** (inny agent edytował `IdeaRecommendationMap.tsx` na żywo; po reloadzie czysto). **3 NAPRAWIONE+ZWERYFIKOWANE LIVE:** (1) kształty circle/diamond/hexagon nieosiągalne z UI → wpięte do Create dropdown `54a8dc962b` (L-05, 4 kształty w menu); (2) fałszywy toast „Change conflict detected" na świeżej pustej tablicy (wyścig auto-seedu) → settle-window 7s `41f5c71182`; (3) karta breadcrumb zasłaniała przycisk „Create" w toolbarze → przesunięta pod toolbar (top-4→top-14) `41f5c71182`, zmierzone live cardCoversCreate=false. **Recepta na non-demo sesję testową:** [[finding_m09_live_test_gates]] (przepiąć usera do org PAID/TRIAL → login → isDemo:false; demo-org=386 userów współdzielony, nie ruszać). **Realny głębszy issue (v1.1):** version-race conflict-recovery WYCIERA niezapisany lokalny node przy świeżej tablicy (sticky znika po refetch) — to ta sama luka shared-WRITE persistence z teczki §C5, do domknięcia osobno.
- 2026-06-20 — **M09 Ideas-Whiteboard: Kod ✅ + harness Manual zbudowany; live-run Manual ZABLOKOWANY (ten sam staging DB outage co M05-M08).** Etap 1 (Kod) ✅: **L-01..L-06 re-zweryfikowane W KODZIE** (agent + file:line, nie z teczki) — org-read fallback `my-work.routes.ts:3563,3591` (WRITE per-user `:3805`), `useWhiteboardCollab` emit/odbiór `graph_patch`+echo-guard, NodeResizer ×4 node'y, base64 cap 10MB, facilitation GET org-scope `realtime-platform.routes.ts:691-820`+`facilitationGetSession` 2 call-sites, WS 403 `ideaCollabWs:237-241`; PARTIAL toolbar-tylko-rectangle = teczka P3. Etap 4 (Testy) ✅ **Kod 65 PASS / 0 fail (12 plików)** — DB-niezależne (map-orgread.contract 4/4, useWhiteboardCollab, ideaCollabWs.orgscope, realtimePlatformService, ...). **Manual: harness `b98dc267e9`** — `tests/e2e/smoke/m09-whiteboard-helpers.ts` (auth + nav + onboarding-suppress `consultify_onboarding_done:{userId}` + `waitForWhiteboardReady` kwiescencja seedu + addSticky/saveBoard/persistStickyViaApi) + foundation 3-test spec (S1/S2/S4, S9 persyst, S13/16/17/19) + 12 PNG `tests/e2e/screenshots/m09/`. **Live N/N = 0/126 BLOK:** staging DB outage — `register-demo`+`login` wiszą >30s→500 (DB-side lock; restart appki=świeża pula NIE pomógł; `conversations` bez-auth=401/1ms). **Finding (backlog):** client-side version race świeżej idei — mindmap auto-seed (v1→2) → 409 pierwszego zapisu whiteboardu → conflict-recovery wyciera niezapisany lokalny node (backend+merge OK, sticky persystuje przy poprawnym baseVersion — zweryf. API). Diagnoza zbieżna z M07 „canvas Loading = perf+contention". **Zostają:** pełny bieg Manual + screenshoty per-scenariusz (ciche okno po przywróceniu DB) · i18n Faza 4 · Deploy demo (zgoda Piotra) · →F/→UI. **M09 NIE 8/8.** ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ restartowałem backend dev (touch `server/src/index.ts`, mtime-only, 0 diff; nowy PID) — pula odświeżona, ale DB-outage trwa = nie mój zakres.
- 2026-06-20 — **M06 Ideas-Mind Map: gates 1/3/4 domknięte z dowodem; Manual 17/121 (harness żywy); 2 = DoD 6/7; 6/7/8 = Piotr.** Etap 1 (Kod) ✅: L-01..L-07 (Harvard 2) re-weryfikowane W KODZIE+ŻYWO — L-04 podklamy potwierdzone (ExportPPT etykieta `ExportPowerPoint.tsx:161`, AI overlays = REALNY LLM `Api.getMyIdeaAISuggestions` `AISentimentOverlay:56`, sidekick KONSUMOWANY `AIActionsPopover.tsx:91`+`FloatingAIPopover.tsx:54`, ColorPicker dedup `floating-toolbar/ColorPickerPopover.tsx:19`). **Realny residual ZNALEZIONY+USUNIĘTY:** `mindmap/WebhookSettings.tsx` (localStorage fake-backend = L-04/Z-08) był OSIEROCONYM trackowanym plikiem (0 importerów repo-wide; chore `ff5120cb21` go przywrócił) → `git rm`. Etap 4 (Testy) ✅ **230 PASS** (166 unit `tests/unit/mindmap`+`mywork` · 42 integ z WS org-scope `ideaCollabWs.orgscope` 6/6 + map-sync contract 11/11 · 22 component). Etap 3 (Epiki) ✅ 7/7 (zmapowane do zamkniętych L-01..L-07; EPIK6 align/snap+drawer D-01 = odroczone enhancement). Etap 2 (DoD) 🟡 **6/7** (#3 i18n **881 isPolish/isPl** → Faza 4 decyzją Piotra; #4 rose-korupcja=0 ✅, 299 hex=color-system/Visual Standard; reszta ✅). Etap 5 (Manual) 🟡 **17/121**: zbudowany reprodukowalny, **bez-sekretów harness Playwright** `tests/e2e/m06/_m06.ts` (auth `register-demo`, brak QA creds) + `_AGENT_BRIEF.md`; specy §1/§2/§4/§10 odpalone ŻYWO (localhost:3000 + staging) → **19 .png** `tests/e2e/screenshots/m06/` (§1 3/3 PASS; §2 8/8 ujęte; §4/§10 keyboard). Honest-skip dla [MANUAL]/[REAL-AI]/headless-focus (Cmd+K `IRM:3779`, undo `IRM:3124` wired w kodzie — nie odpalają pod headless keyboard-focus = nie defekt). **BLOKERY pełnego 121:** (a) staging DB outage + perf ~40s/test (~2.4s/API, ~15s mount), (b) fan-out 4 sub-agentów PADŁ na kontencji 1 backendu (socket-closed, 0 plików) → pełne 121 = follow-up CI na tym harnessie. **Zostają:** pełny bieg Manual (ciche okno/CI) · i18n Faza 4 · Deploy demo (6, „przygotuj, ja kliknę") · →F (7) · →UI (8, 19 .png = dowód częściowy). **M06 NIE 8/8.** ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ git-race: HEAD skakał b545098d72→c45322db4b(M07)→018be63b58(M08); mój `git rm` WebhookSettings mógł zostać zgarnięty przez równoległy commit (plik GONE z HEAD = efekt osiągnięty).
- 2026-06-20 — **M07 Ideas-Process Flow: ROZWÓJ NA BAZIE TESTOWANIA ŻYWEGO — kanwa była NIEUŻYWALNA; 3 realne bugi naprawione+zweryfikowane live (write-access).** Postawiony harness write-access (lokalny backend `:3009` ENABLE_TEST_SUPPORT na staging DB → pełny non-demo token; `frontend-test :3011`→:3009; inject sesji do preview) — bo `register-demo`=read-only demo. Driving kanwy: dodaj kształt → obserwuj → napraw. **BUG 1 (P0, `43428e2e8b`): KAŻDA edycja znikała** — add węzła → `onGraphChange` → summary callback → `MyWorkHub setIdeaGraphSummary` (state) → re-render → **REMOUNT toola** → optimistic state skasowany → re-hydrate z pustego serwera (dowód: liczniki mount 4/add + bisekcja). Fix: summary→**ref** (czytany tylko do AI-promptu). **BUG 2 (P0, `15b5290607`): edycje nie zapisywane** — autosave debounce **60s** → utrata przy nawigacji <60s; skrócenie ujawniło **pętlę re-save** (19 synców/add z `lastSavedAt` state→recreated `flushNow`/`queueSync`→effect re-fire). Fix: idleMs 60s→2.5s + `lastSavedAt`→ref. Zweryf.: add → ~3 syncy → **reload → węzeł trwały via autosave (bez ręcznego Save)**. **BUG 3 (`aa733487ce`): martwy poll** — `GET /api/v8/process-flow/:id/health` co 30s → 404 + ~18 zapytań DB/~11s (v8-gate), bo route wycięty (DP-7); `useProcessFlowDegraded`→no-op (zweryf. 0 calls/35s). **Efekt: kanwa UŻYWALNA + TRWAŁA; naprawy WSPÓLNE (MyWorkHub/useIdeaMapSync) → korzyść M06/M07/M08/M09.** Bez regresji: `unit/mywork`+`components/MyWork`+processflow **373/373**; tsc 0. Properties panel OTWIERA się (F2). Niezmienione (świadomie): ghost-node `ai-generate` 500 = env(deepseek balance)+cichy try/catch+per-add LLM=feature; `edgesReconnectable` prop-leak=kosmetyk. Głębsze interakcje (select→metryki, drag-connect) = realne zdarzenia myszy (Playwright coord/Chrome MCP), poza syntetycznymi klikami. ⚠ git-race: tracker współdzielony, równoległe sesje M04/M06/M08/M09 — commituję jawnymi ścieżkami.
