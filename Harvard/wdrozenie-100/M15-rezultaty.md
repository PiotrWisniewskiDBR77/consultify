# WP M15 — Rezultaty (Results / Benefits Realization) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M15-rezultaty/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak (oba P0 — cross-org time-series + x-kpi-role — NAPRAWIONE `91c8245559`)
**Faza programu:** FAZA 2 (kliencki: VTS/Apator/Elkomtech) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Moduł funkcjonalnie solidny — KPI (4 tryby: overview/queue/catalog/scorecards + time-series + signal sheet) i ROI (portfolio summary, ROI Analysis) to **realne obliczenia z realnych tabel** (`v8_kpi_definitions`, `kpi_time_series`, `v8_roi_realization_entries`, `kpi_financial_mappings` — AVG/COUNT/NPV/payback, bez fasady `new Map()`), Reports 5 trybów z **approval-gatingiem egzekwowanym serwerowo** (`resultsEnterpriseService.ts:796`, pokryty testem `results-finalization-guard`), a showcase/demo-data to **wzorcowo bezpieczny mechanizm** (`shouldUseResultsShowcaseData()` = wyłącznie jawny toggle, „NEVER auto-activate”, podstawia tylko gdy realne PUSTE, chip „Showcase data — local”). **i18n najzdrowszy w audycie** (134× `t()`, 0× `isPolish`, 0 hex). **Oba P0 NAPRAWIONE** (`91c8245559`): cross-org KPI write (`UPDATE` z `AND organization_id`) i RBAC bypass `x-kpi-role` (header usunięty, rola z JWT). Sufit 54/100: Fazy 3+4 + 5 mocków-drift + degraded banner V8→legacy NIE renderowany (cicha pustka).

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 2)
- **[P2] degraded banner V8→legacy NIE renderowany** — `kpiRuntime.ts:39-74` cicho schodzi na `/api/benefits/*` (`source:'legacy'`), ale `'legacy'` nigdzie nie pokazany (chip tylko `'showcase'`); jedyny ślad `console.warn`. Cicha pustka jak M13/M14. Fix: renderować baner `source:'legacy'` (wzorzec M16 `FinanceDegradedBanner`).
- **[P3] `ResultsGridView` (`ResultsKPITable`) raw `<table>`** bez `TableWithPreviewLayout` — dopuszczalne (główny katalog to `KpisTableV3`), świadoma decyzja lub §27.

### (b) BACKEND / API (FAZA 2)
- Oba P0 NAPRAWIONE (`91c8245559`): time-series UPDATE org-scoped; `x-kpi-role` usunięty, rola z JWT. **WZORZEC SYSTEMOWY:** autoryzacja sterowana nagłówkiem klienta — sprawdzić w innych v8-routerach.
- **[P2] SEC-6 connector IRIS plaintext** — `mes_api_token`/Authorization plaintext JSON w `mcp_providers.config` (`mcp.routes.ts:91`); `GET /api/mcp/providers` (tylko `verifyToken`, nie admin) zwraca `config` non-adminom. Fix: szyfrowanie + ograniczyć endpoint do admina.
- **[P2] SEC-8 beta-lock tylko nawigacyjny** — `/benefits` (`AppRoutes.tsx:2136`) tylko `ProductionModuleGate`, bez beta-guarda; direct URL omija. Fix: beta-guard na route.
- **[P3] SEC-3** INSERT/UPSERT deviation/roi bez weryfikacji własności rodzica (data-pollution własnej org).

### (c) INTEGRACJA / TESTY (FAZA 2 + 4)
- **[INTEGRACJA] sync-to-results dead-end** — `publish-to-results` (`table-platform.routes.ts:3413`, z M20) pisze tylko do `tp_module_sync_results`; **żaden moduł Results tego nie czyta** (0 trafień). Decyzja: wpiąć odbiór lub oznaczyć „preview”. Koordynacja z WP M20.
- **[MARTWY] `BenefitsRealizationView`/`BenefitsHub.tsx`** (8 zakładek) — lazy-import (`AppRoutes:115`), nigdy w JSX; `/benefits` renderuje `ResultsHub`. 0 ścieżek renderu. Wytnij.
- **[P0 testowy] 5 FAIL (test-drift, nie bugi)** — 4× stale-mock `resolveReconciliation` (serwis dodał `notificationService.send :56`, test nie mockuje); 1× stale-assertion `getResultsKpiCatalog` (mapping +6 pól → `toMatchObject`). Naprawić.
- **[P0 testowy] szczelność showcase demo=ON** — brak testu że przy demo=ON showcase NIE przecieka do realnych zapisów `/api/v8/results/*` (B3). Dodać.
- **[P1 testowy]** fallback V8-OFF (S7) i cron (S3) nietestowane.
- CI: `test-suite.yml` tylko `[main,develop]`; testy M15 (`src/components/Results/__tests__/`, `server/**/__tests__/`) poza shardami → PR-gate ≈ 0 (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 2)** Degraded banner V8→legacy — renderować `source:'legacy'` (wzorzec `FinanceDegradedBanner` M16) zamiast cichej pustki.
2. **(FAZA 2)** Szyfrowanie connector IRIS secrets + ograniczyć `GET /api/mcp/providers` do admina (nie zwracać `config` non-adminom); beta-guard na `/benefits`.
3. **(FAZA 2)** Decyzja sync-to-results (M20 dead-end) — wpiąć odbiór KPI z Tabel lub oznaczyć „preview” + jasny komunikat. Koordynacja z WP M20.
4. **(FAZA 3 jakość)** Wytnij martwy `BenefitsHub`/`BenefitsRealizationView`; §27 `ResultsGridView` (lub świadomie zostaw); SEC-3 weryfikacja własności rodzica przy UPSERT deviation/roi.
5. **(testy)** Naprawa 5 FAIL (mocki `notificationService`, `toMatchObject`); B3 szczelność showcase demo=ON; B4 fallback V8-OFF; B5 cron.
6. **(FAZA 4)** Żywe 7 scenariuszy (S6 showcase chip „local”, S7 degradacja czy baner widoczny, P0 x-kpi-role spoof curl viewer→403, P0 time-series cross-org read-only proof). **(FAZA 3-Railway)** migracje `v8_kpi_*`/`roi_*` + smoke (OSTROŻNIE z zapisem KPI — dev `.env` może wskazywać PROD).

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** KPI/ROI/Reports na realnych danych trwałe po reload; degraded banner widoczny przy V8-OFF (nie cicha pustka); sync-to-results wpięty lub jasno oznaczony „preview”; zero martwego `BenefitsHub`.
2. **Bezpieczeństwo:** oba P0 zamknięte (cross-org time-series + x-kpi-role, `91c8245559`) z testem; connector secrets szyfrowane + admin-only; beta-guard na route.
3. **i18n:** już najzdrowszy (134× `t()`, 0× `isPolish`) — utrzymać.
4. **Tokeny:** już 0 hex — utrzymać.
5. **§27:** KPI Catalog (`KpisTableV3`) + Reports zgodne (już); `ResultsGridView` świadoma decyzja.
6. **E2E w PR-gate:** IDOR + RBAC + szczelność showcale demo=ON + naprawa 5 FAIL zielone na `Londyn`.

## 5. Weryfikacja
- KPI/ROI: catalog → time-series → reload → trwałe.
- V8-OFF (S7): degradacja pokazuje baner `source:'legacy'`, nie cisza.
- Showcase (S6): chip „Showcase data — local” widoczny; przy demo=ON brak wycieku do realnych zapisów (test B3).
- P0 x-kpi-role: `curl` z `x-kpi-role: kpi_owner` na koncie viewer → 403 na delete/create.
- P0 time-series: cross-org KPI write → 403/404; KPI org B niezmienione (read-only proof).
- Uwaga DB: dev `.env` może wskazywać Railway PROD — ostrożność z zapisem KPI.

## 6. Zależności
- **sync-to-results dead-end** dotyka M20 (`publish-to-results` pisze log, Results nie czyta) — decyzja wspólna z WP M20 (preview vs realny odbiór).
- WEJŚCIA ← M13 Inicjatywy (tracked + KPI), M16 Finanse (ROI/economics) — bez zmiany kontraktu.
- **WZORZEC SYSTEMOWY** `x-kpi-role`: autoryzacja z nagłówka klienta — audyt innych v8-routerów (cross-module).
- CI PR-gate dla `Londyn` + shardy obejmujące Results testy — systemowe (FAZA 4).
