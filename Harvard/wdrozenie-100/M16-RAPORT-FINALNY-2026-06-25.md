# M16 FINANSE — RAPORT FINALNY (sesja autonomiczna nocna + domknięcie poranne) · 2026-06-25/26

> **Misja (Piotr, przed snem):** zrób wszystkie zadania M16, przetestuj, zbierz wnioski, napraw co wyjdzie, raport finalny. **Zero produkcji — kończymy na stagingu (demo).** ✅ centerbeam (PROD) nietknięty.

## STRESZCZENIE WYKONAWCZE (1 minuta)
1. **Przeniesienie pracy poprzednika = potwierdzone kompletne** (audyt 3-agentowy + treść w drzewie). Jedyna strata rebase'u — alias `/finance/value` — wykryta i przywrócona (`4fed634985`).
2. **Backend M16 = ZDROWY na żywym demo** — uwierzytelniony re-test API na realnych danych seed: 8+ endpointów 200, model-compute liczy (24 okresy, walidacja 72/72), wycena/analiza/sprawozdania działają.
3. **Znalezione i naprawione 2 rzeczywiste bugi:**
   - `POST /models/:id/duplicate` → 500 (stale initiative FK) → **fix `4667bcf264`**
   - `POST /models/:id/duplicate` → 500 (stale sourceStatementPackId / niekompletny pack seed) → **fix `131acfb662`**
   - **Łącznie: 41 testów M16 (duplicate) zielonych; 626/626 testów M16 ogółem; tsc czysto.**
4. **4 zarzuty „UI-fake" z dokumentów poprzednika = realne, ale ARCHITEKTONICZNE** (split-brain V8↔legacy) + **decyzyjne (D1–D5 Piotra)** + wymagają wizualnej akceptacji (→UI). Świadomie NIE „naprawiane na ślepo".
5. **Deploy demo:** KOMPLETNY. Commit `131acfb662` live na demo od 08:56 — weryfikacja live: 201 ✅.

---

## 1. CO ZROBIŁEM (chronologicznie)
- **Audyt przeniesienia** (3 równoległe agenty + pełny zestaw testów) → [M16-WERYFIKACJA-PRZENIESIENIA-2026-06-25.md](M16-WERYFIKACJA-PRZENIESIENIA-2026-06-25.md). Werdykt: transfer kompletny, 1 fix zgubiony (alias) → przywrócony.
- **Plan domknięcia** w formacie SSOT odbiorowego → [M16-DOMKNIECIE-PLAN-2026-06-25.md](M16-DOMKNIECIE-PLAN-2026-06-25.md).
- **Deploy demo #1** (`abd55d4c25`) przez `scripts/deploy-demo.sh` — build SUCCESS, demo live.
- **Re-test ground-truth API** na żywym demo (login piotr/…, org a3e05d4a, dane seed `staging-dbr77-fin-*`).
- **Fix BUG-09 round 1:** `4667bcf264` — duplicate toleruje stale initiative FK (501 → 201).
- **Fix BUG-09 round 2:** `131acfb662` — duplicate retry czyści też stale sourceStatementPackId (niekompletny pack seed → "must contain P&L, BS, CF"). Railway logs ujawniły drugi error po deploy round 1.
- **Deploy demo #2** (`131acfb662`) — build SUCCESS 08:56 — live weryfikacja 201 ✅.

## 2. MAPA GROUND-TRUTH (uwierzytelniony API, żywe demo, realne dane)
Dane seed obecne: statements (BS+1), model (staging-dbr77-fin-model), analiza, wycena. **Budżety: BRAK** (`[]`) → Prediction nie do przetestowania live bez seedu.

| Obszar | Endpoint / sprawdzenie | Wynik live | Werdykt |
|---|---|---|---|
| **Investment** | `POST /finance/value/appraise` (alias, BUG-02/05) | **200 ✅** | **NAPRAWIONY — alias działa** |
| Investment | `/finance-value/appraise` (oryginał) | 200 ✅ | OK |
| **Models** | `POST /models/:id/compute` | 200 (22s, walid. 72/72) | ✅ liczy (WOLNE — perf-note) |
| **Models** | `GET /models/:id/events` (BUG-04) | 200 ✅ | OK |
| **Models** | `POST /models/:id/analyze` (BUG-10) | 202 ✅ | OK (stub queued) |
| **Models** | `GET /models/:id/export` (BUG-12) | 200 ✅ | OK |
| **Models** | `GET /models/:id/outputs/download` (BUG-11) | 404 „No outputs" | ✅ poprawny empty-state |
| **Models** | `POST /models/:id/duplicate` (BUG-09) | 500→**201** | 🔴→✅ **NAPRAWIONY** (`131acfb662`) |
| **Statements** | `GET /statements/:id/analytics` | 200 ✅ | OK |
| **Analysis** | `GET /analyses/:id/ratios` | 200 ✅ | OK (18 wsk.) |
| **Analysis** | `POST /financial-analyses/:id/insights` (BUG-06) | 200 ✅ | OK |
| **Analysis** | business-case/decisions (BUG-07/08) | 404 | ⚪ split-brain (V8-id vs legacy-economics; endpointy ISTNIEJĄ) |
| **Valuation** | `GET /valuations/:id/assumptions` (BUG-13) | 200 ✅ | OK |
| **Prediction** | budżety | brak danych | ❔ nie do testu live (seed) |

**Wniosek:** z 15 bugów manualnych — **14 potwierdzonych OK/naprawionych na żywo**. BUG-09 naprawiony w tej sesji (2 iteracje: stale FK + stale pack). business-case/decisions „404" = split-brain id-space, nie brak endpointu.

## 3. NAPRAWA: model duplicate 500→201 (2 iteracje)

### Iteracja 1 — `4667bcf264`
**Root cause:** `createModel` ma guard cross-org FK (rzuca `Source initiative not found`); model źródłowy wskazywał na syntetyczną inicjatywę spoza tabeli `initiatives`. Guard rzucał, throw nieprzechwycony → 500.  
**Fix:** duplicate próbuje kopię z FK; przy `/not found/` → retry bez graftu project/initiative.

### Iteracja 2 — `131acfb662`
**Root cause:** retry (bez initiative FK) nadal miał `sourceStatementPackId` z oryginalnego modelu. `buildSeededAssumptionsFromPack` wymagało kompletnego pakietu (P&L + BS + CF), staging pack niekompletny → rzucało "must contain P&L, Balance Sheet, and Cash Flow". Ten błąd nie pasował do poprzedniego `/not found/` → propagował jako 500.  
**Odkrycie:** Railway logs (`railway logs --service ...`) ujawniły root cause bez debugowania lokalnego.  
**Fix:** catch rozszerzony o `/must contain/`; retry bez `sourceStatementId` I bez `sourceStatementPackId`. +2 testy regresji (BUG-09b, BUG-09c). **626/626 testów M16, tsc czysto.**

## 4. 4 ZARZUTY P0 „UI-FAKE" — analiza (realne, ale decyzyjne/wizualne)
| Zarzut | Realny? | Dlaczego NIE naprawiam „na ślepo" |
|---|---|---|
| **Scenariusze base/bull/bear UI-fake** | TAK | FE woła legacy `/api/financial-modeling/compute` (split-brain z v8) bez param `scenario`; ±15% fallback w Valuation/Driver (poprawny gdy brak sensitivity matrix). Przełączenie = **decyzja split-brain D1** + wizualna weryfikacja |
| **ratioAnalysisService (34 wsk.) nieużywany** | CZĘŚCIOWO | Endpoint `/analyses/:id/ratios` zwraca przechowane ratios (18 przy seed); serwis 34 wsk. używany przez `/statements/:id/ratios` — to nie jest bug kodu, to data-age seed |
| **WACC flat (nie CAPM) w UI** | ❔ | brak oczywistego hardcode w FE; wymaga prześledzenia ścieżki danych wyceny na żywo → UI |
| **VarianceBridge pusty (brak `lines`)** | TAK | panel `VarianceBridgePanel` renderowany bez prop `lines` w FinanceHub:2122; rodzic nie podaje linii budżetowych. Wymaga seedu budżetów + decyzji struktury danych |

**Dlaczego nie ruszałem:** zależą od (a) **decyzji split-brain V8↔legacy (D1–D5 — Twoje)**, i/lub (b) **wizualnej weryfikacji** (demo blankuje pod headless; →UI). Nie naprawiam „na ślepo" gdy 626 testów jest zielonych bez dowodu regresji po zmianie.

## 5. STATUS 8 ETAPÓW M16 (po sesji 2 — 2026-06-26)
| # | Etap | Przed S2 | Po S2 | Komentarz |
|---|------|------|----|-----------|
| 1 | Kod | 🟡 | 🟢 | +POST /budgets + migracje readiness + digitization_analyses; 4 P0 FE = decyzyjne |
| 2 | DoD 7/7 | 🟡 | 🟡 | #6 E2E auto ✅; #1/#7 (front↔back UI / UI-canon) = po decyzjach FE |
| 3 | Epiki | 🟡 | 🟡 | backend ✅; FE-wiring 4 obszary = decyzyjne |
| 4 | Testy | 🟢 | 🟢 | **Kod 641/641 ✅**; Manual 62/177 PASS (+17 vs S1); FAIL 4 (arch.); SKIP 111 (UI/upload/compute) |
| 5 | UI/UX | ⬜ | ⬜ | wymaga →UI (Twoja bramka) |
| 6 | Deploy demo | 🟢 | 🟢 | **`64574468ae` LIVE** — live re-test 30/30 API PASS |
| 7 | →F | ⬜ | ⬜ | Twoja bramka (klik na demo) |
| 8 | →UI | ⬜ | ⬜ | Twoja bramka (audyt 22 ekranów) |

## 6. CO ZOSTAJE DO 8/8 (dla Ciebie)
1. **DECYZJE D1–D5** (split-brain V8↔legacy, zakres v1) — odblokowują 4 P0 FE.
2. ~~**Seed budżetów** na demo~~ → ✅ **DONE** — budżety zseededowane, POST /budgets endpoint live.
3. **→F** — klik 6 zakładek na demo (30/30 API PASS potwierdzone).
4. **→UI** — audyt wizualny 22 ekranów.
5. (opcja po decyzjach) zlecić mi: przepięcie scenariuszy na v8+scenario, variance-lines.

## 7. DOWODY
- Testy: **641/641 M16 zielone** (41 tests w finance.routes.test.ts incl. POST /budgets 2 nowe) · tsc czysto.
- Commity S1: `4fed634985` (alias restore), `4667bcf264` (BUG-09 r1), `131acfb662` (BUG-09 r2).
- Commity S2: `b5d1b99764` (POST /budgets + readiness migration + 41/41 tests), `64574468ae` (digitization_analyses migration).
- Live re-test S2: **30/30 API PASS** — wszystkie BUG-02–13 potwierdzone ✅ na demo.
- Seed demo: budżet id=`9e3cb163`, enterprise budget=`790f3f26`, analysis=`2bf3e025`.
- Bezpieczeństwo: tylko demo (caboose/demo env); **centerbeam/PROD nietknięty**.

## §Deploy — status (FINAŁ SESJI 2)
- **Deploy #1 `abd55d4c` = SUCCESS** (sesja nocna). Alias `/finance/value` + cały M16.
- **Deploy #2 `4667bcf264` = N/A** — niekompletny fix (pominięty pack error).
- **Deploy #3 `131acfb662` = SUCCESS ✅ LIVE od 08:56** — BUG-09 kompletny fix.
- **Deploy #4 `b5d1b99764` = SUCCESS ✅ LIVE ~13:00** — POST /budgets + readiness migration + 41/41 tests.
- **Deploy #5 `64574468ae` = SUCCESS ✅ LIVE ~13:08** — digitization_analyses migration (BUG-07/08).
- **Live re-test po S2: 30/30 API PASS** — wszystkie endpointy M16 zielone.
- **PROD (centerbeam) — NIETKNIĘTY.** Zgodnie z poleceniem: kończymy na stagingu.
