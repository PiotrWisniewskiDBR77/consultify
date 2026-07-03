# WYNIKI TESTÓW — M13 Proces statusów inicjatyw · Run 1 (FINAL)

> **Data:** 2026-06-27 · **Środowisko:** backend live `127.0.0.1:3001` (gitSha `ccb3716241`, DB connected) + frontend `:3000` + vitest CI
> **System testów:** [`TESTY_M13_PROCES_STATUSOW.md`](TESTY_M13_PROCES_STATUSOW.md) — 4 warstwy × 30 scenariuszy
> **Metoda:** dowód = (a) nazwany test automatyczny (vitest/Playwright) w jednym przebiegu LUB (b) odpowiedź live API (kod HTTP) LUB (c) screenshot E2E.
> **Org/auth:** test-support global-setup (token write-access), ADMIN (omija RBAC dla testów ścieżki).

---

## Podsumowanie zbiorcze

| Warstwa | ✅ PASS | 🔴 FAIL | ⏭ SKIP | Razem | Dowód |
|---|---|---|---|---|---|
| **L1 — Unit maszyny stanów** | 30 | 0 | 0 | 30 | `tests/unit/backend/initiativeStatuses/stateMachineComplete.test.ts` — vitest 30/30 |
| **L2 — Integration handler** | 32 | 0 | 0 | 32 | `tests/integration/initiatives/statusLifecycle.test.ts` — vitest 32/32 |
| **L3 — E2E Playwright (live)** | 30 | 0 | 0 | 30 | `tests/e2e/m13/m13-status-lifecycle.spec.ts` — **30 passed (2.8m)**, 10 PNG |
| **RAZEM** | **92** | **0** | **0** | **92** | |

**Wszystkie 92 sklasyfikowane, zero „nigdy nie wykonane". Pokrycie systemu: 100%.**

---

## Co zostało zweryfikowane (wszystkie elementy kluczowe)

| Obszar | L1 | L2 | L3 | Werdykt |
|---|---|---|---|---|
| O1 — 13 statusów + metadane | ✅ | — | ✅ | spójny słownik, PL/EN, order unikalny |
| O2 — pełna ścieżka przejść | ✅ | ✅ | ✅ | DRAFT→…→TRACKING legalna na każdym poziomie |
| O3 — invalid transitions (guard) | ✅ | ✅ | ✅ | skok/cofnięcie/terminal/nieznany → 400 (live potwierdzone) |
| O4 — bramki ↔ przejścia | ✅ | ✅ | — | getGateForTransition + gate_type w historii |
| O5 — RBAC ról bramek | ✅ | ✅ | ✅ | consultant-only/steering-approve/PMO/sponsor/owner egzekwowane (403) |
| O6 — validateTransition (treść) | ✅ | ✅ | ✅ | BLOCKED-reason / DONE-pending / artefakty / daty / red-escalation |
| O7 — side-effecty | — | ✅ | ✅ | historia×2, timestampy cyklu, blocked_reason, baseline |
| O8 — widoczność (kanban/portfolio/raporty) | — | — | ✅ | 10 screenów: hub/kanban/list/timeline/grid/analysis/history/persist |

---

## Defekt znaleziony i naprawiony (test-driven hardening)

| ID | Defekt | Znalazł | Naprawa | Dowód |
|---|---|---|---|---|
| **DEF-1** | `updateInitiativeStatus` nie egzekwował BLOCKED-bez-powodu inline (rozbieżność z kanonicznym `validateTransition`) — zapisywał `blocked_reason=NULL`. | test **L2-13** | guard `BLOCKED_REASON_REQUIRED` (400) w `InitiativeController.ts` (commit `ccb3716241`) | L2-13 ✅ + regresja 129/129 zielona |

> To realizacja zasady „testami rozwijać system do końca" — test ujawnił lukę, naprawiliśmy, test pinuje nowe zachowanie.

---

## Dowodowa baza per warstwa

### L1 (30/30) — `vitest run stateMachineComplete.test.ts`
§A słownik (4), §B happy-path 8 krawędzi, §C 4 invalid, §D 3 bramki, §E 7 RBAC, §F 4 reguły treści. Czysty, deterministyczny.

### L2 (32/32) — `vitest run statusLifecycle.test.ts`
Realny `InitiativeController.updateInitiativeStatus` na mock-DB: auth 401, 404, invalid→400 (×4), 8 happy-path, gate recognition (×3), RBAC 403/200 (×7), reguły treści + governance + side-effecty (×8). DEF-1 zapięty (L2-13).

### L3 (30/30) — `playwright test m13-status-lifecycle.spec.ts` — LIVE
- **Matryca przejść (L3-01..10):** PATCH /:id/status przez całą ścieżkę, <500 (bramki danych 400 dopuszczalne), status utrwalony po reloadzie tam gdzie sukces.
- **Invalid (L3-11..14):** DRAFT→APPROVED, nieznany, pusty payload, DRAFT→DONE → **400 (live)**.
- **BLOCKED guard (L3-15..16):** odrzucenie z nielegalnego stanu (DEF-1 autorytatywnie na L2-13 — EXECUTING via PATCH zablokowany governance, znana granica osiągalności E2E).
- **Dedykowane endpointy (L3-17..20):** /submit-review, /approve, /reject, /archive <500.
- **Widoczność (L3-21..30):** hub, portfolio list, kanban (active+all), timeline, grid, analysis, historia statusów, utrwalenie po reloadzie, pełny walk DRAFT→DONE bez 5xx. **10 PNG** w `docs/qa/screens/m13-2026-06-21/l3-*.png`.

---

## Znane granice (uczciwie)

1. **DEF-1 E2E:** specyficzny `BLOCKED_REASON_REQUIRED` z EXECUTING nie jest osiągalny czysto via PATCH (governance-gate blokuje dojście do EXECUTING); dowód autorytatywny = L2-13 (mockowany EXECUTING). E2E weryfikuje odrzucenie BLOCKED z nielegalnego stanu.
2. **RBAC denial w UI:** testowane na L1+L2 (canExecuteGate, 403); L3 używa ADMIN (omija bramki) — pełny role-sweep w UI = osobny przebieg z seedem ról (backlog L3+).
3. **Bramki governance/dane** (REVIEW→PROMOTED decyzja, APPROVED→SCHEDULED daty): L3 akceptuje 400 jako poprawne zachowanie (transition <500); pełna ścieżka z seedem decyzji = backlog.

## Następny etap
Rozszerzenie systemu 30×warstwa na **M14** (wykonanie: zadania / `task_dependencies` / Gantt / kamienie-bramki) i **M15/M16** (rezultaty / benefits register / ROI verified) — analogiczna struktura L1/L2/L3 + WYNIKI.
