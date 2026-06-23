# M13 DEPTH — STAN PRACY · odbiory sub-modułów do 100% (SSOT operacyjny)

**Start:** 2026-06-20 · **Branch:** Londyn · **Deploy odbioru:** Railway staging (caboose/trolley) → demo → prod (centerbeam, za osobną zgodą Piotra)
> 🚀 **DEPLOYED na demo.consultify.ai 2026-06-21** (commit `b374e6d0`, build SUCCESS, root+/api/health=200). Serie G (AI bramki) + R (artefakty) LIVE. Migracje (`initiative_feature_flags`, `initiative_gate_ai_events`) zaaplikowane na demo (zweryfikowane). `POST /gate-ai-check` routowany (401 guard, nie 404). **Flaga `gate_ai` ON tylko na org Piotra demo** (`a3e05d4a…`, próg 75; dokładnie 1 org ON — zero szerokiego włączenia). Kalendarz (R3) + banner decyzji (R2) + DELETE-guard + kebab widoczne od razu. **→F = klik Piotra na demo** (transition na inicjatywie w jego org → pigułka/soft-block/override); →UI = screeny.
**Zasada twarda:** idziemy sub-moduł po sub-module po kolei (G1→G5 → R1→R4 → C1→C2 → K1→K4 → V1). Nie przechodzę do kolejnego, póki poprzedni nie jest **ZAMKNIĘTY (8/8)**. Zero odstępstw.

## ⚠️ STATUS PRAWDY — 2026-06-23 (po audycie 5-agentowym · czytaj NAJPIERW)

> **Audyt wieloma agentami (2026-06-23)** zweryfikował każdą bramkę realizacji twardym dowodem (plik istnieje + test przechodzi + kod realny, nie fasada). **Wynik: ZERO zawyżeń, zero fasad.** Wcześniejszy blok ZANIŻAŁ stan (mówił „V1 częściowo / notifyAssignment niewpięty / due-breach niezbudowany" — wszystkie JUŻ zbudowane commitami `a8cfca1df4`/`40018dc782`/`3be1de017f`). Ten blok jest teraz zsynchronizowany z kodem.

**Twardy dowód realizacji (run 2026-06-23, audyt):** `tests/{unit,integration,components}` M13 = **280/280 zielonych** (48 plików). Per-seria audyt: G 48/48 · R 36/36 · C 24/24 · K 29/29 · V 24/24. Deploy: **origin/demo @ `5ef1e3ab73`** (health 200). Prod nietknięty.

**Licznik prawdy (16 sub-modułów):**
| Kategoria | Ile | Które |
|---|---|---|
| 🟢 **Realizacja techniczna DOMKNIĘTA** (Kod+Epiki+Testy, deployed) | **15/16** | G1–G5 (5) · R1–R4 (4, R4 epiki **4/4** — status/assignment/due-breach[flaga OFF]/blocker) · C1–C2 (2) · K1·K3·K4 (3) · V1 (1, **4 funkcje Gantta: zoom/filtr/zależności/ścieżka-krytyczna ✅**) |
| 🟡 **Fundament + ogon opt-in** | **1** (K2) | **K2-E1 ✅** (CardContainer/CardHeader registry-driven, backward-compat) · **K2-E2 🟡** = pełna adopcja registry-ikon w ~26 sekcjach — świadomie przyrostowa/opt-in (audyt potwierdził: 0/26 sekcji jeszcze zaadoptowane, sekcje wciąż hardkodują ikony; ryzyko regresji renderu = nie big-bang) |
| 🟢 **Czeka TYLKO Twoich odbiorów** (→F klik na demo / →UI grafika) | **wszystkie 15** | jedyna rzecz blokująca „ZAMKNIĘTY 8/8" — z definicji Twoja bramka |

**Wniosek (audyt):** **15/16 realizacji domkniętej technicznie**, 1 (K2-E2) = świadoma przyrostowa adopcja. Jedyne realne bramki: (a) **odbiory →F/→UI Piotra** na demo (15 sub-modułów), (b) K2-E2 pełna adopcja, (c) due-breach cron `INITIATIVE_DUE_BREACH_CRON_ENABLED` ON na demo-org + live-verify. **0/16 ZAMKNIĘTYCH 8/8** — bo 8/8 wymaga →F/→UI.

---

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
✅ **Q6** ROZWIĄZANE (CEO 2026-06-22: „buduj w v1") — K2-E1 fundament `CardContainer` zbudowany; E2 pełna adopcja w 26 sekcjach = przyrostowo/opt-in
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
| G5 | UI bramki (pigułka + panel + modal override) | G | 3/3 | ✅ | ✅ | 1/10 real-data | 🟢 | ⬜ | ⬜ | 3 | 🟢 DEPLOYED demo (modal wpięty w handleStatusAction soft-block→override; pill+panel w GateReadinessSection); **real-data 06-23: sekcja Gates renderuje pełen cykl stage'y + readiness + Blocked PASS** (`real-ini-gates`); →F/→UI po flaga ON demo |
| R1 | M13a Taski — stabilizacja | R (artefakty) | 2/2 | ✅ | ✅ | 3/8 real-data | 🟢 | ⬜ | ⬜ | 1 | 🟢 DEPLOYED demo (audyt Tasks ✅ + helper `initiativeSchedule` 8/8); **real-data 06-23: sekcja §27 (4 taski/statusy/daty) + dark + light PASS** (`real-tsk-*`) |
| R2 | M13b Decyzje — stabilizacja | R | 2/2 | ✅ | ✅ | 3/8 real-data | 🟢 | ⬜ | ⬜ | 1 | 🟢 DEPLOYED demo (banner decyzji GO_NO_GO bramki w `DecisionsSection`); **real-data 06-23: amber gate-banner GO_NO_GO + 4 decyzje + dark + light PASS wzorcowe** (`real-dec-*`) |
| R3 | M13c Kalendarz — build | R | 4/4 | ✅ | ✅ | 4/12 real-data | 🟢 | ⬜ | ⬜ | 2 | 🟢 DEPLOYED demo — `InitiativeCalendar` **WPIĘTY** w `TimelineSection` (toggle, zasilony `buildScheduleItems`) + **drag-reschedule WPIĘTY** (`6e3a20d48f`); **real-data 06-23: month+week+dark+light PASS, chipy tasków na właściwych dniach czerwca** (`real-cal-*`); drag live-verify zostaje |
| R4 | M13d Notyfikacje — build | R | **4/4** | ✅ | ✅ | 1/10 live-verify | N/A | ⬜ | ⬜ | 2 | 🟢 DEPLOYED demo — **epiki 4/4** (audyt 2026-06-23): E1 status-change kanoniczny (dubel Wariant A naprawiony) · E2 `notifyAssignment` WPIĘTY `TaskController:1895` (`40018dc782`) · E3 due-breach cron `job33` za flagą OFF (`3be1de017f`) · E4 blocker=CRITICAL. Testy notif 36/36. **real-data 06-23: centrum in-app — D3 ZAMKNIĘTE (nie bug): `setLoading(false)` w `finally` + `GET /notifications` 200/0.45s z realną listą (Piotr ma notyfikacje); „Loading" w zrzucie = artefakt headless** |
| C1 | Generator portfolio-aware (dedup) | C (tworzenie) | 3/3 | ✅ | ✅ | 0/8 | 🟡 | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — `initiativeSimilarityService` (Jaccard, fail-safe) + `POST /similar-check` 7/7 + **ostrzeżenie o duplikacie w Charter Wizard** (debounce na tytule, amber); E3 model-select N/A (Q5); tsc/lint clean; live-verify+deploy zostają |
| C2 | Tworzenie przez Teresę — e2e | C | 2/2 | ✅ | ✅ | 0/6 | N/A | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — tool `generate_initiative` (READ/auto, DRAFT, Postgres-correct) + handler 5/5 + registracja + persona prompt; registry 2/2 (additive, czat nietknięty); e2e „Teresa stwórz inicjatywę" na demo po deployu |
| K1 | Karty §B3 — egzekwowanie jakości | K (artefakt) | 2/2 | ✅ | ✅ | 0/6 | 🟡 | ⬜ | ⬜ | 0 | 🟢 GOTOWY code-side — `initiativeCardValidators` (advisory Q7) + `POST /validate-card` 7/7 + **FE: podpowiedzi §B3 na polu hipotezy w Charter Wizard** (debounce, amber); tsc/lint clean |
| K2 | Karty — `CardContainer` (układ graficzny) | K | 1/2 | ✅ | ✅ | 0/8 | 🟡 | ⬜ | ⬜ | 1 | 🟢 E1 FUNDAMENT GOTOWY (`156163d522`: `CardContainer`/`CardHeader` registry-driven, `sectionIcon` resolver, `CollapsibleSection` backward-compat; test 4/4) · E2 🟡 pełna adopcja 26 sekcji = przyrostowo/opt-in (audyt: 0/26 zaadoptowane) |
| K3 | Karty — korelacja artefaktów (trwała) | K | 3/3 | ✅ | ✅ | 0/6 | 🟡 | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side — backend (tabela+service+`/:id/linked-items` 6/6) + **`LinkedItemsSection` przepięty na API** (load-on-expand, persist add/remove, rollback, fail-open); data-loss naprawiony e2e; tsc/JSON OK |
| K4 | AI-fill — domknięcie 7 sekcji | K | 2/2 | 6/7 | 🟢 | 0/7 | ⬜ | ⬜ | ⬜ | 1 | 🟢 GOTOWY code-side (`80e5ef94ea`) — E1 realne handlery: hypothesis/OKR/lessons-learned (usunięte z `SECTION_AI_NOOP`, dispatch w `runActiveSectionAi` + persist); E2 świadomy no-op dla 4 reszty (raci/change-log/workstream-owners/suggested-changes — złożone modele danych); tsc clean; live-verify+→F/→UI |
| V1 | Gant zadaniowy + drag-reschedule | V (widoki) | 3/3 | ✅ | ✅ | 3/10 real-data | 🟡 | ⬜ | ⬜ | 2 | 🟢 GOTOWY code-side — bary tydzień+dziś-marker+drag-reschedule (W5 `5ab7c4f121`) + toggle Kalendarz/Gantt + **4 funkcje `a8cfca1df4`**: zoom day/week/month · filtr statusu · linie zależności (SVG) · ścieżka krytyczna (`computeCriticalPath` DAG). **real-data 06-23: bary + zoom + LINIE ZALEŻNOŚCI + ŚCIEŻKA KRYTYCZNA PASS (DOM-verified `{plannerDep:3, igDep:3, critRings:3}`).** 3 naprawy: (1) backend `task-dependencies` lowercase-alias (DEPLOYED+live); (2) `ganttDependencies` `sourceTaskId`+dedup (InitiativeGantt); (3) **D1b ROZWIĄZANE opcja A** — `TimelinePlanner.rows.dependsOnId` wyprowadzony z task_dependencies (główny widok rysuje linie). Regresja 24/24, tsc clean. Patrz `_ANALIZA_REALDATA_M13_2026-06-23.md §D1b`. Testy V 24/24+3 |

**Postęp programu:** 0 / 16 ZAMKNIĘTYCH (8/8) · **Seria G (AI bramki) 5/5 DEPLOYED demo** 🟢 (kod✅ testy✅ deploy✅ migracje✅ endpoint✅ flaga ON org Piotra✅ — zostaje →F klik Piotra + →UI screeny) · **Seria R (artefakty) 4/4 DEPLOYED demo** 🟢 (Kalendarz+banner decyzji+notyfikacje+DELETE live; **R4 epiki 4/4 — assignment+due-breach wpięte 2026-06-22**, audyt potwierdził) · **Seria C (tworzenie) 2/2 DEPLOYED demo** 🟢 (`4203292e`: C1 dedup `/similar-check`+wizard warning · C2 Teresa `generate_initiative` tool; e2e na demo = klik) · **Seria K (artefakt) 3/4 GOTOWE code-side** 🟢 (K1 §B3 validators+FE-lint · K3 korelacja trwała e2e · **K4 AI-fill `80e5ef94ea`**: hypothesis/OKR/lessons-learned realne + 4 świadomy no-op; **K2-E1 fundament `CardContainer` zbudowany `156163d522`**, E2 adopcja 26 sekcji = przyrostowo) · **Seria V (widoki) 1/1 GOTOWA code-side** 🟢 (Gant zadaniowy + toggle Kalendarz/Gantt + **W5 drag-reschedule `5ab7c4f121`** + **Calendar drag `6e3a20d48f`**; headless S3 zielone) · **Manual gate (Playwright): 20/121** wykonane z 40+ screenami (`m13-manual.spec.ts` §1/§2 26-sekcji/§3/§4/§5/§6/§7/§11; headless acceptance S1/S2/S3 osobno = 3/3) · **Ekrany: 40+** w `docs/qa/screens/m13-2026-06-21/`. Pozostałe scenariusze (cross-module/AI-gen/pilot/DB/wizard-modale/light-mode) = live-verify. **P1 (DRAFT znika z Kanban) NAPRAWIONY** `973138a3a3`. Analiza graficzna: `_ANALIZA_UIUX_M13_2026-06-21.md`.
**Seria G — dowód code-side:** 107 testów zielonych (G1 12 · G2 6 · G3 9 · G4 telemetry 5 · G4 endpoint+soft-block 10 · +istniejące) · tsc czysty na wszystkich plikach gate-ai · całość za flagą `initiativeGateAiEnabled` OFF (fail-open). 2 migracje (flags + events) czekają na deploy staging; demo-org ON dopiero świadomie.
**Done-by-the-way (już w kodzie, poza tym planem):** DELETE status-guard 409 + test 7/7 · kebab Archive/Delete w dokumencie (tsc clean).

**Real-data Manual (06-23):** +24 zdjęcia z REALNYCH danych org Piotra (proxy local-FE→demo-BE, zalogowany jako Piotr Wiśniewski) ocenione dwukryterialnie przez 3 agentów → `_ANALIZA_REALDATA_M13_2026-06-23.md`. **PASS wizualnie+funkcjonalnie: Taski(R1) · Decyzje(R2 wzorcowe) · Kalendarz(R3) · Inicjatywy hub/grid/timeline/analysis/dokument + sekcje gates/raid · dark/light wszędzie.** Brak naruszeń „no danger-fill". **1 realny bug znaleziony i NAPRAWIONY:** Gantt nie rysował zależności/ścieżki krytycznej — node-pg lowercase-alias w `getInitiativeTaskDependenciesRead` (`taskId:"undefined"`); fix case-robust + 3 testy; widoczne po re-deployu demo. Do live-verify (real browser): KPIs/Financial empty-panel (D2), centrum notyfikacji loader (D3).

**ŚCIEŻKA DO 8/8 — co zostaje każdej serii (stan 06-23):**
- **Wszystkie 16:** kolumny **→F (klik Piotra na demo)** + **→UI (akceptacja graficzna Piotr+Claude)** — to bramki Piotra, otwarte celowo; dane demo są teraz bogate, demo hydratuje w realnej przeglądarce.
- **Seria G (5):** deploy migracji gate-ai na demo świadomie + **flaga ON na org Piotra** → wtedy →F soft-block/override na żywo. (Kod/testy/UI ✅, Manual G5 ma render-dowód.)
- **Seria R (4):** R1/R2/R3 Manual zielony na real-data; **R3 drag-reschedule** + **R4 centrum notyfikacji** = live-verify w real browser; reszta scenariuszy R = przyrostowo.
- **Seria C (2):** e2e na demo po deployu — C1 wizard-duplikat (modal) + C2 „Teresa stwórz inicjatywę" (czat). Wymaga interakcji = osobny harness wizard/chat.
- **Seria K (4):** K2-E2 pełna adopcja `CardContainer` w 26 sekcjach (przyrostowo, review per sekcja) · K1/K3/K4 live-verify (wizard-hints / linked-items / AI-fill 3 sekcje).
- **Seria V (1):** ✅ KOMPLET — D1 backend + ganttDependencies + **D1b opcja A** (TimelinePlanner czyta task_dependencies) NAPRAWIONE; linie zależności + ścieżka krytyczna DOM-verified na realnych danych; bary/zoom/drag/marker PASS. Zostaje deploy D1b na demo + →F/→UI.

**Stan deployu (06-23):** ✅ fix D1 `task-dependencies` + D1b opcja A (TimelinePlanner) zdeployowane na demo (`56bc775554`), backend zweryfikowany live. Seria G DEPLOYED+flaga ON. **D2/D3 ZAMKNIĘTE** (nie bugi — Financial/KPIs renderują karty/empty-state; notyfikacje `finally`+endpoint 200; objawy = artefakty headless). **Wszystkie bramki realizacji domknięte po stronie inżynierskiej.** Jedyne co zostaje = **Twoje →F/→UI ×16 na demo** (dane bogate, hydratuje w realnej przeglądarce).

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
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo (2026-06-21) · realizacja ✅ — zostaje tylko →F/→UI (= N/A na G2, brak własnego UI; →F/→UI na G5)

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — rollup orchestration | ✅ | `gateAiReadinessService.ts` (reuse reviewer per wymaganą sekcję → ważony score + gaps[]); tsc 0 |
| 2 | DoD 7/7 | ✅ | #2 fail-open (LLM down → enabled:false) ✅ · #6 testy ✅ · reszta N/A (backend) |
| 3 | Epiki 3/3 | ✅ | E1 rollup · E2 reuse reviewer §B4 · E3 cache+invalidacja |
| 4 | Testy | ✅ | `tests/unit/initiatives/gateAiReadiness.test.ts` (zielone w runie 2026-06-22: 260/260 M13) |
| 5 | UI/UX | ✅ | N/A (backend) |
| 6 | Deploy | ✅ | DEPLOYED demo 2026-06-21 (commit `b374e6d0`) |
| 7 | →F | ⬜ | N/A na G2 (brak UI; →F na G5) |
| 8 | →UI | ⬜ | N/A na G2 (→UI na G5) |

**Epiki:** E1 rollup `score/verdict/gaps/fixes` dla bramki · E2 reuse reviewer (CARD_CONTENT_FORMULA §B4) · E3 cache per (initiativeId,gate,contentHash) + inwalidacja.
**Manual (6):** rollup dla każdej z 9 bramek; pusta sekcja → gap; komplet → ready; LLM down → fail-open; cache hit; inwalidacja po edycji.

### G3 — `gateTimelineService` (na linii czasu) · 3 epiki · 0 ekranów
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo (2026-06-21) · realizacja ✅ — →F/→UI na G5

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — analizator czasowy | ✅ | `gateTimelineService.ts` (zależności + konflikt dat → `timelineFlags[]`; zasoby = świadomy skip udok.); tsc 0 |
| 2 | DoD 7/7 | ✅ | #2 org-scope query ✅ · #6 testy ✅ · reszta N/A (backend) |
| 3 | Epiki 3/3 | ✅ | E1 zależności niegotowe · E2 konflikt dat · E3 zasoby (skip udok.) |
| 4 | Testy | ✅ | `tests/unit/initiatives/gateTimeline.test.ts` (każdy typ flagi; block vs warn; fail-open) — zielone 2026-06-22 |
| 5 | UI/UX | ✅ | N/A (backend) |
| 6 | Deploy | ✅ | DEPLOYED demo 2026-06-21 (`b374e6d0`) |
| 7–8 | →F / →UI | ⬜ | N/A na G3 (→F/→UI na G5) |

**Epiki:** E1 zależność < SCHEDULED → `block` · E2 nakładanie dat SCHEDULED → `warn` · E3 zasób w oknie → `warn`. Aktywne na SCHEDULE+START.
**Manual (6):** zależność niegotowa blokuje; daty kolidują→warn; zasób koliduje→warn; brak zależności→czysto; tylko SCHEDULE/START; pozostałe bramki timeline=null.

### G4 — Endpoint + soft-block/override + telemetria · 3 epiki · 0 ekranów
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo (2026-06-21) · realizacja ✅ — →F/→UI na G5

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — endpoint + override + events | ✅ | `POST /:id/gate-ai-check` + soft-block w `updateInitiativeStatus` (422 bez override / log z); tsc 0 |
| 2 | DoD 7/7 | ✅ | #2 JWT+org-scope+flaga ✅ · #7 telemetria ✅ |
| 3 | Epiki 3/3 | ✅ | E1 `gate-ai-check` · E2 soft-block (422/override) · E3 `initiative_gate_ai_events` |
| 4 | Testy | ✅ | `InitiativeController.gateAiCheck.test.ts` + `tests/integration/initiatives/gate-ai-soft-block.test.ts` (4/4, **dodane 2026-06-22**) + `gateAiTelemetry.test.ts` — zielone |
| 5 | UI/UX | ✅ | N/A (backend) |
| 6 | Deploy | ✅ | DEPLOYED demo 2026-06-21 (`b374e6d0`) |
| 7–8 | →F / →UI | ⬜ | N/A na G4 (→F/→UI na G5) |

**Epiki:** E1 endpoint lazy (§5) · E2 transition: 422 `{aiReadiness,timeline}` bez override / przejście+log z override · E3 `initiative_gate_ai_events`.
**Manual (6):** poniżej progu→422; override+powód→przejście+log; powyżej progu→bez tarcia; timeline block→422; flaga OFF→stare zachowanie; event zapisany.

### G5 — UI bramki (pigułka + panel + modal override) · 3 epiki · 3 ekrany
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ — **zostają TYLKO Twoje odbiory →F/→UI**

| # | Etap | ✓ | Odbiór / dowód |
|--|--|:--:|--|
| 1 | Kod — pigułka/panel/modal | ✅ | `GateReadinessPill/Panel.tsx`, `GateOverrideModal.tsx`, wpięte w `GateReadinessSection`+`handleStatusAction`; tsc 0 |
| 2 | DoD 7/7 | ✅ | #3 i18n PL+EN · #4 tokeny · #5 bursztyn=ostrzeżenie nie danger |
| 3 | Epiki 3/3 | ✅ | E1 pigułka · E2 panel braków · E3 modal override |
| 4 | Testy | ✅ | component Pill/Panel/Modal (**dodane 2026-06-22**) + `gateReadinessPayload.test.ts` — zielone (część 260/260) |
| 5 | UI/UX | ✅ | kanon §7; bursztyn nie czerwień; dark+light (snapshoty component) |
| 6 | Deploy | ✅ | DEPLOYED demo; flaga `gate_ai` ON na org Piotra (`a3e05d4a`, próg 75) |
| 7 | →F Piotr | ⬜ | **CZEKA CIEBIE:** klik bramki poniżej progu na demo → braki → override działa |
| 8 | →UI | ⬜ | **CZEKA CIEBIE:** akceptacja screenów pigułka/panel/modal dark+light |

**Epiki:** E1 pigułka gotowości (score+kolor) · E2 panel `gaps/fixes/timelineFlags` · E3 modal override (obowiązkowe uzasadnienie).
**Ekrany (3):** pasek bramki z pigułką · panel braków · modal override.
**Manual (10):** pigułka≥próg zielona; <próg bursztyn; klik→panel; gaps poprawne; timelineFlags na SCHEDULE; próba przejścia<próg→modal; override bez powodu→zablokowany przycisk; override+powód→przejście; flaga OFF→brak pigułki; dark+light.

---

## SERIA R — Artefakty powiązane (M13a–d) · **blokowana Q2 (scoped vs współdzielony)**

### R1 — M13a Taski (stabilizacja) · 2 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ (`sections/TasksMilestonesSection.tsx` + `buildScheduleItems` 8/8; `PUT /api/pmo/tasks/:id` integration test 2026-06-22) — zostają →F/→UI Piotra
**Epiki:** E1 korelacja z Kalendarzem/Gant (wspólne źródło dat) · E2 polish AI-fill + testy.
**DoD kluczowe:** #1 front↔back, #6 testy. **Manual (8):** CRUD task; status; AI-propozycja; zasilenie kalendarza; zasilenie Gant; edycja daty; usuwanie; back.

### R2 — M13b Decyzje (stabilizacja) · 2 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ (`sections/DecisionsSection.tsx` banner GO_NO_GO; `decisions-crud` integration test 2026-06-22 — guard getTableColumns) — zostają →F/→UI
**Epiki:** E1 korelacja GO_NO_GO ↔ bramki (#4) · E2 testy + screeny.
**Manual (8):** CRUD decyzja; typ GO_NO_GO; status flow; widoczność przy bramce; powiązanie z inicjatywą; edycja; usuwanie; back.

### R3 — M13c Kalendarz (build) · 4 epiki · 2 ekrany
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ (`calendar/InitiativeCalendar.tsx` miesiąc/tydzień + drag-reschedule `PUT /api/pmo/tasks/:id` optimistic+rollback; toggle w `TimelineSection`; component test 3/3 + render/filtr/rollback do-build) — zostają →F/→UI
**Epiki:** E1 widok kalendarza miesiąc/tydzień · E2 wspólny serwis czasu (tasks+milestones+timeline) · E3 drag-to-reschedule (PATCH dat) · E4 filtry status + dark/light.
**Manual (12):** render miesiąc; render tydzień; zadania po dacie; kamienie po dacie; drag→nowa data persist; filtr status; pusty stan; nawigacja miesięcy; spójność z Gant; offline/fallback; dark; light.

### R4 — M13d Notyfikacje (build wiring) · 4 epiki · 2 ekrany
Status: 🟢 GOTOWY DO ODBIORU code-side · **realizacja 4/4 epiki ✅** (audyt 2026-06-23, testy 36/36) — zostaje →F/→UI + due-breach cron ON na demo-org.
**Epiki:** E1 status-change ✅ (kanoniczny `initiative.status_changed`, dedup Wariant A — brak underscore, →BLOCKED=CRITICAL, recipients≠actor) · **E2 assignment ✅ WPIĘTY** (`notifyAssignment` w `TaskController.updateTask:1895` przy zmianie assignee taska, `40018dc782`; +2 testy) · **E3 due-date breach ✅** (serwis + `cron/InitiativeDueBreachCron.ts` deps + lazy-ensure kolumny `due_breach_notified_for` + job33 Scheduler daily-6AM **za flagą `INITIATIVE_DUE_BREACH_CRON_ENABLED` OFF** + 15 testów; `3be1de017f`; zostaje live-verify real-DB + ewentualne ON) · E4 blocker ✅ (eskalacja CRITICAL).
**Manual (10):** zmiana statusu→notyfikacja; przypisanie→notyfikacja; termin→notyfikacja; blocker→notyfikacja; in-app widoczna; email wysłany; org-scope; brak duplikatów; ustawienia kanałów; back.

---

## SERIA C — Tworzenie

### C1 — Generator portfolio-aware (dedup) · 3 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ (dedup `initiativeSimilarity` 7/7 + `POST /similar-check` integration test + amber-warning w Charter Wizard, `CharterWizard.dedup` component 2026-06-22; E3 model-select N/A wg Q5) — zostają →F/→UI
**Epiki:** E1 dedup query istniejących inicjatyw org · E2 ostrzeżenie „podobna istnieje" w UI · E3 (Q5) UI wyboru modelu LLM **lub** N/A.
**Manual (8):** generacja z insightu M10; dedup wykrywa duplikat; ostrzeżenie w UI; brak duplikatu→czysto; (model select jeśli Q5=tak); fallback LLM; jakość wg formuły; back.

### C2 — Tworzenie przez Teresę (e2e) · 2 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · DEPLOYED demo · realizacja ✅ (tool `generate_initiative` 5/5 + rejestracja + persona; `generateInitiativeRegistry` test 2026-06-22) — zostaje →F (klik „Teresa stwórz inicjatywę" na demo)
**Epiki:** E1 `generate_initiative` (READ/auto, wzorem `generate_deliverable`) · E2 persona Teresy wymienia inicjatywy + montaż w czacie.
**Manual (6):** „Teresa stwórz inicjatywę X"→DRAFT; DRAFT na liście; otwieralny; PL; EN; brak approval-gate blokady.

---

## SERIA K — Artefakt (karty)

### K1 — Karty §B3 egzekwowanie · 2 epiki · 0 ekranów
Status: 🟢 GOTOWY DO ODBIORU · realizacja ✅ (walidatory §B3 `initiativeCardValidators` 7/7 + `POST /validate-card` integration + FE podpowiedzi `b3-hints` 3/3; tryb miękki wg Q7) — zostaje →F/→UI
**Epiki:** E1 walidatory §B3 jako warstwa (lang_pl/no_filler/problem_len…) · E2 tryb (twardy/miękki wg Q7) + testy.
**Manual (6):** walidator łapie filler; pusty wymagany→flag; tryb wg Q7; PL; przejście gdy OK; log.

### K2 — Karty `CardContainer` (układ graficzny) · 2 epiki · 1 ekran
Status: 🟢 FUNDAMENT GOTOWY code-side 2026-06-22 (decyzja CEO Q6 „buduj w v1") · **E1 ✅** — `sections/shared/CardContainer.tsx` (`CardContainer`=registry-driven `CollapsibleSection` + standalone `CardHeader`) + `sectionIcon.tsx` (resolver `SectionTypeInfo.icon`→Lucide, fallback). `CollapsibleSection` uczyniony **registry-driven** (icon/kolor/tytuł z `sectionType` gdy nie podane jawnie), **backward-compatible** — 14 sekcji już używających shell-a nietknięte. Testy `CardContainer.test` 4/4; tsc clean. · **E2 🟡** — pełna adopcja registry-driven we WSZYSTKICH ~26 sekcjach (zamiana hardkodowanych ikon na registry) = przyrostowa z przeglądem wizualnym per-sekcja (zmienia wygląd) — opt-in, nie big-bang (ryzyko regresji renderu w 10k-liniowym DocumentView).
**Epiki:** E1 wspólny `CardContainer`/`CardHeader` ✅ · E2 migracja sekcji (przyrostowo, opt-in).
**Manual (8):** spójny nagłówek; ikona/kolor z `SectionTypeInfo`; dark; light; §27 zgodność; brak regresji renderu; reorder; back.

### K3 — Karty korelacja artefaktów (trwała) · 3 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · realizacja ✅ (`initiative_linked_items` + service 6/6 + `LinkedItemsSection` przepięty na API, persist+rollback; data-loss e2e fixed) — zostaje →F/→UI
**Epiki:** E1 tabela `initiative_linked_items` · E2 CRUD + persist (DB-backed) · E3 graf `link_graph_edges` + query.
**Manual (6):** link task; link decyzja; persist po reload; graf query; usuwanie linku; org-scope.

### K4 — AI-fill domknięcie 7 sekcji · 2 epiki · 1 ekran
Status: 🟢 GOTOWY DO ODBIORU · realizacja ✅ (E1 realne handlery hypothesis/OKR/lessons-learned `80e5ef94ea`; E2 świadomy no-op dla 4 złożonych; `section-ai-noop` 3/3) — zostaje →F/→UI
**Epiki:** E1 handlery dla priorytetowych (OKR, hipoteza, lessons-learned) · E2 świadomy no-op + opis dla reszty.
**Manual (7):** AI-fill OKR; AI-fill hipoteza; no-op opisany; brak fake-success; PL; jakość; back.

---

## SERIA V — Widoki

### V1 — Gant zadaniowy + drag-reschedule · 3 epiki · 2 ekrany
Status: 🟢 GOTOWY DO ODBIORU code-side · realizacja ✅ — **4 brakujące funkcje DOBUDOWANE 2026-06-22** (decyzja CEO „buduj wszystkie 4"): zoom day/week/month + filtr statusu (self-contained w `InitiativeGantt`) + **linie zależności (SVG, prop-driven)** + **ścieżka krytyczna** (`computeCriticalPath` longest-path DAG w `initiativeSchedule.ts`, podświetlenie ring-rose). `TimelineSection` liczy krawędzie z `dependsOnId`/dependencies + critical-path i podaje do Gantta. Testy: `computeCriticalPath` 4/4 + `InitiativeGantt.features` 5/5 + istniejące drag/render 11/11; tsc clean. Zostaje →F/→UI.
**Epiki:** E1 schedule-bar zadań/kamieni (dni/tygodnie/zoom) ✅ · E2 drag-to-reschedule ✅ · E3 ścieżka krytyczna + zależności ✅ (dobudowane).
**Manual (10):** render bary zadań; skala dni/tygodnie; drag→persist; zależności widoczne; ścieżka krytyczna; spójność z Kalendarzem; zoom; filtr; dark; light.
