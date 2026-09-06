/**
 * KPI-E004 — Scorecards shared row + DTO types.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §A (schema) / §D
 * ("kpiScorecardTypes.ts — Row/DTO types").
 * Schema: server/migrations/20260812_rvn_kpi_scorecards.sql.
 *
 * Convention mirrors kpiDeviationTypes.ts exactly: `*Row` interfaces are
 * snake_case, matching DB columns 1:1 (the shape a raw `client.query<...Row>()`
 * call returns); DTO interfaces are camelCase — the shape command/repository
 * functions return to their callers. `kpiScorecardCommands.ts` and
 * `kpiScorecardRepository.ts` both import from here rather than each
 * re-declaring their own copy of these interfaces (the design doc's §B/§C
 * code samples inline them per-file for readability, but this file
 * consolidates them the same way kpiDeviationTypes.ts already does for
 * KPI-E003 — one definition, two importers, no drift risk).
 */

import { toNullableNumber } from './kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const KPI_SCORECARD_SCOPE_TYPES = [
  'organization',
  'business_unit',
  'team',
  'process',
  'individual',
  'custom',
] as const;
export type KpiScorecardScopeType = (typeof KPI_SCORECARD_SCOPE_TYPES)[number];

export const KPI_SCORECARD_REVIEW_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'custom',
] as const;
export type KpiScorecardReviewFrequency = (typeof KPI_SCORECARD_REVIEW_FREQUENCIES)[number];

// No 'pending_approval' — a Scorecard is a curation/membership object, not a
// governed contract requiring maker-checker (migration's own column comment).
export const KPI_SCORECARD_LIFECYCLE_STATUSES = ['draft', 'active', 'suspended', 'archived'] as const;
export type KpiScorecardLifecycleStatus = (typeof KPI_SCORECARD_LIFECYCLE_STATUSES)[number];

export const KPI_SCORECARD_ITEM_ROLES = ['primary', 'supporting'] as const;
export type KpiScorecardItemRole = (typeof KPI_SCORECARD_ITEM_ROLES)[number];

export const KPI_SCORECARD_SNAPSHOT_STATUSES = ['draft', 'published', 'superseded'] as const;
export type KpiScorecardSnapshotStatus = (typeof KPI_SCORECARD_SNAPSHOT_STATUSES)[number];

// ==========================================
// rvn_kpi_scorecards
// ==========================================

export interface KpiScorecardRow {
  scorecard_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  scope_type: KpiScorecardScopeType;
  scope_id: string | null;
  owner_user_id: string;
  owner_name?: string | null;
  review_frequency: KpiScorecardReviewFrequency;
  lifecycle_status: KpiScorecardLifecycleStatus;
  /* P7K — nagłówek raportu (SSOT §2: „zakład, rok, edycja, data rewizji,
     przygotował"). Kolumny addytywne, migracja
     `20261124_rvn_kpi_report_contract_fields.sql`; `?` bo starsze zapytania
     robią `SELECT sc.*` sprzed migracji i nie mają prawa się wywrócić. */
  edition_label?: string | null;
  revision_date?: string | null;
  prepared_by_user_id?: string | null;
  prepared_by_name?: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiScorecard {
  scorecardId: string;
  organizationId: string;
  name: string;
  description: string | null;
  scopeType: KpiScorecardScopeType;
  scopeId: string | null;
  ownerUserId: string;
  ownerName: string | null;
  reviewFrequency: KpiScorecardReviewFrequency;
  lifecycleStatus: KpiScorecardLifecycleStatus;
  editionLabel: string | null;
  revisionDate: string | null;
  preparedByUserId: string | null;
  preparedByName: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toKpiScorecard(row: KpiScorecardRow): KpiScorecard {
  return {
    scorecardId: row.scorecard_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name ?? null,
    reviewFrequency: row.review_frequency,
    lifecycleStatus: row.lifecycle_status,
    editionLabel: row.edition_label ?? null,
    revisionDate: row.revision_date ?? null,
    /* „Przygotował" spada do właściciela raportu, gdy nikt nie został
       zapisany osobno — to jest UCZCIWY fallback (właściciel odpowiada za
       raport), nie zgadywanie osoby. */
    preparedByUserId: row.prepared_by_user_id ?? row.owner_user_id ?? null,
    preparedByName: row.prepared_by_name ?? row.owner_name ?? null,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_scorecard_items — pure membership reference (AC #1/#2, migration
// header comment: "carries NO KPI-fact column"). No row_version of its own
// (decision #8) — the scorecard row is the CAS surface for every membership
// mutation.
// ==========================================

export interface KpiScorecardItemRow {
  item_id: string;
  scorecard_id: string;
  kpi_id: string;
  kpi_name?: string | null;
  organization_id: string;
  role: KpiScorecardItemRole;
  sort_order: number;
  display_config: Record<string, unknown> | null;
  /* ── P7K · KONTRAKT MIERNIKA W RAPORCIE ───────────────────────────────────
     Kolumny z `20261124_rvn_kpi_report_contract_fields.sql`. `?`, bo w bazie
     sprzed tej migracji ich po prostu nie ma, a `SELECT si.*` nie może się
     przez to wywrócić. */
  area_name?: string | null;
  superior_owner_name?: string | null;
  indicator_type?: string | null;
  benchmark_value?: string | number | null;
  limit_percent?: string | number | null;
  /* Elementy kontraktu, które MA wersja definicji miernika — dołączane
     joinem, żeby L2 nie musiał robić 138 osobnych zapytań o wersję. */
  kpi_unit?: string | null;
  kpi_target_geometry?: string | null;
  kpi_measurement_frequency_days?: number | null;
  kpi_owner_user_id?: string | null;
  kpi_owner_name?: string | null;
  kpi_description?: string | null;
  kpi_formula_text?: string | null;
  added_by: string;
  added_by_name?: string | null;
  added_at: string;
}

export interface KpiScorecardItem {
  itemId: string;
  scorecardId: string;
  kpiId: string;
  kpiName: string | null;
  organizationId: string;
  role: KpiScorecardItemRole;
  sortOrder: number;
  displayConfig: Record<string, unknown> | null;
  /** Obszar raportu. `null` = miernik bez zadeklarowanego obszaru — UI pokazuje „—". */
  areaName: string | null;
  /** Właściciel nadrzędny (MD) obszaru. Nigdy nie wyprowadzany z ownera miernika. */
  superiorOwnerName: string | null;
  /** `settlement` = rozliczeniowy, `informational` = informacyjny. */
  indicatorType: 'settlement' | 'informational' | null;
  benchmarkValue: number | null;
  /** Dopuszczalny limit [%] — NIE to samo co absolutne progi wersji definicji. */
  limitPercent: number | null;
  unit: string | null;
  targetGeometry: string | null;
  measurementFrequencyDays: number | null;
  ownerUserId: string | null;
  ownerName: string | null;
  description: string | null;
  formulaText: string | null;
  addedBy: string;
  addedByName: string | null;
  addedAt: string;
}

/**
 * Zapis seeda DBR77 w `display_config` jest FALLBACKIEM odczytu, dopóki
 * kolumny kontraktu są puste (patrz nagłówek migracji
 * `20261124_rvn_kpi_report_contract_fields.sql`). Kolumna ZAWSZE wygrywa —
 * gdy ktoś wpisze obszar w aplikacji, zapis seeda przestaje mieć znaczenie.
 */
function displayConfigString(
  config: Record<string, unknown> | null,
  key: string
): string | null {
  const raw = config?.[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayConfigNumber(
  config: Record<string, unknown> | null,
  key: string
): number | null {
  const raw = config?.[key];
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Kolumna NUMERIC wraca ze sterownika `pg` jako TEKST (żeby nie tracić
 *  precyzji), a z atrapy bazy i z testów bywa liczbą — obie drogi muszą dać
 *  ten sam wynik. `toNullableNumber` z `kpiTypes.ts` przyjmuje tylko `string`. */
function numericColumn(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return toNullableNumber(typeof value === 'number' ? String(value) : value);
}

/**
 * Typ wskaźnika przychodzi z dwóch źródeł: z kolumny jako enum SSOT
 * (`settlement`/`informational`) i z zapisu seeda jako polskie słowo z
 * arkusza właściciela („Rozliczeniowy" / „Informacyjny"). Normalizujemy do
 * enumu; czegokolwiek innego NIE zgadujemy — zostaje `null`, a UI pokaże „—".
 */
export function normalizeKpiIndicatorType(
  value: string | null | undefined
): 'settlement' | 'informational' | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'settlement' || normalized.startsWith('rozlicz')) return 'settlement';
  if (normalized === 'informational' || normalized.startsWith('informac')) return 'informational';
  return null;
}

export function toKpiScorecardItem(row: KpiScorecardItemRow): KpiScorecardItem {
  return {
    itemId: row.item_id,
    scorecardId: row.scorecard_id,
    kpiId: row.kpi_id,
    kpiName: row.kpi_name ?? null,
    organizationId: row.organization_id,
    role: row.role,
    sortOrder: row.sort_order,
    displayConfig: row.display_config,
    areaName: row.area_name ?? displayConfigString(row.display_config, 'obszar'),
    superiorOwnerName:
      row.superior_owner_name ?? displayConfigString(row.display_config, 'wlascicielNadrzedny'),
    indicatorType: normalizeKpiIndicatorType(
      row.indicator_type ?? displayConfigString(row.display_config, 'typWskaznika')
    ),
    benchmarkValue:
      numericColumn(row.benchmark_value) ?? displayConfigNumber(row.display_config, 'benchmark'),
    limitPercent:
      numericColumn(row.limit_percent) ??
      displayConfigNumber(row.display_config, 'dopuszczalnyLimitPct'),
    unit: row.kpi_unit ?? null,
    targetGeometry: row.kpi_target_geometry ?? null,
    measurementFrequencyDays: row.kpi_measurement_frequency_days ?? null,
    ownerUserId: row.kpi_owner_user_id ?? null,
    ownerName: row.kpi_owner_name ?? null,
    description: row.kpi_description ?? null,
    formulaText: row.kpi_formula_text ?? null,
    addedBy: row.added_by,
    addedByName: row.added_by_name ?? null,
    addedAt: row.added_at,
  };
}

// ==========================================
// P7K — MATRYCA OKRESÓW RAPORTU (poziom 2, SSOT §6)
//
// Raport KPI pokazuje dla każdego miernika parę CEL / Rezultat w KAŻDYM
// okresie roku plus YTD. Bez tego kontraktu jedynym sposobem złożenia tego
// widoku byłoby 138 osobnych zapytań `GET /kpi/:kpiId/measurements` — po
// jednym na miernik raportu.
//
// Etykiety okresów (`SIE 2026`) świadomie NIE przychodzą z serwera: nazwa
// miesiąca jest sprawą języka interfejsu, a nie danych. Serwer podaje klucz
// i granice okresu, front zapisuje je słowem.
// ==========================================

export type KpiPerformanceStatus = 'on_target' | 'warning' | 'critical' | 'neutral';

export interface ScorecardPeriodDefinition {
  /** `2026-08` dla miesiąca, `2026-Q3` dla kwartału, `2026` dla roku. */
  key: string;
  periodStart: string;
  periodEnd: string;
  /** Okres, w którym mieści się „teraz" — front podświetla go w tabeli. */
  isCurrent: boolean;
}

export interface ScorecardPeriodCell {
  periodKey: string;
  measurementId: string | null;
  targetValue: number | null;
  actualValue: number | null;
  /** Stan zapisany PRZY POMIARZE przez ewaluator aplikacji — nie przeliczany tutaj. */
  performanceStatus: KpiPerformanceStatus | null;
  dataQualityStatus: string | null;
}

export interface ScorecardPeriodMatrixItem {
  kpiId: string;
  itemId: string;
  cells: ScorecardPeriodCell[];
  ytdTargetValue: number | null;
  ytdActualValue: number | null;
  ytdPerformanceStatus: KpiPerformanceStatus | null;
  /**
   * `sum` — okresy się sumują (sztuki, złote, godziny);
   * `average` — okresy się uśredniają (jednostka `%`, bo suma procentów nie
   * ma sensu);
   * `unknown` — reguły nie da się wyprowadzić z jednostki, więc YTD NIE jest
   * liczone i zostaje `null`. Zgadywanie reguły agregacji byłoby wymyślaniem
   * liczby, której nikt nie zadeklarował.
   */
  ytdAggregation: 'sum' | 'average' | 'unknown';
  /** Stan ostatniego zamkniętego okresu — kolumna STAN w L2. */
  latestPerformanceStatus: KpiPerformanceStatus | null;
  /** Liczba OTWARTYCH kart działania (spraw odchylenia) — ikona przy wierszu. */
  openDeviationCaseCount: number;
}

export interface ScorecardPeriodMatrix {
  scorecardId: string;
  year: number;
  granularity: 'month' | 'quarter' | 'year';
  periods: ScorecardPeriodDefinition[];
  items: ScorecardPeriodMatrixItem[];
}

// ==========================================
// rvn_kpi_scorecard_review_snapshots — immutable published view (AC #3).
// ==========================================

export interface ScorecardSnapshotItemFact {
  kpiId: string;
  definitionVersionId: string | null;
  itemRole: KpiScorecardItemRole;
  measurementId: string | null;
  actualValue: number | null;
  unit: string | null;
  performanceStatus: 'on_target' | 'warning' | 'critical' | 'neutral' | null;
  dataQualityStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ScorecardStatusCounts {
  safe: number;
  warning: number;
  critical: number;
  missing: number;
}

export interface ScorecardSnapshotPayload {
  items: ScorecardSnapshotItemFact[];
  statusCounts: ScorecardStatusCounts;
}

export interface KpiScorecardReviewSnapshotRow {
  snapshot_id: string;
  scorecard_id: string;
  organization_id: string;
  review_period_start: string;
  review_period_end: string;
  snapshot_payload: ScorecardSnapshotPayload | null;
  status: KpiScorecardSnapshotStatus;
  content_hash: string | null;
  published_by: string | null;
  published_by_name?: string | null;
  published_at: string | null;
  superseded_by_snapshot_id: string | null;
  superseded_at: string | null;
  row_version: number;
  created_by: string;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KpiScorecardReviewSnapshot {
  snapshotId: string;
  scorecardId: string;
  organizationId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  snapshotPayload: ScorecardSnapshotPayload | null;
  status: KpiScorecardSnapshotStatus;
  contentHash: string | null;
  publishedBy: string | null;
  publishedByName: string | null;
  publishedAt: string | null;
  supersededBySnapshotId: string | null;
  supersededAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toKpiScorecardReviewSnapshot(row: KpiScorecardReviewSnapshotRow): KpiScorecardReviewSnapshot {
  return {
    snapshotId: row.snapshot_id,
    scorecardId: row.scorecard_id,
    organizationId: row.organization_id,
    reviewPeriodStart: row.review_period_start,
    reviewPeriodEnd: row.review_period_end,
    snapshotPayload: row.snapshot_payload,
    status: row.status,
    contentHash: row.content_hash,
    publishedBy: row.published_by,
    publishedByName: row.published_by_name ?? null,
    publishedAt: row.published_at,
    supersededBySnapshotId: row.superseded_by_snapshot_id,
    supersededAt: row.superseded_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Re-exported so callers reading NUMERIC columns off raw rows (e.g. a
 * future route layer) don't need a second import path — same convention
 * kpiDeviationTypes.ts follows for this helper. */
export { toNullableNumber };
