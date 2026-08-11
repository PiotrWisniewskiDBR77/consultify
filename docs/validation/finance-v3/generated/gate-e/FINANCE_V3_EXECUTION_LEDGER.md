# Finance v3 — Execution Ledger (Complete Product Integration)

Prowadzony przez OPUS. Jedyne źródło prawdy o stanie programu.
Aktualizowany **po** integracji pakietu, nigdy na podstawie deklaracji subagenta.

- **Gałąź integracyjna:** `codex/finance-v3-complete-product-integration`
- **Baza:** `8f16403ff6` (documentary tip poprzedniej sesji) + `d06a8d5965` (korekta z sesji równoległych)
- **Bieżący tip integracyjny:** `1a6c507f0d`
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
| M — UI/API inventory | SONNET | `codex/fv3p-m-inventory` | `585af4ce4b` | `1a6c507f0d` | — | OPUS: `PASS` | **scalone** | `PASS` |
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

## 5A. ODBIÓR WIZUALNY PRZEZ OPUS — `finance-model-workspace`, 1440 light

Zrzut z pakietu M obejrzany **przez orkiestratora osobiście**, zgodnie z regułą #7 CLAUDE.md
(właściciel nigdy nie jest pierwszym testerem wizualnym). Poniższe naruszenia wynikają
z **oglądu ekranu**, nie z raportu tekstowego — i żadne z nich nie było w raporcie agenta:

| # | Naruszenie | Źródło wymagania |
|---|---|---|
| V-1 | **`Oś czasu zdarzeń` jest zakładką w Baseline Model** | Instrukcja Faza 4: „Usuń Events Timeline z Baseline". Baseline jest z definicji **no-decision** (DEC-FIN-002) — oś zdarzeń należy do Prediction |
| V-2 | **`Wyceń model` jest akcją w pasku głównym** | `OWN-FIN-018` + Faza 4: „Usuń Valuate Model jako główną akcję". Wycena jest downstream, nie krokiem Models |
| V-3 | **Cztery główne widoki zamiast dwóch** (`Dane wejściowe i założenia` · `Oś czasu zdarzeń` · `Wyniki` · `Walidacja`) | `OWN-FIN-017` + Faza 4: „Dokładnie dwa główne widoki: Założenia, Wyliczenia" |
| V-4 | **Mieszanka językowa w tej samej warstwie UI** — `GROUNDED ON`, `Seeded from statement`, `IMPORTED FROM STATEMENT`, `Refresh from source`, `Version history` obok `Dane wejściowe i założenia`, `Bilans otwarcia`, `Gotówka`, `Brak zapisanych wersji` | Decyzja produktowa 17: „UI musi być jednolite językowo". `REVENUE`/`COGS`/`OPEX` są dopuszczalne jako kanoniczne skróty finansowe — **reszta nie jest** |
| V-5 | **Martwa przestrzeń ~50% szerokości** poniżej zakładek (cała prawa kolumna pusta) | Faza 9: „brak martwej przestrzeni >25%" |
| V-6 | **Wielopiętrowy nagłówek**: tytuł+status, osobny pas `GROUNDED ON`, osobny rząd zakładek; brak przycisku fullscreen/focus; `Version history` wrzucone w treść strony zamiast w lifecycle paska; pływające `← Lista` / `Uwagi` w prawym dolnym rogu nachodzą na obszar roboczy | `OWN-FIN-011` jeden Workspace Bar · `OWN-FIN-004` tryb pełnego obszaru · `OWN-FIN-012`/`013` lifecycle w pasku |

**Do obserwacji przy pakiecie F:** pole `Gotówka` pokazuje `0` z podpisem `IMPORTED FROM STATEMENT`.
Jeśli to realne zero — poprawne. Jeśli to brak danych wyrenderowany jako zero — **łamie decyzję
produktową 3 („brak danych nigdy nie jest prezentowany jako zero")**. Wymaga rozstrzygnięcia
odczytem, nie oglądem.

Te sześć pozycji wchodzi do zakresu pakietu **F (Baseline Models)** jako twarde wymagania odbioru.

---

## 6. HISTORIA INTEGRACJI

| Data | SHA | Co |
|---|---|---|
| 2026-08-11 | `dec4586cd1` | utworzenie gałęzi z `8f16403ff6` + korekta `d06a8d5965` (root-cause EV → harness rollup, nie `sumFlow`) |
| 2026-08-11 | `585af4ce4b` | execution ledger |
| 2026-08-11 | `1a6c507f0d` | **pakiet M** — inwentaryzacja UI, naprawa harnessu, 7 zrzutów |

### Pakiet M — wynik odbioru przez OPUS: `PASS`

Allowlista uszanowana (zero plików `src/**` i `server/**`). `.claude/launch.json` jest
współdzielony — sprawdzone: **21 → 22 wpisy, wyłącznie dopisanie**, nic cudzego nie skasowane.

**Ustalenia, które zmieniają plan:**
- **66** plików `.tsx` Finance/Economics, nie 21 jak oszacował orkiestrator wstępnie.
- `FinanceHub` (lista + preview) **jest** zgodny z TRIADA. **Wszystkie 5 workspace'ów szczegółu
  jest bespoke — zero komponentów standardu.** To potwierdza `OWN-FIN-001`: listy zostają,
  przebudowa dotyczy wyłącznie workspace'ów.
- **0/22 wymagań właścicielskich spełnionych w pełni**, 3 częściowo, 17 wcale, 2 poza zakresem UI.
- **Harness był martwy** — brakowało pliku `dev-render/screens/tools-sesja-wyjscie.tsx`,
  co wywalało **wszystkie 136 ekranów**. Ten sam wzorzec „jeden brakujący plik = cały harness"
  wystąpił w tym repo już kilkakrotnie. Naprawiony minimalnie.
- **Martwy kod:** 19 z 20 plików `Economics/panels/`, 9 z 9 `Economics/charts/` i
  `financeValuationApi.ts` mają **zero mountów produkcyjnych** — w tym komentarz w
  `dev-render/screens/finance-value-panels.tsx` **fałszywie twierdzący**, że dwa panele są
  „wired to real data". Zgłoszone, nie naprawione (poza allowlistą).
- Bezpieczniki `check-list-canon.sh` i `check-artefakt.sh` dają dziś `exit 0`, ale to **ratchet
  na baseline długu** (408/409 plików, 7/7 crimson), **nie dowód zerowych naruszeń**.

`EVIDENCE_MISSING` zgłoszone przez pakiet: zrzuty pozostałych 4 workspace'ów; realny E2E `Compute`
(`OWN-FIN-018`); kanon domenowy baseline (`OWN-FIN-015` — wymaga decyzji poza UI).
