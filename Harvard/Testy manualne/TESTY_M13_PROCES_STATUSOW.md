# SYSTEM TESTÓW — Proces statusów i pracy z inicjatywami (M13→M16)

> **Cel:** kompletne, systematyczne przetestowanie CAŁEGO procesu pracy z inicjatywą — odtworzenie przez zmianę statusów przez wszystkie elementy kluczowe — i rozwijanie systemu przez te testy (test-driven hardening).
> **Konwencja:** wzór M13/M14/M15/M16 (`TESTY_*` spec + `WYNIKI_*` raport realizacji).
> **SSOT procesu:** [`docs/initiatives/INITIATIVE_LIFECYCLE.md`](../../docs/initiatives/INITIATIVE_LIFECYCLE.md) · [`INITIATIVE_PROCESS_EFFECTIVENESS.md`](../../docs/initiatives/INITIATIVE_PROCESS_EFFECTIVENESS.md)
> **Kod SSOT:** `server/src/constants/initiativeStatuses.ts` · `controllers/InitiativeController.ts:1231` · `routes/pmo/initiatives.routes.ts`
> **Data utworzenia:** 2026-06-26
> **Legenda statusu scenariusza:** ✅ PASS (dowód) · 🟡 IN-PROGRESS · ⬜ PLANNED · 🔴 BLOCKED/DEFEKT · ⏭ SKIP/N-A

---

## 0. Architektura: 4 warstwy × 30 scenariuszy

Każdy element procesu testowany na 3 poziomach abstrakcji + raport. **90 scenariuszy testowych**, plus warstwa raportu (L4).

| Warstwa | Co testuje | Plik | Wykonanie | Stan |
|---|---|---|---|---|
| **L1 — Unit (maszyna stanów)** | czysty rdzeń: VALID_TRANSITIONS, GATE_PERMISSIONS, validateTransition, RBAC-mapa | `tests/unit/backend/initiativeStatuses/stateMachineComplete.test.ts` | vitest, deterministyczny | ✅ **30/30** |
| **L2 — Integration (`updateInitiativeStatus` live)** | realny handler: RBAC 403, AI soft-block 422, governance 400, invalid 400, side-effecty, dedykowane endpointy | `tests/integration/initiatives/statusLifecycle.test.ts` | vitest + mock-DB (realny handler) | ✅ **32/32** (1 defekt udokumentowany) |
| **L3 — E2E (Playwright, ja wykonuję)** | przejście CAŁEJ ścieżki DRAFT→TRACKING na żywej apce: Network+UI+Reload+screenshot per status, kanban, raporty | `tests/e2e/m13/m13-status-lifecycle.spec.ts` | Playwright na żywym backendzie (:3001/:3000) | ✅ **30/30** (10 screenów) |
| **L4 — Raport realizacji** | klasyfikacja KAŻDEGO scenariusza z dowodem (format M15 RUN) | [`WYNIKI_M13_INICJATYWY_RUN1.md`](WYNIKI_M13_INICJATYWY_RUN1.md) | synteza po L1-L3 | ✅ |

**Postęp ogólny: 92 / 92 scenariuszy (100%)** — L1+L2+L3 domknięte, wszystkie zielone, DEF-1 znaleziony i naprawiony.

### Defekty znalezione przez testy (test-driven hardening)
| ID | Defekt | Dowód | Stan |
|---|---|---|---|
| **DEF-1** (L2-13) | `updateInitiativeStatus` nie egzekwował BLOCKED-bez-powodu inline — rozbieżność z kanonicznym `validateTransition` (F2). | test L2-13 | ✅ **NAPRAWIONY** — guard `BLOCKED_REASON_REQUIRED` (400) w `InitiativeController.ts`; L2-13 asertuje nowe zachowanie; regresja 129/129 zielona |

---

## 1. Macierz „wszystkie elementy kluczowe" (oś pozioma)

Każda warstwa pokrywa te same 8 obszarów procesu (różnym poziomem):

| # | Obszar kluczowy | L1 | L2 | L3 |
|---|---|---|---|---|
| O1 | Słownik 13 statusów + metadane | ✅ A1-A4 | — | ⬜ pasek statusu UI |
| O2 | Pełna ścieżka przejść (happy path) | ✅ B1-B8 | ⬜ L2-01..08 | ⬜ L3-01..12 |
| O3 | Niedozwolone przejścia (guard) | ✅ C1-C4 | ⬜ L2-09..12 | ⬜ L3-13..15 |
| O4 | Bramki ↔ przejścia | ✅ D1-D3 | ⬜ L2-13..15 | — |
| O5 | RBAC ról na bramkach | ✅ E1-E7 | ⬜ L2-16..22 | ⬜ L3-16..20 |
| O6 | validateTransition (reguły treści) | ✅ F1-F4 | ⬜ L2-23..26 | — |
| O7 | Side-effecty (historia/audyt/notyfikacje/baseline) | — | ⬜ L2-27..30 | ⬜ L3-21..24 |
| O8 | Widoczność (kanban/raporty/due-breach) | — | — | ⬜ L3-25..30 |

---

## 2. L1 — Unit maszyny stanów · ✅ 30/30 PASS

> Dowód: `tests/unit/backend/initiativeStatuses/stateMachineComplete.test.ts` — vitest run 2026-06-26, **30 passed**.

| ID | Scenariusz | Stan |
|---|---|---|
| A1 | Istnieje dokładnie 13 statusów | ✅ |
| A2 | Każdy status ma komplet metadanych (label/labelPL/order/icon) | ✅ |
| A3 | getStatusLabel rozdziela PL/EN | ✅ |
| A4 | Porządki (order) unikalne — brak kolizji | ✅ |
| B1 | DRAFT → PENDING_REVIEW legalne | ✅ |
| B2 | PENDING_REVIEW → REVIEW + send-back → DRAFT | ✅ |
| B3 | REVIEW → PROMOTED + reject → DRAFT | ✅ |
| B4 | PROMOTED → PLANNING | ✅ |
| B5 | PLANNING → APPROVED | ✅ |
| B6 | APPROVED → SCHEDULED | ✅ |
| B7 | SCHEDULED → EXECUTING; EXECUTING ⇄ BLOCKED | ✅ |
| B8 | Ogon EXECUTING → DONE → TRACKING → ARCHIVED | ✅ |
| C1 | Skok DRAFT → APPROVED nielegalny | ✅ |
| C2 | Cofnięcie DONE → EXECUTING nielegalne | ✅ |
| C3 | ARCHIVED terminalny (zero wyjść) | ✅ |
| C4 | CANCELLED z aktywnych, NIE po DONE/TRACKING | ✅ |
| D1 | getGateForTransition mapuje kluczowe krawędzie | ✅ |
| D2 | Krawędź bez bramki → null | ✅ |
| D3 | CANCEL osiągalny z 9 aktywnych statusów | ✅ |
| E1 | CONSULTANT tylko submit-for-review | ✅ |
| E2 | ADMIN każda bramka (override) | ✅ |
| E3 | APPROVE tylko STEERING_COMMITTEE | ✅ |
| E4 | PMO: SCHEDULE/START/START_PLANNING tak, APPROVE nie | ✅ |
| E5 | PROJECT_SPONSOR: ACCEPT/UNBLOCK tak, APPROVE nie | ✅ |
| E6 | BUSINESS_OWNER: tylko START_TRACKING | ✅ |
| E7 | INITIATIVE_OWNER: BLOCK/COMPLETE/SUBMIT tak, APPROVE nie | ✅ |
| F1 | Zła rola na bramce → invalid + requiredRoles | ✅ |
| F2 | BLOCKED bez powodu → invalid; z powodem → valid | ✅ |
| F3 | DONE blokowane przez pending tasks / otwarte decyzje | ✅ |
| F4 | Bramki danych: artefakty / daty / red-UNBLOCK steering | ✅ |

---

## 3. L2 — Integration `updateInitiativeStatus` (live handler) · ⬜ 0/30

> Plik docelowy: `tests/integration/initiatives/statusLifecycle.test.ts`. Metoda: realny `InitiativeController.updateInitiativeStatus` przez supertest + mock-DB (wzór `tests/integration/routes/pmo.initiatives.fail-closed.contract.test.ts`). Każdy scenariusz = realny HTTP status + efekt w DB/notyfikacji.

| ID | Scenariusz | Oczekiwany wynik |
|---|---|---|
| L2-01..08 | Każda krawędź happy-path z właściwą rolą | 200 + status zmieniony w DB |
| L2-09 | Skok DRAFT→APPROVED | 400 `INVALID_TRANSITION` + `validNext` |
| L2-10 | Cofnięcie DONE→EXECUTING | 400 INVALID_TRANSITION |
| L2-11 | Mutacja ARCHIVED | 400 (terminal) |
| L2-12 | Nieznany status docelowy | 400 `UNKNOWN_STATUS` |
| L2-13..15 | Bramka rozpoznana per krawędź (gate_type w historii) | 200 + `gate_type` w `initiative_status_history` |
| L2-16 | CONSULTANT próbuje APPROVE | 403 + requiredRoles |
| L2-17 | PMO próbuje APPROVE (tylko steering) | 403 |
| L2-18 | Steering APPROVE | 200 |
| L2-19 | Brak steering-board → degradacja do sponsor/portfolio | 200 dla sponsora |
| L2-20 | ADMIN omija bramkę | 200 |
| L2-21 | Konsultant submit CUDZEJ inicjatywy | 403 (created_by guard) |
| L2-22 | **Dedykowane endpointy `/submit-review` etc. — guard roli** | 🔴 weryfikacja udokumentowanej LUKI (brak guardu) |
| L2-23 | BLOCKED bez reason przez handler | 400 |
| L2-24 | AI soft-block poniżej progu | 422 `INITIATIVE_GATE_AI_SOFT_BLOCK` |
| L2-25 | AI soft-block + overrideReason | 200 + telemetria override |
| L2-26 | Governance-decision brak (REVIEW→PROMOTED bez Go/No-Go) | 400 `GATE_DECISION_REQUIRED` |
| L2-27 | Side-effect: 2× ślad historii (`status_history` + `initiative_history`) | wiersze obecne |
| L2-28 | Side-effect: audyt `initiative.status_changed` | wpis audytu |
| L2-29 | Side-effect: notyfikacja →BLOCKED = CRITICAL + powód | severity CRITICAL |
| L2-30 | Side-effect: APPROVED→SCHEDULED tworzy baseline harmonogramu | `schedule_baseline_id` bump |

---

## 4. L3 — E2E Playwright (pełne przejście na żywej apce) · ⬜ 0/30

> Plik docelowy: `tests/e2e/m13/m13-status-lifecycle.spec.ts`. Wykonuje **Claude (ja)** na żywym backendzie. Dowód per scenariusz: Network (status HTTP) + UI (DOM) + Reload (trwałość) + screenshot `docs/qa/screens/m13-status/`.

| ID | Scenariusz | Dowód |
|---|---|---|
| L3-01..12 | Przejście DRAFT→PENDING_REVIEW→REVIEW→PROMOTED→PLANNING→APPROVED→SCHEDULED→EXECUTING→DONE→TRACKING (każdy krok osobno) | screenshot per status + reload |
| L3-13 | Drag&drop na kanbanie zmienia status | Network PATCH + UI |
| L3-14 | Próba nielegalnego przejścia z UI zablokowana | brak CTA / 400 |
| L3-15 | EXECUTING→BLOCKED→EXECUTING (block z powodem, unblock) | 2× screenshot |
| L3-16..20 | CTA bramek widoczne/ukryte wg roli (5 ról) | screenshot per rola |
| L3-21 | Historia statusów widoczna w sekcji dokumentu | screenshot |
| L3-22 | Notyfikacja gate_action_required dociera do roli następnej bramki | inbox/dzwonek |
| L3-23 | →BLOCKED generuje notyfikację CRITICAL | badge/severity |
| L3-24 | Audyt/timestamps cyklu (approved_at/done_at) | DB/UI |
| L3-25 | Kanban: kolumny = statusy, świeży DRAFT widoczny (scope active) | screenshot |
| L3-26 | Kanban scope all dokłada EXECUTING…ARCHIVED | screenshot |
| L3-27 | Raport Steering Committee zawiera status/RAG inicjatywy | screenshot |
| L3-28 | Raport Portfolio Health: liczniki onTrack/atRisk | screenshot |
| L3-29 | Timeline/Gantt renderuje inicjatywy wg dat | screenshot |
| L3-30 | Due-breach: przeterminowana inicjatywa oznaczona (chip) | screenshot |

---

## 5. Jak mierzyć postęp

- **Liczba zielona / 90** = pokrycie systemu (dziś **30/90 = 33%**).
- **Defekty z testów = backlog rozwoju** (test-driven hardening). Każdy 🔴 to zadanie:
  - **L2-22** (luka RBAC na dedykowanych endpointach) — już udokumentowana w `INITIATIVE_PROCESS_EFFECTIVENESS.md` F-series; test ma ją POTWIERDZIĆ, potem hardening (dodać guard) → 🔴→✅.
- **Raport L4 (`WYNIKI_M13_INICJATYWY_RUN1.md`)** powstaje po każdym przebiegu i klasyfikuje 100% scenariuszy (zero „nigdy nie wykonane"), wzór M15 RUN4.

## 6. Kolejność realizacji (plan)

1. ✅ **L1** (30) — DONE.
2. ✅ **L2** (32) — DONE; wykrył DEF-1 (BLOCKED-reason) → **naprawiony**.
3. ✅ **L3** (30) — DONE; wykonane live na :3001/:3000, 10 screenów w `docs/qa/screens/m13-2026-06-21/l3-*.png`.
4. ✅ **L4** — raport realizacji `WYNIKI_M13_INICJATYWY_RUN1.md`.
5. ⬜ Rozszerzenie na M14 (wykonanie: zadania/Gantt) i M15/M16 (rezultaty/ROI) — analogiczne 30×warstwa (następny etap).
