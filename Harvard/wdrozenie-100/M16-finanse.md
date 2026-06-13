# WP M16 — Finanse (Economics / Financial Analysis v3) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M16-finanse/KARTA_AUDYTU.md` (ocena 58/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak (P0 legacy IDOR `getModel` NAPRAWIONY `e3945bc7fc`)
**Faza programu:** FAZA 2 (kliencki: VTS/Apator/Elkomtech) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Funkcjonalnie najsilniejszy moduł finansowy — **wszystkie analizy to realna matematyka, nie demo/placeholder** (NPV/IRR przez bisekcję ze zbieżnością <0.0001, payback z interpolacją `financialAnalysisService.ts:264-318`; ratios z safeDiv/safePct `:560`; DCF z WACC breakdown, terminal Gordon/exit-multiple, FCFF `valuationService.ts`; silnik modeli monthly `financialModelingService.ts:643`; import Excel realny parsing xlsx `finance-statements.routes.ts:221`), persystencja na realnych tabelach Postgres (`financial_statements/_values/_lines`, `financial_models/_outputs`, `financial_analyses`, `valuations` — bez fasady `new Map()`), **billing honest** (mock `pm_..._mock` usunięty, kill-switch default OFF → „billing handled manually”, token-billing 503 `not_configured` bez Stripe), degraded banner V8→legacy **realny i WIDOCZNY** (`FinanceDegradedBanner`, `useFinanceLane.ts:209` — lepiej niż cicha pustka M13/M14). **P0 cross-org IDOR legacy `/api/financial-modeling` NAPRAWIONY** (`e3945bc7fc` — `getModel` org-scoped). Sufit 58/100: Fazy 3+4 + **obliczenia finansowe tylko częściowo testowane (fałszywa zieleń DCF/WACC/ratio)** + beta-lock nawigacyjny + i18n inline.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 2)
- **[P3] i18n inline** — 148× `t()` ale 19× `isPolish`/`i18n.language` inline (antywzorzec jak M19/M20); empty-messages mieszane PL/EN (`FinanceHub :1739` EN vs `:1763-1771` PL hardkod). Fix: usunąć `isPolish`, ujednolicić.
- **[P3] brak `EntityStatusChip`** — własne chipy (`:1609,1034`). Fix: `EntityStatusChip` z SSOT.
- (`EconomicsViewPlaceholder.tsx` martwy — już USUNIĘTY `b5de79ef03`.)

### (b) BACKEND / API (FAZA 2)
- P0 legacy IDOR `getModel` NAPRAWIONY (`e3945bc7fc` — `WHERE id=? AND organization_id=?` na wszystkich legacy by-id: GET/PUT/DELETE/compute/submit-review/events/approve). **WZORZEC SYSTEMOWY:** V8 czyste, legacy raw-DB dziurawe — sprawdzić inne legacy routery.
- **[P1] F-SEC-2 beta-lock tylko nawigacyjny** — CLOSED w sidebarze (`Sidebar.tsx:152`), `RouterSyncProvider` bez beta-guarda; direct URL `/finance`/`/economics` omija (wzorzec M17-M20). Mityguje `isFeatureBlocked('finance')` (`:2114`) — ale to polityka org, nie beta. Fix: beta-guard na route → plate `BETA_LOCKED`.

### (c) INTEGRACJA / TESTY (FAZA 2 + 4)
- **[P0 testowy] obliczenia finansowe częściowo testowane / fałszywa zieleń** — DCF/WACC tylko `toBeTypeOf('number')`; ratio/forecast bez compute-testów; **`financialCalculatorService.test.js` definiuje własny kalkulator w teście, nie importuje produkcji**. W module gdzie liczby są produktem to realne ryzyko regresji. Fix: B1 przepisać na realny serwis; B2 numeryczne asercje DCF/WACC; B3 unit `ratioAnalysisService`.
- **[P0 testowy] 14 FAIL (drift, nie logika)** — 2 FE label-drift (toolbar `+ Importuj statement`/`complete-import`); 4 integration schema-drift PG/rola `iris` (`MOCK_DB=false` mimo to PG); 8 BE mock-drift sekwencji `DbPromise` w p05-finance-lane (kolejność DB zmieniona). Fix: B5 sekwencja mocków p05; B6 label-drift; B7 economicsFlow env.
- **[INTEGRACJA] sync-to-finance STUB** — `ModuleSyncService:57` (z M20) pisze tylko log do `tp_module_sync_results`; **żadna tabela `financial_*` nie konsumuje mostu** (potwierdzone z drugiej strony). Decyzja: realny odbiór lub jawne „preview”. Koordynacja z WP M20.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; testy mockują flagę V8 ON (beta-OFF prawie niepokryty). Dodać `Londyn` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 2)** Beta-guard na route `/finance`/`/economics` (nie tylko sidebar) → plate `BETA_LOCKED`.
2. **(FAZA 2, P0 testowy)** Testy obliczeń finansowych — przepisać `financialCalculatorService.test.js` na realny serwis (B1); numeryczne asercje DCF/WACC (B2); unit `ratioAnalysisService`/forecast (B3). To domyka ryzyko „fałszywej zieleni” w module, gdzie liczby są produktem.
3. **(FAZA 2)** Naprawa 14 FAIL drift — sekwencja mocków p05 (8×404, B5), label-drift FinanceHub (B6), economicsFlow env (B7).
4. **(FAZA 2)** Decyzja sync-to-finance (M20 STUB) — wpiąć realny odbiór lub jawnie oznaczyć „preview”. Koordynacja z WP M20.
5. **(FAZA 3 jakość)** i18n — usunąć 19× `isPolish`, ujednolicić empty-messages PL/EN; `EntityStatusChip` zamiast własnych chipów.
6. **(FAZA 4)** Trigger CI `Londyn` + testy server/. **(FAZA 4 żywe)** 8 scenariuszy (S5 wycena — czy liczby DCF poprawne na żywo, S7 degraded banner widoczny, IDOR legacy cross-org read-only proof, billing 503 bez Stripe). **(FAZA 3-Railway)** migracje `financial_*`/`valuations` + smoke (OSTROŻNIE — dev `.env` może wskazywać PROD; modele finansowe!).

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** wszystkie analizy (DCF/WACC/ratio/NPV/IRR/forecast) na realnych danych trwałe po reload; degraded banner widoczny (już działa); billing honest (już); zero fasady.
2. **Bezpieczeństwo:** legacy IDOR zamknięty (`e3945bc7fc`, z testem cross-org); beta-guard na route.
3. **i18n:** usunąć 19× `isPolish`; empty-messages PL/EN komplet.
4. **Tokeny:** `EntityStatusChip` z SSOT zamiast własnych chipów.
5. **§27:** `ModuleHub`+`TableWithPreviewLayout`+`FilterableTable` (już zgodne); `CanonicalStatementTable` własny grid uzasadniony (sprawozdanie).
6. **E2E w PR-gate:** obliczenia (DCF/WACC/ratio realne) + IDOR cross-org 404 zielone na `Londyn`; 14 FAIL → 0.

## 5. Weryfikacja
- S5 wycena: DCF/WACC liczone poprawnie na żywo (spot-check wartości).
- S7: degraded banner widoczny przy degradacji V8 (już potwierdzone — re-smoke).
- IDOR legacy: próba GET/PUT/DELETE cudzego `modelId` → 404 (read-only proof cross-org na staging).
- Billing: bez Stripe → 503 `not_configured`, brak fake-success.
- Testy: `financialCalculatorService` importuje produkcję (nie własny kalkulator); DCF/WACC asercje numeryczne.
- Uwaga DB: dev `.env` może wskazywać Railway PROD — szczególna ostrożność z modyfikacją modeli finansowych.

## 6. Zależności
- **sync-to-finance STUB** dotyka M20 (`ModuleSyncService` pisze log, Finance nie odbiera) — decyzja wspólna z WP M20 (preview vs realny odbiór).
- WEJŚCIE ← M13 Inicjatywy (`v8_initiative_economics_linkages`); WYJŚCIE → M17 Outputs (export za beta) — bez zmiany kontraktu.
- **WZORZEC SYSTEMOWY** legacy raw-DB IDOR — audyt innych legacy routerów (cross-module, jak M20/M15).
- CI PR-gate dla `Londyn` + testy server/ — systemowe (FAZA 4).
