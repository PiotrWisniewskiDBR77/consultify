import { v4 as uuidv4 } from 'uuid';

import { InitiativeStatus } from '../../constants/initiativeStatuses.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { type Conclusion, conclusionService } from '../conclusions/ConclusionService.js';
import { createInitiative as funnelCreateInitiative } from '../initiative/createInitiativeService.js';

export type ConversionStatus =
  | 'draft'
  | 'proposed'
  | 'approved'
  | 'converted'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface ArtifactConversion {
  id: string;
  organizationId: string;
  projectId?: string | null;
  sourceConclusionId?: string | null;
  sourceArtifactType: string;
  sourceArtifactId: string;
  sourceArtifactTitle: string;
  sourceModule: string;
  targetArtifactType: string;
  targetArtifactId?: string | null;
  conversionIntent: string;
  conversionStatus: ConversionStatus;
  confidenceLevel?: string | null;
  limits?: string | null;
  evidenceRefs: unknown[];
  sourcePack: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdBy: string;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
}

interface ArtifactConversionRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  source_conclusion_id?: string | null;
  source_artifact_type: string;
  source_artifact_id: string;
  source_artifact_title: string;
  source_module: string;
  target_artifact_type: string;
  target_artifact_id?: string | null;
  conversion_intent: string;
  conversion_status: ConversionStatus;
  confidence_level?: string | null;
  limits_text?: string | null;
  evidence_refs_json?: string | null;
  source_pack_json?: string | null;
  payload_json?: string | null;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
}

let ensureTablesPromise: Promise<void> | null = null;

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToConversion(row: ArtifactConversionRow): ArtifactConversion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id ?? null,
    sourceConclusionId: row.source_conclusion_id ?? null,
    sourceArtifactType: row.source_artifact_type,
    sourceArtifactId: row.source_artifact_id,
    sourceArtifactTitle: row.source_artifact_title,
    sourceModule: row.source_module,
    targetArtifactType: row.target_artifact_type,
    targetArtifactId: row.target_artifact_id ?? null,
    conversionIntent: row.conversion_intent,
    conversionStatus: row.conversion_status,
    confidenceLevel: row.confidence_level ?? null,
    limits: row.limits_text ?? null,
    evidenceRefs: safeJson<unknown[]>(row.evidence_refs_json, []),
    sourcePack: safeJson<Record<string, unknown>>(row.source_pack_json, {}),
    payload: safeJson<Record<string, unknown>>(row.payload_json, {}),
    createdBy: row.created_by,
    approvedBy: row.approved_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    errorMessage: row.error_message ?? null,
  };
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await conclusionService.ensureReady();
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS artifact_conversions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          source_conclusion_id TEXT,
          source_artifact_type TEXT NOT NULL,
          source_artifact_id TEXT NOT NULL,
          source_artifact_title TEXT NOT NULL,
          source_module TEXT NOT NULL,
          target_artifact_type TEXT NOT NULL,
          target_artifact_id TEXT,
          conversion_intent TEXT NOT NULL,
          conversion_status TEXT NOT NULL DEFAULT 'proposed',
          confidence_level TEXT,
          limits_text TEXT,
          evidence_refs_json TEXT NOT NULL DEFAULT '[]',
          source_pack_json TEXT NOT NULL DEFAULT '{}',
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_by TEXT NOT NULL,
          approved_by TEXT,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_artifact_conversions_source
         ON artifact_conversions(organization_id, source_artifact_type, source_artifact_id)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_artifact_conversions_target
         ON artifact_conversions(organization_id, target_artifact_type, target_artifact_id)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_artifact_conversions_status
         ON artifact_conversions(organization_id, conversion_status)`
      );
    })();
  }
  return ensureTablesPromise;
}

function getPrimarySource(conclusion: Conclusion): { type: string; id: string; title: string } {
  const primary = conclusion.sourceArtifactRefs[0];
  return {
    type: primary?.type || 'conclusion',
    id: primary?.id || conclusion.id,
    title: primary?.title || conclusion.title,
  };
}

export function canConvertToInitiative(conclusion: Conclusion): {
  allowed: boolean;
  reason?: string;
} {
  if (conclusion.confidenceLevel === 'insufficient') {
    return { allowed: false, reason: 'Conclusion needs evidence before initiative conversion.' };
  }
  if (conclusion.confidenceLevel === 'contradicted') {
    return {
      allowed: false,
      reason:
        'Contradicted conclusion must be resolved or converted to an investigation note first.',
    };
  }
  if (!conclusion.limits || conclusion.evidenceRefs.length === 0) {
    return {
      allowed: false,
      reason: 'Evidence and limits are required before initiative conversion.',
    };
  }
  return { allowed: true };
}

export function buildInitiativePayload(conclusion: Conclusion): Record<string, unknown> {
  const evidenceCount = conclusion.evidenceRefs.length;
  return {
    title: conclusion.title,
    summary: conclusion.statement,
    hypothesis: conclusion.recommendedNextAction || conclusion.statement,
    problemStatement: conclusion.statement,
    keyRisks: conclusion.limits ? [conclusion.limits] : [],
    successCriteria: conclusion.recommendedNextAction ? [conclusion.recommendedNextAction] : [],
    deliverables: ['Clarified initiative intake from Wnioski conversion'],
    confidenceLevel: conclusion.confidenceLevel,
    status: InitiativeStatus.DRAFT,
    sourceType: 'conclusion',
    sourceId: conclusion.id,
    sourceContext: {
      conclusionId: conclusion.id,
      sourceModule: conclusion.sourceModule,
      sourceArtifactRefs: conclusion.sourceArtifactRefs,
      evidenceCount,
      limits: conclusion.limits,
      recommendedNextAction: conclusion.recommendedNextAction,
    },
  };
}

export class ArtifactConversionService {
  async ensureReady(): Promise<void> {
    await ensureTables();
  }

  async proposeConversion(params: {
    organizationId: string;
    actorUserId: string;
    conclusionId: string;
    targetArtifactType: 'initiative';
    intent?: string;
  }): Promise<{ conversion?: ArtifactConversion; error?: string }> {
    await ensureTables();
    const conclusion = await conclusionService.getConclusion(
      params.organizationId,
      params.conclusionId,
      params.actorUserId
    );
    if (!conclusion) return { error: 'Conclusion not found' };

    const source = getPrimarySource(conclusion);
    const targetPayload = buildInitiativePayload(conclusion);
    const now = new Date().toISOString();
    const id = uuidv4();
    const validation = canConvertToInitiative(conclusion);
    const status: ConversionStatus = validation.allowed ? 'proposed' : 'failed';

    await queryHelpers.queryRun(
      `INSERT INTO artifact_conversions (
        id, organization_id, project_id, source_conclusion_id, source_artifact_type,
        source_artifact_id, source_artifact_title, source_module, target_artifact_type,
        conversion_intent, conversion_status, confidence_level, limits_text, evidence_refs_json,
        source_pack_json, payload_json, created_by, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        conclusion.projectId ?? null,
        conclusion.id,
        source.type,
        source.id,
        source.title,
        conclusion.sourceModule,
        params.targetArtifactType,
        params.intent || 'Create initiative intake from conclusion',
        status,
        conclusion.confidenceLevel,
        conclusion.limits,
        JSON.stringify(conclusion.evidenceRefs),
        JSON.stringify({
          conclusionId: conclusion.id,
          sourceArtifactRefs: conclusion.sourceArtifactRefs,
          evidenceRefs: conclusion.evidenceRefs,
          limits: conclusion.limits,
        }),
        JSON.stringify(targetPayload),
        params.actorUserId,
        validation.reason || null,
        now,
        now,
      ]
    );

    const conversion = await this.getConversion(params.organizationId, id);
    return conversion
      ? { conversion, error: validation.reason }
      : { error: 'Conversion not found' };
  }

  async getConversion(
    organizationId: string,
    conversionId: string
  ): Promise<ArtifactConversion | null> {
    await ensureTables();
    const row = await queryHelpers.queryOne<ArtifactConversionRow>(
      `SELECT * FROM artifact_conversions WHERE id = ? AND organization_id = ?`,
      [conversionId, organizationId]
    );
    return row ? rowToConversion(row) : null;
  }

  async listConversions(params: {
    organizationId: string;
    sourceConclusionId?: string;
    sourceArtifactType?: string;
    sourceArtifactId?: string;
    targetArtifactType?: string;
    targetArtifactId?: string;
  }): Promise<ArtifactConversion[]> {
    await ensureTables();
    const clauses = ['organization_id = ?'];
    const values: unknown[] = [params.organizationId];
    if (params.sourceConclusionId) {
      clauses.push('source_conclusion_id = ?');
      values.push(params.sourceConclusionId);
    }
    if (params.sourceArtifactType) {
      clauses.push('source_artifact_type = ?');
      values.push(params.sourceArtifactType);
    }
    if (params.sourceArtifactId) {
      clauses.push('source_artifact_id = ?');
      values.push(params.sourceArtifactId);
    }
    if (params.targetArtifactType) {
      clauses.push('target_artifact_type = ?');
      values.push(params.targetArtifactType);
    }
    if (params.targetArtifactId) {
      clauses.push('target_artifact_id = ?');
      values.push(params.targetArtifactId);
    }
    const rows = await queryHelpers.queryAll<ArtifactConversionRow>(
      `SELECT * FROM artifact_conversions WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`,
      values
    );
    return rows.map(rowToConversion);
  }

  async recordCompletedConversion(params: {
    organizationId: string;
    actorUserId: string;
    sourceConclusionId?: string | null;
    sourceArtifactType: string;
    sourceArtifactId: string;
    sourceArtifactTitle: string;
    sourceModule: string;
    targetArtifactType: string;
    targetArtifactId: string;
    conversionIntent: string;
    projectId?: string | null;
    confidenceLevel?: string | null;
    limits?: string | null;
    evidenceRefs?: unknown[];
    sourcePack?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }): Promise<ArtifactConversion> {
    await ensureTables();
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO artifact_conversions (
        id, organization_id, project_id, source_conclusion_id, source_artifact_type,
        source_artifact_id, source_artifact_title, source_module, target_artifact_type,
        target_artifact_id, conversion_intent, conversion_status, confidence_level, limits_text,
        evidence_refs_json, source_pack_json, payload_json, created_by, approved_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'converted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        params.projectId ?? null,
        params.sourceConclusionId ?? null,
        params.sourceArtifactType,
        params.sourceArtifactId,
        params.sourceArtifactTitle,
        params.sourceModule,
        params.targetArtifactType,
        params.targetArtifactId,
        params.conversionIntent,
        params.confidenceLevel ?? null,
        params.limits ?? null,
        JSON.stringify(params.evidenceRefs || []),
        JSON.stringify(params.sourcePack || {}),
        JSON.stringify(params.payload || {}),
        params.actorUserId,
        params.actorUserId,
        now,
        now,
      ]
    );
    await queryHelpers.queryRun(
      `INSERT INTO artifact_conversion_events (id, organization_id, conversion_id, event_type, actor_id, payload_json, created_at)
       VALUES (?, ?, ?, 'conversion.recorded', ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        id,
        params.actorUserId,
        JSON.stringify({
          targetArtifactType: params.targetArtifactType,
          targetArtifactId: params.targetArtifactId,
        }),
        now,
      ]
    );
    const conversion = await this.getConversion(params.organizationId, id);
    if (!conversion) throw new Error('Failed to load recorded conversion');
    return conversion;
  }

  async executeConversion(params: {
    organizationId: string;
    actorUserId: string;
    conversionId: string;
  }): Promise<{ conversion?: ArtifactConversion; initiative?: { id: string }; error?: string }> {
    await ensureTables();
    const conversion = await this.getConversion(params.organizationId, params.conversionId);
    if (!conversion) return { error: 'Conversion not found' };
    if (conversion.targetArtifactType !== 'initiative') {
      return { error: 'Only initiative conversion is supported in this slice' };
    }
    if (conversion.conversionStatus === 'converted' && conversion.targetArtifactId) {
      return { conversion, initiative: { id: conversion.targetArtifactId } };
    }
    if (conversion.conversionStatus === 'failed') {
      return { conversion, error: conversion.errorMessage || 'Conversion is blocked' };
    }

    const payload = conversion.payload;
    const now = new Date().toISOString();
    const artifactSourceId = conversion.sourceConclusionId || conversion.sourceArtifactId;

    // Uspójnienie F1.9 — kanoniczny lejek tworzenia inicjatyw.
    let initiativeId: string;
    if (process.env.INITIATIVE_FUNNEL_ENABLED !== 'false') {
      const __r = await funnelCreateInitiative(
        params.organizationId,
        {
          title: String(payload.title || conversion.sourceArtifactTitle),
          projectId: conversion.projectId ?? null,
          summary: String(payload.summary || ''),
          hypothesis: String(payload.hypothesis || ''),
          confidenceLevel:
            String(payload.confidenceLevel || conversion.confidenceLevel || '') || null,
          problemStatement: String(payload.problemStatement || '') || null,
          deliverables: (payload.deliverables as string[]) || [],
          successCriteria: (payload.successCriteria as string[]) || [],
          keyRisks: (payload.keyRisks as unknown[]) || [],
          sourceType: 'artifact',
          sourceId: artifactSourceId || null,
        },
        { validate: false, actor: { id: params.actorUserId } }
      );
      initiativeId = __r.id;
    } else {
      initiativeId = uuidv4();
      try {
        await queryHelpers.queryRun(
          `INSERT INTO initiatives (
            id, organization_id, project_id, title, name, summary, hypothesis, status,
            confidence_level, problem_statement, deliverables, success_criteria, key_risks,
            source_type, source_id, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            initiativeId,
            params.organizationId,
            conversion.projectId ?? null,
            String(payload.title || conversion.sourceArtifactTitle),
            String(payload.title || conversion.sourceArtifactTitle),
            String(payload.summary || ''),
            String(payload.hypothesis || ''),
            InitiativeStatus.DRAFT,
            String(payload.confidenceLevel || conversion.confidenceLevel || ''),
            String(payload.problemStatement || ''),
            JSON.stringify(payload.deliverables || []),
            JSON.stringify(payload.successCriteria || []),
            JSON.stringify(payload.keyRisks || []),
            'conclusion',
            artifactSourceId,
            params.actorUserId,
            now,
            now,
          ]
        );
      } catch {
        // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
        // (Postgres) — this catch-fallback only wrote `title`, which 500s with
        // 23502 (the primary insert above already writes both title and name).
        const fallbackTitle = String(payload.title || conversion.sourceArtifactTitle);
        await queryHelpers.queryRun(
          `INSERT INTO initiatives (
            id, organization_id, project_id, title, name, summary, hypothesis, status,
            confidence_level, problem_statement, deliverables, success_criteria, key_risks,
            source_type, source_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            initiativeId,
            params.organizationId,
            conversion.projectId ?? null,
            fallbackTitle,
            fallbackTitle,
            String(payload.summary || ''),
            String(payload.hypothesis || ''),
            InitiativeStatus.DRAFT,
            String(payload.confidenceLevel || conversion.confidenceLevel || ''),
            String(payload.problemStatement || ''),
            JSON.stringify(payload.deliverables || []),
            JSON.stringify(payload.successCriteria || []),
            JSON.stringify(payload.keyRisks || []),
            'conclusion',
            artifactSourceId,
            now,
            now,
          ]
        );
      }
    }

    await queryHelpers.queryRun(
      `UPDATE artifact_conversions SET
        target_artifact_id = ?,
        conversion_status = 'converted',
        approved_by = ?,
        updated_at = ?,
        error_message = NULL
       WHERE id = ? AND organization_id = ?`,
      [initiativeId, params.actorUserId, now, conversion.id, params.organizationId]
    );
    if (conversion.sourceConclusionId) {
      await conclusionService.markConverted({
        organizationId: params.organizationId,
        conclusionId: conversion.sourceConclusionId,
        actorUserId: params.actorUserId,
      });
    }
    await queryHelpers.queryRun(
      `INSERT INTO artifact_conversion_events (id, organization_id, conversion_id, event_type, actor_id, payload_json, created_at)
       VALUES (?, ?, ?, 'conversion.executed', ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        conversion.id,
        params.actorUserId,
        JSON.stringify({ targetArtifactType: 'initiative', targetArtifactId: initiativeId }),
        now,
      ]
    );

    const updated = await this.getConversion(params.organizationId, conversion.id);
    return { conversion: updated || conversion, initiative: { id: initiativeId } };
  }
}

export const artifactConversionService = new ArtifactConversionService();
