# Plan testowania M13 Inicjatywy (kod + manualny)

> Data: 2026-06-22 · Branch `feat/deliverables-w1` → demo · Autor: CTO (Claude)
> Cel: jeden wykonywalny plan — co, na jakim poziomie i jak testować M13 Depth (16 sub-modułów, serie G/R/C/K/V) zanim moduł przejdzie do ZAMKNIĘTY (8/8).

---

## 1. Cel i zakres

M13 = moduł Inicjatyw (portfolio + dokument 26-sekcyjny + maszyna 13 statusów + bramki AI). Testujemy 5 serii: **G** (bramki AI), **R** (artefakty: taski/decyzje/kalendarz/notyfikacje), **C** (tworzenie: dedup + Teresa), **K** (jakość kart), **V** (widoki: Gantt/Kalendarz).

**DoD (7 kryteriów, wspólne):** (1) front↔back spięte, zero fasad; (2) bezpieczeństwo (zero P0/P1, każda naprawa z testem); (3) i18n PL/EN przez `t()`; (4) tokeny kolorów; (5) §27 listy (FilterableTable + Menu 1/2/3); (6) E2E w PR-gate; (7) zgodność UI/UX z kanonem.

---

## 2. Piramida testów M13 (co na jakim poziomie)

| Poziom | Zakres M13 | Istniejące pliki (dowód) | W CI? |
|---|---|---|---|
| **Unit** | similarity (Jaccard), gate-services (readiness/timeline), card-validators §B3, schedule-helper, notification-emitters | `tests/unit/initiatives/initiativeSimilarity.test.ts`, `generateInitiativeTool.test.ts`, gate-ai unit (G1-G4 ~107), `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` | ✅ tak (`tests/unit`) |
| **Integration** | endpointy: `/similar-check`, `/validate-card`, `/linked-items`, `gate-ai-check`, PATCH `/status` (override) | route-testy w `tests/integration/` (mass-assignment, IDOR, error-disclosure) | ✅ tak (`tests/integration`) |
| **Component** | Gantt drag, sekcje dokumentu, nav | `tests/components/Initiatives/InitiativeGantt.drag-reschedule.test.tsx`, `tests/hooks/useIdeaMapSync.deferred-payload.test.ts` | ✅ tak (`tests/components`) |
| **E2E (Playwright)** | hub/kanban, dokument 26 sekcji, status machine, portfolio views, ROI | `tests/e2e/m13/m13-manual.spec.ts` (20), `m13-acceptance.spec.ts` (S1-S3) | ⚠️ patrz §3 gotcha |
| **Manual (człowiek/real browser)** | wizardy, voice, cross-module deep, pilot-role, light/dark wizualnie | `Harvard/Testy manualne/TESTY_M13_INICJATYWY.md` (121 scen.) | — |

> **GOTCHA CI:** runnery CI uruchamiają tylko `tests/unit|integration|components` (jawne ścieżki). Testy pod `tests/e2e/` NIE trafiają do PR-gate automatycznie — muszą być dopisane do tier0 (jak `tests/e2e/smoke/tier0-*`). M13 acceptance/manual NIE są jeszcze w tier0 → **luka DoD #6** (patrz §3 gaps).

---

## 3. Testy automatyczne (kod) — per seria

Legenda: ✅ pokryte · 🟡 częściowo · ⬜ luka.

### Seria G — bramki AI (✅ ~107 testów)
- ✅ G1 flaga+próg (12) · G2 readiness-rollup (6) · G3 timeline-gate (9) · G4 endpoint+soft-block (10) + telemetry (5).
- ✅ **GAP ZAMKNIĘTY 2026-06-22** — `tests/integration/initiatives/gate-ai-soft-block.test.ts` (4/4): egzekwowanie soft-block/override w PATCH `/status` (realny `updateInitiativeStatus`): poniżej progu bez override → 422 `INITIATIVE_GATE_AI_SOFT_BLOCK` + telemetria `blocked:true`; z override → przejście + `overridden:true`; powyżej progu → przejście; flaga OFF → brak AI-check. **UI-klik (pill/panel/modal) NIE testowalny headless** (modal nie montuje się; MOCK_DB nie produkuje soft-blocka) → wariant integration zastępuje e2e; wizualny klik = manual/real-browser Piotra.

### Seria R — artefakty (🟡)
- ✅ schedule-helper (8), status-change notify (wpięte).
- ✅ **notifyBlocker** na →BLOCKED (wpięte 2026-06-22) — ✅ **GAP ZAMKNIĘTY 2026-06-22** — `tests/integration/initiatives/notifications.test.ts` (3/3 + 1 skip): PATCH /status→BLOCKED ⇒ `initiative_blocked` CRITICAL z reason; przejście nie-blokujące ⇒ `initiative_status_change` INFO; aktor nie dostaje notyfikacji o własnej zmianie.
- ✅ **DUBEL notyfikacji statusu — NAPRAWIONY 2026-06-22 (Wariant A, decyzja Piotra), commit `137492dd67`.** Było: wpięcie R4 (`@1953`) nie zastąpiło pre-existing bloku `~2069` → jedno →BLOCKED = 2 notyfikacje (`initiative_blocked` + `initiative.status_changed`). Fix: usunięty emiter R4 + importy; kanoniczny blok legacy `initiative.status_changed` (jedyny zarejestrowany w katalogu integracji) eskalowany do CRITICAL + tytuł 'Initiative blocked' dla →BLOCKED (z reason). Jedna notyfikacja/zmiana. `notifications.test.ts` 8/8 (guard "dokładnie jedna na odbiorcę" aktywny). **Branch wypchnięty; deploy na demo = osobny krok (merge→origin/demo).**
- ⬜ **notifyDueBreach** — wymaga cron-joba (skan overdue), NIE wpięte (infra, osobne zadanie). Test: po implementacji — job-unit z mock-zegarem.
- 🟡 Calendar/Gantt drag — Gantt ma component-test (3); ✅ Calendar drag — `tests/components/Initiatives/InitiativeCalendar.drag-reschedule.test.tsx` (3 testy, HTML5 drag, PUT+onReschedule, read-only bez callbacku) — zrobione 06-22.

### Seria C — tworzenie (✅)
- ✅ similarity (7) + generate_initiative tool (5) + 4 route-mocki (35). Konsolidacja Serie C (shared Jaccard) — testy zielone.
- ⬜ **GAP:** E2E „Teresa stwórz inicjatywę" na demo (wymaga AI/live) — manual/live.

### Seria K — jakość kart (🟡)
- ✅ K1 validators (7), K3 linked-items (6), K4 SECTION_AI_NOOP (3).
- ⬜ **K2 CardContainer** — niezbudowane (czeka Q6) → testy po decyzji.
- ✅ **GAP ZAMKNIĘTY 2026-06-22 (P2)** — `tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx` (3/3): debounce 600ms na polu tezy → `validateCard(text, ['lang_pl','no_filler','hypothesis_format'])` → bursztynowe podpowiedzi renderują; <8 znaków → brak wywołania; szybkie edycje skoalescowane do jednej walidacji finalnej wartości. (CI łapie `tests/components`.)

### Seria V — widoki (🟡)
- ✅ Gantt drag (3 component).
- ⬜ **GAP:** Calendar drag test (jw.), brak e2e drag-persist (headless pointer-drag flaky — zrobić jako component, nie e2e).

**Priorytet dopisania testów:** ✅ P0 = R notifications integration (`notifications.test.ts` 3/3) — ZROBIONE 2026-06-22 · ✅ P1 = G5 override (`gate-ai-soft-block.test.ts` 4/4, forma integration zamiast e2e) + M13 e2e w PR-gate (`tier0-initiative-acceptance.spec.ts` 3/3 → DoD #6) — ZROBIONE 2026-06-22 · ✅ Calendar drag component — wcześniej · ⬜ P2 = §B3 hints, K2 (po Q6) · 🔴 NOWE: fix dubla notyfikacji (`task_1e4c00bb`, czeka decyzji).

---

## 4. Testy manualne (121 scenariuszy → wykonywalna checklista)

SSOT scenariuszy: `Harvard/Testy manualne/TESTY_M13_INICJATYWY.md`. Status automatyzacji: **20/121 zrobione w Playwright** (`m13-manual.spec.ts`), reszta = człowiek/real-browser.

### Pogrupowane wg powierzchni + priorytet

| Powierzchnia | Scenariusze | Auto (headless) | Wymaga człowieka / real-browser |
|---|---|---|---|
| **Hub / Kanban** (§1, §5) | tworzenie, kolumny statusów, DnD, widoki list/kanban/timeline/grid | ✅ §1a-P1 (DRAFT widoczny), §1b, §5.1, §5.2/5.3, §5.5 API | DnD drag-drop między kolumnami (real mouse), pilot-role ukrycie CTA |
| **Dokument 26 sekcji** (§2) | nawigacja, edycja per typ, autosave, completeness | ✅ §2.1 (26 sekcji screen), §2.3 autosave | edycja rich-text/tabel z realną treścią per sekcja, reorder DnD |
| **Wizardy** (§3) | Charter, AI Wizard, walidacje | ⚠️ §3.1/§3.2 — **modale NIE montują się headless** (potwierdzone) | **MUSI człowiek**: otworzyć Charter/AI Wizard, przejść kroki, dedup-warning, §B3 hints |
| **Maszyna stanów** (§4) | 13 statusów, bramki, override, history | ✅ §4.1 submit-review, §4.2 approve (API), §4.13 history | override z rolą (gate-roles), reject/block/cancel/archive ścieżki z UI |
| **ROI/ekonomika** (§6) | nawigacja, kalkulacja | ✅ §6.1 nawigacja | kalkulacja ROI z danymi, powiązanie |
| **Analysis/zależności** (§7) | workspace, graf | ✅ §7.1 tab render | graf zależności interaktywny |
| **Cross-module** (§8) | M10→M13, M13→M14/15/16, czat, canvas | ⬜ | **MUSI człowiek**: pełne ścieżki z danymi (S5 InsightHub→inicjatywa) |
| **Gating/security** (§9) | pilot VTS, cross-org, role | 🟡 cross-org API | pilot-role (2. konto), role na przejściach |
| **Przekrojowe** (§11) | dark/light, i18n, a11y, konsola | ✅ dark+light (light naprawiony 06-22), error-boundary walk | i18n PL/EN pełne, a11y czytnik, budżet czerwieni (pigułka „Model") |

### Kolejność wykonania manualnego (dla Piotra na demo)
1. **P0 smoke (15 min):** utwórz inicjatywę → widoczna w kolumnie DRAFT → otwórz dokument → przejdź 5 kluczowych sekcji → zmień status submit-review. (Potwierdza rdzeń.)
2. **P1 core (1-2h):** Charter + AI Wizard pełne kroki · edycja sekcji z treścią · Timeline Kalendarz↔Gantt + drag · bramka AI override · ROI.
3. **P2 edge (osobna sesja):** cross-module S5 (M10→M13) · pilot-role blokady · reject/block/cancel/archive · i18n EN · a11y.

> **Dowód Manual = screenshot per scenariusz.** Live-klik bez zapisanego artefaktu ≠ zaliczony (zasada wdrozenie-100).

---

## 5. Środowiska + jak uruchomić

- **Lokalny E2E (headless, deterministyczny):**
  `E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/m13/ --workers=2`
  (MOCK_DB + ENABLE_TEST_SUPPORT; **workers=2 = bezpieczny sufit** — workers=3+ timeoutuje mock-DB; token write-access przez test-support bootstrap, NIE register-demo która jest read-only).
- **Unit/integration/component:** `npx vitest run tests/unit tests/integration tests/components` (integration wymaga Postgres).
- **Demo (real browser, dla Manuala Piotra):** demo.consultify.ai — sesja non-demo (write), bramka flaga gate-ai ON dla org Piotra.
- **tsc:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --skipLibCheck` (FE) + `cd server && npx tsc --noEmit`.

---

## 6. Bramki wejścia / wyjścia

**Wejście (zanim testujemy):** kod zielony, tsc czysty (poza znanym reactflow-quirk), build przechodzi.
**Wyjście (per sub-moduł → ZAMKNIĘTY 8/8):** Epiki N/N · DoD 7/7 · **Kod** (testy auto zielone w CI) · **Manual N/N** (Playwright + screeny) · **UI** wg kanonu · **→F** (Piotr klika na demo) · **→UI** (audytor+Piotr odbierają grafikę).

Aktualnie M13: Kod ~15/16 zielone · Manual 20/121 · →F/→UI = 0 (czeka Piotr) · Q6 blokuje K2.

---

## 7. Ryzyka i znane ograniczenia

- **Headless-undriveable:** modale wizardów (potwierdzone — portal/session-effect), M09-style hydration, cross-module deep state, voice/STT, pilot-role. → MUSZĄ być testowane w realnej przeglądarce.
- **reactflow tsc-quirk:** `useUpdateNodeInternals`/`useNodesInitialized` raportowane przez tsc jako brak (resolution `bundler`), runtime sprawny — NIE blokuje testów, fix = clean reinstall.
- **MOCK_DB:** część endpointów (activity, niektóre wizard/sessions) ma uproszczony mock — asercje `[DB]` wymagają realnej bazy (staging).
- ✅ **CI nie łapie `tests/e2e/`** — ZAMKNIĘTE 2026-06-22: `tests/e2e/smoke/tier0-initiative-acceptance.spec.ts` (smoke-native, bo `m13/` jest pod głównym configiem + flaky deep-link UI = niegatowalne pod MOCK_DB) wpięte do `test:e2e:tier0` w `package.json`; asertuje /portfolio mount + core API + endpointy M13-Depth (status, gate-ai-check) zamontowane; 3/3 green pod smoke-harness (17.5s). **DoD #6 dla M13 spełnione w PR-gate.**
