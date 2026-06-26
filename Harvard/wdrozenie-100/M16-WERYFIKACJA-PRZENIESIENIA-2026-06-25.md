# M16 — WERYFIKACJA PRZENIESIENIA PRACY (audyt niezależny) · 2026-06-25

> **Po co:** Piotr nie był pewny, czy praca poprzedniego agenta nad M16 (Finanse) została prawidłowo przeniesiona po dzisiejszym rebase współdzielonej gałęzi. Ten audyt sprawdza: (1) integralność przeniesienia, (2) czy zbudowano 30 testów/funkcjonalność, (3) stopień wykonania, (4) czy bugi naprawione, (5) głębię realizacji wg dokumentacji. Metoda: 3 równoległe agenty audytujące (dokumentacja / case'y+wyniki / integralność git+kod) + uruchomienie pełnego zestawu testów automatycznych.

## WERDYKT W JEDNYM ZDANIU
**Przeniesienie jest KOMPLETNE** (cała praca M16 przetrwała rebase — zweryfikowane przez TREŚĆ w drzewie, nie tylko SHA; jedyna strata = alias `/finance/value`, już przywrócony `4fed634985`). **Testy zbudowane obficie** (604 automatyczne zielone + 180 manualnych). **ALE: wykonanie manualne = tylko 35%, a deklarowany status UI poprzedniego agenta jest przeszacowany** (jego własny audyt detaliczny wymienia 10 P0 luk UI — niepotwierdzonych po naprawach na żywo).

---

## 1. Czy przeniesienie prawidłowe? → TAK (po naprawie aliasu)
Audyt integralności git (SHA + **treść w drzewie**, bo rebase przepisuje SHA):

| Obszar | Obecny? |
|---|---|
| 35/35 serwisów M16 (Fale F1–F9) | ✅ (financeLinkService pod `services/results/`) |
| 5 paneli wartości (Investment/ValueOffice/Variance/Valuation/DriverPlanner) `.tsx` | ✅ obecne + wired w FinanceHub |
| financeValueRoutes zamontowany | ✅ (`/finance/value` + `/finance-value`) |
| extendedRatiosService (ROE/ROA/ROIC/DuPont), scenarioCompute, nlToModel, financeCalcEngine | ✅ |
| 6 commitów napraw bugów + budget approve | ✅ wszystkie |
| 47 plików testowych (37 `tests/unit/finance` + 10 `tests/components/Finance`) | ✅ |
| **Alias `/finance/value` (BUG-02/05)** | 🔴→✅ **zgubiony w rebase, przywrócony** |

**Jedyna realna strata = alias** (już naprawiony). Reszta nienaruszona.

## 2. Czy zbudowano 30 testów/funkcjonalność? → TAK, w dwóch warstwach
- **Manualne (6×30 = 180):** wszystkie 6 plików istnieją, zakresy `MC-16{S,M,A,P,W,I}-01..30` kompletne. Jakość wysoka — każdy case ma kroki + oczekiwany rezultat + asercję Network (endpoint/payload) + grafikę. NIE szkielety.
- **Automatyczne: 604 testy / 55 plików — wszystkie ZIELONE.** W tym 5× `*PanelM16.test.tsx`, 30 epic-coverage, testy serwisów F1–F9, routes, fallback V8↔legacy.

## 3. W jakim stopniu wykonane?
| Warstwa | Wykonanie |
|---|---|
| **Automatyczne** | **604 / 604 PASS (100%)** |
| **Manualne** | **63 / 180 realnie wykonane (35%)** → 45 PASS / 18 FAIL; **114 SKIP** (brak danych / operacje hazardowe / poza zakresem headless) |

**Największa luka = manualne wykonanie (35%).** 114 SKIP to nie porażki — to nieuruchomione (głównie brak danych na środowisku). Pełne wykonanie wymaga żywego env z danymi (= odłożony re-test).

## 4. Czy bugi naprawione?
- **15 bugów (BUG-01..15) wykrytych manualnie** → 6 commitów napraw, wszystkie obecne + alias przywrócony. **Kod napraw zweryfikowany w drzewie.**
- **ALE: FAIL→PASS NIE re-testowane na żywo.** Bugi naprawione w KODZIE; że faktycznie znikły z UI — niepotwierdzone (to właśnie odłożony re-test).
- **KG-01..04** = świadome luki designu v1 (VarianceBridge bez `lines`, brak selektora typu analizy, itp.), nie bugi.

| Bug | Co | Status kodu |
|---|---|---|
| BUG-01 (P1) | lane polling co ~1s (wyciek) | ✅ fix (onUnavailableRef) — uwaga: test `useFinanceData` nadal loguje „Maximum update depth" |
| BUG-02/05 (P1/P2) | ValueOffice + InvestmentAppraisal `/finance/value/* → 404` | ✅ alias przywrócony |
| BUG-03/04/09/10/11/12 (P2) | 6 brakujących endpointów finance.routes | ✅ dodane |
| BUG-06/07/08/13 (P2) | 4 endpointy economics.routes + schema | ✅ dodane |
| BUG-14/15 (P3) | CSV mismatch + spec nieaktualna | ✅ |

## 5. Głębia realizacji + ⚠️ SPRZECZNOŚĆ W DOKUMENTACJI
Program **9-fazowy F0–F9**: WACC/CAPM engine, living business case, value-bridge waterfall, portfolio board+rNPV+Monte Carlo, variance bridge, cash forecast+versioning, investment panel (NPV/IRR/MIRR/PI), anomaly AI+NL→model, konsolidacja V8.

**⚠️ Dokumentacja jest WEWNĘTRZNIE SPRZECZNA — to klucz do Twojej obawy:**
- `M16-STAN-PRACY-ODBIORY.md`: backend F1–F9 = ✅ GREEN (z testami).
- `M16-AUDYT-DETALICZNY-2026-06-24.md`: wymienia **10 P0 „martwych obietnic UI"** — scenariusze martwe (UI-fake), variance brak, investment panel skorupa, WACC flat (nie CAPM), sensitivity nie renderuje.
- Realny rozkład: **backend ~70% zrobiony i otestowany, FE ~30% wired.** „Zielone testy + działający backend" ≠ „widać i działa w UI".
- Część z 10 P0 mogła zostać domknięta przez późniejsze commity (panele wired, alias, endpointy) — ale **żaden nie potwierdzony na żywo** po naprawach.

## CO TO ZNACZY (bottom line dla Piotra)
1. **Nie zgubiliśmy pracy** — przeniesienie kompletne (po naprawie aliasu). Twoja obawa była uzasadniona (1 fix zniknął), ale reszta jest.
2. **Testów jest dużo i są zielone** (604 auto), case'y manualne kompletne i dobre.
3. **Dwie realne luki:** (a) manualne wykonanie tylko 35% (114 SKIP — brak danych), (b) status UI poprzedniego agenta przeszacowany (10 P0 wg jego własnego audytu, niepotwierdzone po naprawach).
4. **Jedyne co domyka niepewność = żywy re-test** na env z danymi: potwierdzić że 18 FAIL → PASS po naprawach + przejść 114 SKIP. To jest dokładnie ten odłożony krok (deploy + re-test 6 zakładek).

## Źródła audytu
3 agenty (dokumentacja / 180 case'ów+raport / integralność git+kod) + `vitest run` pełnego zestawu M16 (604/604). Raport wyników: [TESTY_M16_REZULTATY_W1_W6.md](../Testy%20manualne/TESTY_M16_REZULTATY_W1_W6.md). Audyt detaliczny: [M16-AUDYT-DETALICZNY-2026-06-24.md](M16-AUDYT-DETALICZNY-2026-06-24.md).
