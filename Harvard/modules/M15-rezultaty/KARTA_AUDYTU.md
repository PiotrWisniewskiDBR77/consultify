# M15 — Rezultaty (Results / Benefits Realization) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `6b12f5c38c`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M15 · inwentarz `Harvard/podzial/inventory/INV_D_*.md` (sekcja REZULTATY, poz.1-8) · poprzednia karta `docs/audit/2026-06-02/MODULE_07_rezultaty.md` (45/100)
**Evidence:** `Harvard/modules/M15-rezultaty/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 54/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 2→7 (W1 cross-org KPI write + W3 x-kpi-role naprawione, commity `b9f2dee9d2` + `e3945bc7fc`, hard cap zdjęty).

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | KPI/ROI to realne obliczenia z DB; **showcase-data = bezpieczny, oznaczony demo-toggle** (nie ciche fabrykowanie); BenefitsHub MARTWY potwierdzony. |
| B. Wiring i dane | 15 | 11 | Realne tabele Postgres (`v8_kpi_definitions`, `kpi_time_series`, `roi_*`), bez fasady; ale degradacja V8→legacy CICHA + sync-to-results z M20 to dead-end (Results nic nie czyta). |
| C. Testy automatyczne | 15 | 8 | 239 PASS/5 FAIL (test-drift, nie bugi); approval-gating dobrze pokryty, ale szczelność showcase przy demo=ON nietestowana; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 7 | §27 zgodny (KpisTableV3/Reports), **i18n najzdrowszy w audycie** (134× `t()`, 0× `isPolish`, 0 hex); ale degraded banner NIE działa (cicha pustka jak M13/M14). |
| F. Bezpieczeństwo/dostęp | 10 | 7 | W1 cross-org KPI write + W3 x-kpi-role naprawione (commity `b9f2dee9d2`, `e3945bc7fc`); W7 beta-lock 3-warstwowy; pozostałe: connector IRIS plaintext (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — oba P0 naprawione (W1+W3), hard cap zdjęty.** Suma surowa 54 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Moduł funkcjonalnie solidny — KPI (4 tryby: overview/queue/catalog/scorecards + time-series + signal sheet) i ROI (portfolio summary, ROI Analysis) to **realne obliczenia z realnych tabel** (`v8_kpi_definitions`, `kpi_time_series`, `v8_roi_realization_entries`, `kpi_financial_mappings` — AVG/COUNT/NPV/payback, bez fasady `new Map()`), Reports 5 trybów enterprise z **approval-gatingiem egzekwowanym serwerowo** (`resultsEnterpriseService.ts:796` blokuje wykonanie do `awaiting_approval`; pokryte testem `results-finalization-guard`), a **showcase/demo-data to wzorcowo bezpieczny mechanizm** — `shouldUseResultsShowcaseData()` = wyłącznie jawny toggle usera („Demo data must NEVER auto-activate", brak backdoora localhost/DEV), podstawia tylko gdy realne PUSTE, i renderuje widoczny chip „Showcase data — local" (`ResultsHub.tsx:909`) — NIE pokazuje fake-wyników klientowi bez świadomego włączenia. i18n najzdrowszy ze wszystkich studiów (134× `t()`, 0× `isPolish`, 0 hardkodów hex). **Dwa blockery bezpieczeństwa P0:** (1) **cross-org KPI write** — `POST /benefits/kpis/:kpiId/time-series` scope'uje INSERT do własnej org, ale następczy `UPDATE initiative_kpis SET current_value = ? WHERE id = ?` (`benefits.routes.ts:468`) jest **bez `organization_id`** → user org A nadpisuje `current_value` KPI org B po kpiId (wzorzec recalc M14, zweryfikowane osobiście); (2) **RBAC bypass** — `p04KpiRoleFromRequest` (`v8/results.routes.ts:108-113`) bierze rolę KPI **wyłącznie z nagłówka `x-kpi-role`** bez porównania z realną rolą usera → dowolny członek wysyła `x-kpi-role: kpi_owner` i przechodzi bramki `delete_kpi`/`edit_definition`/`create_report`/`manage_reconciliation` (in-org privilege escalation, defeat całego modelu RBAC + bramki tworzenia raportów). Reszta by-id (legacy benefits PUT/DELETE) jest org-scoped (`WHERE id=? AND organization_id=?` przed mutacją) — M15 NIE jest pełną hybrydą jak M16. Drugorzędne: degraded banner V8→legacy NIE renderowany (cicha pustka jak M13/M14, jedyny ślad `console.warn`); connector IRIS sekret plaintext w `mcp_providers.config` zwracany non-adminom (P2); beta-lock nawigacyjny (P2). Hard cap (cross-org write → 50) + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_D sekcja REZULTATY, poz.1-8.
**Scenariusze krytyczne (7):**
1. **S1** — Initiatives tracked + filtry lifecycle/health.
2. **S2** — KPI 4 tryby (overview/queue/catalog/scorecards) + time-series + create.
3. **S3** — Reports 5 trybów + cron schedules + approval gating.
4. **S4** — ROI portfolio summary + edytor założeń.
5. **S5** — ROI Analysis.
6. **S6** — Showcase/demo-data fallback (oznaczenie).
7. **S7** — Dual-runtime V8→legacy.
**Obowiązujące kanony:** §27 — **TAK** (KPI catalog/reports, tracked initiatives) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: **ModuleHub** · gating: **beta CLOSED dla wszystkich** + v8 results.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 5 · DZIAŁA-z-degradacją 1 (dual-runtime) · bezpieczny-demo 1 (showcase) · MARTWY 1 (BenefitsHub).**

### 1a. REALNE (zweryfikowane)
- Initiatives tracked (V8 catalog + `initiative_kpis`), KPI 4 tryby (`v8_kpi_definitions`, `kpi_time_series`, realne AVG/COUNT, scorecards, time-series drawer), Reports 5 trybów (**approval gating serwerowy** `resultsEnterpriseService.ts:796`), ROI (`v8_roi_realization_entries` + NPV/payback), ROI Analysis (`kpi_financial_mappings` × delta).

### 1b. MOCK / STUB / fabrykowane
- **[bezpieczne] Showcase-data** — `shouldUseResultsShowcaseData()` (`resultsShowcaseData.ts:85`) = jawny toggle usera, „NEVER auto-activate", chip „Showcase data — local" (`ResultsHub.tsx:909`); dane = statyczne fixtures FE (brak wycieku cross-org). **NIE ciche fabrykowanie.**
- **(z M20) sync-to-results dead-end** — `publish-to-results` (`table-platform.routes.ts:3413`) pisze tylko do `tp_module_sync_results`; **żaden moduł Results tego nie czyta** (0 trafień). 0 wierszy KPI trafia do Results.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P2] Degraded banner V8→legacy NIE renderowany** — `kpiRuntime.ts:39-74` cicho schodzi na `/api/benefits/*` (`source:'legacy'`), ale `'legacy'` nigdzie nie pokazany (chip tylko `'showcase'`). Cicha degradacja jak M13/M14.

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `BenefitsRealizationView`/`BenefitsHub.tsx`** (8 zakładek) — lazy-import (`AppRoutes:115`), nigdy w JSX; `/benefits` renderuje `ResultsHub`. 0 ścieżek renderu → wytnij.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| KPI 4 tryby | `/api/v8/results`, `/api/benefits` | v8_kpi_definitions, kpi_time_series | DZIAŁA (real); **time-series UPDATE bez org (P0)** |
| ROI | roi summary/analysis | v8_roi_realization_entries, kpi_financial_mappings | DZIAŁA |
| Reports enterprise | `resultsEnterpriseService` | results reports | DZIAŁA (approval serwerowy) |
| Dual-runtime | `kpiRuntime.ts` | — | DZIAŁA (degradacja CICHA) |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| beta gate | CLOSED dla wszystkich | sidebar lock (tylko nawigacja) |
| v8 results | per-org | V8 vs legacy fallback (cichy) |
| `shouldAllowDemoData()` | OFF (jawny toggle) | showcase-data + chip „local" |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M13 Inicjatywy | tracked initiatives + KPI | DZIAŁA |
| WEJŚCIE ← | M16 Finanse | ROI/economics | DZIAŁA |
| WEJŚCIE ← | M20 Tabele | governed publish-to-results | **DEAD-END (Results nie czyta)** |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `6b12f5c38c`):** **239 PASS / 5 FAIL / 0 SKIP (244).**
| Blok | PASS | FAIL |
|---|---|---|
| FE smoke (4) | 13 | 0 |
| BE (resultsROIService/runtime/routes/p04-kpi/finalization-guard) | 226 | 5 |

**Root-cause 5 FAIL (test-drift, nie bugi):** 4× stale-mock `resolveReconciliation` (serwis dodał `import notificationService.send` `:56`, test nie mockuje); 1× stale-assertion `getResultsKpiCatalog` (mapping urósł o 6 pól, test `toEqual` na starym kształcie → użyć `toMatchObject`).
**Showcase izolacja (poz.6): TESTOWANA CZĘŚCIOWO** — gate ma `MODE==='test'→false`, FE smoki mockują na `false`; **brak testu że przy demo=ON showcase NIE przecieka do realnych zapisów** `/api/v8/results/*` (backlog B3 P0).
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 tracked+filtry | częśc. | ✓ (FAIL drift) | ✗ | ✗ | — |
| S2 KPI 4 tryby | 2/4 | ✓ | ✗ | ✗ | tryby UI |
| S3 Reports+cron+approval | częśc. | ✓ approval / ✗ cron | ✗ | ✗ | cron nietestowany |
| S4 ROI portfolio | ✓ | ✓ | ✗ | ✗ | — |
| S5 ROI Analysis | ✓ | ✓ | ✗ | ✗ | — |
| S6 showcase | tylko OFF | n/d | ✗ | ✗ | **szczelność demo=ON** |
| S7 V8→legacy | ✗ | tylko v8=ON | ✗ | ✗ | fallback nietestowany |

**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn`; testy M15 w `src/components/Results/__tests__/` i `server/**/__tests__/` poza shardami → PR-gate ≈ 0.
**Backlog testowy:** [P0] B1/B2 naprawa 5 FAIL (mocki/assercje), B3 test szczelności showcase demo=ON; [P1] B4 fallback V8-OFF, B5 cron; [P2] B6-B8 tryby KPI / E2E v8 / CI.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: KPI catalog/time-series, ROI summary, Reports approval, **próba cross-org na time-series (read-only proof)** + **x-kpi-role spoof** (potwierdzić P0 na żywo), showcase chip. Migracje `v8_kpi_*`/`roi_*` zastosowane?. **Uwaga DB:** dev `.env` może wskazywać Railway PROD — ostrożność z zapisem KPI.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: S6 showcase (czy chip „local" widoczny, czy nie myli z realnym), S7 degradacja (czy cicha pustka), **P0 x-kpi-role spoof** (curl z nagłówkiem na koncie viewer → delete/create), **P0 time-series cross-org** (read-only proof).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27:** KPI Catalog (`ResultsKpisTableV3`) i Reports (`ResultsKpiReportsView`) ZGODNE — `TableWithPreviewLayout`+`FilterableTable`+preview+kebab; Tracked Initiatives `EntityStatusChip` z SSOT. **[P3]** `ResultsGridView` (`ResultsKPITable`) raw `<table>` bez `TableWithPreviewLayout` (dopuszczalne — główny katalog to KpisTableV3).
**Wzorzec hubowy:** `ModuleHub` (kanoniczny) — zgodny.
**i18n:** **najzdrowszy w audycie** — 134× `t()` z bilingual fallback, **0× `isPolish`**, 0 hardkodów hex.
**Stany:** **[P2] degraded banner V8→legacy NIE działa** (cicha pustka, chip tylko `'showcase'`); showcase oznaczony wzorowo.
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`.
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope legacy benefits by-id | CZYSTE | PUT/DELETE `/kpis/:kpiId` `WHERE id=? AND organization_id=?` (`:247,:313`) |
| time-series KPI write | **DZIURAWE (UPDATE bez org)** | `benefits.routes.ts:468` |
| RBAC KPI (V8) | NAPRAWIONE (`91c8245559`) | `x-kpi-role` usunięty; rola z JWT org role |
| Approval/finalization raportów | serwerowe | `findKpiReportFinalizationViolation` (409) |

**Findingi:**
- ~~**[P0] SEC-1 cross-org KPI write**~~ **NAPRAWIONY** (`91c8245559`) — `POST /benefits/kpis/:kpiId/time-series` (`:481`): UPDATE teraz `AND organization_id = ?`; INSERT był już org-scoped.
- ~~**[P0] SEC-2 RBAC bypass `x-kpi-role`**~~ **NAPRAWIONY** (`91c8245559`) — `x-kpi-role` header usunięty; `p04KpiRoleFromRequest` wyprowadza rolę z JWT (`req.user?.role`).
- **[P2] SEC-6 connector IRIS plaintext** — `mes_api_token`/Authorization plaintext JSON w `mcp_providers.config` (`mcp.routes.ts:91`); `GET /api/mcp/providers` (tylko `verifyToken`, nie admin) zwraca `config` non-adminom.
- **[P2] SEC-8 beta-lock tylko nawigacyjny** — `/benefits` (`AppRoutes.tsx:2136`) tylko `ProductionModuleGate`, brak beta-guarda; direct URL omija.
- **[P3] SEC-3** INSERT/UPSERT deviation/roi bez weryfikacji własności rodzica (data-pollution własnej org).

**OK/czyste:** legacy benefits by-id org-scoped (NIE pełna hybryda); V8 `getV8Context` org z tokena; approval/finalization serwerowe; showcase brak wycieku cross-org; sekrety w logach czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **Org-scope na time-series KPI write** — dodać `AND organization_id=?` do `UPDATE initiative_kpis` (`:468`) + weryfikacja że `kpiId` należy do org przed INSERT — Weryfikacja: cross-org time-series → 403/404; KPI org B niezmienione.
2. **Usunąć `x-kpi-role` z nagłówka** — rola KPI z realnej roli usera/membership (serwerowo), nigdy z requestu — Weryfikacja: `x-kpi-role: kpi_owner` na koncie viewer → 403 na delete/create.
3. **Naprawa 5 FAIL** (mocki notificationService, `toMatchObject`) + test szczelności showcase demo=ON (B3) — Weryfikacja: zielone, showcase nie przecieka do realnych zapisów.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **Degraded banner V8→legacy** — renderować `source:'legacy'` (jak chip showcase / baner M16) — Weryfikacja: degradacja pokazuje baner, nie cisza.
2. **Szyfrowanie connector secrets** + ograniczyć `GET /api/mcp/providers` do admina (nie zwracać `config` non-adminom) — Weryfikacja: brak plaintext, non-admin nie widzi sekretu.
3. **Beta-guard na route** `/benefits` — Weryfikacja: direct URL → plate.
4. **Decyzja sync-to-results** (M20 dead-end) — wpiąć odbiór lub oznaczyć „preview" — Weryfikacja: KPI z Tabel ląduje w Results albo jasny komunikat.

### Fala 3 — Jakość i kanony (P2/P3)
1. **Wytnij `BenefitsHub`/`BenefitsRealizationView`** (martwy) — Weryfikacja: 0 referencji.
2. **§27 `ResultsGridView`** → `TableWithPreviewLayout` (lub świadomie zostaw) — Weryfikacja: spójność.
3. **CI** — `Londyn` w PR-gate + shardy obejmujące Results testy (systemowe) — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. IDOR + RBAC + showcale-szczelność) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: degraded banner, i18n (już zdrowy)
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (BenefitsHub, cichy fallback)
- [ ] 6. Dwa P0 zamknięte (cross-org time-series + x-kpi-role)

---
**Pozostałe do domknięcia audytu M15:** Faza 3 (Railway) + Faza 4 (żywe 7 scenariuszy). **Dwa blockery P0:** cross-org KPI write (hard cap) + RBAC bypass `x-kpi-role` (nowy wzorzec — autoryzacja sterowana nagłówkiem klienta, sprawdzić w innych v8-routerach!). Showcase-data wzorcowo bezpieczne, i18n najzdrowszy — moduł po naprawie 2× P0 + Fazach 3/4 realnie Beta.
