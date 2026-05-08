import type { DeckSetup, SourceArtifact } from './presentationGeneratorService.js';

export type PresentationSourcePackConfidence = 'none' | 'low' | 'medium' | 'high';
export type PresentationSourcePackStatus = 'empty' | 'partial_ready' | 'ready' | 'blocked';

export interface PresentationSourcePackItem {
  sourceId: string;
  sourceType: SourceArtifact['type'] | string;
  label: string;
  confidence: number | null;
  readiness: string;
  freshnessDays: number | null;
  capturedAt: string | null;
  lineage: Record<string, unknown> | null;
}

export interface PresentationSourcePack {
  sourcePackId: string;
  client: string | null;
  workstream: string | null;
  purpose: string;
  status: PresentationSourcePackStatus;
  confidence: PresentationSourcePackConfidence;
  confidenceScore: number;
  coverage: {
    totalSources: number;
    readySources: number;
    partialSources: number;
    blockedSources: number;
    staleSources: number;
  };
  sources: PresentationSourcePackItem[];
  missingInputs: string[];
  warnings: string[];
  builtAt: string;
}

export interface PresentationSourcePackPreflight {
  ok: boolean;
  sourcePack: PresentationSourcePack;
  missingInputs: string[];
  warnings: string[];
}

const STALE_AFTER_DAYS = 45;

function clampConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function sourceKey(source: SourceArtifact, index: number): string {
  return String(source.artifactId || source.id || `${source.type}-${index}`).trim();
}

function inferPurpose(setup: DeckSetup): string {
  const goal = setup.goal || 'inform';
  const audience = setup.audience || 'internal';
  return `${goal}:${audience}`;
}

function confidenceLabel(score: number, totalSources: number): PresentationSourcePackConfidence {
  if (totalSources === 0) return 'none';
  if (score >= 0.8) return 'high';
  if (score >= 0.55) return 'medium';
  return 'low';
}

function requiredInputsForSetup(setup: DeckSetup): string[] {
  const required = new Set<string>();
  const goal = setup.goal;
  const templateId = String(setup.templateId || '').toLowerCase();
  const title = String(setup.title || '').toLowerCase();

  if (goal === 'decide') required.add('decision evidence or recommendation source');
  if (goal === 'sell') required.add('client/prospect context source');
  if (title.includes('kpi') || title.includes('roi')) required.add('kpi_roi');
  if (title.includes('risk') || title.includes('ryzyk')) required.add('raid');
  if (templateId) required.add('approved template source mapping');

  return [...required];
}

function hasRequiredInput(required: string, sources: SourceArtifact[]): boolean {
  if (required === 'decision evidence or recommendation source') {
    return sources.some((source) =>
      ['assessment', 'decision_pack', 'insight_pack', 'interview_study', 'tool_session'].includes(
        source.type
      )
    );
  }
  if (required === 'client/prospect context source') {
    return sources.some((source) =>
      ['workspace', 'report', 'interview_study', 'financial_analysis', 'valuation'].includes(
        source.type
      )
    );
  }
  if (required === 'approved template source mapping') {
    return sources.length > 0;
  }
  return sources.some((source) => source.type === required);
}

export function buildPresentationSourcePack(params: {
  setup: DeckSetup;
  organizationId: string;
  now?: Date;
}): PresentationSourcePack {
  const now = params.now || new Date();
  const sources = Array.isArray(params.setup.sourceArtifacts) ? params.setup.sourceArtifacts : [];
  const items = sources.map((source, index) => {
    const freshnessDays = numberOrNull(
      (source as any).freshnessDays ?? (source as any).freshness_days
    );
    return {
      sourceId: sourceKey(source, index),
      sourceType: source.type || 'custom',
      label: String(source.label || source.type || 'Source'),
      confidence: clampConfidence(source.confidence),
      readiness: source.readiness || 'ready',
      freshnessDays,
      capturedAt:
        typeof (source as any).capturedAt === 'string'
          ? (source as any).capturedAt
          : typeof (source as any).captured_at === 'string'
            ? (source as any).captured_at
            : null,
      lineage:
        source.lineage && typeof source.lineage === 'object'
          ? (source.lineage as Record<string, unknown>)
          : null,
    } satisfies PresentationSourcePackItem;
  });

  const readySources = items.filter((item) => item.readiness === 'ready').length;
  const blockedSources = items.filter((item) =>
    ['policy_blocked', 'insufficient_evidence'].includes(item.readiness)
  ).length;
  const partialSources = Math.max(0, items.length - readySources - blockedSources);
  const staleSources = items.filter(
    (item) => item.freshnessDays !== null && item.freshnessDays > STALE_AFTER_DAYS
  ).length;
  const confidenceValues = items
    .map((item) => item.confidence)
    .filter((value): value is number => typeof value === 'number');
  const confidenceScore =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : items.length > 0
        ? 0.5
        : 0;

  const missingInputs = requiredInputsForSetup(params.setup).filter(
    (required) => !hasRequiredInput(required, sources)
  );
  const warnings: string[] = [];
  if (items.length === 0) warnings.push('Source pack is empty; deck will rely on prompt context.');
  if (partialSources > 0) warnings.push('Some sources are only partially ready.');
  if (blockedSources > 0)
    warnings.push('Some sources are blocked by policy or insufficient evidence.');
  if (staleSources > 0) warnings.push('Some sources are stale and should be refreshed.');
  if (missingInputs.length > 0) {
    warnings.push(`Missing required inputs: ${missingInputs.join(', ')}.`);
  }

  const status: PresentationSourcePackStatus =
    items.length === 0
      ? 'empty'
      : blockedSources > 0
        ? 'blocked'
        : missingInputs.length > 0 || partialSources > 0 || staleSources > 0
          ? 'partial_ready'
          : 'ready';

  return {
    sourcePackId: `psp_${params.organizationId}_${now.getTime()}`,
    client: null,
    workstream: null,
    purpose: inferPurpose(params.setup),
    status,
    confidence: confidenceLabel(confidenceScore, items.length),
    confidenceScore: Number(confidenceScore.toFixed(2)),
    coverage: {
      totalSources: items.length,
      readySources,
      partialSources,
      blockedSources,
      staleSources,
    },
    sources: items,
    missingInputs,
    warnings,
    builtAt: now.toISOString(),
  };
}

export function preflightPresentationSourcePack(params: {
  setup: DeckSetup;
  organizationId: string;
  strict?: boolean;
  now?: Date;
}): PresentationSourcePackPreflight {
  const sourcePack = buildPresentationSourcePack(params);
  const hardMissing = params.strict ? sourcePack.missingInputs : [];
  const ok = sourcePack.status !== 'blocked' && hardMissing.length === 0;
  return {
    ok,
    sourcePack,
    missingInputs: sourcePack.missingInputs,
    warnings: sourcePack.warnings,
  };
}
