# HANDOFF — M13 Inicjatywy (przekazanie kontekstu następnemu agentowi)

> **Data:** 2026-06-22 · **Powód:** zmiana konta (wyczerpane tokeny) · **Autor:** Claude (CTO, poprzednia sesja)
> **Branch:** `feat/deliverables-w1` @ `c2971523f3` (zsync z origin) · **Deploy:** `origin/demo` @ `ab19da8fc7` (demo.consultify.ai)
> **Dla kogo:** świeży agent bez historii rozmowy. Ten plik = pełny kontekst, żebyś mógł kontynuować bez pytań wstępnych.

---

## 0. JAK UŻYĆ TEGO DOKUMENTU (czytaj najpierw)

1. Przeczytaj §1 (kim jesteś, twarde zasady) — **to nadpisuje wszystko, łam tylko za zgodą Piotra**.
2. Przeczytaj §2 (stan gita — krytyczne: jest DRUGA równoległa sesja na tym branchu).
3. §3 = pełny status programu M13. §4 = co zrobiła ta sesja. §5 = wiedza-która-kosztowała (gotchas).
4. §7 = jak uruchamiać testy. §8 = co blokuje Piotr. §9 = co robić dalej (priorytety).
5. Pamięć trwała jest w `/Users/piotrwisniewski/.claude/projects/-Users-piotrwisniewski-Documents-Antygracity-DRD-consultify/memory/` — `MEMORY.md` to indeks. Najważniejsze wpisy: `finding_night_run_2026-06-21`, `finding_ideas_m5_m9_closure_2026-06-21`, `finding_e2e_mockdb_lower_email_and_demo_readonly`, `project_m13_depth_program`, `project_wdrozenie_100`.

---

## 1. KIM JESTEŚ I TWARDE ZASADY (nie łam bez zgody)

- **Piotr** = produkt+strategia (wymyśla+testuje funkcje, robi odbiory). **Ty (Claude) = CTO** — robisz CAŁĄ inżynierię, decyzje techniczne/infra/deploy. Komunikacja po polsku. Styl UX: Miro-like.
- **PROD = świętość.** PROD to baza `centerbeam` (Railway). NIGDY nie deployuj kodu na prod bez OSOBNEJ, jawnej zgody. Staging/demo najpierw. (Ta sesja: Piotr explicite wybrał **tylko demo**, prod nietknięty.)
- **Deploy demo:** branch `feat/deliverables-w1` → merge do `origin/demo` → Railway auto-deployuje demo.consultify.ai. Merge robiony przez osobny worktree `/tmp/m13-consolidate` (checkout `demo`, merge `origin/feat/deliverables-w1`, push).
- **Git higiena:** NIGDY `git add -A` (łapie sekrety/duże binaria). Pliki testów są gitignored → `git add -f tests/...`. Screeny w `docs/qa/` są trackowane.
- **Weryfikuj zanim ogłosisz „done":** zmiana UI → otwórz w preview/e2e + dowód (screenshot). NIE raportuj „zrobione" na podstawie samego tsc/eslint. Zmiana backendu → przynajmniej tsc + idealnie test.
- **`.env.local` nadpisuje `DATABASE_URL`** — uważaj żeby nie uderzyć w centerbeam (prod).
- **Pamięć:** zapisuj trwałe ustalenia do `memory/` (jeden fakt = jeden plik + wpis w `MEMORY.md`).

---

## 2. STAN GITA (KRYTYCZNE — czytaj uważnie)

- **Twój branch roboczy:** `feat/deliverables-w1`. HEAD = `c2971523f3`. Zsync z `origin`.
- **⚠️ DRUGA RÓWNOLEGŁA SESJA jest aktywna na tym samym branchu** — inny agent robi **program Deliverables (M17-M20)**: commity `deliverables/*`, `B3/B4-ext`, `content-gen`, `X1-X6`, `quality harness`. **Widać je przeplecione z moimi M13.** Skutki dla Ciebie:
  - Przed pushem ZAWSZE `git fetch` + sprawdź czy origin się ruszył; jeśli tak — **rebase, nie merge** (czysta historia) LUB cherry-pick swoich zmian. Git-race jest realny.
  - „ahead N" względem origin może być commitami DRUGIEJ sesji (nie Twoimi) — NIE pushuj cudzej pracy.
  - Pracuj na plikach M13 (`src/components/Initiatives/`, `server/src/...initiative...`, `tests/e2e/m13/`) — nie kolidują z deliverables (`src/components/ReportsAndPresentations/`, `Studio/`, `server/...deliverable...`).
- **Moje commity M13 tej sesji (rozpoznasz po tagach `(M13...)`/`(M06/M07...)`/`(M13/R4)`/`(M13/V)`):**
  `973138a3a3` P1 ACTIVE_STATUSES · `7af683bc83` 2 tsc fixy + manual 20 · `dfef7863cd` light-mode · `bc5214cb31` notifyBlocker + plan testów · `c2971523f3` Calendar drag test. Plus wcześniejsze (W5 Gantt `5ab7c4f121`, Calendar drag `6e3a20d48f`, Serie C `63d6cecc7f`, mock-DB+harness `39380c9ded`, M07 data-loss `b8626b01b1`).
- **Pre-existing uncommitted (NIE moje):** ~80 zmodyfikowanych plików (głównie `docs/qa/screens/m06/*` i deliverables WIP) — to stan drugiej sesji / iCloud. NIE commituj ich hurtem.

---

## 3. STATUS PROGRAMU M13 DEPTH (16 sub-modułów, serie G/R/C/K/V)

**SSOT operacyjny:** `Harvard/wdrozenie-100/M13-STAN-PRACY-ODBIORY.md` (per-sub-moduł, najświeższy).
**Stan zbiorczy:** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` (cały program 27 modułów; M13 = wiersz).

**0/16 ZAMKNIĘTYCH (8/8)** — bo „ZAMKNIĘTY" wymaga odbiorów →F/→UI Piotra. **Kod: 15/16 gotowe** (tylko K2 czeka na decyzję Q6).

| Seria | Stan | Szczegół |
|---|---|---|
| **G — bramki AI** (G1-G5) | 🟢 5/5 DEPLOYED demo | flaga+próg, readiness-rollup, timeline-gate, endpoint+override, UI(pill/panel/modal). ~107 testów. Za flagą `initiativeGateAiEnabled` (OFF domyślnie, ON dla org Piotra na demo) |
| **R — artefakty** (R1-R4) | 🟢 4/4 DEPLOYED (R4 ogon) | R1 Taski, R2 banner decyzji, R3 Kalendarz **+drag**, R4 notyfikacje: status-change ✅ + **notifyBlocker ✅** (ta sesja); **notifyDueBreach = cron-job NIE zrobiony** (infra) |
| **C — tworzenie** (C1-C2) | 🟢 2/2 DEPLOYED | C1 dedup `/similar-check`+wizard-warning, C2 Teresa `generate_initiative`. + konsolidacja (shared Jaccard primitive) |
| **K — jakość kart** (K1-K4) | 🟢 3/4 · ⬜ K2 | K1 §B3 validators, K3 linked-items, K4 AI-fill (hypothesis/OKR/lessons-learned). **K2 CardContainer = ⬜ czeka Q6** (jedyny pozostały kod-task serii K) |
| **V — widoki** (V1) | 🟢 1/1 | Gantt + **W5 drag** + **Calendar drag**, toggle Kalendarz/Gantt w TimelineSection |

**Bramka Manual (cross-cutting):** **20/121** scenariuszy wykonane w Playwright + **40+ screenów** + analiza graficzna. Reszta = headless-niemożliwe → real-browser/człowiek.
**→F / →UI:** 0 (wszystko czeka na Piotra).

---

## 4. CO ZROBIŁA TA SESJA (pełny log)

### Naprawione bugi (realne)
- **P1 — DRAFT znika z Kanban** (`973138a3a3`): `ACTIVE_STATUSES` (w `src/utils/initiativeHelpers.ts`) nie zawierał DRAFT/PENDING_REVIEW → świeżo utworzona inicjatywa nie miała kolumny i była wykluczana z fetcha → znikała z domyślnej tablicy. Fix: DRAFT+PENDING_REVIEW na początku tablicy. Dowód: `docs/qa/screens/m13-2026-06-21/s1a-P1-draft-visible-kanban.png`. Zweryfikowane (manual §1a-P1).
- **M07 P0 data-loss** (`b8626b01b1`, wcześniej w sesji): `useIdeaMapSync.ts` czyścił `queuedPayloadRef` bezwarunkowo w success-path → deferred payload (zakolejkowany przez 2. call w trakcie await) ginął → węzły znikały po reloadzie. Fix: czyść tylko gdy `=== payload` który zapisaliśmy. **Radiuje na M06/M08/M09** (wspólny hook). Zweryfikowane: M08 20/20 + regression-test 7/7.
- **2 błędy tsc** (`7af683bc83`): `'process_flow'`→`'processflow'` (IdeaProcessFlowTool — toolType ignorowany w hooku, czysty type-fix) + `PortfolioInitiative.title?` dodane.
- **Light-mode capture** (`dfef7863cd`): motyw to **Zustand store** (`useAppStore.theme`, persist key `consultify-storage` v2), NIE localStorage 'theme'. Naprawiony helper `forceTheme` w `tests/e2e/m13/_m13.ts`. Zweryfikowane wizualnie (biały hub).

### Nowy kod (funkcje)
- **R3 Calendar drag-reschedule** (`6e3a20d48f`): mirror W5 Gantt — HTML5 drag, `PUT /api/pmo/tasks/:id`, optymistyczny+rollback. `src/components/Initiatives/calendar/InitiativeCalendar.tsx`.
- **W5 Gantt drag-reschedule** (`5ab7c4f121`): pointer-events, snap-to-day, optymistyczny+rollback. `src/components/Initiatives/gantt/InitiativeGantt.tsx`.
- **R4 notifyBlocker** (`bc5214cb31`): w `server/src/controllers/InitiativeController.ts` (blok status-change ~linia 1947) — na →BLOCKED odpala `notifyBlocker` (CRITICAL+reason) zamiast generycznego INFO. Fail-safe, tsc-clean. ⚠️ **runtime-firing jeszcze nie zaasertowane** (integration-test = P0 gap w planie).
- **K4 AI-fill** (`80e5ef94ea`): hypothesis/OKR/lessons-learned realne handlery (usunięte z `SECTION_AI_NOOP` w `InitiativeDocumentView.tsx`).
- **Serie C konsolidacja** (`63d6cecc7f`): wspólny `similarityPrimitives.ts` (Jaccard); oba endpointy `/similar-check` + `/similarity-check` nietknięte.

### Testy dodane (ta sesja)
- `tests/e2e/m13/m13-manual.spec.ts` — **20 scenariuszy** (§1/§2 26-sekcji/§3/§4/§5/§6/§7/§11), 40+ screenów. Helper `tests/e2e/m13/_m13.ts`.
- `tests/components/Initiatives/InitiativeGantt.drag-reschedule.test.tsx` (3) + `InitiativeCalendar.drag-reschedule.test.tsx` (3).
- `tests/hooks/useIdeaMapSync.deferred-payload.test.ts` (1) + `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` (3). Razem regression 7/7.
- Test-infra: mock-DB `LOWER(email)` fix + demo-readonly→bootstrap harness (`39380c9ded`) — odblokowało 127 testów M06.

### Dokumenty (SSOT)
- `_PLAN_TESTOW_M13.md` — pełny plan testów (kod+manual). **Czytaj go — to mapa drogowa testowania.**
- `_ANALIZA_UIUX_M13_2026-06-21.md` — analiza graficzna (5 zasad Piotra, per-powierzchnia).
- `_BACKLOG_PORANNY_2026-06-22.md` — co wymaga Piotra (sekcja A) + dług (B) + zrobione (C/C0).
- `M13-STAN-PRACY-ODBIORY.md` zaktualizowany (R3 drag, manual 20, P1 fixed).

### 5 agentów (równolegle, worktree) — wynik
Calendar drag ✅ · Serie C konsolidacja ✅ · M10 E2E→tier0-gate ✅ (`tests/e2e/smoke/tier0-interview.spec.ts`) · regresja 7/7 ✅ · activity-mock ⏭️ odrzucony (redundancja z LOWER(email) fix). Worktree posprzątane.

---

## 5. WIEDZA KTÓRA KOSZTOWAŁA (gotchas — oszczędzą Ci godzin)

1. **CI uruchamia tylko `tests/unit|integration|components`** (jawne ścieżki). Testy pod `tests/e2e/` NIE trafiają do PR-gate — trzeba je dopisać do `test:e2e:tier0` (lista w `package.json`, gate w `.github/workflows/test-suite.yml` job `e2e-tests`). **Kładź luka-testy w `tests/`, nie `src/__tests__`.**
2. **E2E lokalny: `workers=2` to BEZPIECZNY SUFIT.** workers=3+ timeoutuje mock-DB. Komenda: `E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/m13/ --workers=2`.
3. **register-demo daje sesję READ-ONLY** (403 `DEMO_READ_ONLY` na zapisach). Do testów write-access używaj **test-support bootstrap** (`POST /api/test-support/bootstrap`, header `x-test-support-key`, zwraca non-demo ADMIN token). Wzorzec w `tests/e2e/m13/m13-acceptance.spec.ts` (`readTestSupportState`) i `_m13.ts`.
4. **Modale headless NIE montują się** (wizardy Charter/AI, M09 canvas) — portal/session-effect. Potwierdzone twardo. Te scenariusze MUSZĄ iść przez realną przeglądarkę (computer-use / Piotr na demo). NIE marnuj czasu na headless.
5. **`openDoc` musi czekać na nav sekcji, nie na tytuł** — tytuł inicjatywy pojawia się TEŻ jako wiersz listy w hubie, więc czekanie na tytuł daje fałszywy „dokument otwarty" (faktycznie hub). `_m13.ts:openDoc` czeka na `sectionNavLocator` (drag-handle markery) z retry.
6. **reactflow tsc-quirk (NIE błąd kodu, NIE ruszaj pochopnie):** tsc twierdzi że `useUpdateNodeInternals`/`useNodesInitialized` nie są eksportowane z `reactflow` — ale barrel `reactflow/dist/esm/index.d.ts` robi `export * from '@reactflow/core'` i core JE eksportuje. Runtime działa (vite buduje, e2e zielone). To `moduleResolution:"bundler"` quirk. **Fix = czysty reinstall** (`rm -rf node_modules/.ignored && npm ci`), NIE chirurgia importów (ryzyko regresji 4 narzędzi Ideas). Total tsc FE = ~15 błędów, większość to ten reactflow + middleware/jsonwebtoken (pre-existing, runtime-fine).
7. **Build vite wymaga `NODE_OPTIONS=--max-old-space-size=8192`** (inaczej OOM Abort trap 6). Już ustawione w `playwright.config.ts` webServer.
8. **`Date.now()`/`Math.random()`/`new Date()` są OK w testach vitest/playwright** (tylko w skryptach Workflow są zablokowane).
9. **iCloud duplikuje katalogi** (`test-results 2/3/4`, `* 2.ts`, `node_modules/.ignored`) — ignoruj duplikaty z numerami/spacjami.

---

## 6. MAPA PLIKÓW M13 (gdzie co jest)

**Frontend:**
- `src/components/Initiatives/InitiativesHub.tsx` — hub (kanban/lista/timeline/grid, CTA wizardów, default `viewMode='kanban'`).
- `src/components/Initiatives/InitiativeDocumentView.tsx` — dokument 26-sekcyjny (~10k linii; `SECTION_AI_NOOP`, `runActiveSectionAi`, `activeNSection`).
- `src/components/Initiatives/sections/` — sekcje (registry.ts = `SECTION_REGISTRY`, `DEFAULT_SECTION_ORDER`), `TimelineSection.tsx` (toggle Kalendarz/Gantt + drag wiring).
- `src/components/Initiatives/calendar/InitiativeCalendar.tsx` · `gantt/InitiativeGantt.tsx` — widoki V1.
- `src/components/Initiatives/Wizard/` — `InitiativeWizardModal.tsx` (testid `initiative-wizard-core-panel`), `InitiativeCharterWizard.tsx` (shared `WizardModal`).
- `src/components/Portfolio/PortfolioKanbanView.tsx` — kolumny kanban (z `ACTIVE_STATUSES`/`ALL_STATUSES`).
- `src/utils/initiativeHelpers.ts` — `ACTIVE_STATUSES`/`ALL_STATUSES` (P1 fix tu). `src/services/initiativeLifecycle.ts` — 13 statusów + przejścia.
- `src/components/MyWork/canvas/useIdeaMapSync.ts` — wspólny hook persystencji Ideas (M07 fix tu; radiuje M06/M08/M09).

**Backend:**
- `server/src/controllers/InitiativeController.ts` — CRUD + `updateInitiativeStatus` (notify wiring ~1947) + `updateInitiative` (owner-change notify ~1099).
- `server/src/services/initiative/initiativeNotificationService.ts` — emitery: `notifyStatusChange`/`notifyAssignment`/`notifyDueBreach`/`notifyBlocker`.
- `server/src/services/initiative/initiativeSimilarityService.ts` + root `initiativeSimilarityService.ts` + `similarityPrimitives.ts`.
- `server/src/routes/pmo/initiatives.routes.ts` + `tasks.routes.ts` (`POST /api/pmo/tasks`, `PUT /:id`).

**Testy:** `tests/e2e/m13/` · `tests/components/Initiatives/` · `tests/unit/initiatives/` + `tests/unit/initiativeDocumentView.*` · `tests/hooks/useIdeaMapSync.*`.

---

## 7. JAK URUCHAMIAĆ TESTY (dokładne komendy)

```bash
# Czyszczenie portów PRZED każdym e2e (krytyczne — inaczej "port already used"):
pkill -f "playwright.*test"; pkill -f "vite preview"; pkill -f "tsx src/index"
for p in 3000 3001 4173; do lsof -ti:$p | xargs kill -9 2>/dev/null; done
rm -rf dist/assets dist

# E2E M13 (manual + acceptance), headless, MOCK_DB, write-access bootstrap:
E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/m13/ --workers=2 --reporter=list
# (~14 min: build vite + run. Screeny lądują w docs/qa/screens/m13-2026-06-21/)

# Unit/component (szybkie, bez Postgresa):
npx vitest run tests/components/Initiatives/ tests/unit/initiativeDocumentView.section-ai-noop.test.ts tests/hooks/useIdeaMapSync.deferred-payload.test.ts

# tsc:
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --skipLibCheck   # FE
cd server && npx tsc --noEmit                                            # backend
```
**Aktualny stan testów (zielone):** M13 manual 20/20 · acceptance S1-S3 3/3 (razem `tests/e2e/m13/` = 27) · regression 7/7 · M08 20/20 · M06 57/5 (5=known) · M07 3/3.

---

## 8. CO BLOKUJE PIOTR (sekcja A — NIE zrobisz tego sam)

1. **Q6** — czy budować **K2 CardContainer** (refaktor ~26 sekcji do wspólnego komponentu `CardHeader`/`CardContainer`) w v1? To JEDYNY pozostały kod-task serii K. Bez decyzji NIE ruszaj (duży, zmienia wygląd wszystkich sekcji).
2. **Odbiory →F (funkcja, klik na demo) / →UI (grafika)** — przesuwają wszystkie 16 sub-modułów do ZAMKNIĘTY. Kod 15/16 gotowy; blokuje TYLKO to.
3. **Env keys na Railway** (Piotr miał ustawić): Gemini/STT na demo (M10 głos), `VITE_ENABLE_DELIVERABLES_LIGHT` (M02), superadmin (M27). Gdy ustawi — poprosi o live-verify; dopnij je wtedy.
4. **Zgoda na prod** — wszystko na demo; Londyn→prod czeka na osobną zgodę.

---

## 9. CO ROBIĆ DALEJ (priorytety dla Ciebie, następny agencie)

**Najpierw zapytaj Piotra od czego ruszamy** (Q6? wykonanie manuali? nowy moduł?). Domyślny zakres ostatnio = **głębokość M13 + szlif Ideas, deploy tylko demo**.

Bezpieczne, odblokowane, wartościowe (możesz robić bez nowych decyzji):
- **P0 — integration-test notyfikacji** (`tests/integration/initiatives/notifications.test.ts`): PATCH /status→BLOCKED ⇒ `notifyBlocker` CRITICAL; owner-change ⇒ owner_changed; bez dubla. **To weryfikuje świeży kod notifyBlocker** (obecnie tylko tsc-clean, runtime nie zaasertowany). Wymaga Postgresa (suite integration).
- **P1 — G5 override e2e** w `m13-manual.spec.ts`: status→wymaga-bramki → modal override → event telemetrii.
- **P1 — dopisać `m13-acceptance.spec.ts` do `test:e2e:tier0`** (package.json + workflow) → domyka DoD #6 (E2E w PR-gate). Wzorzec: zrobione dla interview (`tier0-interview.spec.ts`).
- **P2 — component-test §B3 hints** w Charter Wizard.

Zablokowane / NIE ruszaj nocą bez powodu:
- **K2** — czeka Q6.
- **notifyDueBreach** — to nowy cron-job (`server/src/cron/Scheduler`, skan overdue) — osobne zadanie z mock-zegarem, NIE pośpieszny dodatek.
- **reactflow tsc** — clean reinstall, nie chirurgia (patrz §5.6).
- **Manuale wizardów/cross-module/pilot** — wymagają realnej przeglądarki (Piotr na demo lub computer-use).

**Pętla autonomiczna:** poprzedni agent używał `ScheduleWakeup` (dynamic pacing) + background-tasks do długich buildów (~14 min). Jak czekasz na build/test — odpal go `run_in_background:true` i kontynuuj inną pracą, nie blokuj się.

---

## 10. SZERSZY KONTEKST (program wdrożenia 27 modułów)

M13 to część programu „Wdrożenie do 100%" (SSOT: `Harvard/wdrozenie-100/`). Stan reszty (z `_STAN_PRACY_ODBIORY.md`):
- **ZAMKNIĘTE (4):** M01 Czat, M02 Canvas, M03 My Work, M04 Notatnik.
- **Pula Ideas DO ODBIORU (zielona kodowo, czeka →F/→UI):** M05, M06 (57/5), M07 (P0 fixed), M08 (20/20), M09 (4/4; S9 headless-skeleton = nie regresja).
- **M13** = aktywny (ten handoff).
- **NIE ROZP.:** M10 Wywiad (kod sporo gotowy, blokery STT-key), M12 Audyty, M14-M27.
- **Równolegle:** druga sesja robi **M17-M20 Deliverables** (generatory doc/deck/tabela) — patrz §2 ostrzeżenie o git-race.

---

**TL;DR dla Ciebie:** M13 jest kodowo 15/16 (K2 czeka Q6), w pełni zielony testowo na demo. Backlog techniczny domknięty (poza świadomie wstrzymanym reactflow + infra due-breach). Reszta = bramki Piotra (Q6, odbiory, env, prod). Plan testów (`_PLAN_TESTOW_M13.md`) to Twoja mapa drogowa. Zacznij od zapytania Piotra o priorytet, potem P0 integration-test notyfikacji.
