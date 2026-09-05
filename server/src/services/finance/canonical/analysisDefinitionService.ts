/**
 * Finance v3 canonical — producent DEFINICJI ANALIZY i WIERSZY SELEKCJI wskaźników.
 *
 * Paczka F-P4 (`docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`,
 * sekcja `## F‑P4`), znalezisko audytu F0 §2.3.
 *
 * PRZYCZYNA (zmierzona, nie przepisana). `kpiComputeService.ts` mówi wprost w nagłówku
 * (`:18-21`): „row PRESENCE is KPI/period SELECTION, this module never inserts new selection
 * rows, only computes into existing ones", a jedyna operacja tego modułu na tabeli wartości to
 * `UPDATE finance_analysis_kpi_values` (`:866`). Trzy tabele rodziny Analizy —
 * `finance_analysis_definitions`, `finance_analysis_kpi_values`, `finance_analysis_benchmarks` —
 * nie miały w kodzie produkcyjnym ANI JEDNEGO `INSERT`-a (potwierdzone `grep`-em na
 * `origin/staging`, 05.09.2026). Skutkiem było: `POST /api/v8/finance-v2/analysis/:bv/compute`
 * zawsze zwracał `resultsCount: 0`, czyli analiza historyczna pokazywała pustą tabelę.
 *
 * Katalog wskaźników JEST zaseedowany migracją
 * `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql` (18 wierszy P0, `tier='UNIVERSAL'`,
 * `status='ACTIVE'`), więc brakowało wyłącznie SELEKCJI: które wskaźniki × które okresy × która
 * jednostka. Ten moduł jest tym brakującym, siódmym producentem.
 *
 * CO ROBI (w JEDNEJ transakcji, ambient-aware — patrz `lineageService.insertEdge` po ten sam
 * wzorzec „użyj transakcji wołającego, jeśli jest"):
 *   1. `INSERT` wiersza `finance_analysis_definitions` (waluta/jednostka wyprowadzone z linii
 *      pakietu źródłowego, nie zgadnięte) z opcjonalną NAZWĄ WŁASNĄ analizy
 *      (`analysis_name`, migracja `20260905_finance_analysis_definition_name.sql`).
 *   2. `INSERT` wierszy selekcji do `finance_analysis_kpi_values` — iloczyn
 *      (katalog wskaźników) × (okresy pakietu źródłowego) × (jednostki pakietu źródłowego),
 *      każdy wiersz jako pusta komórka `value_status='MISSING'` (`value_decimal` NULL —
 *      wymóg `chk_finance_analysis_kpi_values_value_shape`). To `compute` wypełnia wartości.
 *
 * CZEGO ŚWIADOMIE NIE ROBI — `finance_analysis_benchmarks`. Tabela wymaga realnych danych
 * porównawczych (`peer_set_definition`, `source_name`, `as_of_date`, `p25/median/p75`).
 * Nie mamy dziś ŻADNEGO źródła benchmarków (ani licencji, ani dostawcy), a wpisanie wymyślonych
 * percentyli byłoby sfabrykowaniem danych finansowych pokazywanych klientowi. Zostaje bez
 * producenta, świadomie i jawnie — do osobnej decyzji o źródle danych.
 *
 * ODMOWA BEZ ZAPISU. Gdy pakiet źródłowy nie ma okresów albo jednostek (a tak wygląda dziś
 * KAŻDY pakiet na stagingu — `finance_stmt_periods` i `finance_stmt_entities` mają 0 wierszy,
 * bo ogniwo F-M5 nie jest scalone), moduł ZWRACA BŁĄD i nie zapisuje niczego. Utworzenie analizy
 * „na pusto" jest dokładnie tym defektem, który ta paczka usuwa — lepszy uczciwy komunikat po
 * polsku niż kolejny pusty ekran.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { getCurrentPgTransactionClient } from '../../../utils/queryHelpers.js';

/** Minimalny kontrakt transakcji, wspólny dla ambient (`withPgTransaction`) i pinned. */
interface TxLike {
  queryAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export const ANALYSIS_PURPOSES = [
  'INTERNAL_REVIEW',
  'INVESTOR_REPORTING',
  'LENDER_COVENANT',
  'ACQUISITION_DILIGENCE',
  'BENCHMARKING',
  'BOARD_REPORTING',
] as const;
export type AnalysisPurpose = (typeof ANALYSIS_PURPOSES)[number];

export const ANALYSIS_TYPES = [
  'STANDARD',
  'DEEP_DIVE',
  'COVENANT_FOCUSED',
  'BENCHMARK_FOCUSED',
] as const;
export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export const ANALYSIS_UNITS = ['UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS'] as const;
export type AnalysisUnit = (typeof ANALYSIS_UNITS)[number];

export interface CreateAnalysisDefinitionParams {
  organizationId: string;
  /** Wersja biznesowa analizy (artefakt `HISTORICAL_ANALYSIS`), już utworzona. */
  analysisBusinessVersionId: string;
  /** Wersja biznesowa pakietu sprawozdań, z którego analiza powstaje (`STATEMENT_PACK`). */
  sourceStatementPackVersionId: string;
  createdBy: string;
  /** Nazwa własna analizy (wymóg właściciela). NULL ⇒ nazwa domyślna po stronie UI. */
  analysisName?: string | null;
  purpose?: AnalysisPurpose;
  analysisType?: AnalysisType;
  industryCode?: string | null;
  /** Zawężenie okresów (kreator). Puste/undefined ⇒ wszystkie okresy pakietu źródłowego. */
  periodIds?: readonly string[];
  /** Zawężenie wskaźników po `kpi_code` (kreator). Puste/undefined ⇒ cały aktywny katalog. */
  kpiCodes?: readonly string[];
}

export interface AnalysisDefinitionSelectionSummary {
  definitionId: string;
  analysisName: string | null;
  presentationCurrency: string;
  unit: AnalysisUnit;
  entityIds: string[];
  periodIds: string[];
  kpiCatalogIds: string[];
  kpiCodes: string[];
  /** Ile wierszy selekcji faktycznie wstawiono (powtórka idempotentna ⇒ 0). */
  selectionRowsInserted: number;
  /** Ile wierszy selekcji istnieje dla tej analizy po operacji. */
  selectionRowsTotal: number;
}

export type CreateAnalysisDefinitionResult =
  | { ok: true; summary: AnalysisDefinitionSelectionSummary }
  | {
      ok: false;
      code:
        | 'SOURCE_PACK_HAS_NO_PERIODS'
        | 'SOURCE_PACK_HAS_NO_ENTITIES'
        | 'NO_ACTIVE_KPI_CATALOG'
        | 'REQUESTED_PERIODS_NOT_IN_SOURCE_PACK'
        | 'REQUESTED_KPI_NOT_IN_CATALOG';
      message: string;
    };

const DEFAULT_PURPOSE: AnalysisPurpose = 'INTERNAL_REVIEW';
const DEFAULT_ANALYSIS_TYPE: AnalysisType = 'STANDARD';
const DEFAULT_CURRENCY = 'PLN';
const DEFAULT_UNIT: AnalysisUnit = 'UNITS';

/**
 * Okresy pakietu źródłowego. Schemat CELOWO nie ma tabeli „okresy tego pakietu"
 * (`finance_stmt_periods` jest wspólne dla organizacji — ADR WP-D01 §2.1), więc jedyną uczciwą
 * definicją „okresy pakietu" jest zbiór okresów, w których ten pakiet FAKTYCZNIE ma komórki
 * (`finance_stmt_lines`). Kolejność po dacie początku okresu — deterministyczna.
 */
async function loadSourcePeriodIds(
  tx: TxLike,
  organizationId: string,
  sourceVersionId: string
): Promise<string[]> {
  const rows = await tx.queryAll<{ period_id: string }>(
    `SELECT DISTINCT l.period_id, p.period_start
       FROM finance_stmt_lines l
       JOIN finance_stmt_periods p ON p.period_id = l.period_id
      WHERE l.organization_id = ? AND l.business_version_id = ?
      ORDER BY p.period_start`,
    [organizationId, sourceVersionId]
  );
  return rows.map((r) => r.period_id);
}

async function loadSourceEntityIds(
  tx: TxLike,
  organizationId: string,
  sourceVersionId: string
): Promise<string[]> {
  const rows = await tx.queryAll<{ id: string }>(
    `SELECT id FROM finance_stmt_entities
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY entity_code`,
    [organizationId, sourceVersionId]
  );
  return rows.map((r) => r.id);
}

/**
 * Katalog do selekcji: seed P0 (`tier='UNIVERSAL'`, `organization_id IS NULL`) + ewentualne
 * własne wskaźniki organizacji (`ORG_CUSTOM`). Wiersze INDUSTRY zostają poza domyślną selekcją —
 * dobór branżowy to osobna decyzja kreatora, nie domyślka producenta.
 */
async function loadCatalogForSelection(
  tx: TxLike,
  organizationId: string
): Promise<Array<{ id: string; kpi_code: string }>> {
  return tx.queryAll<{ id: string; kpi_code: string }>(
    `SELECT id, kpi_code FROM finance_analysis_kpi_catalog
      WHERE status = 'ACTIVE'
        AND (
          (tier = 'UNIVERSAL' AND organization_id IS NULL)
          OR (tier = 'ORG_CUSTOM' AND organization_id = ?)
        )
      ORDER BY kpi_code`,
    [organizationId]
  );
}

/** Waluta i jednostka prezentacji — wyprowadzone z linii pakietu, nie zgadnięte. */
async function resolvePresentation(
  tx: TxLike,
  organizationId: string,
  sourceVersionId: string
): Promise<{ presentationCurrency: string; unit: AnalysisUnit }> {
  const row = await tx.queryOne<{ presentation_currency: string | null; unit: string | null }>(
    `SELECT presentation_currency, unit, COUNT(*) AS cell_count
       FROM finance_stmt_lines
      WHERE organization_id = ? AND business_version_id = ?
        AND presentation_currency IS NOT NULL
      GROUP BY presentation_currency, unit
      ORDER BY cell_count DESC, presentation_currency
      LIMIT 1`,
    [organizationId, sourceVersionId]
  );
  const unit = (ANALYSIS_UNITS as readonly string[]).includes(String(row?.unit))
    ? (row?.unit as AnalysisUnit)
    : DEFAULT_UNIT;
  return { presentationCurrency: row?.presentation_currency || DEFAULT_CURRENCY, unit };
}

async function createInTransaction(
  tx: TxLike,
  params: CreateAnalysisDefinitionParams
): Promise<CreateAnalysisDefinitionResult> {
  const { organizationId, analysisBusinessVersionId, sourceStatementPackVersionId } = params;

  const [allPeriodIds, entityIds, catalog] = await Promise.all([
    loadSourcePeriodIds(tx, organizationId, sourceStatementPackVersionId),
    loadSourceEntityIds(tx, organizationId, sourceStatementPackVersionId),
    loadCatalogForSelection(tx, organizationId),
  ]);

  if (entityIds.length === 0) {
    return {
      ok: false,
      code: 'SOURCE_PACK_HAS_NO_ENTITIES',
      message:
        'Pakiet sprawozdań nie ma jeszcze zarejestrowanych jednostek sprawozdawczych — nie ma na czym policzyć wskaźników. Najpierw dokończ import i mapowanie pakietu.',
    };
  }
  if (allPeriodIds.length === 0) {
    return {
      ok: false,
      code: 'SOURCE_PACK_HAS_NO_PERIODS',
      message:
        'Pakiet sprawozdań nie ma jeszcze okresów z danymi — nie ma czego analizować. Najpierw dokończ import i mapowanie pakietu.',
    };
  }
  if (catalog.length === 0) {
    return {
      ok: false,
      code: 'NO_ACTIVE_KPI_CATALOG',
      message:
        'Katalog wskaźników jest pusty — brak aktywnych definicji wskaźników dla tej organizacji.',
    };
  }

  const requestedPeriods = (params.periodIds ?? []).filter((id) => id);
  const periodIds =
    requestedPeriods.length > 0
      ? allPeriodIds.filter((id) => requestedPeriods.includes(id))
      : allPeriodIds;
  if (periodIds.length === 0) {
    return {
      ok: false,
      code: 'REQUESTED_PERIODS_NOT_IN_SOURCE_PACK',
      message: 'Żaden z wybranych okresów nie występuje w pakiecie źródłowym.',
    };
  }

  const requestedKpiCodes = (params.kpiCodes ?? []).filter((code) => code);
  const selectedCatalog =
    requestedKpiCodes.length > 0
      ? catalog.filter((row) => requestedKpiCodes.includes(row.kpi_code))
      : catalog;
  if (selectedCatalog.length === 0) {
    return {
      ok: false,
      code: 'REQUESTED_KPI_NOT_IN_CATALOG',
      message: 'Żaden z wybranych wskaźników nie występuje w aktywnym katalogu.',
    };
  }

  const { presentationCurrency, unit } = await resolvePresentation(
    tx,
    organizationId,
    sourceStatementPackVersionId
  );

  // Definicja: idempotentnie po `uq_finance_analysis_def_bv` (jedna definicja na wersję analizy).
  const inserted = await tx.queryOne<{ id: string; analysis_name: string | null }>(
    `INSERT INTO finance_analysis_definitions (
       organization_id, business_version_id, purpose, industry_code, analysis_type,
       entity_scope_mode, presentation_currency, unit, analysis_name, created_by
     ) VALUES (?, ?, ?, ?, ?, 'GROUP_CONSOLIDATED', ?, ?, ?, ?)
     ON CONFLICT ON CONSTRAINT uq_finance_analysis_def_bv DO NOTHING
     RETURNING id, analysis_name`,
    [
      organizationId,
      analysisBusinessVersionId,
      params.purpose ?? DEFAULT_PURPOSE,
      params.industryCode ?? null,
      params.analysisType ?? DEFAULT_ANALYSIS_TYPE,
      presentationCurrency,
      unit,
      params.analysisName ?? null,
      params.createdBy,
    ]
  );
  const definitionRow =
    inserted ??
    (await tx.queryOne<{ id: string; analysis_name: string | null }>(
      `SELECT id, analysis_name FROM finance_analysis_definitions
        WHERE organization_id = ? AND business_version_id = ?`,
      [organizationId, analysisBusinessVersionId]
    ));
  if (!definitionRow) throw new Error('finance_analysis_definitions insert returned no row');

  // Wiersze selekcji: katalog × okresy × jednostki. Wstawiane jako PUSTE komórki
  // (`value_status='MISSING'`, `value_decimal` NULL) — wartość wpisuje dopiero `compute`.
  const values: unknown[] = [];
  const tuples: string[] = [];
  for (const kpi of selectedCatalog) {
    for (const entityId of entityIds) {
      for (const periodId of periodIds) {
        tuples.push(`(?, ?, ?, ?, ?, 'MISSING', ?)`);
        values.push(
          organizationId,
          analysisBusinessVersionId,
          kpi.id,
          entityId,
          periodId,
          params.createdBy
        );
      }
    }
  }
  const insertedRows = await tx.queryAll<{ id: string }>(
    `INSERT INTO finance_analysis_kpi_values (
       organization_id, business_version_id, kpi_catalog_id, entity_id, period_id, value_status, created_by
     ) VALUES ${tuples.join(', ')}
     ON CONFLICT ON CONSTRAINT uq_finance_analysis_kpi_values_cell DO NOTHING
     RETURNING id`,
    values
  );

  const totalRow = await tx.queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM finance_analysis_kpi_values
      WHERE organization_id = ? AND business_version_id = ?`,
    [organizationId, analysisBusinessVersionId]
  );

  return {
    ok: true,
    summary: {
      definitionId: definitionRow.id,
      analysisName: definitionRow.analysis_name ?? params.analysisName ?? null,
      presentationCurrency,
      unit,
      entityIds,
      periodIds,
      kpiCatalogIds: selectedCatalog.map((row) => row.id),
      kpiCodes: selectedCatalog.map((row) => row.kpi_code),
      selectionRowsInserted: insertedRows.length,
      selectionRowsTotal: Number(totalRow?.count ?? 0),
    },
  };
}

/**
 * Zakłada definicję analizy i komplet wierszy selekcji wskaźników w JEDNEJ transakcji.
 * Jeśli wołający już otworzył transakcję (`withPgTransaction` w trasie `derived-analysis`),
 * pracuje w NIEJ — dzięki temu nieudana selekcja wycofuje także artefakt i krawędź rodowodu.
 */
export async function createAnalysisDefinitionWithSelection(
  params: CreateAnalysisDefinitionParams
): Promise<CreateAnalysisDefinitionResult> {
  const ambient = getCurrentPgTransactionClient();
  if (ambient) {
    return createInTransaction(
      {
        queryAll: async <T>(sql: string, queryParams: unknown[] = []) =>
          (await ambient.query<T>(sql, queryParams)).rows,
        queryOne: async <T>(sql: string, queryParams: unknown[] = []) =>
          (await ambient.query<T>(sql, queryParams)).rows[0] ?? null,
      },
      params
    );
  }
  return withPinnedPostgresTransaction((tx) =>
    createInTransaction(
      {
        queryAll: <T>(sql: string, queryParams: unknown[] = []) =>
          tx.queryAll<T & Record<string, unknown>>(sql, queryParams),
        queryOne: <T>(sql: string, queryParams: unknown[] = []) =>
          tx.queryOne<T & Record<string, unknown>>(sql, queryParams),
      },
      params
    )
  );
}
