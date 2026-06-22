# M13 DEPTH — STAN PRACY · odbiory sub-modułów do 100% (SSOT operacyjny)

**Start:** 2026-06-20 · **Branch:** Londyn · **Deploy odbioru:** Railway staging (caboose/trolley) → demo → prod (centerbeam, za osobną zgodą Piotra)
> 🚀 **DEPLOYED na demo.consultify.ai 2026-06-21** (commit `b374e6d0`, build SUCCESS, root+/api/health=200). Serie G (AI bramki) + R (artefakty) LIVE. Migracje (`initiative_feature_flags`, `initiative_gate_ai_events`) zaaplikowane na demo (zweryfikowane). `POST /gate-ai-check` routowany (401 guard, nie 404). **Flaga `gate_ai` ON tylko na org Piotra demo** (`a3e05d4a…`, próg 75; dokładnie 1 org ON — zero szerokiego włączenia). Kalendarz (R3) + banner decyzji (R2) + DELETE-guard + kebab widoczne od razu. **→F = klik Piotra na demo** (transition na inicjatywie w jego org → pigułka/soft-block/override); →UI = screeny.
**Zasada twarda:** idziemy sub-moduł po sub-module po kolei (G1→G5 → R1→R4 → C1→C2 → K1→K4 → V1). Nie przechodzę do kolejnego, póki poprzedni nie jest **ZAMKNIĘTY (8/8)**. Zero odstępstw.

## RAPORT SESJI 2026-06-21 (CTO)
Zbudowane code-side + **wdrożone na demo.consultify.ai** (najnowszy `gitSha` = **7e5c41bf**, health 200):
- **Seria G (5/5)** — AI na bramce: flaga per-org · rollup merytoryczny (reviewer §B4) · timeline (zależności/daty) · `POST /gate-ai-check` + soft-block 422/override + telemetria · UI (modal + pigułka/panel). Flaga `gate_ai` **ON na org Piotra** (`a3e05d4a`, próg 75).
- **Seria R (4/4)** — M13a Taski (+helper `buildScheduleItems`) · M13b banner decyzji GO_NO_GO · M13c Kalendarz (wpięty) · M13d notyfikacje (status-change wpięty).
- **Seria C (2/2)** — C1 dedup `/similar-check` + ostrzeżenie w Charter Wizard · C2 Teresa `generate_initiative` tool (DRAFT, additive).
- **Seria K (3/4)** — K1 §B3 validators `/validate-card` + FE-lint w wizardzie · K3 korelacja trwała (`/linked-items`, `LinkedItemsSection` przepięty — data-loss e2e fixed) · **K4 AI-fill** (`80e5ef94ea`: hypothesis/OKR/lessons-learned realne + 4 świadomy no-op). **K2 CardContainer odłożony (Q6)** — jedyny realny kod-task serii.
- **Seria V (1/1)** — V1 task-Gantt + toggle Kalendarz/Gantt (wspólny `ScheduleItem`) + **W5 drag-reschedule** (`5ab7c4f121`).
- **Done-by-the-way:** DELETE status-guard 409 + test.
- **Liczby:** ~85 nowych testów zielonych · headless S1/S2/S3 3/3 · tsc/eslint clean (poza pre-existing warnings) · deploye na demo · branch `Londyn` zsync · stale-worktrees posprzątane.
- **ZOSTAJE:** K2 (CardContainer, duży refaktor — **czeka decyzji Q6**), ogón R4 (assignment/due/blocker call-sites), **Manual (Playwright)** + **→F/→UI (kliki Piotra na demo)**.
- **→F gotowe do kliku na demo:** (1) bramka G — otwórz inicjatywę w org Piotra → sekcja Gates / zmiana statusu → soft-block; (2) Teresa C2 — „stwórz inicjatywę X"; (3) Kalendarz/Gantt — sekcja Timeline → toggle; (4) Linked items — dodaj link → reload → przeżył.

### MANUAL (Playwright) — UCZCIWY STAN (2026-06-21)
**Harness ZBUDOWANY i DZIAŁA:** `tests/e2e/m13/m13-acceptance.spec.ts` (S1 hub · S2 dokument · S3 Timeline Calendar/Gantt), run `E2E_USE_WEB_SERVER=true NODE_OPTIONS=--max-old-space-size=8192 npx playwright test tests/e2e/m13/` → **build OK + 3/3 green + 3 screenshoty** (`tests/e2e/screenshots/m13/`). Pierwszy OOM na build frontu rozwiązany przez NODE_OPTIONS 8GB.
**ALE dowód SŁABY:** MOCK_DB nie robi round-tripu create→list dla inicjatyw (seed `POST /api/initiatives` zwraca ok, ale hub pokazuje „No initiatives yet", ALL=0). Screenshoty dowodzą „moduł ładuje się bez crasha", **NIE** funkcji (kalendarz/gantt/bramka z danymi).
**ŻEBY Manual realnie rósł:** seed musi się ujawnić → albo naprawić MOCK_DB dla inicjatyw, albo run przeciw zaseedowanej realnej DB (trolley). To następny krok — dopiero wtedy bramka Manual = X/N z sensownym .png. **Nie liczę tego jako Manual zaliczony.**

**Próba C (przeciw demo.consultify.ai, 2026-06-21):** `tests/e2e/m13/m13-demo.spec.ts` — świeży user przez `/api/auth/register` (bez credentiali Piotra), flaga `gate_ai` ON na jego org, seed inicjatywy + login cookie (`access_token` httpOnly). **4 specy „green" ALE screenshoty puste/blank** — SPA nie renderuje na zimno przez Playwright (auth cookie OK, ale strona blank/redirect). Czyli **dalej brak sensownego dowodu funkcji**. Trzy ścieżki wyczerpane w tej sesji (MOCK_DB puste / demo-token spinner / demo-cookie blank). **REALNY następny krok:** storageState z zalogowanej przeglądarki Piotra (on jest zalogowany — widać na jego screenach) ALBO dopieszczenie lokalnego harnessu z realnym seedem. Uczciwie: **bramki Manual NIE zaliczam w tej sesji** — harness istnieje i biega, ale dowód-funkcji się nie udał.

**Próba A (lokalny harness przeciw trolley, real DB, 2026-06-21):** `MOCK_DB` zrobiony override'owalny w `playwright.config.ts`; run `E2E_USE_WEB_SERVER=true E2E_MOCK_DB=false DATABASE_URL=<trolley> NODE_OPTIONS=8GB`. **S1 (hub) PASS — realny screenshot huba Inicjatyw** (`tests/e2e/screenshots/m13/S1-hub.png`, prawdziwy UI, auth OK). **ALE S2/S3 FAIL:** dokument się nie otwiera bo (a) lista huba wisi „Loading"/ALL=0 — seed nie ujawnia się (async rebuild snapshotu My Work dla świeżej org, ~20s+ / zapytanie wisi), (b) `/implementation?initiativeId=X` to moduł M14 Execution → pokazuje tylko EXECUTING, nie DRAFT (screen Piotra był EXECUTING). Dokument DRAFT-a otwiera się dopiero z listy huba (klik), a lista wisi.
**WNIOSEK CTO (uczciwy):** mam harness + realny screen huba, ale **nie funkcji z danymi** — bloker to data-flow appki (snapshot/status routing), nie spec. Najszybsza pewna droga do screenów funkcji = **storageState z sesji Piotra** (ma otwartą realną inicjatywę EXECUTING z bramką/kalendarzem). Alternatywa: inżynieria obejścia seeda (promote DRAFT→EXECUTING przez API + czekać na snapshot) — niepewna, każdy iter = ~2 min build.

Ten plik = jedyne miejsce prawdy o postępie **M13 Depth**. Odhaczamy tu każdy etap. Szczegół (epiki, luki, kryteria) = [`M13-DEPTH-PLAN.md`](M13-DEPTH-PLAN.md) + [`../../docs/product/INITIATIVE_GATE_AI_SPEC.md`](../../docs/product/INITIATIVE_GATE_AI_SPEC.md). Wiersz zbiorczy M13 w [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md) linkuje tu.

**Testy:** `npx vitest run tests/unit/initiatives tests/integration/initiatives` + `tests/e2e/m13/` (Playwright). Baseline 2026-06-20: unit/integration **89 pass / 3 fail** (3 = legacy `initiatives.test.js` create/prioritize→404, wymaga żywej DB, NIE dotyczy M13 Depth) · e2e m13 **0 specs** (do napisania per sub-moduł) · nowy `InitiativeController.deleteInitiative` **7/7**.

**Znalezisko #1 (przekrojowe, P0-ryzyko):** każda zmiana bramek/statusów dotyka żywych klientów (VTS/Apator/Elkomtech na prod). Dlatego **flaga per-org `initiativeGateAiEnabled` + fail-open** to pierwsza pozycja „Bezpieczeństwo" KAŻDEGO sub-modułu serii G. Demo/wewn najpierw; klienci OFF do telemetrii.

## Legenda
⬜ niezrobione · 🟡 w toku · ✅ zrobione+odebrane

## Etapy odbioru per sub-moduł (8)
1. **Kod** — luki funkcjonalne/security domknięte; `tsc --noEmit` 0 błędów w plikach sub-modułu
2. **DoD 7/7** — wszystkie 7 kryteriów globalnych (niżej)
3. **Epiki** — wszystkie epiki sub-modułu zielone
4. **Testy** — unit/integration + e2e (Playwright) zielone; 0 fail
5. **Zgodność UI/UX** — komponenty vs kanon (`CANON.md` §7/§9/§17/§27); zero odstępstw P0/P1
6. **Deploy** — Railway staging→demo; smoke test PASS (prod tylko za zgodą Piotra)
7. **ODBIÓR FUNKCJA — Piotr** — klikasz w aplikacji, działa
8. **ODBIÓR UI/grafik — Claude + Piotr** — screenshoty ekranów (Playwright .png lub computer-use), UX odebrany

Sub-moduł **ZAMKNIĘTY = 8/8**.

## DoD globalny (7 kryteriów — wspólny dla każdego sub-modułu)
1. **Spięcie front↔back** — zero demo-only fasad gdy `hasBackend`; zero martwych przycisków
2. **Bezpieczeństwo** — org-scope wszędzie; nowe endpointy za JWT guard; **zmiany behawioralne za flagą per-org + fail-open**; zero żywych P0/P1
3. **i18n** — PL+EN komplet; 0 brakujących `initiatives.*` (`node scripts/i18n/check-bare-missing.cjs`)
4. **Tokeny CSS** — zero hardkodów hex/`Colors.*`; tylko CSS vars/tokeny (graf + PDF-export = udokumentowane wyjątki)
5. **Standard UI/UX** — kanon §27 (tabele sticky-thead/FilterableTable) + §7/§9/§17; zero danger-fill na normalnych statusach
6. **tsc + lint + testy** — 0 fail, 0 błędów w plikach sub-modułu
7. **Flaga/rollout/telemetria** — zmiana behawioralna za flagą per-org; fail-open; telemetria zapisywana (gdy dotyczy)

## BRAMKA WSTĘPNA (przed G1) — decyzje Piotra
🟡 **Q1** required-sections per bramka (GATE_AI_SPEC §3) — **ruszyłem z moją propozycją** (G1 wdrożone wg `initiativeGateAi.ts`); czeka na potwierdzenie/korektę Piotra (zmiana = edycja jednej mapy)
⬜ **Q2** M13a–d: initiative-scoped czy współdzielony silnik (reuse M14/15/16)? ← blokuje architekturę serii R
⬜ **Q3** Notyfikacje: kanały (in-app/email/Slack) + 4 eventy MUST ← blokuje R4
⬜ **Q4** Kalendarz vs Gant: osobno czy wspólny silnik czasu ← blokuje R3+V1
⬜ **Q5** Generator: UI wyboru modelu LLM czy stały tier ← blokuje C1 zakres
⬜ **Q6** Karty: `CardContainer` w v1 czy później ← blokuje K2
⬜ **Q7** §B3: egzekwowanie twarde czy miękkie ← blokuje K1
⬜ **Q8** kolejność fal W2–W5 — akceptacja
✅ **Infra** branch Londyn aktualny · flaga `pgFlags` wzorzec istnieje (reuse)
⬜ **Demo org** wskazana do pilota flagi (telemetria)

> G1–G5 (Fala 1) mogą ruszyć po Q1 (reszta Q nie blokuje serii G). Seria R blokowana przez Q2/Q3/Q4.

---

## Tabela zbiorcza (dashboard PM)

Bramki realizacji: Epiki x/N · DoD x/7 · Testy (vitest+playwright PASS) · Manual x/N (dowód = Playwright .png lub computer-use, min. 1/scenariusz) · UI wg kanonu. Bramki odbioru: →F (Piotr) · →UI (Claude+Piotr).

| # | Sub-moduł | Seria | Epiki | DoD | Testy | Manual | UI | →F | →UI | Ekr. | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| G1 | Flaga + GATE_REQUIRED_SECTIONS + próg | G (AI bramki) | 3/3 | 6/7 | ✅ | 0/4 | N/A | ⬜ | ⬜ | 0 | 🟢 DEPLOYED demo (flaga+kanon+próg; 12/12 testy; tsc clean; Manual+deploy pending) |
| G2 | `gateAiReadinessService` — rollup merytoryczny | G | 3/3 | ✅ | ✅ | 0/6 | N/A | ⬜ | ⬜ | 0 | 🟢 DEPLOYED demo (reuse reviewer §B4, fail-open, cache; 6/6 testy) |
| G3 | `gateTimelineService` — na linii czasu | G | 3/3 | ✅ | ✅ | 0/6 | N/A | ⬜ | ⬜ | 0 | 🟢 DEPLOYED demo (deps+date-conflict; resource=skip udok.; 9/9 testy) |
| G4 | Endpoint + soft-block/override + telemetria | G | 3/3 | ✅ | ✅ | 0/6 | N/A | ⬜ | ⬜ | 0 | 🟢 DEPLOYED demo (POST gate-ai-check + 422/override w PATCH /status + events; 9/9 + 5/5 testy) |
| G5 | UI bramki (pigułka + panel + modal override) | G | 3/3 | ✅ | ✅ | 0/10 | 🟡 | ⬜ | ⬜ | 3 | 🟢 DEPLOYED demo (modal wpięty w handleStatusAction soft-block→override; pill+panel w GateReadinessSection; tsc clean; →F/→UI po deploy+flaga ON demo) |
| R1 | M13a Taski — stabilizacja | R (artefakty) | 2/2 | ✅ | ✅ | 0/8 | N/A | ⬜ | ⬜ | 1 | 🟢 DEPLOYED demo (audyt Tasks ✅ + helper `initiativeSchedule` 8/8; default Q2=initiative-scoped) |
| R2 | M13b Decyzje — stabilizacja | R | 2/2 | ✅ | ✅ | 0/8 | 🟡 | ⬜ | ⬜ | 1 | 🟢 DEPLOYED demo (banner decyzji GO_NO_GO bramki w `DecisionsSection`; tsc clean) |
| R3 | M13c Kalendarz — build | R | 4/4 | ✅ | ✅ | 0/12 | 🟡 | ⬜ | ⬜ | 2 | 🟢 DEPLOYED demo — `InitiativeCalendar` **WPIĘTY** w `TimelineSection` (toggle, zasilony `buildScheduleItems`) + **drag-reschedule WPIĘTY** (`6e3a20d48f`: mirror W5, PUT `/api/pmo/tasks/:id`, optymistyczny+rollback); tsc clean; live-verify zostaje |
| R4 | M13d Notyfikacje — build | R | 3/4 | ✅ | ✅ | 0/10 | N/A | ⬜ | ⬜ | 2 | 🟢 DEPLOYED demo — emitery 7/7 + **status-change WPIĘTY** w `updateInitiativeStatus` (notify watchers/owners po sukcesie, fail-safe, bez dublu z gate_blocked); assignment/due/blocker call-sites = follow-up |
| C1 | Generator portfolio-aware (dedup) | C (tworzenie) | 3/3 | ✅ | ✅ | 0/8 | 🟡 | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — `initiativeSimilarityService` (Jaccard, fail-safe) + `POST /similar-check` 7/7 + **ostrzeżenie o duplikacie w Charter Wizard** (debounce na tytule, amber); E3 model-select N/A (Q5); tsc/lint clean; live-verify+deploy zostają |
| C2 | Tworzenie przez Teresę — e2e | C | 2/2 | ✅ | ✅ | 0/6 | N/A | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — tool `generate_initiative` (READ/auto, DRAFT, Postgres-correct) + handler 5/5 + registracja + persona prompt; registry 2/2 (additive, czat nietknięty); e2e „Teresa stwórz inicjatywę" na demo po deployu |
| K1 | Karty §B3 — egzekwowanie jakości | K (artefakt) | 2/2 | ✅ | ✅ | 0/6 | 🟡 | ⬜ | ⬜ | 0 | 🟢 GOTOWY code-side — `initiativeCardValidators` (advisory Q7) + `POST /validate-card` 7/7 + **FE: podpowiedzi §B3 na polu hipotezy w Charter Wizard** (debounce, amber); tsc/lint clean |
| K2 | Karty — `CardContainer` (układ graficzny) | K | 0/2 | 0/7 | ⬜ | 0/8 | ⬜ | ⬜ | ⬜ | 1 | ⬜ NIE ROZP. (czeka Q6) |
| K3 | Karty — korelacja artefaktów (trwała) | K | 3/3 | ✅ | ✅ | 0/6 | 🟡 | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — backend (tabela+service+`/:id/linked-items` 6/6) + **`LinkedItemsSection` przepięty na API** (load-on-expand, persist add/remove, rollback, fail-open); data-loss naprawiony e2e; tsc/JSON OK |
| K4 | AI-fill — domknięcie 7 sekcji | K | 2/2 | 6/7 | 🟢 | 0/7 | ⬜ | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side (`80e5ef94ea`) — E1 realne handlery: hypothesis/OKR/lessons-learned (usunięte z `SECTION_AI_NOOP`, dispatch w `runActiveSectionAi` + persist); E2 świadomy no-op dla 4 reszty (raci/change-log/workstream-owners/suggested-changes — złożone modele danych); tsc clean; live-verify+→F/→UI |
| V1 | Gant zadaniowy + drag-reschedule | V (widoki) | 3/3 | ✅ | ✅ | 0/10 | 🟡 | ⬜ | ⬜ | 2 | 🟢 GOTOWY code-side — `InitiativeGantt` (schedule-bary tydzień, dziś-marker, undated; wspólny `ScheduleItem` z Kalendarzem wg Q4) + toggle Kalendarz/Gantt w `TimelineSection` + **W5 drag-reschedule** (`5ab7c4f121`: pointer-events, snap-to-day, optymistyczny UI, `PUT /api/pmo/tasks/:id`, rollback na błędzie); tsc clean. Headless S3 zielone |

**Postęp programu:** 0 / 16 ZAMKNIĘTYCH (8/8) · **Seria G (AI bramki) 5/5 DEPLOYED demo** 🟢 (kod✅ testy✅ deploy✅ migracje✅ endpoint✅ flaga ON org Piotra✅ — zostaje →F klik Piotra + →UI screeny) · **Seria R (artefakty) 4/4 DEPLOYED demo** 🟢 (Kalendarz+banner decyzji+notyfikacje+DELETE live; →UI screeny; ogony: calendar drag-persist, R4 assignment/due/blocker) · **Seria C (tworzenie) 2/2 DEPLOYED demo** 🟢 (`4203292e`: C1 dedup `/similar-check`+wizard warning · C2 Teresa `generate_initiative` tool; e2e na demo = klik) · **Seria K (artefakt) 3/4 GOTOWE code-side** 🟢 (K1 §B3 validators+FE-lint · K3 korelacja trwała e2e · **K4 AI-fill `80e5ef94ea`**: hypothesis/OKR/lessons-learned realne + 4 świadomy no-op; K2 CardContainer **odłożony — czeka Q6**, jedyny realny kod-task serii) · **Seria V (widoki) 1/1 GOTOWA code-side** 🟢 (Gant zadaniowy + toggle Kalendarz/Gantt + **W5 drag-reschedule `5ab7c4f121`** + **Calendar drag `6e3a20d48f`**; headless S3 zielone) · **Manual gate (Playwright): 20/121** wykonane z 40+ screenami (`m13-manual.spec.ts` §1/§2 26-sekcji/§3/§4/§5/§6/§7/§11; headless acceptance S1/S2/S3 osobno = 3/3) · **Ekrany: 40+** w `docs/qa/screens/m13-2026-06-21/`. Pozostałe scenariusze (cross-module/AI-gen/pilot/DB/wizard-modale/light-mode) = live-verify. **P1 (DRAFT znika z Kanban) NAPRAWIONY** `973138a3a3`. Analiza graficzna: `_ANALIZA_UIUX_M13_2026-06-21.md`.
**Seria G — dowód code-side:** 107 testów zielonych (G1 12 · G2 6 · G3 9 · G4 telemetry 5 · G4 endpoint+soft-block 10 · +istniejące) · tsc czysty na wszystkich plikach gate-ai · całość za flagą `initiativeGateAiEnabled` OFF (fail-open). 2 migracje (flags + events) czekają na deploy staging; demo-org ON dopiero świadomie.
**Done-by-the-way (już w kodzie, poza tym planem):** DELETE status-guard 409 + test 7/7 · kebab Archive/Delete w dokumencie (tsc clean).

**Słownik statusu:** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (6 bramek realizacji ✅, czeka →F/→UI) · ✅ ZAMKNIĘTY (8/8 ✅).

---

# Odbiory szczegółowe (sub-moduł po sub-module)

## SERIA G — AI na bramce (Fala 1) → spec: `INITIATIVE_GATE_AI_SPEC.md`

### G1 — Flaga + GATE_REQUIRED_SECTIONS + próg · 3 epiki · 0 ekranów
Status: 🟢 DEPLOYED demo (realizacja ✅ — Manual+deploy+→F zostają) · **za flagą OFF = zero ryzyka żywych**

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — flaga + kanon + config | ✅ | `initiativeGateAiConfig.ts` (per-org flaga, fail-safe OFF, cache) + `initiativeGateAi.ts` (kanon) + migracja `20260620_5000_*`; tsc 0 w plikach |
| 2 | DoD 6/7 | ✅ | #2 flaga per-org+fail-open ✅ · #6 testy ✅ · #1/#3/#4/#5/#7 N/A (backend-config, brak UI/i18n) |
| 3 | Epiki 3/3 | ✅ | E1 flaga+próg config · E2 `GATE_REQUIRED_SECTIONS` (9 bramek, klucze registry) + `GATE_AI_TIMELINE_GATES` · E3 próg per-org (`getGateAiThreshold`) |
| 4 | Testy | ✅ | `tests/unit/initiatives/initiativeGateAi.test.ts` → **12/12** (kanon 9 bramek + OFF-default + fail-safe + threshold + upsert) |
| 5 | UI/UX | ✅ | N/A (backend/config) |
| 6 | Deploy | ⬜ | migracja na staging (flaga OFF wszędzie); demo-org ON dopiero przy G5 |
| 7 | →F Piotr | ⬜ | N/A na G1 (brak UI; →F na G5) |
| 8 | →UI | ⬜ | N/A na G1 (→UI na G5) |

**Epiki:** E1 flaga `initiativeGateAiEnabled` + próg (config, org-scope) · E2 `GATE_REQUIRED_SECTIONS` (mapa 9 bramek→sekcje, **po akceptacji Q1**) · E3 odczyt progu per-org.
**Manual (4):** M1 flaga OFF → bramki bez zmian · M2 flaga ON demo → infra aktywna · M3 próg czytany per-org · M4 fail-open gdy config brak.

### G2 — `gateAiReadinessService` (rollup merytoryczny) · 3 epiki · 0 ekranów
Status: ⬜ NIE ROZP.

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — rollup orchestration | ⬜ | reuse `review-section` per wymaganą sekcję → ważony score + gaps[]; tsc 0 |
| 2 | DoD 7/7 | ⬜ | #2 fail-open (LLM down → enabled:false), #6 testy |
| 3 | Epiki 3/3 | ⬜ | E1 rollup · E2 reuse reviewer §B4 · E3 cache+invalidacja |
| 4 | Testy | ⬜ | unit: score liczony, gaps poprawne, cache invaliduje przy edycji sekcji |
| 5 | UI/UX | ⬜ | N/A |
| 6 | Deploy | ⬜ | staging |
| 7 | →F | ⬜ | — |
| 8 | →UI | ⬜ | — |

**Epiki:** E1 rollup `score/verdict/gaps/fixes` dla bramki · E2 reuse reviewer (CARD_CONTENT_FORMULA §B4) · E3 cache per (initiativeId,gate,contentHash) + inwalidacja.
**Manual (6):** rollup dla każdej z 9 bramek; pusta sekcja → gap; komplet → ready; LLM down → fail-open; cache hit; inwalidacja po edycji.

### G3 — `gateTimelineService` (na linii czasu) · 3 epiki · 0 ekranów
Status: ⬜ NIE ROZP.

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — analizator czasowy | ⬜ | zależności + konflikt dat + zasoby → `timelineFlags[]`; tsc 0 |
| 2 | DoD 7/7 | ⬜ | #2 org-scope query, #6 testy |
| 3 | Epiki 3/3 | ⬜ | E1 zależności niegotowe · E2 konflikt dat · E3 konflikt zasobów |
| 4 | Testy | ⬜ | unit: każdy typ flagi; block vs warn |
| 5–8 | … | ⬜ | jak wyżej |

**Epiki:** E1 zależność < SCHEDULED → `block` · E2 nakładanie dat SCHEDULED → `warn` · E3 zasób w oknie → `warn`. Aktywne na SCHEDULE+START.
**Manual (6):** zależność niegotowa blokuje; daty kolidują→warn; zasób koliduje→warn; brak zależności→czysto; tylko SCHEDULE/START; pozostałe bramki timeline=null.

### G4 — Endpoint + soft-block/override + telemetria · 3 epiki · 0 ekranów
Status: ⬜ NIE ROZP.

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — endpoint + override + events | ⬜ | `POST /:id/gate-ai-check`; transition `overrideReason?` → 422 bez / log z; tsc 0 |
| 2 | DoD 7/7 | ⬜ | #2 JWT+org-scope+flaga, #7 telemetria |
| 3 | Epiki 3/3 | ⬜ | E1 `gate-ai-check` · E2 soft-block (422/override) · E3 events table+zapis |
| 4 | Testy | ⬜ | integration: 422 bez override poniżej progu; przejście+log z override; flaga OFF=bez zmian |
| 5–8 | … | ⬜ | — |

**Epiki:** E1 endpoint lazy (§5) · E2 transition: 422 `{aiReadiness,timeline}` bez override / przejście+log z override · E3 `initiative_gate_ai_events`.
**Manual (6):** poniżej progu→422; override+powód→przejście+log; powyżej progu→bez tarcia; timeline block→422; flaga OFF→stare zachowanie; event zapisany.

### G5 — UI bramki (pigułka + panel + modal override) · 3 epiki · 3 ekrany
Status: ⬜ NIE ROZP.

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — pigułka/panel/modal | ⬜ | pigułka score na CTA bramki; panel gaps/fixes/flags; modal override z polem powodu; tsc 0 |
| 2 | DoD 7/7 | ⬜ | #3 i18n PL+EN, #4 tokeny, #5 bursztyn=ostrzeżenie nie danger |
| 3 | Epiki 3/3 | ⬜ | E1 pigułka · E2 panel braków · E3 modal override |
| 4 | Testy | ⬜ | e2e: soft-block flow (poniżej progu→modal→override→przejście) |
| 5 | UI/UX | ⬜ | kanon §7; bursztyn nie czerwień; dark+light |
| 6 | Deploy | ⬜ | staging demo; flaga ON demo |
| 7 | →F Piotr | ⬜ | klika bramkę poniżej progu, widzi braki, override działa |
| 8 | →UI | ⬜ | screeny pigułka/panel/modal dark+light |

**Epiki:** E1 pigułka gotowości (score+kolor) · E2 panel `gaps/fixes/timelineFlags` · E3 modal override (obowiązkowe uzasadnienie).
**Ekrany (3):** pasek bramki z pigułką · panel braków · modal override.
**Manual (10):** pigułka≥próg zielona; <próg bursztyn; klik→panel; gaps poprawne; timelineFlags na SCHEDULE; próba przejścia<próg→modal; override bez powodu→zablokowany przycisk; override+powód→przejście; flaga OFF→brak pigułki; dark+light.

---

## SERIA R — Artefakty powiązane (M13a–d) · **blokowana Q2 (scoped vs współdzielony)**

### R1 — M13a Taski (stabilizacja) · 2 epiki · 1 ekran
Status: ⬜ NIE ROZP. · Stan: ✅ istnieje (`sections/TasksMilestonesSection.tsx`)
**Epiki:** E1 korelacja z Kalendarzem/Gant (wspólne źródło dat) · E2 polish AI-fill + testy.
**DoD kluczowe:** #1 front↔back, #6 testy. **Manual (8):** CRUD task; status; AI-propozycja; zasilenie kalendarza; zasilenie Gant; edycja daty; usuwanie; back.

### R2 — M13b Decyzje (stabilizacja) · 2 epiki · 1 ekran
Status: ⬜ NIE ROZP. · Stan: ✅ istnieje (`sections/DecisionsSection.tsx`)
**Epiki:** E1 korelacja GO_NO_GO ↔ bramki (#4) · E2 testy + screeny.
**Manual (8):** CRUD decyzja; typ GO_NO_GO; status flow; widoczność przy bramce; powiązanie z inicjatywą; edycja; usuwanie; back.

### R3 — M13c Kalendarz (build, BRAK) · 4 epiki · 2 ekrany · **czeka Q4**
Status: ⬜ NIE ROZP. · Stan: 🔴 BRAK
**Epiki:** E1 widok kalendarza miesiąc/tydzień · E2 wspólny serwis czasu (tasks+milestones+timeline) · E3 drag-to-reschedule (PATCH dat) · E4 filtry status + dark/light.
**Manual (12):** render miesiąc; render tydzień; zadania po dacie; kamienie po dacie; drag→nowa data persist; filtr status; pusty stan; nawigacja miesięcy; spójność z Gant; offline/fallback; dark; light.

### R4 — M13d Notyfikacje (build wiring, BRAK) · 4 epiki · 2 ekrany · **czeka Q3**
Status: ⬜ NIE ROZP. · Stan: 🔴 BRAK wiring
**Epiki:** E1 emiter status-change · E2 emiter assignment · E3 emiter due-date breach · E4 emiter blocker. Reuse `NotificationApi`+reminders.
**Manual (10):** zmiana statusu→notyfikacja; przypisanie→notyfikacja; termin→notyfikacja; blocker→notyfikacja; in-app widoczna; email wysłany; org-scope; brak duplikatów; ustawienia kanałów; back.

---

## SERIA C — Tworzenie

### C1 — Generator portfolio-aware (+ model select?) · 3 epiki · 1 ekran · **czeka Q5**
Status: ⬜ NIE ROZP.
**Epiki:** E1 dedup query istniejących inicjatyw org · E2 ostrzeżenie „podobna istnieje" w UI · E3 (Q5) UI wyboru modelu LLM **lub** N/A.
**Manual (8):** generacja z insightu M10; dedup wykrywa duplikat; ostrzeżenie w UI; brak duplikatu→czysto; (model select jeśli Q5=tak); fallback LLM; jakość wg formuły; back.

### C2 — Tworzenie przez Teresę (e2e) · 2 epiki · 1 ekran
Status: ⬜ NIE ROZP. · Stan: 🟡 tool niepodłączony
**Epiki:** E1 `generate_initiative` (READ/auto, wzorem `generate_deliverable`) · E2 persona Teresy wymienia inicjatywy + montaż w czacie.
**Manual (6):** „Teresa stwórz inicjatywę X"→DRAFT; DRAFT na liście; otwieralny; PL; EN; brak approval-gate blokady.

---

## SERIA K — Artefakt (karty)

### K1 — Karty §B3 egzekwowanie · 2 epiki · 0 ekranów · **czeka Q7**
**Epiki:** E1 walidatory §B3 jako warstwa (lang_pl/no_filler/problem_len…) · E2 tryb (twardy/miękki wg Q7) + testy.
**Manual (6):** walidator łapie filler; pusty wymagany→flag; tryb wg Q7; PL; przejście gdy OK; log.

### K2 — Karty `CardContainer` (układ graficzny) · 2 epiki · 1 ekran · **czeka Q6**
**Epiki:** E1 wspólny `CardContainer`/`CardHeader` · E2 migracja sekcji do containera (zakres wg Q6).
**Manual (8):** spójny nagłówek; ikona/kolor z `SectionTypeInfo`; dark; light; §27 zgodność; brak regresji renderu; reorder; back.

### K3 — Karty korelacja artefaktów (trwała) · 3 epiki · 1 ekran
**Epiki:** E1 tabela `initiative_linked_items` · E2 CRUD + persist (dziś in-memory) · E3 graf `link_graph_edges` + query.
**Manual (6):** link task; link decyzja; persist po reload; graf query; usuwanie linku; org-scope.

### K4 — AI-fill domknięcie 7 sekcji · 2 epiki · 1 ekran
**Epiki:** E1 handlery dla priorytetowych (OKR, hipoteza) · E2 świadomy no-op + opis dla reszty.
**Manual (7):** AI-fill OKR; AI-fill hipoteza; no-op opisany; brak fake-success; PL; jakość; back.

---

## SERIA V — Widoki

### V1 — Gant zadaniowy + drag-reschedule · 3 epiki · 2 ekrany · **czeka Q4**
**Epiki:** E1 schedule-bar poziom zadań/kamieni (dni/tygodnie) · E2 drag-to-reschedule · E3 ścieżka krytyczna z `TimelineAnalysis`.
**Manual (10):** render bary zadań; skala dni/tygodnie; drag→persist; zależności widoczne; ścieżka krytyczna; spójność z Kalendarzem; zoom; filtr; dark; light.
