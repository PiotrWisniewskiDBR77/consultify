/**
 * V8 Reports & Presentations Operating Model Service
 *
 * Manages the unified output delivery lifecycle, template families,
 * recurring automation programs, and AI governance configs.
 * All queries enforce organization-level isolation.
 *
 * Decisions:
 *   W6-1 — shared AI governance layer with output-specific extensions
 *   W6-2 — separate Prompt OS presets per output type
 *   W6-3 — three canonical template families
 *   W6-4 — recurring: full for reports, bounded for presentations
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CreateOutputArtifactParams,
  CreateRecurringProgramParams,
  DeliveryPipelineSummary,
  OutputAIGovernanceConfig,
  OutputArtifact,
  OutputDeliveryState,
  OutputExportFormat,
  OutputExportRecord,
  OutputQualityScores,
  OutputType,
  RecurringOutputProgram,
  RecurringProgramHealth,
  RegisterTemplateFamilyParams,
  SetAIGovernanceConfigParams,
  TemplateFamily,
  TemplateUsageStat,
} from '../../types/reportsPresOperatingModel.js';
import {
  CreateOutputArtifactParamsSchema,
  CreateRecurringProgramParamsSchema,
  DELIVERY_TERMINAL_STATES,
  DELIVERY_VALID_TRANSITIONS,
  OutputDeliveryStateValues,
  OutputExportFormatValues,
  OutputTypeValues,
  RegisterTemplateFamilyParamsSchema,
  SetAIGovernanceConfigParamsSchema,
} from '../../types/reportsPresOperatingModel.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ReportsPresModel]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface ArtifactRow {
  artifact_id: string;
  organization_id: string;
  output_type: string;
  delivery_state: string;
  template_family_ref: string | null;
  source_initiative_id: string | null;
  ai_governance_preset_ref: string | null;
  created_by: string;
  created_at: string;
  last_transition_at: string;
}

interface TemplateFamilyRow {
  family_id: string;
  organization_id: string;
  family_name: string;
  report_form_ref: string | null;
  presentation_form_ref: string | null;
  governed_mapping_enabled: number;
  created_at: string;
}

interface RecurringProgramRow {
  program_id: string;
  organization_id: string;
  output_type: string;
  template_family_ref: string | null;
  cadence: string;
  source_data_binding: string;
  is_active: number;
  last_run_at: string | null;
  next_run_at: string | null;
  governance_level: string;
  created_at: string;
}

interface GovernanceConfigRow {
  config_id: string;
  organization_id: string;
  output_type: string;
  preset_ref: string;
  eval_gate_ref: string | null;
  quality_thresholds: string;
  created_at: string;
  updated_at: string;
}

interface ArtifactRowWithQuality extends ArtifactRow {
  quality_scores: string | null;
}

interface ExportRow {
  export_id: string;
  artifact_id: string;
  organization_id: string;
  format: string;
  requested_by: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface CountGroupRow {
  delivery_state?: string;
  output_type?: string;
  cnt: number;
}

interface AvgQualityRow {
  avg: number | null;
}

interface CountOnlyRow {
  cnt: number;
}

interface TemplateUsageRow {
  family_id: string;
  family_name: string;
  usage_count: number;
}

interface ExportStatusCountRow {
  status: string;
  c: number;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToArtifact(row: ArtifactRow): OutputArtifact {
  return {
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    outputType: row.output_type as OutputArtifact['outputType'],
    deliveryState: row.delivery_state as OutputArtifact['deliveryState'],
    templateFamilyRef: row.template_family_ref,
    sourceInitiativeId: row.source_initiative_id,
    aiGovernancePresetRef: row.ai_governance_preset_ref,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastTransitionAt: row.last_transition_at,
  };
}

function rowToTemplateFamily(row: TemplateFamilyRow): TemplateFamily {
  return {
    familyId: row.family_id,
    organizationId: row.organization_id,
    familyName: row.family_name as TemplateFamily['familyName'],
    reportFormRef: row.report_form_ref,
    presentationFormRef: row.presentation_form_ref,
    governedMappingEnabled: row.governed_mapping_enabled === 1,
    createdAt: row.created_at,
  };
}

function rowToRecurringProgram(row: RecurringProgramRow): RecurringOutputProgram {
  return {
    programId: row.program_id,
    organizationId: row.organization_id,
    outputType: row.output_type as RecurringOutputProgram['outputType'],
    templateFamilyRef: row.template_family_ref,
    cadence: row.cadence as RecurringOutputProgram['cadence'],
    sourceDataBinding: safeJsonParse(row.source_data_binding, {}),
    isActive: row.is_active === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    governanceLevel: row.governance_level as RecurringOutputProgram['governanceLevel'],
    createdAt: row.created_at,
  };
}

function rowToGovernanceConfig(row: GovernanceConfigRow): OutputAIGovernanceConfig {
  return {
    configId: row.config_id,
    organizationId: row.organization_id,
    outputType: row.output_type as OutputAIGovernanceConfig['outputType'],
    presetRef: row.preset_ref,
    evalGateRef: row.eval_gate_ref,
    qualityThresholds: safeJsonParse(row.quality_thresholds, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// STATE MACHINE VALIDATION
// ==========================================

function isValidDeliveryTransition(from: OutputDeliveryState, to: OutputDeliveryState): boolean {
  const allowed = DELIVERY_VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// PUBLIC API — Output Artifacts
// ==========================================

export async function createOutputArtifact(
  params: CreateOutputArtifactParams
): Promise<OutputArtifact> {
  const validated = CreateOutputArtifactParamsSchema.parse(params);

  const artifactId = uuidv4();
  const now = new Date().toISOString();

  const artifact: OutputArtifact = {
    artifactId,
    organizationId: validated.organizationId,
    outputType: validated.outputType,
    deliveryState: 'draft',
    templateFamilyRef: validated.templateFamilyRef,
    sourceInitiativeId: validated.sourceInitiativeId,
    aiGovernancePresetRef: validated.aiGovernancePresetRef,
    createdBy: validated.createdBy,
    createdAt: now,
    lastTransitionAt: now,
  };

  await dbRun(
    `INSERT INTO v8_output_artifacts (
      artifact_id, organization_id, output_type, delivery_state,
      template_family_ref, source_initiative_id, ai_governance_preset_ref,
      created_by, created_at, last_transition_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      artifact.artifactId,
      artifact.organizationId,
      artifact.outputType,
      artifact.deliveryState,
      artifact.templateFamilyRef,
      artifact.sourceInitiativeId,
      artifact.aiGovernancePresetRef,
      artifact.createdBy,
      artifact.createdAt,
      artifact.lastTransitionAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created ${validated.outputType} artifact ${artifactId} for org ${validated.organizationId}`
  );
  return artifact;
}

export async function transitionDeliveryState(
  artifactId: string,
  organizationId: string,
  newState: OutputDeliveryState
): Promise<OutputArtifact> {
  const artifact = await getOutputArtifact(artifactId, organizationId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const fromState = artifact.deliveryState;

  if (DELIVERY_TERMINAL_STATES.has(fromState)) {
    throw new Error(
      `Cannot transition artifact ${artifactId}: current state '${fromState}' is terminal`
    );
  }

  if (!isValidDeliveryTransition(fromState, newState)) {
    throw new Error(
      `Invalid delivery transition: ${fromState} → ${newState}. ` +
        `Allowed from ${fromState}: [${DELIVERY_VALID_TRANSITIONS[fromState].join(', ')}]`
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_output_artifacts
     SET delivery_state = ?, last_transition_at = ?
     WHERE artifact_id = ? AND organization_id = ?`,
    [newState, now, artifactId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Artifact ${artifactId}: ${fromState} → ${newState}`);

  return {
    ...artifact,
    deliveryState: newState,
    lastTransitionAt: now,
  };
}

export async function getOutputArtifact(
  artifactId: string,
  organizationId: string
): Promise<OutputArtifact | null> {
  const row = await dbGet<ArtifactRow>(
    `SELECT * FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToArtifact(row);
}

// ==========================================
// PUBLIC API — Template Families (Decision W6-3)
// ==========================================

export async function registerTemplateFamily(
  params: RegisterTemplateFamilyParams
): Promise<TemplateFamily> {
  const validated = RegisterTemplateFamilyParamsSchema.parse(params);

  const familyId = uuidv4();
  const now = new Date().toISOString();

  const family: TemplateFamily = {
    familyId,
    organizationId: validated.organizationId,
    familyName: validated.familyName,
    reportFormRef: validated.reportFormRef,
    presentationFormRef: validated.presentationFormRef,
    governedMappingEnabled: validated.governedMappingEnabled,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_template_families (
      family_id, organization_id, family_name,
      report_form_ref, presentation_form_ref,
      governed_mapping_enabled, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      family.familyId,
      family.organizationId,
      family.familyName,
      family.reportFormRef,
      family.presentationFormRef,
      family.governedMappingEnabled ? 1 : 0,
      family.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered template family '${validated.familyName}' (${familyId}) for org ${validated.organizationId}`
  );
  return family;
}

export async function getTemplateFamilies(organizationId: string): Promise<TemplateFamily[]> {
  const rows = await dbAll<TemplateFamilyRow>(
    `SELECT * FROM v8_template_families
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToTemplateFamily);
}

// ==========================================
// PUBLIC API — Recurring Output Programs (Decision W6-4)
// ==========================================

export async function createRecurringProgram(
  params: CreateRecurringProgramParams
): Promise<RecurringOutputProgram> {
  const validated = CreateRecurringProgramParamsSchema.parse(params);

  if (validated.outputType === 'presentation' && validated.governanceLevel !== 'strict') {
    throw new Error('Recurring presentation programs require strict governance (Decision W6-4)');
  }

  const programId = uuidv4();
  const now = new Date().toISOString();

  const program: RecurringOutputProgram = {
    programId,
    organizationId: validated.organizationId,
    outputType: validated.outputType,
    templateFamilyRef: validated.templateFamilyRef,
    cadence: validated.cadence,
    sourceDataBinding: validated.sourceDataBinding,
    isActive: true,
    lastRunAt: null,
    nextRunAt: null,
    governanceLevel: validated.outputType === 'presentation' ? 'strict' : validated.governanceLevel,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_recurring_output_programs (
      program_id, organization_id, output_type, template_family_ref,
      cadence, source_data_binding, is_active,
      last_run_at, next_run_at, governance_level, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      program.programId,
      program.organizationId,
      program.outputType,
      program.templateFamilyRef,
      program.cadence,
      JSON.stringify(program.sourceDataBinding),
      program.isActive ? 1 : 0,
      program.lastRunAt,
      program.nextRunAt,
      program.governanceLevel,
      program.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created recurring ${validated.outputType} program ${programId} for org ${validated.organizationId}`
  );
  return program;
}

export async function getRecurringPrograms(
  organizationId: string
): Promise<RecurringOutputProgram[]> {
  const rows = await dbAll<RecurringProgramRow>(
    `SELECT * FROM v8_recurring_output_programs
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToRecurringProgram);
}

// ==========================================
// PUBLIC API — AI Governance (Decisions W6-1, W6-2)
// ==========================================

export async function setAIGovernanceConfig(
  params: SetAIGovernanceConfigParams
): Promise<OutputAIGovernanceConfig> {
  const validated = SetAIGovernanceConfigParamsSchema.parse(params);

  const existing = await getAIGovernanceConfig(validated.outputType, validated.organizationId);
  const now = new Date().toISOString();

  if (existing) {
    await dbRun(
      `UPDATE v8_output_ai_governance
       SET preset_ref = ?, eval_gate_ref = ?, quality_thresholds = ?, updated_at = ?
       WHERE config_id = ? AND organization_id = ?`,
      [
        validated.presetRef,
        validated.evalGateRef,
        JSON.stringify(validated.qualityThresholds),
        now,
        existing.configId,
        validated.organizationId,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Updated AI governance for ${validated.outputType} in org ${validated.organizationId}`
    );

    return {
      ...existing,
      presetRef: validated.presetRef,
      evalGateRef: validated.evalGateRef,
      qualityThresholds: validated.qualityThresholds,
      updatedAt: now,
    };
  }

  const configId = uuidv4();

  const config: OutputAIGovernanceConfig = {
    configId,
    organizationId: validated.organizationId,
    outputType: validated.outputType,
    presetRef: validated.presetRef,
    evalGateRef: validated.evalGateRef,
    qualityThresholds: validated.qualityThresholds,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_output_ai_governance (
      config_id, organization_id, output_type,
      preset_ref, eval_gate_ref, quality_thresholds,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      config.configId,
      config.organizationId,
      config.outputType,
      config.presetRef,
      config.evalGateRef,
      JSON.stringify(config.qualityThresholds),
      config.createdAt,
      config.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created AI governance for ${validated.outputType} in org ${validated.organizationId}`
  );
  return config;
}

export async function getAIGovernanceConfig(
  outputType: string,
  organizationId: string
): Promise<OutputAIGovernanceConfig | null> {
  const row = await dbGet<GovernanceConfigRow>(
    `SELECT * FROM v8_output_ai_governance
     WHERE output_type = ? AND organization_id = ?`,
    [outputType, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToGovernanceConfig(row);
}

// ==========================================
// PUBLIC API — Output runtime (Wave 17)
// ==========================================

const OUTPUT_EXPORT_FORMAT_SET = new Set<string>(OutputExportFormatValues);

function clampArtifactQueryLimit(limit?: number): number {
  const raw = limit === undefined ? 100 : limit;
  return Math.min(Math.max(raw, 1), 1000);
}

function assertQualityScores(scores: OutputQualityScores): void {
  const keys: (keyof OutputQualityScores)[] = [
    'contentScore',
    'designScore',
    'dataAccuracy',
    'overallScore',
  ];
  for (const k of keys) {
    if (typeof scores[k] !== 'number' || !Number.isFinite(scores[k])) {
      throw new Error(`Invalid quality score field: ${String(k)}`);
    }
  }
}

function rowToExport(row: ExportRow): OutputExportRecord {
  return {
    exportId: row.export_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    format: row.format as OutputExportFormat,
    requestedBy: row.requested_by,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function getArtifactsByOrg(
  organizationId: string,
  outputType?: OutputType,
  state?: OutputDeliveryState,
  limit?: number
): Promise<OutputArtifact[]> {
  if (outputType !== undefined && !(OutputTypeValues as readonly string[]).includes(outputType)) {
    throw new Error(`Invalid outputType filter: ${outputType}`);
  }
  if (state !== undefined && !(OutputDeliveryStateValues as readonly string[]).includes(state)) {
    throw new Error(`Invalid delivery state filter: ${state}`);
  }

  const lim = clampArtifactQueryLimit(limit);
  const clauses: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  if (outputType !== undefined) {
    clauses.push('output_type = ?');
    params.push(outputType);
  }
  if (state !== undefined) {
    clauses.push('delivery_state = ?');
    params.push(state);
  }

  const sql = `SELECT artifact_id, organization_id, output_type, delivery_state,
      template_family_ref, source_initiative_id, ai_governance_preset_ref,
      created_by, created_at, last_transition_at
    FROM v8_output_artifacts
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ?`;

  params.push(lim);

  const rows = await dbAll<ArtifactRow>(sql, params, { fallback: true });
  return (rows || []).map(rowToArtifact);
}

export async function getArtifactsByTemplate(
  templateFamilyId: string,
  organizationId: string,
  limit?: number
): Promise<OutputArtifact[]> {
  const lim = clampArtifactQueryLimit(limit);
  const rows = await dbAll<ArtifactRow>(
    `SELECT artifact_id, organization_id, output_type, delivery_state,
      template_family_ref, source_initiative_id, ai_governance_preset_ref,
      created_by, created_at, last_transition_at
    FROM v8_output_artifacts
    WHERE template_family_ref = ? AND organization_id = ?
    ORDER BY created_at DESC
    LIMIT ?`,
    [templateFamilyId, organizationId, lim],
    { fallback: true }
  );

  return (rows || []).map(rowToArtifact);
}

export async function cloneArtifact(
  artifactId: string,
  organizationId: string,
  clonedBy: string
): Promise<OutputArtifact> {
  const row = await dbGet<ArtifactRowWithQuality>(
    `SELECT * FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const newId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_output_artifacts (
      artifact_id, organization_id, output_type, delivery_state,
      template_family_ref, source_initiative_id, ai_governance_preset_ref,
      created_by, created_at, last_transition_at, quality_scores
    ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL)`,
    [
      newId,
      organizationId,
      row.output_type,
      row.template_family_ref,
      row.source_initiative_id,
      row.ai_governance_preset_ref,
      clonedBy,
      now,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Cloned artifact ${artifactId} → ${newId} for org ${organizationId}`);

  return {
    artifactId: newId,
    organizationId,
    outputType: row.output_type as OutputArtifact['outputType'],
    deliveryState: 'draft',
    templateFamilyRef: row.template_family_ref,
    sourceInitiativeId: row.source_initiative_id,
    aiGovernancePresetRef: row.ai_governance_preset_ref,
    createdBy: clonedBy,
    createdAt: now,
    lastTransitionAt: now,
  };
}

export async function scoreArtifactQuality(
  artifactId: string,
  organizationId: string,
  scores: OutputQualityScores
): Promise<void> {
  assertQualityScores(scores);
  const existing = await getOutputArtifact(artifactId, organizationId);
  if (!existing) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const payload = JSON.stringify({
    ...scores,
    recordedAt: new Date().toISOString(),
  });

  await dbRun(
    `UPDATE v8_output_artifacts
     SET quality_scores = ?
     WHERE artifact_id = ? AND organization_id = ?`,
    [payload, artifactId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Recorded quality scores for artifact ${artifactId}`);
}

export async function getQualityScores(
  artifactId: string,
  organizationId: string
): Promise<OutputQualityScores | null> {
  const row = await dbGet<{ quality_scores: string | null }>(
    `SELECT quality_scores FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true }
  );

  if (!row?.quality_scores) return null;

  const parsed = safeJsonParse<Record<string, unknown>>(row.quality_scores, {});
  const out: OutputQualityScores = {
    contentScore: Number(parsed.contentScore),
    designScore: Number(parsed.designScore),
    dataAccuracy: Number(parsed.dataAccuracy),
    overallScore: Number(parsed.overallScore),
  };

  if (
    !Number.isFinite(out.contentScore) ||
    !Number.isFinite(out.designScore) ||
    !Number.isFinite(out.dataAccuracy) ||
    !Number.isFinite(out.overallScore)
  ) {
    return null;
  }

  return out;
}

export async function scheduleExport(
  artifactId: string,
  organizationId: string,
  format: OutputExportFormat,
  requestedBy: string
): Promise<OutputExportRecord> {
  if (!OUTPUT_EXPORT_FORMAT_SET.has(format)) {
    throw new Error(`Invalid export format: ${format}`);
  }

  const artifact = await getOutputArtifact(artifactId, organizationId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const exportId = uuidv4();
  const now = new Date().toISOString();

  const record: OutputExportRecord = {
    exportId,
    artifactId,
    organizationId,
    format,
    requestedBy,
    status: 'pending',
    createdAt: now,
    completedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_output_exports (
      export_id, artifact_id, organization_id, format,
      requested_by, status, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [exportId, artifactId, organizationId, format, requestedBy, 'pending', now, null]
  );

  logger.info(`${LOG_PREFIX} Scheduled ${format} export ${exportId} for artifact ${artifactId}`);
  return record;
}

export async function recordCompletedExport(
  artifactId: string,
  organizationId: string,
  format: OutputExportFormat,
  requestedBy: string
): Promise<OutputExportRecord> {
  if (!OUTPUT_EXPORT_FORMAT_SET.has(format)) {
    throw new Error(`Invalid export format: ${format}`);
  }

  const artifact = await getOutputArtifact(artifactId, organizationId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const exportId = uuidv4();
  const now = new Date().toISOString();

  const record: OutputExportRecord = {
    exportId,
    artifactId,
    organizationId,
    format,
    requestedBy,
    status: 'completed',
    createdAt: now,
    completedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_output_exports (
      export_id, artifact_id, organization_id, format,
      requested_by, status, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [exportId, artifactId, organizationId, format, requestedBy, 'completed', now, now]
  );

  logger.info(
    `${LOG_PREFIX} Recorded completed ${format} export ${exportId} for artifact ${artifactId}`
  );
  return record;
}

export async function recordFailedExport(
  artifactId: string,
  organizationId: string,
  format: OutputExportFormat,
  requestedBy: string
): Promise<OutputExportRecord> {
  if (!OUTPUT_EXPORT_FORMAT_SET.has(format)) {
    throw new Error(`Invalid export format: ${format}`);
  }

  const artifact = await getOutputArtifact(artifactId, organizationId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const exportId = uuidv4();
  const now = new Date().toISOString();

  const record: OutputExportRecord = {
    exportId,
    artifactId,
    organizationId,
    format,
    requestedBy,
    status: 'failed',
    createdAt: now,
    completedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_output_exports (
      export_id, artifact_id, organization_id, format,
      requested_by, status, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [exportId, artifactId, organizationId, format, requestedBy, 'failed', now, now]
  );

  logger.warn(`${LOG_PREFIX} Recorded failed ${format} export ${exportId} for artifact ${artifactId}`);
  return record;
}

export async function getExportHistory(
  artifactId: string,
  organizationId: string
): Promise<OutputExportRecord[]> {
  const rows = await dbAll<ExportRow>(
    `SELECT * FROM v8_output_exports
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [artifactId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToExport);
}

export async function getDeliveryPipeline(
  organizationId: string
): Promise<DeliveryPipelineSummary> {
  const stateRows = await dbAll<CountGroupRow>(
    `SELECT delivery_state, COUNT(*) as cnt FROM v8_output_artifacts
     WHERE organization_id = ? GROUP BY delivery_state`,
    [organizationId],
    { fallback: true }
  );

  const typeRows = await dbAll<CountGroupRow>(
    `SELECT output_type, COUNT(*) as cnt FROM v8_output_artifacts
     WHERE organization_id = ? GROUP BY output_type`,
    [organizationId],
    { fallback: true }
  );

  const avgRow = await dbGet<AvgQualityRow>(
    `SELECT AVG(CAST(quality_scores::jsonb->>'overallScore' AS DOUBLE PRECISION)) as avg
     FROM v8_output_artifacts
     WHERE organization_id = ?
       AND quality_scores IS NOT NULL
       AND quality_scores::jsonb->>'overallScore' IS NOT NULL`,
    [organizationId],
    { fallback: true }
  );

  const pendingRow = await dbGet<CountOnlyRow>(
    `SELECT COUNT(*) as cnt FROM v8_output_exports
     WHERE organization_id = ? AND status = 'pending'`,
    [organizationId],
    { fallback: true }
  );

  const artifactsByState: Record<string, number> = {};
  for (const r of stateRows || []) {
    if (r.delivery_state !== undefined) {
      artifactsByState[r.delivery_state] = r.cnt;
    }
  }

  const artifactsByOutputType: Record<string, number> = {};
  for (const r of typeRows || []) {
    if (r.output_type !== undefined) {
      artifactsByOutputType[r.output_type] = r.cnt;
    }
  }

  let averageQualityScore: number | null = null;
  if (avgRow?.avg != null && Number.isFinite(Number(avgRow.avg))) {
    averageQualityScore = Number(avgRow.avg);
  }

  return {
    artifactsByState,
    artifactsByOutputType,
    averageQualityScore,
    pendingExports: pendingRow?.cnt ?? 0,
  };
}

export async function getRecurringProgramHealth(
  programId: string,
  organizationId: string
): Promise<RecurringProgramHealth | null> {
  const row = await dbGet<RecurringProgramRow>(
    `SELECT * FROM v8_recurring_output_programs
     WHERE program_id = ? AND organization_id = ?`,
    [programId, organizationId],
    { fallback: true }
  );

  if (!row) return null;

  let successRate: number | null = null;
  if (row.template_family_ref) {
    const statusRows = await dbAll<ExportStatusCountRow>(
      `SELECT e.status as status, COUNT(*) as c
       FROM v8_output_exports e
       INNER JOIN v8_output_artifacts a
         ON a.artifact_id = e.artifact_id AND a.organization_id = e.organization_id
       WHERE e.organization_id = ?
         AND a.template_family_ref = ?
         AND e.status IN ('completed', 'failed')`,
      [organizationId, row.template_family_ref],
      { fallback: true }
    );

    let completed = 0;
    let failed = 0;
    for (const s of statusRows || []) {
      if (s.status === 'completed') completed += s.c;
      if (s.status === 'failed') failed += s.c;
    }
    const finished = completed + failed;
    if (finished > 0) {
      successRate = completed / finished;
    }
  }

  return {
    programId: row.program_id,
    organizationId: row.organization_id,
    isActive: row.is_active === 1,
    lastExecution: row.last_run_at,
    nextScheduled: row.next_run_at,
    successRate,
  };
}

export async function getTemplateUsageStats(organizationId: string): Promise<TemplateUsageStat[]> {
  const rows = await dbAll<TemplateUsageRow>(
    `SELECT tf.family_id, tf.family_name,
            COUNT(a.artifact_id) as usage_count
     FROM v8_template_families tf
     LEFT JOIN v8_output_artifacts a
       ON a.template_family_ref = tf.family_id AND a.organization_id = tf.organization_id
     WHERE tf.organization_id = ?
     GROUP BY tf.family_id, tf.family_name
     ORDER BY usage_count DESC, tf.family_name ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map((r) => ({
    familyId: r.family_id,
    familyName: r.family_name as TemplateUsageStat['familyName'],
    usageCount: r.usage_count,
  }));
}
