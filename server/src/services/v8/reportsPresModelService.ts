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
  OutputAIGovernanceConfig,
  OutputArtifact,
  OutputDeliveryState,
  RecurringOutputProgram,
  RegisterTemplateFamilyParams,
  SetAIGovernanceConfigParams,
  TemplateFamily,
} from '../../types/reportsPresOperatingModel.js';
import {
  CreateOutputArtifactParamsSchema,
  CreateRecurringProgramParamsSchema,
  DELIVERY_TERMINAL_STATES,
  DELIVERY_VALID_TRANSITIONS,
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
  params: CreateOutputArtifactParams,
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
    ],
  );

  logger.info(`${LOG_PREFIX} Created ${validated.outputType} artifact ${artifactId} for org ${validated.organizationId}`);
  return artifact;
}

export async function transitionDeliveryState(
  artifactId: string,
  organizationId: string,
  newState: OutputDeliveryState,
): Promise<OutputArtifact> {
  const artifact = await getOutputArtifact(artifactId, organizationId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} not found in organization ${organizationId}`);
  }

  const fromState = artifact.deliveryState;

  if (DELIVERY_TERMINAL_STATES.has(fromState)) {
    throw new Error(
      `Cannot transition artifact ${artifactId}: current state '${fromState}' is terminal`,
    );
  }

  if (!isValidDeliveryTransition(fromState, newState)) {
    throw new Error(
      `Invalid delivery transition: ${fromState} → ${newState}. ` +
      `Allowed from ${fromState}: [${DELIVERY_VALID_TRANSITIONS[fromState].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_output_artifacts
     SET delivery_state = ?, last_transition_at = ?
     WHERE artifact_id = ? AND organization_id = ?`,
    [newState, now, artifactId, organizationId],
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
  organizationId: string,
): Promise<OutputArtifact | null> {
  const row = await dbGet<ArtifactRow>(
    `SELECT * FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToArtifact(row);
}

// ==========================================
// PUBLIC API — Template Families (Decision W6-3)
// ==========================================

export async function registerTemplateFamily(
  params: RegisterTemplateFamilyParams,
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
    ],
  );

  logger.info(`${LOG_PREFIX} Registered template family '${validated.familyName}' (${familyId}) for org ${validated.organizationId}`);
  return family;
}

export async function getTemplateFamilies(organizationId: string): Promise<TemplateFamily[]> {
  const rows = await dbAll<TemplateFamilyRow>(
    `SELECT * FROM v8_template_families
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToTemplateFamily);
}

// ==========================================
// PUBLIC API — Recurring Output Programs (Decision W6-4)
// ==========================================

export async function createRecurringProgram(
  params: CreateRecurringProgramParams,
): Promise<RecurringOutputProgram> {
  const validated = CreateRecurringProgramParamsSchema.parse(params);

  if (validated.outputType === 'presentation' && validated.governanceLevel !== 'strict') {
    throw new Error(
      'Recurring presentation programs require strict governance (Decision W6-4)',
    );
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
    ],
  );

  logger.info(`${LOG_PREFIX} Created recurring ${validated.outputType} program ${programId} for org ${validated.organizationId}`);
  return program;
}

export async function getRecurringPrograms(organizationId: string): Promise<RecurringOutputProgram[]> {
  const rows = await dbAll<RecurringProgramRow>(
    `SELECT * FROM v8_recurring_output_programs
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToRecurringProgram);
}

// ==========================================
// PUBLIC API — AI Governance (Decisions W6-1, W6-2)
// ==========================================

export async function setAIGovernanceConfig(
  params: SetAIGovernanceConfigParams,
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
      ],
    );

    logger.info(`${LOG_PREFIX} Updated AI governance for ${validated.outputType} in org ${validated.organizationId}`);

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
    ],
  );

  logger.info(`${LOG_PREFIX} Created AI governance for ${validated.outputType} in org ${validated.organizationId}`);
  return config;
}

export async function getAIGovernanceConfig(
  outputType: string,
  organizationId: string,
): Promise<OutputAIGovernanceConfig | null> {
  const row = await dbGet<GovernanceConfigRow>(
    `SELECT * FROM v8_output_ai_governance
     WHERE output_type = ? AND organization_id = ?`,
    [outputType, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToGovernanceConfig(row);
}
