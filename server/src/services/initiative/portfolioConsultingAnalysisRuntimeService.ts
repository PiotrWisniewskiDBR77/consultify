import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { z } from 'zod';

import { readInitiativeHeader } from '../../domain/initiatives-execution/initiativeUnifiedReader.js';
import {
  type CapturedPortfolioConsultingAnalysis,
  type PortfolioAnalysisSnapshot,
  type PortfolioConsultingAnalysis,
  type PortfolioConsultingAnalysisContextReader,
  type PortfolioConsultingAnalysisReader,
  type PortfolioConsultingModelGateway,
} from '../../domain/initiatives-execution/portfolioConsultingAnalysis.js';
import { PostgresInitiativeReader } from '../../domain/initiatives-execution/postgresInitiativeReader.js';
import llmService from '../ai/llmService.js';
import organizationContextService, {
  type OrganizationContextService,
  type PinnedSnapshotRead,
} from '../organizationContext/OrganizationContextService.js';

type AnalysisState = CapturedPortfolioConsultingAnalysis | PortfolioConsultingAnalysis;

interface AggregateSourceRow {
  aggregate_type: 'decision' | 'execution_case' | 'execution_task' | 'task';
  aggregate_id: string;
  version: number;
  payload_json: Record<string, unknown>;
}

export interface PortfolioAnalysisSnapshotBuildInput {
  organizationId: string;
  scenarioId: string;
  contextSnapshotId: string;
  contextVersion: number;
}

export interface PortfolioAnalysisSnapshotBuilder {
  buildSnapshot(input: PortfolioAnalysisSnapshotBuildInput): Promise<PortfolioAnalysisSnapshot>;
}

export interface PortfolioAnalysisRuntimeSourceDependencies {
  readHeader?: typeof readInitiativeHeader;
  contextService?: Pick<OrganizationContextService, 'getSnapshotVersion'>;
}

export class PortfolioAnalysisRuntimeError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: 400 | 404 | 409 | 503
  ) {
    super(code);
    this.name = 'PortfolioAnalysisRuntimeError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_SOURCE_MALFORMED', 409);
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_AS_OF_INVALID', 503);
  }
  return date.toISOString();
}

function governedSnapshotFacts(snapshot: PinnedSnapshotRead): Record<string, unknown> {
  return {
    organizationId: snapshot.organizationId,
    snapshotId: snapshot.snapshotId,
    version: snapshot.version,
    schemaVersion: snapshot.schemaVersion,
    contentHash: snapshot.contentHash,
    claimCount: snapshot.claimCount,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    claims: snapshot.claims,
    sourceRefs: snapshot.sourceRefs,
  };
}

/**
 * Tenant-scoped production adapter for the already existing canonical stores.
 * It does not create a projection or a parallel analysis table: both captured
 * and finalized analyses live in `ie_aggregate_state` as MaterialCommand JSON.
 */
export class PostgresPortfolioConsultingAnalysisRuntimeService
  implements
    PortfolioAnalysisSnapshotBuilder,
    PortfolioConsultingAnalysisReader,
    PortfolioConsultingAnalysisContextReader
{
  private readonly initiativeReader: PostgresInitiativeReader;
  private readonly readHeader: typeof readInitiativeHeader;
  private readonly contextService: Pick<OrganizationContextService, 'getSnapshotVersion'>;

  constructor(
    private readonly pool: Pick<Pool, 'query'>,
    initiativeReader?: PostgresInitiativeReader,
    deps: PortfolioAnalysisRuntimeSourceDependencies = {}
  ) {
    this.initiativeReader = initiativeReader ?? new PostgresInitiativeReader(pool as Pool);
    this.readHeader = deps.readHeader ?? readInitiativeHeader;
    this.contextService = deps.contextService ?? organizationContextService;
  }

  async find(
    organizationId: string,
    analysisId: string
  ): Promise<{ version: number; analysis: AnalysisState } | null> {
    const result = await this.pool.query<{
      version: number;
      payload_json: AnalysisState;
    }>(
      `SELECT version, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1
          AND aggregate_type = 'portfolio_analysis'
          AND aggregate_id = $2`,
      [organizationId, analysisId]
    );
    const row = result.rows[0];
    return row ? { version: Number(row.version), analysis: row.payload_json } : null;
  }

  async findGovernedSnapshot(input: {
    organizationId: string;
    snapshotId: string;
    version: number;
  }): Promise<{ contentHash: string; snapshot: Record<string, unknown> } | null> {
    const found = await this.contextService.getSnapshotVersion(input.organizationId, input.version);
    if (!found || found.snapshotId !== input.snapshotId) return null;
    return {
      contentHash: found.contentHash,
      snapshot: JSON.parse(JSON.stringify(governedSnapshotFacts(found))) as Record<string, unknown>,
    };
  }

  async buildSnapshot(
    input: PortfolioAnalysisSnapshotBuildInput
  ): Promise<PortfolioAnalysisSnapshot> {
    const clock = await this.pool.query<{ as_of: Date | string }>(
      'SELECT clock_timestamp() AS as_of'
    );
    const asOf = toIso(clock.rows[0]?.as_of ?? '');
    const scenarioRow = await this.initiativeReader.findPortfolioScenario(
      input.organizationId,
      input.scenarioId
    );
    if (!scenarioRow) {
      throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_SCENARIO_NOT_FOUND', 404);
    }
    const scenario = asRecord(scenarioRow.scenario);
    const memberships = Array.isArray(scenario.memberships) ? scenario.memberships : [];
    const membershipVersions = new Map<string, number>();
    const initiativeIds = memberships.map((raw) => {
      const membership = asRecord(raw);
      if (
        typeof membership.initiativeId !== 'string' ||
        !membership.initiativeId.trim() ||
        !Number.isInteger(membership.initiativeVersion) ||
        Number(membership.initiativeVersion) < 1
      ) {
        throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_SCENARIO_MALFORMED', 409);
      }
      membershipVersions.set(membership.initiativeId, Number(membership.initiativeVersion));
      return membership.initiativeId;
    });
    if (initiativeIds.length === 0 || new Set(initiativeIds).size !== initiativeIds.length) {
      throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_SCENARIO_MALFORMED', 409);
    }

    const [initiativeRows, headers, context, sourceRows] = await Promise.all([
      this.initiativeReader.listInitiativesByIds(input.organizationId, initiativeIds),
      Promise.all(initiativeIds.map((id) => this.readHeader(input.organizationId, id))),
      this.contextService.getSnapshotVersion(input.organizationId, input.contextVersion),
      this.pool.query<AggregateSourceRow>(
        `SELECT aggregate_type, aggregate_id, version, payload_json
           FROM ie_aggregate_state
          WHERE organization_id = $1
            AND updated_at <= $3::timestamptz
            AND aggregate_type = ANY($2::text[])
            AND payload_json->>'initiativeId' = ANY($4::text[])
          ORDER BY aggregate_type, aggregate_id`,
        [
          input.organizationId,
          ['decision', 'execution_case', 'execution_task', 'task'],
          asOf,
          initiativeIds,
        ]
      ),
    ]);

    if (
      !context ||
      context.snapshotId !== input.contextSnapshotId ||
      context.organizationId !== input.organizationId
    ) {
      throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_CONTEXT_NOT_FOUND', 404);
    }

    const initiatives = initiativeIds.map((initiativeId, index) => {
      const row = initiativeRows.get(initiativeId);
      const header = headers[index];
      if (
        !row ||
        row.version !== membershipVersions.get(initiativeId) ||
        !header ||
        header.source !== 'CANONICAL' ||
        header.id !== initiativeId
      ) {
        throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_INITIATIVE_NOT_CANONICAL', 409);
      }
      const facts = asRecord(row.initiative);
      const projectId =
        typeof facts.projectId === 'string' && facts.projectId.trim() ? facts.projectId : null;
      return {
        initiativeId,
        initiativeVersion: row.version,
        projectId,
        source: 'CANONICAL' as const,
        facts,
        evidenceRefs: [`initiative:${initiativeId}:v${row.version}`] as [string],
      };
    });

    const decisionHistory = sourceRows.rows
      .filter((row) => row.aggregate_type === 'decision')
      .map((row) => ({
        decisionId: row.aggregate_id,
        version: Number(row.version),
        initiativeId: String(row.payload_json.initiativeId),
        sourceRef: `decision:${row.aggregate_id}:v${row.version}`,
        facts: asRecord(row.payload_json),
      }));
    const runningWork = sourceRows.rows
      .filter((row) => row.aggregate_type !== 'decision')
      .map((row) => ({
        aggregateType: row.aggregate_type as 'execution_case' | 'execution_task' | 'task',
        aggregateId: row.aggregate_id,
        version: Number(row.version),
        sourceRef: `${row.aggregate_type}:${row.aggregate_id}:v${row.version}`,
        facts: asRecord(row.payload_json),
      }));

    const snapshot: PortfolioAnalysisSnapshot = {
      snapshotVersion: 1,
      organizationId: input.organizationId,
      asOf,
      source: { system: 'initiativeUnifiedReader', version: 'runtime-v1', capturedAt: asOf },
      portfolio: {
        scenarioId: input.scenarioId,
        aggregateVersion: scenarioRow.version,
        scenarioVersion: Number(scenario.scenarioVersion),
        facts: scenario,
      },
      initiatives,
      decisionHistory,
      runningWork,
      organizationContext: {
        snapshotId: context.snapshotId,
        version: context.version,
        contentHash: context.contentHash,
        facts: governedSnapshotFacts(context),
      },
    };
    // MaterialCommand persists JSONB. Normalize at this boundary so the
    // request digest is computed over the exact bytes/shape that can be
    // reopened for finalize (no driver-specific Date or undefined values).
    return JSON.parse(JSON.stringify(snapshot)) as PortfolioAnalysisSnapshot;
  }
}

const EvidenceSchema = z.object({
  initiativeId: z.string().min(1),
  field: z.string().min(1),
  source: z.literal('initiativeUnifiedReader'),
  sourceRef: z.string().min(1),
});

const PortfolioAnalysisOutputSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        position: z.number().int().positive(),
        kind: z.enum(['OBSERVATION', 'RECOMMENDATION', 'DECISION']),
        criterion: z.enum([
          'COVERAGE_GAP',
          'OVERLAP',
          'PRIORITY',
          'NEW_VS_EXTENSION',
          'DECISION_HISTORY',
        ]),
        initiativeIds: z.array(z.string().min(1)).min(1),
        rationale: z.string().min(1),
        evidence: z.array(EvidenceSchema).min(1),
        confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
        alternatives: z.array(z.string().min(1)),
        missingData: z.array(z.string().min(1)),
        proposedDisposition: z
          .object({
            kind: z.enum(['IN', 'PARKING', 'ARCHIVE']),
            reason: z.string().min(1),
            returnCondition: z.string().min(1).nullable(),
          })
          .nullable(),
      })
    )
    .min(3),
});

export class ConfiguredPortfolioConsultingModelGateway implements PortfolioConsultingModelGateway {
  async analyze(input: {
    rubricVersion: string;
    requestDigest: string;
    snapshot: PortfolioAnalysisSnapshot;
  }) {
    const resolved = await llmService.resolveModelConfig({ id: 'premium', tier: 'PREMIUM' });
    const provider = String(resolved.provider ?? '').trim();
    const modelId = String(resolved.model_id ?? resolved.modelId ?? resolved.id ?? '').trim();
    if (!provider || !modelId) {
      throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_MODEL_NOT_CONFIGURED', 503);
    }
    const result = await llmService.call({
      type: 'structured',
      modelConfig: resolved,
      systemPrompt:
        'Analyze the exact frozen Initiative portfolio. Return ordered observations, then recommendations, then human-review decisions. Cite only supplied initiative fields and source references. Keep missing data explicit. Treat an existing PARKING or ARCHIVE disposition as suppressed until the frozen snapshot contains explicit evidence that its return condition is met. Do not execute or approve decisions.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            rubricVersion: input.rubricVersion,
            requestDigest: input.requestDigest,
            snapshot: input.snapshot,
          }),
        },
      ],
      schema: PortfolioAnalysisOutputSchema,
      maxTokens: 6_000,
      temperature: 0.2,
      cache: false,
    });
    if (result.qaMock === true) {
      throw new PortfolioAnalysisRuntimeError('PORTFOLIO_ANALYSIS_REAL_MODEL_REQUIRED', 503);
    }
    return {
      provenance: {
        runId: randomUUID(),
        provider,
        modelId,
        modelVersion: String(resolved.version ?? modelId),
        promptVersion: input.rubricVersion,
        generatedAt: new Date().toISOString(),
      },
      output: result.object,
    };
  }
}

export function isPortfolioConsultingAnalysisEnabled(): boolean {
  return process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS === 'true';
}
