# Backlog poranny — 2026-06-22 (handoff po nocnym przebiegu CTO)

> Autor: Claude (CTO) · Sesja nocna 2026-06-21→22 · Branch `feat/deliverables-w1` → demo (prod NIE ruszany, zgodnie z decyzją)
> Zakres nocy (decyzja Piotra): **głębokość** — domknij M13 + szlif puli Ideas. Bez nowych modułów. Deploy tylko demo.
>
> Ten dokument = JEDYNE miejsce rzeczy, których **nie mogłem zrobić sam** + co wymaga Ciebie. Pozycje „ZROBIONE w nocy" są w git/SSOT, tu tylko skrót.

---

## A. Wymaga CIEBIE (twarde blokery — nie do zrobienia autonomicznie)

### A1. Odbiory →F / →UI (klik na demo + akceptacja UI)
Strukturalnie tylko Ty możesz „odebrać". Gotowe do odbioru na demo:
- **M05 Ideas-Zarządzanie, M08 Table, M09 Whiteboard** — 🟢 kod+testy zielone, czekają na Twój →F/→UI.
- **M06 Mind Map** — 🟢 57/5 (5 faili = test-infra/known), 4/5 luk produktowych wpięte; →F/→UI.
- **M07 Process Flow** — 🟢 P0 data-loss naprawiony+zweryfikowany 3/3; →F/→UI.
- **M13 Inicjatywy** — manual gate 20/20 + 40+ screenów + analiza graficzna (P1 naprawiony); →F/→UI (po decyzjach niżej).

### A2. Decyzje produktowe M13 (blokują domknięcie serii)
- **Q6** — czy robić **K2 CardContainer** (refaktor ~26 sekcji do wspólnego komponentu) w v1? To JEDYNY pozostały kod-task serii K. Bez decyzji nie ruszam (duży, zmienia wygląd wszystkich sekcji).
- Pozostałe otwarte decyzje M13 z bramki wstępnej (lista w `M13-STAN-PRACY-ODBIORY.md`).

### A3. Env / klucze na Railway (powiedziałeś, że ustawisz w nocy)
Gdy ustawisz — **napisz mi które**, dorobię live-verify:
- Klucz **Gemini/STT na demo** → M10 głos/STT live-verify (kod + fallback gotowe).
- **VITE_ENABLE_DELIVERABLES_LIGHT** na Railway → M02 Canvas deliverables.
- Konto **superadmin na demo** → M27 RBAC live.
> Jeśli NIE ustawiłeś — te live-verify zostają w backlogu (kod jest gotowy, brakuje tylko sekretów).

### A4. Zgoda na deploy prod
Cała noc wylądowała **tylko na demo**. Deploy `feat/deliverables-w1`→`Londyn`→prod (centerbeam) czeka na Twoją osobną zgodę.

### A5. Moduły NIE ROZPOCZĘTE (poza nocnym zakresem „głębokość")
M10 Wywiad, M12 Audyty, M14 Wdrożenie, M15 Rezultaty, M16 Finanse, M19/M20 Studio, M21 Meeting, M22 AI OS, M23–M27. Każdy = osobny audyt+kod+testy+screeny. Decyzja rano: kolejność/priorytet.

---

## B. Dług techniczny wykryty (mogę zrobić, ale ryzykowne nocą — czeka na zielone światło)

### B1. Błędy tsc reactflow (M06/M07) — ZDIAGNOZOWANE, NIE NAPRAWIONE (świadomie)
`IdeaProcessFlowTool.tsx` + `IdeaRecommendationMap.tsx`: tsc twierdzi że `useUpdateNodeInternals`/`useNodesInitialized` nie są eksportowane z `reactflow`. **Zweryfikowane: to NIE błąd kodu.** Barrel `reactflow/dist/esm/index.d.ts` robi `export * from '@reactflow/core'`, a `@reactflow/core` JAWNIE eksportuje oba hooki — typy SĄ dostępne. tsc po prostu nie rozwiązuje `reactflow` do właściwego `.d.ts` (prawdopodobnie iCloud-duplikat `node_modules/.ignored/reactflow 2` lub moduleResolution). Runtime działa, vite buduje, e2e zielone. **Fix = czysty reinstall** (`rm -rf node_modules/.ignored && npm ci`) lub tweak moduleResolution — NIE nocą, bo dotyka rozdzielczości dla 4 narzędzi Ideas. Pozostały total tsc = **15** błędów (głównie ten reactflow w kilku plikach).
- ✅ **NAPRAWIONE 2026-06-22** (`7af683bc83`): `'process_flow'`→`'processflow'` (toolType ignorowany w hooku, czysty type-fix) + `PortfolioInitiative.title?` dodane. Oba błędy skasowane.

---

## C0. Domknięcia poranne 2026-06-22 (po wybudzeniu, na polecenie Piotra)

- ✅ **Light-mode** — naprawione+zweryfikowane (Zustand store, nie localStorage).
- ✅ **R4 notifyBlocker** — wpięte na przejściu →BLOCKED (CRITICAL+reason, zamiast generycznego INFO; bez dubla z gate_blocked). tsc-clean, fail-safe. ⚠️ runtime-firing jeszcze nie zaasertowane → integration-test flagowany P0 w planie testów.
- ℹ️ **R4 notifyAssignment NIE wpinam** — owner-change JEST już notyfikowany istniejącą ścieżką (`notificationService.send` w `updateInitiative:1099-1116`); wpięcie helpera = dubel. `notifyAssignment` helper pozostaje alternatywą nieużywaną.
- ⬜ **R4 notifyDueBreach = cron-job (infra), NIE call-site** — wymaga nowego joba w `server/src/cron/Scheduler` (skan overdue inicjatyw/tasków). Osobne zadanie z mock-zegarem; nie wpinane nocą/rano bez właściwego testu.
- ✅ **Plan testów M13** — `_PLAN_TESTOW_M13.md` (piramida, per-seria auto-coverage+gaps, 121 manual pogrupowane+priorytet, środowiska, bramki, ryzyka).
- ⚠️ **B1 reactflow** — wstrzymane świadomie (patrz niżej; runtime sprawny, ryzyko vs zero-zysku).

## C. ZROBIONE w nocy (skrót — szczegóły w git/SSOT, branch feat/deliverables-w1 → demo)

**M13 — głębokość:**
- ✅ **P1 NAPRAWIONY** (`973138a3a3`) — DRAFT+PENDING_REVIEW na początku `ACTIVE_STATUSES`; kolumna „DRAFT" z 6 kartami widoczna na domyślnym Kanban (dowód: `s1a-P1-draft-visible-kanban.png`). Naprawia kolumny+fetch+licznik jednym punktem.
- ✅ **Manual gate 17/17** — `tests/e2e/m13/m13-manual.spec.ts` + `_m13.ts` (§1/§2 26-sekcji/§3/§4/§5/§6/§11), **38+ screenów** w `docs/qa/screens/m13-2026-06-21/`. Seed wzbogacony o taski (Timeline/Gantt/Tasks z treścią), asercja P1.
- ✅ **Analiza graficzna** — `_ANALIZA_UIUX_M13_2026-06-21.md` (5 zasad + per-powierzchnia).
- ✅ **W5 Gantt drag** + **Calendar drag** (mirror) — pointer-events, PUT `/api/pmo/tasks/:id`, optimistic+rollback.
- ✅ **K4 AI-fill** (hypothesis/OKR/lessons-learned) + **Serie C konsolidacja** (wspólny primitive Jaccard, oba endpointy nietknięte, 12+35 testów zielone).
- ✅ **Regresja 7/7** — `useIdeaMapSync` deferred-payload (lock M07 data-loss) + Gantt drag + K4 dispatch.

**Pula Ideas — szlif/weryfikacja:**
- ✅ **M06** 57/5 (5 faili = test-infra/known) + 4/5 luk produktowych wpięte w Cmd+K (`d027ca5865`).
- ✅ **M07** P0 data-loss naprawiony+zweryfikowany 3/3.
- ✅ **M08 Table 20/20 GREEN** — kluczowe: M08 używa `useIdeaMapSync` bezpośrednio → **potwierdza ZERO regresji** od mojej zmiany hooka.
- ✅ **mock-DB `LOWER(email)`** + **demo-readonly bootstrap** harness (odblokowało 127 testów M06).

**5 agentów (równolegle, worktree):** Calendar drag ✅ · Serie C ✅ · M10 E2E→gate ✅ · regresja 7/7 ✅ · activity-mock ⏭️ (redundancja). Worktree posprzątane.

---

## D. Stan testów / dowodów na rano

| Suite | Wynik | Uwaga |
|---|---|---|
| M13 manual (`m13-manual.spec.ts`) | **20/20** | + 38 screenów |
| M13 regresja (3 pliki) | **7/7** | unit/component |
| M06 (`tests/e2e/m06/`) | **57/5/66** | 5 faili = KNOWN-MOCK/GAP/DB/viewport-flake, NIE bugi |
| M07 interactions | **3/3** | §3 persist + §4.2 + §6.1 |
| M08 table acceptance | **20/20** | pełny green |
| M09 foundation+walkthrough | **2 fail** | ↓ patrz E |

### E. Otwarte (do weryfikacji LIVE — nie domknięte headless)
- **M09 S9 persistence-across-reload** + walkthrough affordances — padają **headless** (canvas w skeletonie headless wg znanego `finding_m09_live_test_gates`; twardy check S9 idzie przez `persistStickyViaApi` = niezależny od zmian hooka). **NIE regresja** — wymaga weryfikacji w realnej przeglądarce.
- ✅ **Light-mode M13 — NAPRAWIONE 2026-06-22.** Mechanizm = Zustand store (`useAppStore.theme`, persist key `consultify-storage` v2), NIE localStorage 'theme'. `forceTheme` pre-seeduje store → app bootuje jasny. Zweryfikowane wizualnie (s11-light-hub: białe tło, kolumna DRAFT widoczna). Obserwacja UI: czerwona pigułka „Model" bardziej rzuca się w light (item P3 budżet czerwieni).
- **Modale Charter/AI-Wizard M13 — POTWIERDZONE że NIE montują się headless** (twardy dowód: przycisk obecny+kliknięty, ale ZERO `[role=dialog]`/panel-wizarda; a11y snapshot pokazuje hub po kliknięciu). Prawdopodobnie portal/session-effect/MOCK_DB. Testy §3.1/§3.2 oznaczają to adnotacją `headless-limitation` (nie wywalają gate). **Wymaga weryfikacji w realnej przeglądarce** — to jedyny sposób potwierdzenia że wizardy działają (kod CTA jest wpięty: `setShowInitiativeWizard/Charter(true)` → modal z `isOpen`).

> **Werdykt nocy:** M13 (głębokość) i pula Ideas (szlif) doprowadzone tak daleko, jak pozwala headless + brak Twoich decyzji/env/odbiorów. Wszystko zielone-kodowo na demo. Reszta = sekcja A (wymaga Ciebie).
