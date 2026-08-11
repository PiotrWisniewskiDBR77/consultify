# Finance v3 — Execution Ledger (Complete Product Integration)

Prowadzony przez OPUS. Jedyne źródło prawdy o stanie programu.
Aktualizowany **po** integracji pakietu, nigdy na podstawie deklaracji subagenta.

- **Gałąź integracyjna:** `codex/finance-v3-complete-product-integration`
- **Baza:** `8f16403ff6` (documentary tip poprzedniej sesji) + `d06a8d5965` (korekta z sesji równoległych)
- **Bieżący tip integracyjny:** `dec4586cd1`
- **Status:** `IN_PROGRESS`
- **NOT PUSHED / NOT MERGED / NOT DEPLOYED / STAGING NOT VERIFIED / PRODUCTION NOT VERIFIED**

Zamrożone, nietykalne: `codex/finance-v3-closeout-fanin` @ `19b4b06934` (ROI-E007 Round 1).

---

## 0. USTALENIE ARCHITEKTONICZNE, KTÓRE STERUJE CAŁYM PROGRAMEM

Zmierzone na `dec4586cd1`, nie z dokumentacji:

| Warstwa | Stan |
|---|---|
| Serwisy kanoniczne `services/finance/canonical` | **35 plików** |
| `services/finance/grid` | 9 plików |
| `services/finance/keyboard` | 6 plików |
| `services/finance/collaboration` | 6 plików |
| `services/finance/workspace` | 5 plików |
| **RAZEM warstwa serwisowa** | **61 plików** |
| **Produkcyjna powierzchnia HTTP Finance v3** | **2 endpointy** |

Oba endpointy to `POST /api/v8/finance-v2/models/:modelId/approve` i `.../reopen`.
Router **jest** zamontowany produkcyjnie (`routes/v8/index.ts:110` → `Gateway.ts`).

**Wniosek:** Statements, Analysis, Baseline compute, Prediction, Valuation, grid, keyboard,
collaboration, workspace, compare, comments, saved views, import/export, lineage i exceptions
mają **zerową powierzchnię HTTP**. Silniki są gotowe i **nieosiągalne z zewnątrz**.

**Konsekwencja dla planu:** warstwa API jest wąskim gardłem. Pakiety produktowe D–H
(Statements/Analysis/Baseline/Prediction/Valuation UI) **nie mogą** ruszyć równolegle z B,
bo nie miałyby czego wołać. Kolejność jest wymuszona przez zależność, nie przez ostrożność.

Frontend: 21 plików `.tsx` z „finance" w ścieżce, ale wołają **legacy** `/api/v8/finance`
i `financeValue` — **zero** odwołań do kanonicznego `/api/v8/finance-v2`.

---

## 1. FALE I ZALEŻNOŚCI

```
FALA A (równolegle, teraz)
  A  Determinism & Numerical Integrity Auditor      [niezależny]
  B  Finance API & Runtime Integration Engineer     [ŚCIEŻKA KRYTYCZNA]
  M  UI/API Inventory & Visual Harness (read-only)  [niezależny, discovery]

FALA B (po B)
  C  Finance Shared UI Platform Engineer            [zależy: B, M]
  J  RealDB / Security / Concurrency Auditor        [zależy: B]

FALA C (po C)
  D  Statements Product Engineer                    [zależy: B, C]
  E  Analysis Product Engineer                      [zależy: B, C]
  F  Baseline Models Product Engineer               [zależy: B, C]
  G  Prediction Product Engineer                    [zależy: B, C, F]
  H  Valuation Product Engineer                     [zależy: B, C, F, G]

FALA D (po D–H)
  I  Accessibility & Design-System Auditor
  K  Browser E2E & Visual Evidence Engineer
  L  Adversarial CFO / Model-Risk Reviewer
```

---

## 2. REJESTR PAKIETÓW

| Pakiet | Owner | Gałąź | Base SHA | Tip SHA | Zależności | Audyt | Fan-in | Status |
|---|---|---|---|---|---|---|---|---|
| A — Determinism audit | SONNET | `codex/fv3p-a-determinism` | `dec4586cd1` | — | — | — | — | `IN_PROGRESS` |
| B — API & runtime | SONNET | `codex/fv3p-b-api` | `dec4586cd1` | — | — | — | — | `IN_PROGRESS` |
| M — UI/API inventory | SONNET | `codex/fv3p-m-inventory` | `dec4586cd1` | — | — | — | — | `IN_PROGRESS` |
| C — Shared UI platform | — | — | — | — | B, M | — | — | `PENDING` |
| D — Statements | — | — | — | — | B, C | — | — | `PENDING` |
| E — Analysis | — | — | — | — | B, C | — | — | `PENDING` |
| F — Baseline Models | — | — | — | — | B, C | — | — | `PENDING` |
| G — Prediction | — | — | — | — | B, C, F | — | — | `PENDING` |
| H — Valuation | — | — | — | — | B, C, F, G | — | — | `PENDING` |
| I — A11y/design-system | — | — | — | — | D–H | — | — | `PENDING` |
| J — RealDB/security | — | — | — | — | B | — | — | `PENDING` |
| K — Browser E2E/visual | — | — | — | — | D–H | — | — | `PENDING` |
| L — Adversarial CFO | — | — | — | — | D–H | — | — | `PENDING` |

---

## 3. PUNKTY ODNIESIENIA (zmierzone przez OPUS na `4489fdcab8`, protokół `_evidence_run_accept`)

| Bramka | Wynik |
|---|---|
| Migracje STRICT, świeża baza (bez `--safe`) | exit 0, **637**, 1580 tabel (public 1459 + v8 121) |
| `src/services/finance` | **47 plików / 722 testy**, exit 0 |
| Kontrola negatywna bramki DB | 19 passed \| 28 skipped → **319 z 722 to testy realnej bazy** |
| `src/services/finance/canonical` | **37 plików / 454 testy**, exit 0 |
| `tests/resultsVnext/roi` | **37 / 120**, exit 0 |
| `tests/resultsVnext` | **55 / 278**, exit 0 |
| `tsc --noEmit -p server/tsconfig.json` | **exit 0, zero linii** |

Każdy pakiet potwierdza te liczby u siebie PRZED zmianami i podaje obie wartości.

---

## 4. DECYZJE OBOWIĄZUJĄCE (z `FINANCE_CRITICAL_REVIEW_ADDENDUM`, wszystkie `DECIDED`)

DEC-FIN-001 governance zależne od ryzyka · **DEC-FIN-002 Baseline bez decyzji, bez plug,
ujemna kasa zostaje** · DEC-FIN-003 trójwarstwowy katalog KPI · **DEC-FIN-004 Compute
Prediction dwuetapowy (preflight → calculation)** · DEC-FIN-005 koszyk ważony + nieważone
cross-checki, brak danych = N/A nigdy zero · DEC-FIN-006 Advisor przed approval, na świeżym
candidate · DEC-FIN-007 Approved bez hard-delete · **DEC-FIN-008 desktop-first, mobile
wyłączone** · DEC-FIN-009 exception ledger, blokada tylko security/math-undefined ·
DEC-FIN-010 Working Revisions ≠ Business Versions · DEC-FIN-011 lineage to DAG, Scenario
opcjonalne · **DEC-FIN-012 zespół rozstrzyga rutynowe kwestie sam wg najwyższego standardu**.

**Constraint właścicielski OWN-FIN-001:** obecny układ list jest **zaakceptowany**.
Punktowe usprawnienia, **bez redesignu**.

---

## 5. EVIDENCE_MISSING / BLOKERY ZEWNĘTRZNE (dziedziczone)

| Pozycja | Klasa |
|---|---|
| FC-09, FC-10 (16 warunków) — brak UI | `BLOCKED_EXTERNAL` → adresowane przez ten program |
| FC-12 (6 warunków) — brak zewnętrznego recenzenta CFO | `BLOCKED_EXTERNAL` |
| Aktywacja RLS — brak least-privileged roli DB na Railway | `BLOCKED_EXTERNAL` |
| Cutover / rollback / shadow parity — brak stagingu | `BLOCKED_EXTERNAL` |
| SLO produkcyjne p50/p95/p99 — rozrzut 9,3× na laptopie | `EVIDENCE_MISSING` |
| EM-5 pula workerów — brak kolumny payloadu w `compute_jobs` | `EVIDENCE_MISSING` |
| Trzy miejsca bez `ORDER BY` w `predictionComputeService` | → pakiet A |

---

## 6. HISTORIA INTEGRACJI

| Data | SHA | Co |
|---|---|---|
| 2026-08-11 | `dec4586cd1` | utworzenie gałęzi z `8f16403ff6` + korekta `d06a8d5965` (root-cause EV → harness rollup, nie `sumFlow`) |
