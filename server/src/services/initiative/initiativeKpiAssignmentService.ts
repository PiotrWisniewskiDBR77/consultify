import { v4 as uuidv4 } from 'uuid';

import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  archiveDefinition,
  createDefinition,
  getCurrentDefinition,
  type KpiDefinitionFields,
  KpiDefinitionVersionConflictError,
  updateDefinition,
} from '../results/kpiDefinitionService.js';

/**
 * This route's public contract has no `expectedVersion` field (there was no
 * version concept before RES-02). Fetch-current-then-CAS-write with a small
 * bounded retry gives every caller the canonical service's atomicity and
 * audit trail without forcing a breaking API change on this call site: on a
 * genuine concurrent edit the retry re-reads the now-current version and
 * applies the SAME requested fields on top of it, rather than silently
 * losing the write or surfacing a conflict for an ordinary (non-racing) call.
 */
async function updateDefinitionWithRetry(
  kpiId: string,
  organizationId: string,
  fields: Partial<KpiDefinitionFields> & {
    actorUserId?: string | null;
    reason?: string | null;
    source?: string | null;
  },
  attempts = 3
): Promise<Awaited<ReturnType<typeof updateDefinition>>> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const current = await getCurrentDefinition(kpiId, organizationId);
    if (!current) throw new Error('KPI not found');
    try {
      return await updateDefinition({
        ...fields,
        kpiId,
        organizationId,
        expectedVersion: current.currentDefinitionVersion,
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof KpiDefinitionVersionConflictError)) throw error;
    }
  }
  throw lastError;
}

export type InitiativeKpiObservationPhase = 'realization' | 'post-implementation' | 'both';
export type InitiativeKpiDefinitionSource = 'library' | 'initiative-custom';
export type InitiativeKpiObservationStatus = 'active' | 'paused' | 'completed';
export type InitiativeKpiMeasurementFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface InitiativeKpiExpectation {
  baselineValue: number | null;
  targetValue: number | null;
  measurementFrequency: InitiativeKpiMeasurementFrequency;
}

export interface InitiativeKpiAssignmentRead {
  id: string;
  mappingId: string | null;
  initiativeId: string;
  initiativeStatus?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  latestValue: number | null;
  latestMeasurementDate: string | null;
  progressPercentage: number;
  status: string;
  measurementFrequency: InitiativeKpiMeasurementFrequency;
  isOnTarget: boolean;
  createdAt: string;
  updatedAt?: string | null;
  definitionSource: InitiativeKpiDefinitionSource;
  observationPhase: InitiativeKpiObservationPhase;
  trackedInRealization: boolean;
  trackedPostImplementation: boolean;
  observationStatus: InitiativeKpiObservationStatus;
  realizationExpectation: InitiativeKpiExpectation;
  postImplementationExpectation: InitiativeKpiExpectation;
}

export interface UpsertInitiativeKpiAssignmentInput {
  initiativeId: string;
  organizationId: string;
  userId?: string | null;
  kpiId?: string | null;
  name?: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  measurementFrequency?: string | null;
  currentValue?: number | null;
  definitionSource?: InitiativeKpiDefinitionSource;
  observationPhase?: InitiativeKpiObservationPhase;
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: InitiativeKpiObservationStatus;
  realizationExpectation?: Partial<InitiativeKpiExpectation> | null;
  postImplementationExpectation?: Partial<InitiativeKpiExpectation> | null;
}

interface AssignmentQueryRow {
  mapping_id: string | null;
  kpi_id: string;
  initiative_id: string;
  initiative_status: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  latest_value: number | null;
  latest_measurement_date: string | null;
  progress_percentage: number | null;
  kpi_status: string | null;
  measurement_frequency: string | null;
  direction: string | null;
  created_at: string;
  updated_at: string | null;
  definition_source?: string | null;
  observation_phase?: string | null;
  tracked_in_realization?: number | null;
  tracked_post_implementation?: number | null;
  observation_status?: string | null;
  realization_baseline_value?: number | null;
  realization_target_value?: number | null;
  realization_measurement_frequency?: string | null;
  post_implementation_baseline_value?: number | null;
  post_implementation_target_value?: number | null;
  post_implementation_measurement_frequency?: string | null;
}

const KPI_FREQUENCIES: InitiativeKpiMeasurementFrequency[] = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
];

function normalizeFrequency(
  value: unknown,
  fallback: InitiativeKpiMeasurementFrequency = 'MONTHLY'
): InitiativeKpiMeasurementFrequency {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase();
  return KPI_FREQUENCIES.includes(normalized as InitiativeKpiMeasurementFrequency)
    ? (normalized as InitiativeKpiMeasurementFrequency)
    : fallback;
}

function safeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function boolFromDb(value: unknown, fallback = false): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

function normalizeObservationStatus(value: unknown): InitiativeKpiObservationStatus {
  const normalized = String(value || 'active')
    .trim()
    .toLowerCase();
  if (normalized === 'paused') return 'paused';
  if (normalized === 'completed') return 'completed';
  return 'active';
}

function deriveObservationPhase(params: {
  phase?: unknown;
  trackedInRealization?: unknown;
  trackedPostImplementation?: unknown;
}): InitiativeKpiObservationPhase {
  const phase = String(params.phase || '')
    .trim()
    .toLowerCase();
  if (phase === 'realization' || phase === 'post-implementation' || phase === 'both') {
    return phase as InitiativeKpiObservationPhase;
  }

  const inRealization = boolFromDb(params.trackedInRealization, false);
  const postImplementation = boolFromDb(params.trackedPostImplementation, true);
  if (inRealization && postImplementation) return 'both';
  if (inRealization) return 'realization';
  return 'post-implementation';
}

function deriveTrackedFlags(
  phase?: InitiativeKpiObservationPhase,
  trackedInRealization?: boolean,
  trackedPostImplementation?: boolean
): { trackedInRealization: boolean; trackedPostImplementation: boolean } {
  if (trackedInRealization != null || trackedPostImplementation != null) {
    return {
      trackedInRealization: Boolean(trackedInRealization),
      trackedPostImplementation: trackedPostImplementation ?? true,
    };
  }

  if (phase === 'both') {
    return { trackedInRealization: true, trackedPostImplementation: true };
  }
  if (phase === 'realization') {
    return { trackedInRealization: true, trackedPostImplementation: false };
  }
  return { trackedInRealization: false, trackedPostImplementation: true };
}

function computeIsOnTarget(params: {
  latestValue: number | null;
  targetValue: number | null;
  direction?: string | null;
}): boolean {
  if (params.latestValue == null || params.targetValue == null) return false;
  return String(params.direction || 'HIGHER_IS_BETTER').toUpperCase() === 'LOWER_IS_BETTER'
    ? Number(params.latestValue) <= Number(params.targetValue)
    : Number(params.latestValue) >= Number(params.targetValue);
}

function computeProgressPercentage(params: {
  latestValue: number | null;
  targetValue: number | null;
}): number {
  const { latestValue, targetValue } = params;
  if (latestValue == null || targetValue == null || targetValue === 0) return 0;
  return Number(((latestValue / targetValue) * 100).toFixed(1));
}

async function assertInitiativeBelongsToOrg(initiativeId: string, organizationId: string) {
  const initiative = await queryHelpers.queryOne<{ id: string }>(
    'SELECT id FROM initiatives WHERE id = ? AND organization_id = ?',
    [initiativeId, organizationId]
  );
  if (!initiative?.id) {
    throw new Error('Initiative not found');
  }
}

async function assertKpiBelongsToOrg(kpiId: string, organizationId: string) {
  const row = await queryHelpers.queryOne<{
    id: string;
    initiative_id: string | null;
    organization_id: string | null;
  }>(
    `SELECT k.id, k.initiative_id, COALESCE(k.organization_id, i.organization_id) AS organization_id
     FROM initiative_kpis k
     LEFT JOIN initiatives i ON i.id = k.initiative_id
     WHERE k.id = ?`,
    [kpiId]
  );

  if (!row?.id || String(row.organization_id || '') !== String(organizationId)) {
    throw new Error('KPI not found');
  }
  return row;
}

function mapAssignmentRow(row: AssignmentQueryRow): InitiativeKpiAssignmentRead {
  const baselineValue = safeNumber(row.baseline_value);
  const targetValue = safeNumber(row.target_value);
  const currentValue = safeNumber(row.current_value);
  const latestValue = safeNumber(row.latest_value) ?? currentValue;
  const measurementFrequency = normalizeFrequency(row.measurement_frequency);
  const observationPhase = deriveObservationPhase({
    phase: row.observation_phase,
    trackedInRealization: row.tracked_in_realization,
    trackedPostImplementation: row.tracked_post_implementation,
  });
  const trackedFlags = deriveTrackedFlags(
    observationPhase,
    row.tracked_in_realization != null ? boolFromDb(row.tracked_in_realization) : undefined,
    row.tracked_post_implementation != null
      ? boolFromDb(row.tracked_post_implementation)
      : undefined
  );

  const realizationExpectation: InitiativeKpiExpectation = {
    baselineValue: safeNumber(row.realization_baseline_value) ?? baselineValue,
    targetValue: safeNumber(row.realization_target_value) ?? targetValue,
    measurementFrequency: normalizeFrequency(
      row.realization_measurement_frequency,
      measurementFrequency
    ),
  };
  const postImplementationExpectation: InitiativeKpiExpectation = {
    baselineValue: safeNumber(row.post_implementation_baseline_value) ?? baselineValue,
    targetValue: safeNumber(row.post_implementation_target_value) ?? targetValue,
    measurementFrequency: normalizeFrequency(
      row.post_implementation_measurement_frequency,
      measurementFrequency
    ),
  };

  const progressRaw = safeNumber(row.progress_percentage);
  const progressPercentage =
    progressRaw != null && progressRaw !== 0
      ? progressRaw
      : computeProgressPercentage({ latestValue, targetValue });

  return {
    id: String(row.kpi_id),
    mappingId: row.mapping_id ? String(row.mapping_id) : null,
    initiativeId: String(row.initiative_id),
    initiativeStatus: row.initiative_status,
    name: String(row.name || ''),
    description: row.description || null,
    category: row.category || 'benefits',
    unit: row.unit || null,
    baselineValue,
    targetValue,
    currentValue,
    latestValue,
    latestMeasurementDate: row.latest_measurement_date || null,
    progressPercentage,
    status: String(row.kpi_status || 'on_track'),
    measurementFrequency,
    isOnTarget: computeIsOnTarget({
      latestValue,
      targetValue,
      direction: row.direction,
    }),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at || null,
    definitionSource:
      String(row.definition_source || '')
        .trim()
        .toLowerCase() === 'library'
        ? 'library'
        : 'initiative-custom',
    observationPhase,
    trackedInRealization: trackedFlags.trackedInRealization,
    trackedPostImplementation: trackedFlags.trackedPostImplementation,
    observationStatus: normalizeObservationStatus(row.observation_status),
    realizationExpectation,
    postImplementationExpectation,
  };
}

function buildMappingInsertParts(
  columns: Set<string>,
  input: Required<
    Pick<
      UpsertInitiativeKpiAssignmentInput,
      | 'initiativeId'
      | 'organizationId'
      | 'definitionSource'
      | 'observationPhase'
      | 'trackedInRealization'
      | 'trackedPostImplementation'
      | 'observationStatus'
    >
  > &
    Pick<
      UpsertInitiativeKpiAssignmentInput,
      'userId' | 'realizationExpectation' | 'postImplementationExpectation'
    > & {
      kpiId: string;
      id: string;
    }
) {
  const insertCols = ['id', 'initiative_id', 'kpi_id', 'organization_id'];
  const placeholders = ['?', '?', '?', '?'];
  const params: unknown[] = [input.id, input.initiativeId, input.kpiId, input.organizationId];
  const updates: string[] = [];

  const pushOptional = (column: string, value: unknown) => {
    if (!columns.has(column)) return;
    insertCols.push(column);
    placeholders.push('?');
    params.push(value);
    updates.push(`${column} = excluded.${column}`);
  };

  pushOptional('definition_source', input.definitionSource);
  pushOptional('observation_phase', input.observationPhase);
  pushOptional('tracked_in_realization', input.trackedInRealization ? 1 : 0);
  pushOptional('tracked_post_implementation', input.trackedPostImplementation ? 1 : 0);
  pushOptional('observation_status', input.observationStatus);
  pushOptional(
    'realization_baseline_value',
    safeNumber(input.realizationExpectation?.baselineValue) ?? null
  );
  pushOptional(
    'realization_target_value',
    safeNumber(input.realizationExpectation?.targetValue) ?? null
  );
  pushOptional(
    'realization_measurement_frequency',
    normalizeFrequency(input.realizationExpectation?.measurementFrequency)
  );
  pushOptional(
    'post_implementation_baseline_value',
    safeNumber(input.postImplementationExpectation?.baselineValue) ?? null
  );
  pushOptional(
    'post_implementation_target_value',
    safeNumber(input.postImplementationExpectation?.targetValue) ?? null
  );
  pushOptional(
    'post_implementation_measurement_frequency',
    normalizeFrequency(input.postImplementationExpectation?.measurementFrequency)
  );
  pushOptional('created_by', input.userId || null);
  if (columns.has('updated_at')) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
  }

  return { insertCols, placeholders, params, updates };
}

async function upsertMapping(
  columns: Set<string>,
  input: Required<
    Pick<
      UpsertInitiativeKpiAssignmentInput,
      | 'initiativeId'
      | 'organizationId'
      | 'definitionSource'
      | 'observationPhase'
      | 'trackedInRealization'
      | 'trackedPostImplementation'
      | 'observationStatus'
    >
  > &
    Pick<
      UpsertInitiativeKpiAssignmentInput,
      'userId' | 'realizationExpectation' | 'postImplementationExpectation'
    > & {
      kpiId: string;
    }
) {
  const built = buildMappingInsertParts(columns, { ...input, id: uuidv4() });
  await queryHelpers.queryRun(
    `INSERT INTO initiative_kpi_mappings (${built.insertCols.join(', ')})
     VALUES (${built.placeholders.join(', ')})
     ON CONFLICT(initiative_id, kpi_id) DO UPDATE SET ${built.updates.join(', ')}`,
    built.params
  );
}

export async function listInitiativeKpiAssignments(
  initiativeId: string,
  organizationId: string
): Promise<InitiativeKpiAssignmentRead[]> {
  await assertInitiativeBelongsToOrg(initiativeId, organizationId);

  const mappingColumns = await getTableColumns('initiative_kpi_mappings');
  const hasMappingTable = mappingColumns.size > 0;

  // Schema drift guard: `initiative_kpis` on older deployments (e.g. demo) lacks
  // progress_percentage / status. A hardcoded `k.<col>` turns EVERY read (and the
  // create read-back → 500) into a 42703. Select NULL where the column is absent.
  const kpiColumns = await getTableColumns('initiative_kpis');
  const kpiProgressExpr = kpiColumns.has('progress_percentage') ? 'k.progress_percentage' : 'NULL';
  const kpiStatusExpr = kpiColumns.has('status') ? 'k.status' : 'NULL';

  const rows: AssignmentQueryRow[] = [];

  if (hasMappingTable) {
    const mappingRows = await queryHelpers.queryAll<AssignmentQueryRow>(
      `SELECT
         m.id AS mapping_id,
         m.kpi_id,
         m.initiative_id,
         i.status AS initiative_status,
         k.name,
         k.description,
         k.category,
         k.unit,
         k.baseline_value,
         k.target_value,
         k.current_value,
         (
           SELECT ts.value
           FROM kpi_time_series ts
           WHERE ts.kpi_id = k.id AND ts.organization_id = ?
           ORDER BY ts.period_start DESC, ts.created_at DESC
           LIMIT 1
         ) AS latest_value,
         (
           SELECT ts.period_start
           FROM kpi_time_series ts
           WHERE ts.kpi_id = k.id AND ts.organization_id = ?
           ORDER BY ts.period_start DESC, ts.created_at DESC
           LIMIT 1
         ) AS latest_measurement_date,
         ${kpiProgressExpr} AS progress_percentage,
         ${kpiStatusExpr} AS kpi_status,
         k.measurement_frequency,
         k.direction,
         k.created_at,
         k.updated_at,
         ${mappingColumns.has('definition_source') ? 'm.definition_source' : `'initiative-custom'`} AS definition_source,
         ${mappingColumns.has('observation_phase') ? 'm.observation_phase' : `'post-implementation'`} AS observation_phase,
         ${mappingColumns.has('tracked_in_realization') ? 'm.tracked_in_realization' : '0'} AS tracked_in_realization,
         ${
           mappingColumns.has('tracked_post_implementation') ? 'm.tracked_post_implementation' : '1'
         } AS tracked_post_implementation,
         ${mappingColumns.has('observation_status') ? 'm.observation_status' : `'active'`} AS observation_status,
         ${
           mappingColumns.has('realization_baseline_value')
             ? 'm.realization_baseline_value'
             : 'k.baseline_value'
         } AS realization_baseline_value,
         ${
           mappingColumns.has('realization_target_value')
             ? 'm.realization_target_value'
             : 'k.target_value'
         } AS realization_target_value,
         ${
           mappingColumns.has('realization_measurement_frequency')
             ? 'm.realization_measurement_frequency'
             : 'k.measurement_frequency'
         } AS realization_measurement_frequency,
         ${
           mappingColumns.has('post_implementation_baseline_value')
             ? 'm.post_implementation_baseline_value'
             : 'k.baseline_value'
         } AS post_implementation_baseline_value,
         ${
           mappingColumns.has('post_implementation_target_value')
             ? 'm.post_implementation_target_value'
             : 'k.target_value'
         } AS post_implementation_target_value,
         ${
           mappingColumns.has('post_implementation_measurement_frequency')
             ? 'm.post_implementation_measurement_frequency'
             : 'k.measurement_frequency'
         } AS post_implementation_measurement_frequency
       FROM initiative_kpi_mappings m
       JOIN initiative_kpis k ON k.id = m.kpi_id
       JOIN initiatives i ON i.id = m.initiative_id
       WHERE m.organization_id = ? AND m.initiative_id = ? AND k.archived_at IS NULL
       ORDER BY k.created_at DESC`,
      [organizationId, organizationId, organizationId, initiativeId]
    );
    rows.push(...mappingRows);
  }

  const existingIds = new Set(rows.map((row) => String(row.kpi_id)));
  const legacyRows = await queryHelpers.queryAll<AssignmentQueryRow>(
    `SELECT
       NULL AS mapping_id,
       k.id AS kpi_id,
       k.initiative_id,
       i.status AS initiative_status,
       k.name,
       k.description,
       k.category,
       k.unit,
       k.baseline_value,
       k.target_value,
       k.current_value,
       (
         SELECT ts.value
         FROM kpi_time_series ts
         WHERE ts.kpi_id = k.id AND ts.organization_id = ?
         ORDER BY ts.period_start DESC, ts.created_at DESC
         LIMIT 1
       ) AS latest_value,
       (
         SELECT ts.period_start
         FROM kpi_time_series ts
         WHERE ts.kpi_id = k.id AND ts.organization_id = ?
         ORDER BY ts.period_start DESC, ts.created_at DESC
         LIMIT 1
       ) AS latest_measurement_date,
       ${kpiProgressExpr} AS progress_percentage,
       ${kpiStatusExpr} AS kpi_status,
       k.measurement_frequency,
       k.direction,
       k.created_at,
       k.updated_at,
       'initiative-custom' AS definition_source,
       'post-implementation' AS observation_phase,
       0 AS tracked_in_realization,
       1 AS tracked_post_implementation,
       'active' AS observation_status,
       k.baseline_value AS realization_baseline_value,
       k.target_value AS realization_target_value,
       k.measurement_frequency AS realization_measurement_frequency,
       k.baseline_value AS post_implementation_baseline_value,
       k.target_value AS post_implementation_target_value,
       k.measurement_frequency AS post_implementation_measurement_frequency
     FROM initiative_kpis k
     JOIN initiatives i ON i.id = k.initiative_id
     WHERE k.initiative_id = ?
       AND COALESCE(k.organization_id, i.organization_id) = ?
       AND k.archived_at IS NULL
     ORDER BY k.created_at DESC`,
    [organizationId, organizationId, initiativeId, organizationId]
  );

  for (const row of legacyRows) {
    if (!existingIds.has(String(row.kpi_id))) {
      rows.push(row);
    }
  }

  return rows.map(mapAssignmentRow);
}

export async function upsertInitiativeKpiAssignment(
  input: UpsertInitiativeKpiAssignmentInput
): Promise<InitiativeKpiAssignmentRead> {
  await assertInitiativeBelongsToOrg(input.initiativeId, input.organizationId);

  const mappingColumns = await getTableColumns('initiative_kpi_mappings');
  const kpiColumns = await getTableColumns('initiative_kpis');
  const trackedFlags = deriveTrackedFlags(
    input.observationPhase,
    input.trackedInRealization,
    input.trackedPostImplementation
  );
  const definitionSource =
    input.definitionSource || (input.kpiId ? 'library' : 'initiative-custom');
  const observationPhase =
    input.observationPhase ||
    deriveObservationPhase({
      trackedInRealization: trackedFlags.trackedInRealization,
      trackedPostImplementation: trackedFlags.trackedPostImplementation,
    });
  const baseFrequency = normalizeFrequency(input.measurementFrequency);
  const realizationExpectation: InitiativeKpiExpectation = {
    baselineValue:
      safeNumber(input.realizationExpectation?.baselineValue) ?? safeNumber(input.baselineValue),
    targetValue:
      safeNumber(input.realizationExpectation?.targetValue) ?? safeNumber(input.targetValue),
    measurementFrequency: normalizeFrequency(
      input.realizationExpectation?.measurementFrequency,
      baseFrequency
    ),
  };
  const postImplementationExpectation: InitiativeKpiExpectation = {
    baselineValue:
      safeNumber(input.postImplementationExpectation?.baselineValue) ??
      safeNumber(input.baselineValue),
    targetValue:
      safeNumber(input.postImplementationExpectation?.targetValue) ?? safeNumber(input.targetValue),
    measurementFrequency: normalizeFrequency(
      input.postImplementationExpectation?.measurementFrequency,
      baseFrequency
    ),
  };

  let kpiId = String(input.kpiId || '').trim();
  if (kpiId) {
    await assertKpiBelongsToOrg(kpiId, input.organizationId);
  } else {
    const name = String(input.name || '').trim();
    if (!name) {
      throw new Error('KPI name is required');
    }

    // RES-02: initiative_kpis is written EXCLUSIVELY through kpiDefinitionService
    // now — this used to build its own dynamic INSERT (a second, forked writer
    // of the canonical owner object). No SQL against initiative_kpis lives here
    // anymore; the definition + its immutable v1 version + audit entry are all
    // created transactionally by the canonical service.
    const created = await createDefinition({
      organizationId: input.organizationId,
      initiativeId: input.initiativeId,
      actorUserId: input.userId || null,
      name,
      description: input.description || null,
      unit: input.unit || null,
      category: input.category || 'benefits',
      baselineValue: safeNumber(input.baselineValue) ?? null,
      targetValue: safeNumber(input.targetValue) ?? null,
      currentValue: safeNumber(input.currentValue) ?? safeNumber(input.baselineValue) ?? null,
      measurementFrequency: baseFrequency,
      source: 'initiativeKpiAssignmentService',
      reason: 'initiative-kpi-assignment-create',
    });
    kpiId = created.id;
  }

  await upsertMapping(mappingColumns, {
    initiativeId: input.initiativeId,
    organizationId: input.organizationId,
    kpiId,
    userId: input.userId || null,
    definitionSource,
    observationPhase,
    trackedInRealization: trackedFlags.trackedInRealization,
    trackedPostImplementation: trackedFlags.trackedPostImplementation,
    observationStatus: input.observationStatus || 'active',
    realizationExpectation,
    postImplementationExpectation,
  });

  const assignments = await listInitiativeKpiAssignments(input.initiativeId, input.organizationId);
  const created = assignments.find((item) => item.id === kpiId);
  if (!created) {
    // In some postgres setups a read-after-write through mapping projections can be delayed
    // or partially unavailable; keep write path successful by returning a canonical fallback.
    return {
      id: kpiId,
      mappingId: null,
      initiativeId: input.initiativeId,
      initiativeStatus: null,
      name: String(input.name || ''),
      description: input.description || null,
      category: input.category || 'benefits',
      unit: input.unit || null,
      baselineValue: safeNumber(input.baselineValue),
      targetValue: safeNumber(input.targetValue),
      currentValue: safeNumber(input.currentValue) ?? safeNumber(input.baselineValue),
      latestValue: null,
      latestMeasurementDate: null,
      progressPercentage: 0,
      status: 'on_track',
      measurementFrequency: baseFrequency,
      isOnTarget: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      definitionSource,
      observationPhase,
      trackedInRealization: trackedFlags.trackedInRealization,
      trackedPostImplementation: trackedFlags.trackedPostImplementation,
      observationStatus: input.observationStatus || 'active',
      realizationExpectation,
      postImplementationExpectation,
    };
  }
  return created;
}

export async function updateInitiativeKpiAssignment(
  params: UpsertInitiativeKpiAssignmentInput & { kpiId: string }
): Promise<InitiativeKpiAssignmentRead> {
  await assertInitiativeBelongsToOrg(params.initiativeId, params.organizationId);
  await assertKpiBelongsToOrg(params.kpiId, params.organizationId);

  const kpiColumns = await getTableColumns('initiative_kpis');

  // RES-02: DEFINITION fields (name/description/category/unit/baseline/target/
  // measurement_frequency) go through the canonical, CAS-versioned service —
  // no direct SQL against initiative_kpis here anymore. `current_value` and
  // `progress_percentage` are measurement-derived, not definitional (contract
  // point 9: no rebuild of measurement writes beyond the version pin), so
  // they stay a separate, unversioned update below, unchanged in behavior.
  // Matches the ORIGINAL semantics exactly: passing an explicit `null` for a
  // definition field is a no-op (skip), same as before — only a real,
  // non-null value ever changes it via this endpoint.
  const definitionPatch: Record<string, unknown> = {};
  let hasDefinitionChange = false;
  const setDefinitionField = (key: string, value: unknown) => {
    if (value === undefined) return;
    definitionPatch[key] = value;
    hasDefinitionChange = true;
  };
  setDefinitionField(
    'name',
    params.name != null ? String(params.name).trim() || undefined : undefined
  );
  setDefinitionField('description', params.description != null ? params.description : undefined);
  setDefinitionField('category', params.category != null ? params.category : undefined);
  setDefinitionField('unit', params.unit != null ? params.unit : undefined);
  setDefinitionField(
    'baselineValue',
    params.baselineValue != null ? safeNumber(params.baselineValue) : undefined
  );
  setDefinitionField(
    'targetValue',
    params.targetValue != null ? safeNumber(params.targetValue) : undefined
  );
  setDefinitionField(
    'measurementFrequency',
    params.measurementFrequency != null
      ? normalizeFrequency(params.measurementFrequency)
      : undefined
  );

  if (hasDefinitionChange) {
    await updateDefinitionWithRetry(params.kpiId, params.organizationId, {
      ...(definitionPatch as Partial<KpiDefinitionFields>),
      actorUserId: params.userId || null,
      source: 'initiativeKpiAssignmentService',
      reason: 'initiative-kpi-assignment-update',
    });
  }

  const updates: string[] = [];
  const updateParams: unknown[] = [];
  const pushKpiUpdate = (column: string, value: unknown) => {
    if (!kpiColumns.has(column) || value === undefined) return;
    updates.push(`${column} = ?`);
    updateParams.push(value);
  };
  pushKpiUpdate(
    'current_value',
    params.currentValue != null ? safeNumber(params.currentValue) : undefined
  );
  const latestForProgress =
    params.currentValue != null
      ? safeNumber(params.currentValue)
      : params.currentValue === null
        ? null
        : undefined;
  const targetForProgress =
    params.targetValue != null
      ? safeNumber(params.targetValue)
      : params.targetValue === null
        ? null
        : undefined;
  if (kpiColumns.has('progress_percentage')) {
    if (latestForProgress !== undefined || targetForProgress !== undefined) {
      const currentRow = await queryHelpers.queryOne<{
        current_value: number | null;
        target_value: number | null;
      }>('SELECT current_value, target_value FROM initiative_kpis WHERE id = ?', [params.kpiId]);
      const effectiveLatest =
        latestForProgress !== undefined
          ? latestForProgress
          : safeNumber((currentRow as any)?.current_value ?? null);
      const effectiveTarget =
        targetForProgress !== undefined
          ? targetForProgress
          : safeNumber((currentRow as any)?.target_value ?? null);
      pushKpiUpdate(
        'progress_percentage',
        computeProgressPercentage({ latestValue: effectiveLatest, targetValue: effectiveTarget })
      );
    }
  }
  if (!hasDefinitionChange && kpiColumns.has('updated_at') && updates.length > 0) {
    updates.push('updated_at = ?');
    updateParams.push(new Date().toISOString());
  }

  if (updates.length > 0) {
    updateParams.push(params.kpiId);
    await queryHelpers.queryRun(
      `UPDATE initiative_kpis SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );
  }

  const existingAssignments = await listInitiativeKpiAssignments(
    params.initiativeId,
    params.organizationId
  );
  const existing = existingAssignments.find((item) => item.id === params.kpiId);
  await upsertInitiativeKpiAssignment({
    initiativeId: params.initiativeId,
    organizationId: params.organizationId,
    userId: params.userId,
    kpiId: params.kpiId,
    definitionSource: params.definitionSource || existing?.definitionSource || 'initiative-custom',
    observationPhase: params.observationPhase || existing?.observationPhase,
    trackedInRealization: params.trackedInRealization ?? existing?.trackedInRealization,
    trackedPostImplementation:
      params.trackedPostImplementation ?? existing?.trackedPostImplementation,
    observationStatus: params.observationStatus || existing?.observationStatus,
    realizationExpectation: params.realizationExpectation || existing?.realizationExpectation,
    postImplementationExpectation:
      params.postImplementationExpectation || existing?.postImplementationExpectation,
  });

  const refreshed = await listInitiativeKpiAssignments(params.initiativeId, params.organizationId);
  const updated = refreshed.find((item) => item.id === params.kpiId);
  if (!updated) {
    const rawCurrent = await queryHelpers.queryOne<{
      baseline_value: number | null;
      target_value: number | null;
      current_value: number | null;
      measurement_frequency: string | null;
      status: string | null;
      name: string | null;
      description: string | null;
      category: string | null;
      unit: string | null;
      created_at: string | null;
    }>('SELECT * FROM initiative_kpis WHERE id = ?', [params.kpiId]);
    const fallbackTarget =
      params.targetValue != null
        ? safeNumber(params.targetValue)
        : params.targetValue === null
          ? null
          : (safeNumber(rawCurrent?.target_value) ?? existing?.targetValue ?? null);
    const fallbackCurrent =
      params.currentValue != null
        ? safeNumber(params.currentValue)
        : params.currentValue === null
          ? null
          : (safeNumber(rawCurrent?.current_value) ??
            existing?.currentValue ??
            existing?.latestValue ??
            null);
    const fallbackFrequency = normalizeFrequency(
      params.measurementFrequency ??
        rawCurrent?.measurement_frequency ??
        existing?.measurementFrequency ??
        'MONTHLY'
    );
    const fallbackProgress = computeProgressPercentage({
      latestValue: fallbackCurrent,
      targetValue: fallbackTarget,
    });
    return {
      id: params.kpiId,
      mappingId: existing?.mappingId ?? null,
      initiativeId: params.initiativeId,
      initiativeStatus: existing?.initiativeStatus ?? null,
      name:
        params.name != null
          ? String(params.name)
          : String(rawCurrent?.name ?? existing?.name ?? ''),
      description: params.description ?? rawCurrent?.description ?? existing?.description ?? null,
      category: params.category ?? rawCurrent?.category ?? existing?.category ?? 'benefits',
      unit: params.unit ?? rawCurrent?.unit ?? existing?.unit ?? null,
      baselineValue:
        params.baselineValue != null
          ? safeNumber(params.baselineValue)
          : params.baselineValue === null
            ? null
            : (safeNumber(rawCurrent?.baseline_value) ?? existing?.baselineValue ?? null),
      targetValue: fallbackTarget,
      currentValue: fallbackCurrent,
      latestValue: fallbackCurrent,
      latestMeasurementDate: new Date().toISOString(),
      progressPercentage: fallbackProgress,
      status: String(rawCurrent?.status || existing?.status || 'on_track'),
      measurementFrequency: fallbackFrequency,
      isOnTarget: computeIsOnTarget({
        latestValue: fallbackCurrent,
        targetValue: fallbackTarget,
      }),
      createdAt: String(rawCurrent?.created_at || existing?.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      definitionSource:
        params.definitionSource || existing?.definitionSource || 'initiative-custom',
      observationPhase:
        params.observationPhase || existing?.observationPhase || 'post-implementation',
      trackedInRealization: params.trackedInRealization ?? existing?.trackedInRealization ?? false,
      trackedPostImplementation:
        params.trackedPostImplementation ?? existing?.trackedPostImplementation ?? true,
      observationStatus: params.observationStatus || existing?.observationStatus || 'active',
      realizationExpectation: params.realizationExpectation
        ? {
            baselineValue: safeNumber(params.realizationExpectation.baselineValue),
            targetValue: safeNumber(params.realizationExpectation.targetValue),
            measurementFrequency: normalizeFrequency(
              params.realizationExpectation.measurementFrequency,
              fallbackFrequency
            ),
          }
        : existing?.realizationExpectation || {
            baselineValue: null,
            targetValue: fallbackTarget,
            measurementFrequency: fallbackFrequency,
          },
      postImplementationExpectation: params.postImplementationExpectation
        ? {
            baselineValue: safeNumber(params.postImplementationExpectation.baselineValue),
            targetValue: safeNumber(params.postImplementationExpectation.targetValue),
            measurementFrequency: normalizeFrequency(
              params.postImplementationExpectation.measurementFrequency,
              fallbackFrequency
            ),
          }
        : existing?.postImplementationExpectation || {
            baselineValue: null,
            targetValue: fallbackTarget,
            measurementFrequency: fallbackFrequency,
          },
    };
  }
  return updated;
}

export async function deleteInitiativeKpiAssignment(params: {
  initiativeId: string;
  organizationId: string;
  kpiId: string;
}) {
  await assertInitiativeBelongsToOrg(params.initiativeId, params.organizationId);
  await assertKpiBelongsToOrg(params.kpiId, params.organizationId);

  const assignments = await listInitiativeKpiAssignments(
    params.initiativeId,
    params.organizationId
  );
  const existing = assignments.find((item) => item.id === params.kpiId);
  if (!existing) return;

  const mappingColumns = await getTableColumns('initiative_kpi_mappings');
  if (mappingColumns.size > 0) {
    await queryHelpers.queryRun(
      `DELETE FROM initiative_kpi_mappings WHERE initiative_id = ? AND kpi_id = ? AND organization_id = ?`,
      [params.initiativeId, params.kpiId, params.organizationId]
    );
  }

  const remainingMappings = mappingColumns.size
    ? await queryHelpers.queryOne<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?`,
        [params.kpiId, params.organizationId]
      )
    : { cnt: 0 };

  const shouldDeleteKpi =
    existing.definitionSource === 'initiative-custom' && Number(remainingMappings?.cnt || 0) === 0;

  // RES-02: "delete" of the canonical definition is ARCHIVE, not a hard
  // DELETE — history (every immutable version, every kpi_time_series row) is
  // preserved and stays readable. This used to hard-delete initiative_kpis
  // AND cascade-delete its kpi_time_series/kpi_deviation_cases, which is
  // exactly the history loss the RES-02 contract forbids.
  if (shouldDeleteKpi) {
    await archiveDefinition({
      organizationId: params.organizationId,
      kpiId: params.kpiId,
      reason: 'initiative-kpi-assignment-unassigned-and-orphaned',
    });
  }
}
