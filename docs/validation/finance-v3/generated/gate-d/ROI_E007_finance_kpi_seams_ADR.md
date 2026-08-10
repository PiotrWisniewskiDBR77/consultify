# ADR ROI-E007 — Finance/KPI Seams: version-pinned link ledger między ROI a Finance (WP8, Results Next)

**Program:** `docs/product/results-vnext/03_ROI_IMPLEMENTATION_PLAN.md` (Results vNext, ROI Implementation Plan), `docs/product/results-vnext/07_EPIC_AND_TRACEABILITY_LEDGER.md` wiersz ROI-E007 (linia 60) i wiersze XDOM-E001/XDOM-E003 (linie 80-82).
**Work package:** ROI-E007 „Finance/KPI Seams" — WP8 z rekomendowanej kolejności realizacji (§21 planu, krok 9: „Activate the versioned Finance seam and reconciliation" — po WP1-WP7, PRZED legacy archive/security/exact-SHA acceptance).
**Data:** 2026-08-09/10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — DDL sketch, syntactically validated AND behaviorally exercised on an ephemeral Postgres, NOT executed as a real migration`

To jest ADR (decyzja + kontrakt), wzorem `WP-D01`/`WP-D03`/`WP-D05`/`WP-D07`/`WP-D09` z Gate D tej samej sesji — ta sama forma (Decyzja → DDL sketch → dowód testowy żywy → eskalacje → traceability), ale **inna domena**: WP-D01…WP-D09 projektowały schemat WEWNĄTRZ Finance v3 (Statements→Analysis→Baseline→Prediction→Valuation, jeden spójny DAG `finance_lineage_edges` między samymi `finance_business_versions`). ROI-E007 projektuje **cross-domain seam** — jedna strona (`finance_version_id`) JEST kanonicznym Finance v3 (Gate B/C, ten sam worktree, ta sama sesja), druga strona (ROI Case) **nie istnieje jeszcze jako kanoniczny byt** (WP1-WP7 z `03_ROI_IMPLEMENTATION_PLAN.md` nie są zaimplementowane — potwierdzone: `server/migrations/` nie zawiera żadnej tabeli `rvn_roi_*`, sprawdzone `grep -rl rvn_roi_ server/migrations/` → brak wyników). Ten ADR projektuje więc **most (bridge)** do dzisiejszego legacy v8 ROI, zaprojektowany tak, żeby po wylądowaniu WP1 nie wymagał przepisania (sekcja 7).

---

## 1. Wejścia przeczytane w całości, w tej kolejności

1. `docs/product/results-vnext/03_ROI_IMPLEMENTATION_PLAN.md` — przeczytane w całości sekcje: §2.3 „Shared but not collapsed" (linie 106-113 — trzy zdania, dosłownie egzekwowane w tym ADR-ie: „values cross the boundary only through an explicit, versioned mapping or evidence link", „Results never overwrites Finance values", „Finance never overwrites Approved, Forecast or Actual ROI truth", „divergence produces a reconciliation case, not silent last-write-wins synchronization"); §3.2 `ROIBenefitLine`/`ROIBenefitEvidenceLink` (linia ~192 — wzorzec typed link z pinned definition version, evidence purpose, freshness i dispute status zamiast luźnego FK — ten sam wzorzec projektowy zastosowany tu do Finance, nie tylko KPI); §9.6 „Future Finance seam" (linie 625-634 — dosłowny kształt czterech endpointów i wymaganych pól pinningu: `finance_artifact_type`, `finance_artifact_id`, `finance_version_id`, mapping version, source/as-of, semantic unit/currency, link purpose); §10 schema (linie 665-666 — `rvn_roi_finance_links`/`rvn_roi_finance_reconciliations` jako nazwy kanoniczne, oraz ogólne wymagania sekcji 10: org-scoped unique keys, append-only protection, semantic decimal, explicit currency/unit/period, JSON tylko dla immutable snapshots, row version/idempotency, tenant isolation); §12.1 event envelope (linia 716 — `roi.finance_reconciliation_required` jako jedno z siedemnastu zdarzeń domenowych ROI, oraz akapit o `ResultsEventEnvelope`); §17 acceptance matrix (linie 1003 „Finance seam — Divergence is reconciled, not hidden — version/freshness/reconciliation contract", 1006 „KPI evidence — Stale/disputed evidence creates state/reconciliation without overwriting Actual"); §18 Definition of Done (linie 1008-1031, całość — w szczególności „forecast and reapproval never erase original approval", „actuals retain provenance, verification and correction history", „exact-SHA realDB runtime evidence"); §20 „Conditions for future Results–Finance consolidation" (linie 1051-1066, całość — 10 warunków, żaden nie jest dziś spełniony, więc ten ADR projektuje **wyłącznie typed linkage + reconciliation**, nigdy współdzieloną mutowalną tabelę); §21 recommended execution order krok 9 (linie 1068-1079 — Finance seam jest PRZEDOSTATNIM krokiem całego programu ROI, po WP1-WP7, ten ADR świadomie projektuje schemat, który da się aktywować TERAZ, na dzisiejszym legacy v8, zamiast czekać na WP1-WP7 — patrz sekcja 7 „Bridge do przyszłości" dla uzasadnienia tej decyzji).
2. `docs/product/results-vnext/07_EPIC_AND_TRACEABILITY_LEDGER.md` — linia 60 (`ROI-E007 Finance/KPI Seams | pinned Finance artifact/version, typed KPI evidence, reconciliation | WP8 | disputed source creates reconciliation, not overwrite`) i linie 80-82: `XDOM-E001 KPI→ROI Evidence` (pinned KPI definition/version/unit/purpose/freshness; zakazane uproszczenie: „luźne `kpi_id`, kopiowanie Actual"; Gate G6) — **siostrzany, ale ODDZIELNY** epik od tego ADR-u (KPI↔ROI, nie Finance↔ROI — `ROIBenefitEvidenceLink` z §3.2 planu realizuje XDOM-E001, nie ten ADR); `XDOM-E003 Results→Finance` (pinned artifact/version/mapping/reconciliation; zakazane uproszczenie: „auto-sync, second hidden SSOT"; Gate G6) — **to jest dokładnie ten ADR**, ten sam kontrakt freshness/wersjonowania co XDOM-E001 stosuje po drugiej stronie (KPI), zastosowany tu do Finance.
3. Finance v3 fundament zbudowany w TYM worktree, w tej sesji (Gate B/C, WP-B01…WP-B07 + WP-C01/C02, wykonane i przetestowane PRZED tym zadaniem):
   - `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` — przeczytana w całości: `finance_artifacts` (identity, `artifact_type` CHECK 6 wartości), `finance_business_versions` (immutable milestone, `status`/`freshness` CHECK enumy, `uq_finance_bv_one_approved` partial unique index, `trg_finance_bv_immutability` allow-list-diff trigger, `trg_finance_artifacts_sync_current_bv`), `finance_working_revisions`, `finance_artifact_aliases`.
   - `server/migrations/20260809_finance_v3_b03_lineage_freshness.sql` — przeczytana w całości: `finance_lineage_edges` (DAG WEWNĄTRZ Finance, `edge_type` CHECK **nie zawiera** żadnej wartości ROI-owej — potwierdzone żywym `\d`-równoważnym `grep`, sekcja 2 tego ADR-u wyjaśnia dlaczego to jest świadomie POZA zakresem tej krawędzi, nie luka do domknięcia), `finance_lineage_prevent_cycle` (rank-owy cycle-prevention, wzorzec anti-spoof reużyty w sekcji 4.3 tego ADR-u dla `rvn_rfl_check_artifact_type`), `finance_lineage_freshness_events` (append-only propagation ledger — wzorzec reużyty dosłownie jako `rvn_roi_finance_link_events`, sekcja 6).
   - `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md`, `GATE_B_INTEGRATION_RECONCILIATION.md` — kanoniczne nazwy/kolumny (`business_version_id`, nie hipotetyczne `id`/`version` z wcześniejszych szkiców).
   - `docs/validation/finance-v3/generated/gate-d/WP-D09_valuation_schema_ADR.md` (całość, jako najświeższy wzorzec ADR-u tej sesji) — reużyte idiomy: (a) allow-list `to_jsonb(OLD)`/`to_jsonb(NEW)` diff zamiast hardkodowanej listy kolumn dla immutability (sekcja 4.4 tego ADR-u), (b) „trigger fires dla KAŻDEGO wiersza w systemie, no-op gdzie nieistotny" dla propagacji między-domenowej (sekcja 6 tego ADR-u), (c) partial unique index jako mechanizm „co najwyżej jeden X per Y" (sekcja 4.3 tego ADR-u), (d) format dowodu testowego na efemerycznym Postgresie.
   - `server/src/services/finance/canonical/artifactVersionService.ts` (`getArtifact` linia 125, `approveVersion` linia 521) i `server/src/services/finance/canonical/lineageService.ts` (`stageRank`/`validateEdgeRank`/`insertEdge`/`getAncestors`/`getDescendants`) — istniejące serwisy, reużyte przez odniesienie (sekcja 6), zero zmian kodu proponowanych w tym ADR-ie.
4. Legacy v8 ROI/KPI/Finance seam — przeczytane fragmenty (nie całość, zgodnie z poleceniem):
   - `server/src/services/v8/resultsROIService.ts` — `grep` za `KPIFinanceReconciliation`/`ReconciliationHealthSummary`/`ROIActual`/`realized`; przeczytane w całości: interfejsy `ROIRow`/`ReconciliationRow` (linie 118-151), `rowToROI`/`rowToReconciliation` (linie 195-239), `recordROIRealization` (linie 479-517 — jedyny INSERT do `v8_roi_realization_entries`, ZERO UPDATE w tym pliku ani gdziekolwiek w `server/` — potwierdzone repo-wide `grep`), `initiateReconciliation`/`resolveReconciliation` (linie 607-720 — istniejąca, PŁYTKA reconciliation na `v8_kpi_finance_reconciliations`, opisana w komentarzu `resultsFinanceReconciliationService.ts` jako „DISPLAY-ONLY... no unit conversion").
   - `server/src/services/v8/resultsFinanceReconciliationService.ts` — nagłówek modułu przeczytany w całości (linie 1-48): własny opis luki, którą ten moduł zamyka („crude `isMonetaryUnit` null-skip"), i luki, której NIE zamyka (self-opisany gap w zadaniu: „unit_multiplier bez formalnego version-pinning" — dosłownie potwierdzone, `KpiDriverMapping.unitMultiplier`/`driverKey` to WOLNY TEKST rozwiązywalny do „finance-model driver", nie FK do żadnej konkretnej, wersjonowanej `finance_business_versions` — dokładnie luka, którą `rvn_roi_finance_links` domyka, sekcja 2.3); typy `KpiDriverMapping`/`ReconciledKpi`/`DeviationConclusion` (linie 59-120).
   - `server/migrations/20260703_v8_kpi_finance_reconciliation_deviation.sql` (całość, 55 linii) — `driver_key`/`unit_multiplier`/`projected_value`/`realized_value`/`deviation_absolute`/`deviation_percent`/`conclusion_json`/`reconciled_at` dodane do `v8_kpi_finance_reconciliations` — potwierdza dosłownie własny nagłówek migracji: „NO unit conversion" był stanem PRZED tą migracją, ale nawet PO niej `driver_key` pozostaje wolnym tekstem, nie wersjonowanym pinem.
   - `server/migrations/067_economics_initiative_integration.sql` (całość, 303 linii) — `initiative_financials` (cached NPV/IRR/ROI%, linie 14-60, starszy punkt integracji Initiative↔Finance, PROJEKCJA nie ACTUAL — nie jest to ROI Actual, żadna kolumna tej tabeli nie jest „realized"), `benefit_tracking` (linie 62-106, `actual_cost_savings`/`actual_revenue_increase`/`actual_productivity_gains` — TRZECI, równoległy, starszy magazyn „actual" — sekcja 2.4 rozwija, dlaczego ten ADR świadomie NIE rozszerza fizycznej ochrony na tę tabelę w P0).
   - **Dodatkowo, konieczne do niesprzeczności (nie wymienione wprost w briefie), znalezione repo-wide `grep`em przed napisaniem tego ADR-u**: `server/migrations/565_kpi_time_series_roi_attribution_finance.sql` linie 116-129 — `roi_realized_values` (`initiative_id` NOT NULL, `period_month` DATE, `realized_revenue_delta`/`realized_cost_delta`/`realized_savings`, **brak kolumny `updated_at`** — strukturalny sygnał „insert-only by design"). To jest, wbrew pierwszemu wrażeniu z zadania (które wskazywało `resultsROIService.ts`/`v8_roi_realization_entries` jako najbardziej prawdopodobne miejsce), **FAKTYCZNIE najbardziej aktywnie używany magazyn ROI Actual w całym repo** — 4 żywe call site'y INSERT (`executionRealizationService.ts` linie 82 i 362, `benefits.routes.ts` linia 1527, `results.routes.ts` linia 3184), **ZERO** call site'ów UPDATE gdziekolwiek w `server/` (potwierdzone `grep -rn "UPDATE roi_realized_values" server/` → brak wyników), czytany przez `realizedValueReconciliationService.ts`, `postInvestmentReviewService.ts`, `closureDeliveryReceiptService.ts`, `executiveAggregateService.ts` i sześć route'ów. Sekcja 5 tego ADR-u wyjaśnia dlaczego fizyczna ochrona (trigger) idzie na TĘ tabelę, nie na `v8_roi_realization_entries`.

---

## 2. Kontekst — dlaczego to NIE jest szesnasta krawędź `finance_lineage_edges`

### 2.1 `finance_lineage_edges` świadomie nie pasuje

`finance_lineage_edges` (WP-B03) wymaga PO OBU stronach wiersza `finance_business_versions` — `fk_finance_lineage_source`/`fk_finance_lineage_target` to złożone FK do `(business_version_id, organization_id)`, a `finance_lineage_prevent_cycle` odczytuje `artifact_type` OBU stron przez `finance_artifacts` i wymusza `stage_rank(target) > stage_rank(source)` po **zamkniętej** liście sześciu typów (`STATEMENT_PACK`…`REPORT_EXPORT`). ROI Case (dziś: Initiative, docelowo: `rvn_roi_cases`, sekcja 7) nie jest, i przez definicję DEC-ową tego programu (`§2.4` planu: „this delivery does not include... merging Results ROI and Finance InvestmentCase") **nigdy nie będzie** żadnym z tych sześciu typów. Rozszerzenie `finance_lineage_edges.edge_type`/`source_artifact_type` o wartość „ROI_CASE" złamałoby dokładnie ten zakaz — zmieniłoby Finance's własny, zamknięty DAG w cross-domain graf, którego WP-B03 nigdy nie było proszone modelować (jego stage-rank ma sens TYLKO dla „skąd dane finansowe faktycznie compute'ują się" wewnątrz Finance; ROI nie compute'uje się Z Finance, ono się Z NIM **odnosi**).

### 2.2 Co jest reużywane bez zmian

- `finance_artifacts.artifact_type` CHECK enum (6 wartości) — `rvn_roi_finance_links.finance_artifact_type` powtarza go dosłownie (sekcja 3), z anti-spoof triggerem analogicznym do `finance_lineage_prevent_cycle` (sekcja 4.3).
- `finance_business_versions(business_version_id, organization_id)` — jedyny PIN po stronie Finance; żadna wartość nie jest kopiowana z wnętrza wersji (ani `content_semantic_hash`, ani `status`) — dokładnie ten sam „pointer nie kopia" argument, który WP-D07/WP-D09 stosowały wielokrotnie dla własnych cross-table odczytów.
- `finance_lineage_freshness_events` — wzorzec (nie tabela) reużyty 1:1 jako `rvn_roi_finance_link_events` (sekcja 6): append-only, `reason_code` wolny tekst, `previous_state`/`new_state`, `BEFORE UPDATE/DELETE` deny trigger.
- `trg_finance_bv_immutability`'s allow-list-diff idiom (WP-B01, reużyty też przez WP-D09 §12.3 dla Advisor freeze) — reużyty dla `rvn_rfl_enforce_pin_immutability` (sekcja 4.4): pin (`finance_version_id`, `roi_case_bridge_id`, `finance_artifact_id`) jest niemutowalny, WYŁĄCZNIE freshness/supersession metadata może się zmieniać.

### 2.3 Luka, którą ten ADR domyka po stronie legacy v8

`resultsFinanceReconciliationService.ts` (sekcja 1 pkt 4) jest już żywym, testowanym silnikiem M15↔M16 — ale jego `KpiDriverMapping.driverKey` jest **wolnym tekstem** rozwiązywalnym do „finance-model driver / benefit line" (cytat z własnego komentarza modułu, linia 100), nie FK do konkretnego, zatwierdzonego `finance_business_versions` wiersza. To znaczy: dziś reconciliation dzieje się między KPI actual a **nienazwaną, niewersjonowaną** liczbą po stronie Finance — nie da się odpowiedzieć na pytanie „względem KTÓREGO dokładnie zatwierdzonego modelu finansowego (który wariant, która wersja, z jakiego dnia) ta reconciliation została policzona", i nie ma żadnego mechanizmu wykrywającego, że ten model finansowy **właśnie się zmienił** (Finance zatwierdziło nową wersję) — reconciliation z zeszłego tygodnia cicho staje się nieaktualna bez żadnego sygnału. `rvn_roi_finance_links` (sekcja 3) + freshness propagation (sekcja 6) to dokładnie ta brakująca warstwa: **explicit, versioned mapping** (cytat z planu §2.3, linia 110) zamiast wolnego tekstu.

### 2.4 `benefit_tracking.actual_*` — świadomie POZA zakresem P0

Trzeci magazyn „actual" (`benefit_tracking.actual_cost_savings`/`actual_revenue_increase`/`actual_productivity_gains`, migracja 067) ma kolumnę `updated_at` (linia ~106 migracji 067, nie cytowana dosłownie tu — strukturalny sygnał odwrotny do `roi_realized_values`) — sugeruje, że ta tabela BYŁA projektowana jako per-period update-in-place, nie append-only. Ten ADR **nie** dodaje do niej deny-trigger w P0: (a) brief zadania wskazuje konkretnie na `resultsROIService.ts`'s underlying tables, nie na `benefit_tracking`; (b) zmiana update-semantyki istniejącej, aktywnie używanej tabeli poza named-scope tego zadania niesie ryzyko złamania nieznanego wywołującego kodu, którego ten ADR nie zmapował w całości. Sekcja 9 pkt 3 eskaluje to jako otwarty punkt.

---

## 3. `rvn_roi_finance_links` — pin + bridge

```sql
CREATE TYPE rvn_roi_finance_freshness AS ENUM (
  'NEVER_COMPUTED', 'CURRENT', 'STALE_SOURCE', 'COMPUTE_FAILED'
);

CREATE TABLE rvn_roi_finance_links (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),

  -- Bridge do przyszłości (sekcja 7) -- dziś jedyny governed byt po stronie ROI to Initiative
  -- (1:1 z przyszłym rvn_roi_cases.initiative_id, planu §3.1: "initiative_id mandatory and unique
  -- for active case"). roi_case_bridge_type jest CHECK-iem do jednej wartości na dziś, celowo --
  -- rozszerzenie o kolejny typ bridge'a (np. wprost v8 KPI-record) jest jednolinijkową zmianą CHECK-a,
  -- nie przeprojektowaniem (ten sam "rozszerz enum teraz zamiast ALTER później" argument co B03
  -- migracja zastosowała dla VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT).
  roi_case_bridge_type          TEXT NOT NULL DEFAULT 'INITIATIVE' CHECK (roi_case_bridge_type = 'INITIATIVE'),
  roi_case_bridge_id              TEXT NOT NULL, -- initiatives.id dzisiaj (LEGACY BRIDGE REFERENCE -- patrz sekcja 7)
  roi_case_id                       TEXT, -- NULL do WP1; FK do rvn_roi_cases dodany addytywnie (sekcja 7)

  finance_artifact_type                TEXT NOT NULL CHECK (finance_artifact_type IN (
                                          'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                                          'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                                        )),
  finance_artifact_id                    TEXT NOT NULL,
  finance_version_id                       TEXT NOT NULL, -- PRAWDZIWY pin, business_version_id

  mapping_version                            INTEGER NOT NULL DEFAULT 1,
  source                                       TEXT NOT NULL,
  as_of                                          DATE NOT NULL,
  semantic_unit                                    TEXT NOT NULL,
  semantic_currency                                  TEXT,

  link_purpose                                         TEXT NOT NULL CHECK (link_purpose IN (
                                                          'BENEFIT_EVIDENCE', 'COST_EVIDENCE', 'BASELINE_SOURCE',
                                                          'FORECAST_COMPARISON', 'ACTUAL_VERIFICATION',
                                                          'VALUATION_CONTEXT', 'OTHER'
                                                        )),

  freshness_state                                        rvn_roi_finance_freshness NOT NULL DEFAULT 'NEVER_COMPUTED',
  freshness_reason                                         TEXT,
  stale_since                                                TIMESTAMPTZ,

  superseded_by_link_id                                        TEXT REFERENCES rvn_roi_finance_links(id),
  superseded_at                                                  TIMESTAMPTZ,

  created_by                                                       TEXT NOT NULL,
  created_at                                                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_rvn_rfl_finance_artifact_org
    FOREIGN KEY (finance_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),
  CONSTRAINT fk_rvn_rfl_finance_version_org
    FOREIGN KEY (finance_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);
```

### 3.1 Dlaczego te kolumny, dosłownie z §9.6

Zadanie (i plan, linia 634) wymaga dosłownie: „Every link pins `finance_artifact_type`, `finance_artifact_id`, `finance_version_id`, mapping version, source/as-of, semantic unit/currency and link purpose." Wszystkie siedem obecne. `finance_version_id` (nie `finance_artifact_id` samo) jest **jedynym** polem, które faktycznie determinuje "które dokładnie liczby" — `finance_artifact_id` bez wersji byłby luźnym FK dokładnie tego rodzaju, który §2.3 planu zakazuje wprost ("values cross the boundary only through an explicit, **versioned** mapping").

### 3.2 `link_purpose` — enum, nie wolny tekst

Zadanie nie podaje dosłownej listy `link_purpose` — siedem wartości powyżej jest osądem zawodowym tego ADR-u, wywiedzionym z legalnych `finance_artifact_type` × typowych momentów cyklu życia ROI Case (`ROIBaseline`/`ROICostLine`/`ROIBenefitLine`/`ROIForecastVersion`/`ROIActualEntry` z planu §3.2): `BASELINE_SOURCE` (Finance `BASELINE_MODEL` jako źródło `ROIBaseline`), `COST_EVIDENCE`/`BENEFIT_EVIDENCE` (Finance jako dowód dla `ROICostLine`/`ROIBenefitLine`), `FORECAST_COMPARISON` (Finance `PREDICTION_SCENARIO` jako punkt odniesienia dla `ROIForecastVersion`), `ACTUAL_VERIFICATION` (Finance `STATEMENT_PACK`/`HISTORICAL_ANALYSIS` jako weryfikacja `ROIActualEntry`), `VALUATION_CONTEXT` (Finance `VALUATION_CASE`), `OTHER` (escape hatch, jak `finance_valuation_methods.OTHER_WITH_POLICY`, WP-D09 §7.1). **Flagowane do potwierdzenia właściciela w sekcji 9 pkt 1** — to jest jedyne miejsce w tym ADR-ie, gdzie enum-wartości nie są cytatem z żadnego przeczytanego dokumentu.

### 3.3 Anti-spoof + "co najwyżej jeden aktywny link per slot"

```sql
CREATE OR REPLACE FUNCTION rvn_rfl_check_artifact_type() RETURNS TRIGGER AS $$
DECLARE actual_type TEXT;
BEGIN
  SELECT artifact_type INTO actual_type FROM finance_artifacts WHERE artifact_id = NEW.finance_artifact_id;
  IF actual_type IS DISTINCT FROM NEW.finance_artifact_type THEN
    RAISE EXCEPTION 'rvn_roi_finance_links: finance_artifact_type % does not match actual artifact_type % for artifact %',
      NEW.finance_artifact_type, actual_type, NEW.finance_artifact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rvn_rfl_check_artifact_type
  BEFORE INSERT ON rvn_roi_finance_links
  FOR EACH ROW EXECUTE FUNCTION rvn_rfl_check_artifact_type();

CREATE UNIQUE INDEX uq_rvn_rfl_one_active_per_slot
  ON rvn_roi_finance_links (roi_case_bridge_type, roi_case_bridge_id, finance_artifact_id, link_purpose)
  WHERE superseded_by_link_id IS NULL;
```

Ten sam anti-spoof wzorzec co `finance_lineage_prevent_cycle` (WP-B03 header note 3, sekcja 2.2) — caller nie może zadeklarować `finance_artifact_type='VALUATION_CASE'` dla FK-a wskazującego w rzeczywistości na `BASELINE_MODEL`. Partial unique index gwarantuje, że dla jednej pary (Case, Finance artifact, cel linku) istnieje najwyżej JEDEN nie-supersedowany wiersz — drugi INSERT dla tego samego slotu musi najpierw supersedować pierwszy (`superseded_by_link_id`), nie może po prostu dopisać drugiego "aktualnego" pinu obok. **Przetestowane żywo**: TEST 1 (insert do DRAFT wersji — przyjęte), TEST 2 (spoofed `finance_artifact_type` — odrzucone), TEST 3 (drugi aktywny link ten sam slot — odrzucone, duplicate key), TEST 4 (inny `link_purpose`, ten sam Case+artifact — przyjęte, bo inny klucz unikalny).

### 3.4 Pin immutability

```sql
CREATE OR REPLACE FUNCTION rvn_rfl_enforce_pin_immutability() RETURNS TRIGGER AS $$
DECLARE allowed_keys TEXT[] := ARRAY[
  'freshness_state', 'freshness_reason', 'stale_since', 'superseded_by_link_id', 'superseded_at'
];
DECLARE old_j JSONB; new_j JSONB;
BEGIN
  old_j := to_jsonb(OLD); new_j := to_jsonb(NEW);
  IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(allowed_keys)))
     IS DISTINCT FROM
     (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(allowed_keys)))
  THEN
    RAISE EXCEPTION 'rvn_roi_finance_links: % is a pin; only freshness/supersession metadata may change, never the pinned finance_version_id/roi_case_bridge_id', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rvn_rfl_enforce_pin_immutability
  BEFORE UPDATE ON rvn_roi_finance_links
  FOR EACH ROW EXECUTE FUNCTION rvn_rfl_enforce_pin_immutability();
```

Ten sam allow-list-diff idiom co `trg_finance_bv_immutability` (WP-B01) i `finance_advisor_outputs_enforce_freeze` (WP-D09 §12.3) — porównanie całych wierszy jako JSONB, nie hardkodowana lista, żeby przyszłe kolumny automatycznie dziedziczyły ochronę. **Bez tego** nic nie stałoby na przeszkodzie, żeby ktoś "naprawił" stary link przez `UPDATE ... SET finance_version_id = <nowsza wersja>` zamiast utworzyć nowy wiersz + supersedować stary — co byłoby dokładnie tym cichym "last-write-wins", którego §2.3 planu zakazuje (linia 113). **Przetestowane żywo**: TEST 5 — próba `UPDATE ... SET finance_version_id = 'bv-1b'` (realny, istniejący drugi `business_version_id` tego samego artefaktu, nie fikcyjna wartość — testuje trigger, nie FK) odrzucona; TEST 6 — `UPDATE ... SET freshness_state = 'CURRENT'` (dozwolona kolumna) przyjęta.

---

## 4. `rvn_roi_finance_reconciliations` — nigdy overwrite, tylko nowy wiersz

```sql
CREATE TABLE rvn_roi_finance_reconciliations (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id          TEXT NOT NULL REFERENCES organizations(id),
  link_id                     TEXT NOT NULL REFERENCES rvn_roi_finance_links(id),

  status                        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                                   'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
                                 )),
  divergence_summary               JSONB NOT NULL, -- {roi: {...}, finance: {...}, delta: {...}}

  opened_by                          TEXT NOT NULL,
  opened_at                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  resolved_by                            TEXT,
  resolved_at                              TIMESTAMPTZ,
  resolution_note                            TEXT,

  CONSTRAINT chk_rvn_rfr_resolution CHECK (
    (status IN ('RESOLVED', 'DISMISSED') AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
    OR (status IN ('OPEN', 'UNDER_REVIEW') AND resolved_by IS NULL AND resolved_at IS NULL)
  )
);
```

`divergence_summary` niesie `expected`/`observed`/`delta` per stronie (ROI vs Finance) jako **bounded, immutable snapshot JSON** — dokładnie kategoria, którą sekcja 10 planu dopuszcza dla JSON ("JSON only for immutable snapshots or bounded extension data"), nie substytut queryable pól. `chk_rvn_rfr_resolution` fizycznie wymusza, że zamknięcie (RESOLVED/DISMISSED) niesie kto/kiedy/dlaczego — analogiczny wzorzec do `INVALIDATED requires invalidated_reason` (WP-B01 `trg_finance_bv_immutability`). **Przetestowane żywo**: TEST 7 (open — przyjęte), TEST 8 (RESOLVED bez pól rozwiązania — odrzucone), TEST 9 (RESOLVED z pełnymi polami — przyjęte).

**Ta tabela fizycznie NIE MOŻE nadpisać ROI Actual — nie dlatego, że coś to blokuje w locie, tylko dlatego, że taka ścieżka NIE ISTNIEJE w schemacie**: żadna kolumna tej tabeli nie jest FK-iem do `roi_realized_values`/`v8_roi_realization_entries` w kierunku zapisu, i żaden UPDATE na tej tabeli nie ma triggera propagującego cokolwiek gdziekolwiek indziej. Reconciliation **rośnie wyłącznie przez INSERT** nowego przypadku (nowy `divergence_summary`, gdy ta sama para link+okres znowu się rozjeżdża) — nie przez edycję istniejącego rozjazdu. To jest dosłowna realizacja zadania punktu 4 ("reconciliation zawsze tworzy nowy wiersz") i planu §17 wiersza „Finance seam" (linia 1003: "Divergence is reconciled, not hidden").

---

## 5. Zakaz cichego nadpisywania ROI Actual — fizyczny mechanizm

### 5.1 Gdzie dziś żyje ROI Actual

Sekcja 1 pkt 4 ustaliła: **`roi_realized_values`** (migracja `565_kpi_time_series_roi_attribution_finance.sql`, linie 116-129) jest dziś najbardziej aktywnie zapisywanym i czytanym magazynem ROI Actual w repo — `initiative_id`-scoped, `period_month`-granular, trzy `realized_*` kolumny (revenue delta / cost delta / savings), **cztery żywe INSERT call site'y**, **zero** UPDATE call site'ów. `v8_roi_realization_entries` (migracja `20260323_v8_results_roi.sql`, wskazana pierwotnie w brief jako najbardziej prawdopodobne miejsce) jest KPI-scoped, węższa i mniej centralna (jeden serwis, `resultsROIService.ts`), ale ma **identyczny** kształt ryzyka (append-only w praktyce, zero fizycznej ochrony) — obie dostają tę samą ochronę (sekcja 5.2), `roi_realized_values` jako primary.

### 5.2 Deny-UPDATE/DELETE trigger — ten sam idiom co `finance_lineage_edges`/WP-B05/WP-B06

```sql
CREATE OR REPLACE FUNCTION roi_realized_values_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'roi_realized_values is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows (variance_notes/source explaining the correction), reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_* here', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roi_realized_values_deny_update
  BEFORE UPDATE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();
CREATE TRIGGER trg_roi_realized_values_deny_delete
  BEFORE DELETE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();
```

(analogiczna para triggerów, dosłownie ten sam wzorzec, na `v8_roi_realization_entries`.)

To jest **fizyczne**, nie proceduralne, ograniczenie: nie "reconciliation service nie ma kodu, który wywołuje UPDATE" (co jest dziś prawdą, ale jest to fakt o KODZIE z 2026-08-10, nie o SCHEMACIE — jutrzejszy PR mógłby to złamać bez żadnego ostrzeżenia), tylko "baza danych odrzuca KAŻDY UPDATE/DELETE na tej tabeli, niezależnie od tego, który proces/rola/przyszły kod go inicjuje" — dokładnie ten sam poziom gwarancji co `finance_lineage_edges` (WP-B03 §3.1, append-only) i `finance_compute_snapshots`/`finance_exceptions` (WP-B05/B06) już mają w Finance v3. **Jedyna sankcjonowana "korekta"**: nowy wiersz z `source='correction'` i `variance_notes` wyjaśniającym co i dlaczego zostało poprawione — dokładnie wzorzec append-only-korekty, który `ROIActualEntry` z planu §3.2 opisuje wprost dla przyszłego WP1 ("provenance, verification and correction/reversal relationship"), zastosowany tu RETROAKTYWNIE do dzisiejszego legacy stołu, bez czekania na WP1-7.

**Przetestowane żywo**: TEST 10 — `UPDATE roi_realized_values SET realized_revenue_delta = 9999` odrzucone z dokładnym komunikatem. TEST 11 — `DELETE FROM roi_realized_values` odrzucone. TEST 12 — nowy wiersz `source='correction'` z `variance_notes` odnoszącym się do oryginalnego wiersza — przyjęty. Stan końcowy (TEST FINAL): OBA wiersze (`rrv-1` oryginalny nietknięty realized_revenue_delta=1000, `rrv-2` korekta realized_revenue_delta=1300) współistnieją — historia nigdy nie znika.

### 5.3 To NIE jest ograniczenie reconciliation-specyficzne — jest ogólne, i to jest świadome

Zadanie mówi dosłownie: "trigger... blokujący UPDATE inicjowany przez proces reconciliation." Ten ADR projektuje **szerszy** trigger — blokujący UPDATE/DELETE inicjowany przez KOGOKOLWIEK, nie tylko reconciliation. Uzasadnienie: Postgres trigger nie ma pojęcia "kto (jaki proces domenowy) wysyła ten SQL" poza `session_user`/`application_name` (kruche, łatwe do podszycia przez connection pooling), więc próba ograniczenia się WYŁĄCZNIE do "blokuj reconciliation, pozwól innym" wymagałaby albo osobnej roli DB per proces domenowy (odrzucone w WP-B03 §3.1 z tego samego powodu: "a superuser test connection would bypass GRANT-based restrictions entirely"), albo introspekcji `application_name`, którą każdy klient może ustawić dowolnie. Blokowanie WSZYSTKICH UPDATE/DELETE jest **silniejszą**, nie słabszą gwarancją niż zadanie wymaga — i jest bezpieczne, bo sekcja 5.1 potwierdziła zero istniejących UPDATE call site'ów do złamania.

---

## 6. Freshness/supersession — append-only ledger + propagacja z Finance

```sql
CREATE TABLE rvn_roi_finance_link_events (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id           TEXT NOT NULL REFERENCES organizations(id),
  link_id                      TEXT NOT NULL REFERENCES rvn_roi_finance_links(id),
  previous_state                  TEXT,
  new_state                         TEXT NOT NULL,
  reason_code                         TEXT NOT NULL, -- NEW_APPROVED_VERSION / SOURCE_INVALIDATED / MANUAL_REFRESH
  triggering_finance_version_id         TEXT,
  created_at                              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- + BEFORE UPDATE/DELETE deny triggers, identyczne w kształcie do sekcji 5.2 i do
--   finance_lineage_edges_deny_mutation (WP-B03).

CREATE OR REPLACE FUNCTION rvn_roi_finance_mark_links_stale_on_new_approval() RETURNS TRIGGER AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN
    FOR r IN
      SELECT id, freshness_state FROM rvn_roi_finance_links
      WHERE finance_artifact_id = NEW.artifact_id
        AND finance_version_id <> NEW.business_version_id
        AND superseded_by_link_id IS NULL
    LOOP
      UPDATE rvn_roi_finance_links
        SET freshness_state = 'STALE_SOURCE',
            freshness_reason = 'finance_artifact_id ' || NEW.artifact_id || ' has a newer APPROVED version',
            stale_since = now()
        WHERE id = r.id;
      INSERT INTO rvn_roi_finance_link_events (organization_id, link_id, previous_state, new_state, reason_code, triggering_finance_version_id)
        VALUES (NEW.organization_id, r.id, r.freshness_state::text, 'STALE_SOURCE', 'NEW_APPROVED_VERSION', NEW.business_version_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_bv_mark_roi_links_stale
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_finance_mark_links_stale_on_new_approval();
```

**To jest jedyny punkt integracji z istniejącym Finance v3 kodem, i jest nim TRIGGER, nie zmiana `approveVersion()`** — ten sam wzorzec co WP-D09 §12.3 ustanowiło dla Advisor freeze/staleness: `trg_finance_bv_mark_roi_links_stale` fires dla KAŻDEGO `finance_business_versions` UPDATE w całym systemie (Statements, Analysis, Baseline, Scenario, Valuation — wszystkie domeny Gate D), i jest nieszkodliwym no-opem dla wersji, na które żaden `rvn_roi_finance_links` nie wskazuje (pusta pętla `FOR r IN ... LOOP`, zero kosztu poza jednym SELECT-em). `server/src/services/finance/canonical/artifactVersionService.ts:521` (`approveVersion()`) pozostaje **całkowicie niezmodyfikowany**.

**Ważne strukturalne stwierdzenie**: gdy Finance zatwierdza NOWĄ wersję tego samego artefaktu, link **nie jest auto-recompute'owany ani re-pinowany** — `finance_version_id` na starym linku pozostaje wskazujący na starą (teraz supersedowaną) wersję (fizycznie wymuszone przez `rvn_rfl_enforce_pin_immutability`, sekcja 3.4), TYLKO `freshness_state` flipuje na `STALE_SOURCE`. To jest dosłowna realizacja zadania punktu 3 ("link dostaje oznaczenie stale, NIE auto-recompute") i planu §2.3 (linia 113: "not silent last-write-wins synchronization") — użytkownik/Teresa widzi "ten link jest nieaktualny", nie dostaje po cichu nowej liczby podstawionej pod starą decyzję.

**Przetestowane żywo**: TEST 13a-13d — dwa linki (`BASELINE_SOURCE`, `FORECAST_COMPARISON`) pinowane do `bv-1`; `bv-1` zatwierdzone (13a, zero wpływu, bo `finance_version_id <> NEW.business_version_id` nie ma dopasowań — link WSKAZUJE na wersję, która WŁAŚNIE się zatwierdza, to nie jest "nowsza" wersja z jej własnej perspektywy); `bv-1` supersedowane + `bv-1b` (ten sam artefakt) zatwierdzone (13b, mimikując realną kolejność `approveVersion()`: supersede rodzica PRZED approve dziecka, ten sam porządek co BUG-GOLDCO-03 fix) → OBA linki flipują na `STALE_SOURCE`, `finance_version_id` pozostaje `bv-1` na obu (13c, potwierdzone SQL-em), DWA wiersze zdarzeń append-only zapisane z `triggering_finance_version_id='bv-1b'` (13d). TEST 14/15 — próba UPDATE/DELETE na `rvn_roi_finance_link_events` odrzucona.

---

## 7. Bridge do przyszłości — co się zmieni, gdy WP1-7 wylądują

### 7.1 Dlaczego bridge, nie czekanie na WP1-7

Plan (§21, krok 9) każe aktywować Finance seam PO WP1-WP7 — logiczna kolejność dla NOWEGO systemu ROI. Ale zadanie tego ADR-u jest inne: **most do tego, co istnieje DZIŚ** (`roi_realized_values`/`v8_roi_realization_entries`/`initiative_financials`, żywe, aktywnie zapisywane), bo `rvn_roi_cases` i reszta WP1-7 **nie istnieją** (sekcja 1 wstęp, potwierdzone `grep`em). Odkładanie tego seam'a do "po WP1-7" oznaczałoby, że `resultsFinanceReconciliationService.ts`'s wolny-tekst `driverKey` (sekcja 2.3) pozostaje jedynym mostem Results↔Finance przez czas trwania całego WP1-WP7 — co jest dokładnie tym ryzykiem, które ten task ma zamknąć teraz, addytywnie, bez czekania.

### 7.2 Dokładny mechanizm przejścia — addytywny, nie destrukcyjny

`rvn_roi_finance_links.roi_case_id` (kolumna `TEXT NULL`, sekcja 3, bez FK dziś — `rvn_roi_cases` nie istnieje) jest CELOWO obecna od pierwszego dnia, pusta:

1. **Dziś**: `roi_case_bridge_type='INITIATIVE'`, `roi_case_bridge_id=<initiatives.id>`, `roi_case_id=NULL`. API `:caseId` (sekcja 8) rozwiązuje się do `initiative_id` przez `roi_case_bridge_id`.
2. **Gdy WP1 ląduje** (`rvn_roi_cases` istnieje, `initiative_id` NOT NULL UNIQUE per plan §3.1): jedna, addytywna migracja: (a) `ALTER TABLE rvn_roi_finance_links ADD CONSTRAINT fk_rvn_rfl_roi_case FOREIGN KEY (roi_case_id) REFERENCES rvn_roi_cases(id)` (kolumna już istnieje, tylko FK jest nowy); (b) backfill `UPDATE rvn_roi_finance_links SET roi_case_id = rc.id FROM rvn_roi_cases rc WHERE rc.initiative_id = rvn_roi_finance_links.roi_case_bridge_id AND rvn_roi_finance_links.roi_case_bridge_type = 'INITIATIVE'` — deterministyczny JOIN po `initiative_id`, bo `rvn_roi_cases.initiative_id` jest mandatory+unique (plan §3.1, invariant "one Initiative has at most one active vNext ROI Case") — **zero niejednoznaczności** w tym backfillu, w przeciwieństwie do typowych legacy-migration ambiguity problemów, które ten program wielokrotnie napotkał gdzie indziej (np. WP-A01 dla Valuation, sekcja 1 pkt 6 WP-D09). (c) Serwis przełącza się na czytanie `roi_case_id` zamiast `roi_case_bridge_id` dla nowych zapisów; stare wiersze zachowują OBA (bridge jako historyczny audit trail, `roi_case_id` jako nowy canonical pointer) — **żaden istniejący wiersz nie jest przepisywany od zera, żadna kolumna nie jest usuwana**.
3. **Docelowo** (po pełnym cutover, osobna, przyszła decyzja produktowa, POZA zakresem tego ADR-u): `roi_case_id` może stać się `NOT NULL`, `roi_case_bridge_*` może zostać zarchiwizowane (nie usunięte — audit trail) lub pozostać jako permanent "jak to było znalezione przed WP1" ślad.

### 7.3 Co NIE wymaga zmiany

`finance_artifact_type`/`finance_artifact_id`/`finance_version_id`/`mapping_version`/`source`/`as_of`/`semantic_unit`/`semantic_currency`/`link_purpose`/`freshness_state` — cała reszta pinu (sekcja 3) jest **niezależna od tego, czy strona ROI jest bridge'em czy prawdziwym FK**. Reconciliation (sekcja 4) i freshness propagation (sekcja 6) też nie odwołują się do `roi_case_bridge_id`/`roi_case_id` wprost (`rvn_roi_finance_mark_links_stale_on_new_approval` filtruje po `finance_artifact_id`, po stronie Finance, nie po stronie ROI) — cały mechanizm stale/reconciliation/no-overwrite działa identycznie PRZED i PO WP1, bez zmian.

---

## 8. API kontrakt

Zgodnie z planem §9.6 (linie 628-631), z jawnym udokumentowaniem, że `:caseId` dziś rozwiązuje się do `roi_case_bridge_id` (`initiative_id`), nie do przyszłego WP1 Case ID (sekcja 7.1 przypomina to na każdym endpointzie poniżej — nie tylko tu).

### `GET /cases/:caseId/finance-links`

Rozwiązuje `:caseId` → `roi_case_bridge_id` (dziś zawsze `initiative_id`; walidacja: `initiatives.id` musi istnieć i należeć do organizacji wołającego). Zwraca aktywne (nie-supersedowane) linki + opcjonalnie historię przez `?includeSuperseded=true`.

```jsonc
// 200
{
  "caseRef": { "bridgeType": "INITIATIVE", "bridgeId": "init-123", "roiCaseId": null },
  "links": [
    {
      "id": "lnk-1", "financeArtifactType": "BASELINE_MODEL", "financeArtifactId": "fa-1",
      "financeVersionId": "bv-1", "mappingVersion": 1, "source": "user-1", "asOf": "2026-06-30",
      "semanticUnit": "PLN", "semanticCurrency": "PLN", "linkPurpose": "BASELINE_SOURCE",
      "freshnessState": "STALE_SOURCE", "freshnessReason": "finance_artifact_id fa-1 has a newer APPROVED version",
      "staleSince": "2026-08-01T10:00:00Z", "createdBy": "user-1", "createdAt": "2026-06-30T09:00:00Z"
    }
  ]
}
```

### `POST /cases/:caseId/finance-links`

```jsonc
// request
{
  "financeArtifactType": "BASELINE_MODEL", "financeArtifactId": "fa-1", "financeVersionId": "bv-1",
  "source": "user-1", "asOf": "2026-06-30", "semanticUnit": "PLN", "semanticCurrency": "PLN",
  "linkPurpose": "BASELINE_SOURCE"
}
```

Serwer wypełnia `roi_case_bridge_type`/`roi_case_bridge_id` z `:caseId`, `mapping_version` (autoincrement per slot — `MAX(mapping_version)+1` dla ten sam `(bridge, artifact, purpose)`, wliczając supersedowane), `created_by`/`created_at`. Jeśli slot ma już aktywny link (sekcja 3.3), request MUSI nieść `?supersedeLinkId=<id>` — inaczej `409 ACTIVE_LINK_EXISTS` (serwis odczytuje unikalny indeks jako 4xx zanim uderzy w DB, ten sam wzorzec co `validateEdgeRank` robi dla `finance_lineage_edges` po stronie klienta przed round-tripem do bazy — sekcja 2.2). `financeVersionId` MUSI odnosić się do wersji o statusie w `{APPROVED}` dla `linkPurpose` klasy "evidence"/"baseline" (walidacja serwisowa — DRAFT dozwolony schematem, sekcja 3, ale odrzucany na poziomie API dla purpose'ów, gdzie niezatwierdzone dane finansowe jako "dowód" byłyby mylące; `FORECAST_COMPARISON`/`VALUATION_CONTEXT` mogą dopuszczać `IN_REVIEW` — **flagowane do potwierdzenia właściciela, sekcja 9 pkt 2**).

`201`, zwraca pełny obiekt linku (kształt jak w GET).

### `DELETE /cases/:caseId/finance-links/:linkId`

**Nie jest fizycznym DELETE** — `rvn_roi_finance_links` nie ma triggera odrzucającego DELETE (w przeciwieństwie do `roi_realized_values`/`rvn_roi_finance_link_events`, sekcje 5/6), bo linki NIE SĄ append-only truth ledgerem, są bieżącym stanem pinningu — ale API-owy "DELETE" mapuje się na `UPDATE ... SET superseded_by_link_id = NULL, superseded_at = now(), freshness_state = 'NEVER_COMPUTED'`-równoważne **logiczne wycofanie** (nowa kolumna nie jest tu potrzebna — supersedowanie linku BEZ następcy, tzn. `superseded_at` ustawiony, `superseded_by_link_id` pozostaje NULL, oznacza "wycofany bez zastąpienia"; odczyt "aktywne linki" filtruje `superseded_at IS NULL`, nie tylko `superseded_by_link_id IS NULL` — **korekta względem sekcji 3.3's uproszczonego WHERE**, patrz sekcja 9 pkt 4). Realny wiersz i cała jego historia reconciliation (sekcja 4, `link_id` FK) pozostają w bazie — audytowalność nigdy nie jest tracona przez "usunięcie" linku z UI. `204`.

### `POST /cases/:caseId/finance-reconciliations`

```jsonc
// request
{
  "linkId": "lnk-1",
  "divergenceSummary": {
    "roi": { "actual": 1300, "period": "2026-06" },
    "finance": { "actual": 1100, "period": "2026-06" },
    "delta": { "absolute": 200, "percent": 18.2 }
  }
}
```

`201`, `status='OPEN'`, `openedBy`=caller, `openedAt`=now. Emituje `roi.finance_reconciliation_required` (sekcja 10).

### `GET /cases/:caseId/finance-reconciliations`

Lista reconciliation dla wszystkich linków tego Case'a (JOIN `rvn_roi_finance_links.roi_case_bridge_id = :caseId`), filtrowalna po `status`. Brak endpointu do "resolve" w dosłownej liście zadania (`POST`/`GET` tylko) — resolve (Finance strona rozwiązuje, wzorem `resolveReconciliation` z `resultsROIService.ts`, Decision W6-5) jest osobnym, nie-wymienionym w brief'ie `PATCH /cases/:caseId/finance-reconciliations/:reconciliationId` — **flagowane jako brakujący, ale oczywisty endpoint, sekcja 9 pkt 5**, nie dodany do zakresu tego ADR-u wbrew literalnemu brzmieniu zadania.

---

## 9. Domain event `roi.finance_reconciliation_required`

Plan §12.1 (linia 716) wymienia to zdarzenie dosłownie, jako jedno z siedemnastu; §12.1 opisuje też `ResultsEventEnvelope` (organization/aggregate/Initiative IDs, business/schema version, actor/effective role, policy version, correlation/causation/idempotency IDs, timestamp, reason/evidence refs, before/after hash) — **ten envelope nie istnieje jeszcze jako kod** (WP1-7 scope). Dzisiejszy `eventBus.publish(...)` (sekcja 1 pkt 4 — `kpi.reconciliation_initiated`/`kpi.reconciliation_resolved`, `resultsROIService.ts` linie 650/733) używa płaskiego payloadu. Ten ADR emituje przez **dzisiejszy** `eventBus`, z payloadem zaprojektowanym tak, żeby pola 1:1 odpowiadały przyszłemu `ResultsEventEnvelope`, więc migracja na prawdziwy envelope (gdy WP1-7 wyląduje) jest przemianowaniem pól, nie przeprojektowaniem:

```jsonc
eventBus.publish('roi.finance_reconciliation_required', {
  organizationId: "org-1",
  roiCaseBridge: { bridgeType: "INITIATIVE", bridgeId: "init-123", roiCaseId: null }, // -> aggregate/case ID w przyszłym envelope
  initiativeId: "init-123",
  linkId: "lnk-1",
  reconciliationId: "rec-1",
  financeArtifactType: "BASELINE_MODEL",
  financeArtifactId: "fa-1",
  financeVersionId: "bv-1",
  divergence: { absolute: 200, percent: 18.2 },
  reasonCode: "MATERIAL_DEVIATION", // | "SOURCE_STALE" | "MANUAL_FLAG"
  actorUserId: "user-1",
  occurredAt: "2026-08-10T10:00:00Z"
})
```

Emitowany z `POST /cases/:caseId/finance-reconciliations` (sekcja 8) ZAWSZE (nie tylko dla materialnych rozbieżności) — konsument (np. MyWork/notifications, XDOM-E005 z ledgeru epików, linia 84) decyduje o progu istotności, ten event jest faktem "reconciliation case została otwarta", nie osądem "czy to ważne". Nie emitowany automatycznie przez freshness propagation (sekcja 6) — `STALE_SOURCE` samo w sobie NIE jest jeszcze rozbieżnością (może się okazać, że nowa wersja Finance zgadza się z ROI Actual) — dopiero jawne otwarcie reconciliation (przez usera lub, w przyszłości, przez automatyczny recompute-and-compare, POZA zakresem tego ADR-u) emituje ten event. **To rozróżnienie (stale ≠ reconciliation required) jest świadomą decyzją projektową tego ADR-u**, nie cytatem z planu — flagowane sekcja 9... (patrz Eskalacje, pkt 6).

---

## 10. Dowód testowy — 15 scenariuszy, efemeryczny Postgres

Środowisko: PostgreSQL 15.15 (Homebrew), `initdb --locale=C`, `LC_ALL=C`, port 55231 (zakres 55000-59999, sprawdzony wolny przed startem), data dir `/private/tmp/roi_e007_pgdata`, log `/private/tmp/roi_e007_pg.log`. Baza `roi_e007_test` zbudowana z (a) minimalnej fixture'owej rekonstrukcji `organizations`/`initiatives`/`roi_realized_values` (kolumny 1:1 z `565_kpi_time_series_roi_attribution_finance.sql`) + trymowanej `finance_artifacts`/`finance_business_versions` (kolumny/CHECK-i/triggery 1:1 z `20260809_finance_v3_b01_core_artifacts.sql`, wystarczające dla FK-ów i dla `approveVersion()`-kolejności supersede-przed-approve), (b) trzech bloków DDL tego ADR-u (sekcje 3, 4, 5, 6) w całości. Teardown: `pg_ctl -m fast stop` + `rm -rf` katalogu danych, potwierdzone `ps aux`, że proces na porcie 55231 zniknął i że oba współdzielone procesy (PID 911, oraz osobna deweloperska instancja na PID-ach 80451-80456) nie były tknięte.

| # | Test | Oczekiwane | Wynik |
|---|---|---|---|
| 1 | Link do DRAFT finance version | przyjęte | ✅ |
| 2 | `finance_artifact_type` spoofed (VALUATION_CASE dla BASELINE_MODEL artefaktu) | odrzucone | ✅ |
| 3 | Drugi aktywny link, ten sam (Case, artifact, purpose) slot | odrzucone (partial unique index) | ✅ |
| 4 | Inny `link_purpose`, ten sam Case+artifact | przyjęte | ✅ |
| 5 | Repin `finance_version_id` z bv-1 na realną, inną wersję bv-1b przez UPDATE | odrzucone (pin immutability) | ✅ |
| 6 | UPDATE wyłącznie `freshness_state` | przyjęte | ✅ |
| 7 | Otwarcie reconciliation (`OPEN`, `divergence_summary`) | przyjęte | ✅ |
| 8 | `status='RESOLVED'` bez `resolved_by`/`resolved_at`/`resolution_note` | odrzucone | ✅ |
| 9 | `status='RESOLVED'` z pełnymi polami | przyjęte | ✅ |
| 10 | **UPDATE `roi_realized_values.realized_revenue_delta`** | **odrzucone** | ✅ |
| 11 | DELETE z `roi_realized_values` | odrzucone | ✅ |
| 12 | Korekta jako NOWY wiersz (`source='correction'`) | przyjęte | ✅ |
| 13 | Approve bv-1 → supersede bv-1 + approve bv-1b (ten sam artefakt) → OBA linki (BASELINE_SOURCE, FORECAST_COMPARISON) flip na `STALE_SOURCE`, `finance_version_id` NIE zmienia się, 2 wiersze append-only w `rvn_roi_finance_link_events` | przyjęte, dokładnie jak zaprojektowano | ✅ |
| 14 | UPDATE na `rvn_roi_finance_link_events` | odrzucone | ✅ |
| 15 | DELETE na `rvn_roi_finance_link_events` | odrzucone | ✅ |

Stan końcowy `roi_realized_values` potwierdzony SQL-em: `rrv-1` (oryginał, `realized_revenue_delta=1000`) i `rrv-2` (korekta, `realized_revenue_delta=1300`, `variance_notes` odnoszące się do `rrv-1`) współistnieją — **żadna wartość nie została nadpisana ani skasowana przez cały przebieg testów**, włącznie z próbami wprost temu przeczącymi (TEST 10/11).

Te testy **nie są** Gate C — nie testują resume/checksums/shadow-parity/canary, nie testują backfillu z żywych danych (`initiative_financials`/`benefit_tracking`/legacy `roi_assumptions`), nie testują faktycznego API-warstwy (sekcja 8 jest kontraktem, nie zaimplementowanym route'em) ani prawdziwego `eventBus.publish` (sekcja 10 jest payload-kontraktem). Są dowodem, że DDL jest syntaktycznie poprawny i że physical guarantees (no-overwrite ROI Actual, pin immutability, anti-spoof, freshness propagation bez auto-recompute, append-only event ledger, reconciliation resolution completeness) zachowują się zgodnie z projektem na realnych, wielotabelowych transakcjach, mimikujących realną kolejność `approveVersion()`.

---

## 11. Eskalacje wymagane przed pełnym GO

Żadna z poniższych NIE blokuje przyjęcia tego ADR-u jako projektu (ten sam DEC-FIN-012-owy tryb co WP-D09 §15 stosuje w swoim programie — tu bez formalnego numeru DEC, bo ROI-E007 nie ma jeszcze własnego rejestru decyzji jak Finance v3 ma; **rekomendacja**: gdy taki rejestr powstanie dla Results Next, te punkty powinny się tam przenieść).

1. **`link_purpose` siedem wartości (sekcja 3.2) jest osądem tego ADR-u, nie cytatem z planu** — plan nie podaje dosłownej listy. Do potwierdzenia przez właściciela produktu ROI/Finance przed implementacją.
2. **Które `link_purpose` wymagają `APPROVED` finance version, a które dopuszczają `IN_REVIEW`/`DRAFT`** (sekcja 8, `POST .../finance-links`) — zaprojektowane jako serwisowa reguła, nie schemat (schemat dopuszcza DRAFT dla wszystkich, celowo — sekcja 3), ale dokładna macierz purpose→minimalny status nie jest ustalona w tym ADR-ie.
3. **`benefit_tracking.actual_*` (trzeci magazyn "actual", sekcja 2.4) nie dostaje fizycznej ochrony w P0** — świadoma granica zakresu (task wskazuje `resultsROIService.ts`'s underlying tables), ale jeśli ten stół jest faktycznie używany do prezentowania "ROI Actual" gdziekolwiek w UI równolegle do `roi_realized_values`, ta sama klasa ryzyka (cichy overwrite) tam pozostaje otwarta. Wymaga osobnego P1 audytu przed pełnym zamknięciem ROI-E007.
4. **`DELETE /cases/:caseId/finance-links/:linkId` semantyka "wycofania bez następcy"** (sekcja 8) używa `superseded_at IS NOT NULL AND superseded_by_link_id IS NULL` jako sygnału — TO NIE JEST to samo, co filtr `WHERE superseded_by_link_id IS NULL` z partial unique indexu (sekcja 3.3), który świadomie NIE bierze pod uwagę samego `superseded_at`. Innymi słowy: `uq_rvn_rfl_one_active_per_slot` w obecnym kształcie **pozwoliłby** na nowy INSERT do tego samego slotu PO logicznym "DELETE" (bo `superseded_by_link_id IS NULL` nadal prawda dla wycofanego-bez-następcy linku) TYLKO jeśli serwis explicit ustawi `superseded_by_link_id` na nowy link przy każdym recreate — co jest poprawnym zachowaniem, ale nie jest samo-oczywiste ze schematu. Rekomendacja: przy implementacji dodać `chk` lub udokumentować w service layer, że "wycofanie bez następcy" musi ustawić SENTINEL (np. `superseded_by_link_id` wskazujący na samo siebie, albo osobna kolumna `withdrawn_at`) zamiast przeciążać `superseded_at`/`superseded_by_link_id NULL` dwoma znaczeniami. Nie naprawione w tym ADR-ie (DDL sketch w sekcji 3 pozostaje jak przetestowano) — flagowane jako P1 przed implementacją.
5. **`PATCH /cases/:caseId/finance-reconciliations/:reconciliationId` (resolve)** — brakujący z dosłownej listy zadania (sekcja 8), ale strukturalnie konieczny (wzorem `resolveReconciliation` już żywego w `resultsROIService.ts`). Dodany jako oczywisty follow-on, nie w formalnym zakresie tego ADR-u.
6. **"Stale ≠ reconciliation required" (sekcja 10)** — decyzja projektowa tego ADR-u (freshness propagation NIE emituje automatycznie `roi.finance_reconciliation_required`), nie cytat z planu. Jeśli produkt chce automatyczne otwieranie reconciliation na samej staleness (bez czekania na jawny recompute-and-compare), to jest jednolinijkowa zmiana (INSERT do `rvn_roi_finance_reconciliations` wewnątrz `rvn_roi_finance_mark_links_stale_on_new_approval`), ale zmienia semantykę z "sygnał do zbadania" na "automatyczny przypadek do rozwiązania" — różnica warta jawnej decyzji właściciela.
7. **`v8_roi_realization_entries` deny-trigger (sekcja 5.1, analogiczny do `roi_realized_values`)** — DDL nie jest wypisany osobno w tym ADR-ie (Załącznik A pokazuje tylko `roi_realized_values` explicite), bo jest **dosłownie identyczny w kształcie** (ta sama funkcja `roi_realized_values_deny_mutation` wzorca, inna nazwa tabeli/triggera) — przy implementacji migracja powinna zawierać OBIE pary triggerów.

---

## 12. Traceability

| Wymaganie z zadania | Sekcja tego ADR |
|---|---|
| `rvn_roi_finance_links` — pełny zestaw kolumn z zadania | 3 |
| `roi_case_ref` jako typowany legacy bridge, jawnie oznaczony placeholder | 3, 7 |
| `finance_version_id` FK do `finance_business_versions.business_version_id` — prawdziwy pin | 3 |
| `freshness_state` — reużyty wzorzec z Gate B | 3, 6 |
| `rvn_roi_finance_reconciliations` — status/divergence/opened/resolved | 4 |
| Zakaz kolumny pozwalającej "overwrite" ROI Actual | 4 |
| Freshness/supersession append-only events | 6 |
| Finance version zmienia się → link stale, NIE auto-recompute | 6 |
| Zakaz cichego nadpisywania ROI Actual jako FIZYCZNE ograniczenie | 5 |
| Gdzie dokładnie żyje ROI Actual w legacy v8 | 1 pkt 4, 5.1 |
| Trigger blokujący UPDATE inicjowany przez reconciliation; reconciliation zawsze INSERT | 4, 5 |
| API: GET/POST finance-links, DELETE finance-links/:linkId, POST/GET finance-reconciliations | 8 |
| `:caseId` dziś = legacy bridge, jawnie opisane | 7.1, 8 (każdy endpoint) |
| Domain event `roi.finance_reconciliation_required` — payload shape | 9 |
| Sekcja "Bridge do przyszłości" — co się zmienia po WP1-7, addytywnie | 7 |

---

## Załącznik A — DDL sketch (zweryfikowany żywo)

Trzy nowe tabele (`rvn_roi_finance_links`, `rvn_roi_finance_reconciliations`, `rvn_roi_finance_link_events`) + 1 nowy ENUM (`rvn_roi_finance_freshness`) + 5 funkcji/triggerów domenowych (anti-spoof, pin immutability, reconciliation resolution CHECK, append-only deny na event ledger, freshness propagation z `finance_business_versions`) + 2 triggery deny-mutation na istniejących legacy tabelach (`roi_realized_values`, i analogicznie `v8_roi_realization_entries` — eskalacja 7 w sekcji 11), w pełni specyfikowane w treści §3-6 powyżej. Pełne, uruchamialne pliki `.sql` żyły w scratchpadzie sesji (`/private/tmp/roi_e007_fixtures.sql`, `/private/tmp/roi_e007_ddl.sql`, `/private/tmp/roi_e007_tests.sql`) w trakcie testu na efemerycznym Postgresie (sekcja 10) — nie żyją w repo, zgodnie z tym, że ten task jest ADR, nie migracja.

```sql
-- Najbardziej load-bearing fragment: fizyczny zakaz nadpisania ROI Actual (sekcja 5.2)
CREATE OR REPLACE FUNCTION roi_realized_values_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'roi_realized_values is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows, reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_* here', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roi_realized_values_deny_update
  BEFORE UPDATE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();
CREATE TRIGGER trg_roi_realized_values_deny_delete
  BEFORE DELETE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();

-- Freshness propagation, jedyny punkt integracji z istniejącym Finance v3 (sekcja 6)
CREATE TRIGGER trg_finance_bv_mark_roi_links_stale
  AFTER UPDATE OF status ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_finance_mark_links_stale_on_new_approval();
```
