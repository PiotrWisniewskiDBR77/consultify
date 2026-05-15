import {
  runOutcomeRollupPipeline,
  unsafeOutcomeRollupPipelineRunId,
} from '../../../models/v10/pipelines/OutcomeRollupPipeline.js';
import type {
  OutcomeAcceptancePreviewRequest,
  OutcomeAcceptancePreviewResponse,
  OutcomeAcceptanceResolveRequest,
  OutcomeAcceptanceResolveResponse,
  OutcomeBusinessLinkRequest,
  OutcomeBusinessLinkResponse,
  OutcomeConfidence,
  OutcomeKpiDomain,
  OutcomeMetric,
  OutcomeResolveRequest,
  OutcomeResolveResponse,
  OutcomeSignalIngestRequest,
  OutcomeSignalIngestResponse,
  OutcomeSignalKind,
} from '../../../types/v10/outcome-runtime.js';

type OutcomeRuntimeErrorCode = 'not_found' | 'scope_mismatch' | 'validation';

class OutcomeRuntimeError extends Error {
  readonly status: number;
  readonly code: OutcomeRuntimeErrorCode;

  constructor(code: OutcomeRuntimeErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'OutcomeRuntimeError';
    this.code = code;
    this.status = status;
  }
}

type StoredPreview = {
  readonly previewId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly analysisSummary: string;
  readonly businessGoal: string;
  readonly metrics: OutcomeMetric[];
  readonly evidence: OutcomeAcceptancePreviewRequest['evidence'];
  readonly contractId: string;
};

type StoredContract = {
  readonly contractId: string;
  readonly previewId: string;
  readonly tenantId: string;
  status: 'draft' | 'accepted' | 'rejected' | 'needs_revision';
  readonly linkedMetricIds: string[];
  readonly requiredActions: string[];
};

type StoredSignal = {
  readonly signalId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly source: OutcomeSignalIngestRequest['source'];
  readonly kind: OutcomeSignalKind;
  readonly magnitude: OutcomeSignalIngestRequest['magnitude'];
  readonly confidence: OutcomeConfidence;
  readonly evidence: OutcomeSignalIngestRequest['evidence'];
  readonly note?: string;
  readonly createdAt: string;
};

type StoredOutcomeRecord = {
  readonly outcomeRecordId: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly previewId: string;
  readonly acceptedMetricIds: string[];
  readonly createdAt: string;
};

type StoredBusinessLink = {
  readonly linkId: string;
  readonly tenantId: string;
  readonly summary: string;
  readonly linkedMetricIds: string[];
  readonly strongestSignalKind: OutcomeSignalKind;
  readonly createdAt: string;
};

function nowIso(input?: string): string {
  return input?.trim() || new Date().toISOString();
}

function metricToSignalKind(domain: OutcomeKpiDomain): OutcomeSignalKind {
  switch (domain) {
    case 'time':
      return 'time_saved';
    case 'cost':
      return 'margin';
    case 'revenue':
      return 'revenue';
    case 'retention':
    default:
      return 'quality';
  }
}

function inferPreviewState(metric: OutcomeMetric): 'ready' | 'needs_review' | 'at_risk' {
  const gap = Math.abs(metric.targetValue - metric.baselineValue);
  if (gap === 0) return 'needs_review';
  if (metric.observedValue === undefined) return 'ready';

  const progress = Math.abs(metric.observedValue - metric.baselineValue) / gap;
  if (progress >= 0.9) return 'ready';
  if (progress >= 0.4) return 'needs_review';
  return 'at_risk';
}

function confidenceFromStates(
  states: Array<'ready' | 'needs_review' | 'at_risk'>
): OutcomeConfidence {
  if (states.every((state) => state === 'ready')) return 'high';
  if (states.some((state) => state === 'at_risk')) return 'low';
  return 'medium';
}

function assertTenantMatch(expectedTenantId: string, actualTenantId: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new OutcomeRuntimeError(
      'scope_mismatch',
      'Outcome resource is outside current tenant scope.',
      403
    );
  }
}

export class OutcomeRuntimeService {
  private readonly previewStore = new Map<string, StoredPreview>();
  private readonly contractStore = new Map<string, StoredContract>();
  private readonly signalStore = new Map<string, StoredSignal>();
  private readonly recordStore = new Map<string, StoredOutcomeRecord>();
  private readonly businessLinkStore = new Map<string, StoredBusinessLink>();

  resolve(input: OutcomeResolveRequest): OutcomeResolveResponse {
    const now = input.now?.trim() || new Date().toISOString();
    const pipeline = runOutcomeRollupPipeline({
      outcomeId: unsafeOutcomeRollupPipelineRunId(crypto.randomUUID()),
      kind: input.kind,
      payload: input.payload,
      now,
    });
    return { outcomeId: String(pipeline.outcomeId), now: pipeline.now, status: pipeline.status };
  }

  previewAcceptance(input: OutcomeAcceptancePreviewRequest): OutcomeAcceptancePreviewResponse {
    const now = nowIso(input.now);
    const previewId = `out-prev-${crypto.randomUUID()}`;
    const contractId = `out-ctr-${crypto.randomUUID()}`;
    const previewStates = input.metrics.map(inferPreviewState);
    const confidence = confidenceFromStates(previewStates);
    const requiredActions = [
      'Review KPI deltas against the business goal.',
      'Confirm evidence lineage before final acceptance.',
    ];

    this.previewStore.set(previewId, {
      previewId,
      tenantId: input.scope.tenantId,
      userId: input.scope.userId,
      createdAt: now,
      analysisSummary: input.analysisSummary,
      businessGoal: input.businessGoal,
      metrics: input.metrics,
      evidence: input.evidence,
      contractId,
    });

    this.contractStore.set(contractId, {
      contractId,
      previewId,
      tenantId: input.scope.tenantId,
      status: 'draft',
      linkedMetricIds: input.metrics.map((metric) => metric.id),
      requiredActions,
    });

    return {
      previewId,
      now,
      metrics: input.metrics.map((metric) => ({
        ...metric,
        projectedDelta: metric.targetValue - metric.baselineValue,
        deltaToTarget:
          metric.observedValue === undefined
            ? metric.targetValue - metric.baselineValue
            : metric.targetValue - metric.observedValue,
        previewState: inferPreviewState(metric),
        suggestedSignalKind: metricToSignalKind(metric.domain),
      })),
      suggestedSignals: input.metrics.map((metric) => ({
        kind: metricToSignalKind(metric.domain),
        confidence,
        magnitude: {
          value: Math.abs(metric.targetValue - metric.baselineValue),
          unit: metric.unit,
        },
        rationale: `${metric.label} links the analysis to "${input.businessGoal}".`,
      })),
      acceptanceContract: {
        contractId,
        previewId,
        status: 'draft',
        requiredActions,
        linkedMetricIds: input.metrics.map((metric) => metric.id),
      },
      businessLinkSummary: {
        headline: `${input.businessGoal} linked to ${input.metrics.length} KPI candidate(s).`,
        linkedMetricIds: input.metrics.map((metric) => metric.id),
        confidence,
      },
    };
  }

  ingestSignal(input: OutcomeSignalIngestRequest): OutcomeSignalIngestResponse {
    const now = nowIso(input.now);
    const signalId = `out-sig-${crypto.randomUUID()}`;

    this.signalStore.set(signalId, {
      signalId,
      tenantId: input.scope.tenantId,
      userId: input.scope.userId,
      source: input.source,
      kind: input.kind,
      magnitude: input.magnitude,
      confidence: input.confidence,
      evidence: input.evidence,
      note: input.note,
      createdAt: now,
    });

    return { signalId, now, status: 'captured' };
  }

  resolveAcceptance(input: OutcomeAcceptanceResolveRequest): OutcomeAcceptanceResolveResponse {
    const contract = this.contractStore.get(input.contractId);
    if (!contract) {
      throw new OutcomeRuntimeError('not_found', 'Outcome acceptance contract was not found.', 404);
    }
    assertTenantMatch(contract.tenantId, input.scope.tenantId);

    const preview = this.previewStore.get(contract.previewId);
    if (!preview) {
      throw new OutcomeRuntimeError(
        'not_found',
        'Outcome preview for the acceptance contract was not found.',
        404
      );
    }

    const now = nowIso(input.now);
    const acceptedMetricIds =
      input.acceptedMetricIds.length > 0 ? input.acceptedMetricIds : contract.linkedMetricIds;
    const allowedMetricIds = new Set(contract.linkedMetricIds);
    const hasUnknownMetricId = acceptedMetricIds.some(
      (metricId) => !allowedMetricIds.has(metricId)
    );
    if (hasUnknownMetricId) {
      throw new OutcomeRuntimeError(
        'validation',
        'Acceptance includes an unknown KPI metric id.',
        422
      );
    }

    contract.status = input.decision;

    let outcomeRecordId: string | null = null;
    if (input.decision === 'accepted') {
      outcomeRecordId = `out-rec-${crypto.randomUUID()}`;
      this.recordStore.set(outcomeRecordId, {
        outcomeRecordId,
        tenantId: input.scope.tenantId,
        contractId: contract.contractId,
        previewId: preview.previewId,
        acceptedMetricIds,
        createdAt: now,
      });
    }

    return {
      contractId: contract.contractId,
      previewId: preview.previewId,
      status: contract.status,
      outcomeRecordId,
      acceptedMetricIds,
      now,
    };
  }

  linkAnalysisToBusinessOutcome(input: OutcomeBusinessLinkRequest): OutcomeBusinessLinkResponse {
    const now = nowIso(input.now);
    const linkId = `out-link-${crypto.randomUUID()}`;
    const linkedMetricIds = input.metrics.map((metric) => metric.id);
    const strongestSignalKind = metricToSignalKind(input.metrics[0]?.domain ?? 'time');
    const summary =
      `${input.businessGoal}: ${input.hypothesis}. ` +
      `Analysis is tied to ${linkedMetricIds.length} KPI(s) and can be accepted through the outcome contract.`;

    this.businessLinkStore.set(linkId, {
      linkId,
      tenantId: input.scope.tenantId,
      summary,
      linkedMetricIds,
      strongestSignalKind,
      createdAt: now,
    });

    return {
      linkId,
      now,
      strongestSignalKind,
      linkedMetricIds,
      summary,
      evidenceCoverage: {
        hasArtifact: Boolean(input.evidence.artifactId),
        hasResearchMission: Boolean(input.evidence.researchMissionId),
        hasReasoningRun: Boolean(input.evidence.reasoningRunId),
      },
    };
  }
}

export const outcomeRuntimeService = new OutcomeRuntimeService();

export function mapOutcomeRuntimeError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof OutcomeRuntimeError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: error instanceof Error ? error.message : 'Unexpected outcome runtime error.',
      code: 'outcome_runtime_error',
    },
  };
}
