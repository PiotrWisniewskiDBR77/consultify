/**
 * Traceability service (V3-A01)
 * Enforces canonical source for every output (Initiative/Report/Deck).
 */

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type {
  MyWorkDerivedSource,
  MyWorkSession,
  SourceType,
  TraceabilityMetadata,
} from '@/types/domain/traceability';

const SOURCE_TYPE_TO_API: Record<
  SourceType,
  (
    id: string
  ) => Promise<{ name?: string; title?: string; createdBy?: string; createdAt?: string } | null>
> = {
  tool_session: (id) => Api.getToolSession(id).catch(() => null),
  mywork: (id) => Api.getToolSession(id).catch(() => null),
  assessment: async () => null,
  financial_analysis: async () => null,
  interview: async () => null,
  manual: async () => null,
};

/**
 * Ensures output has valid traceability. Throws if source is missing and cannot be materialized.
 */
export async function ensureTraceability(
  outputType: string,
  sourceInfo?: Partial<TraceabilityMetadata>
): Promise<TraceabilityMetadata> {
  const validation = validateTraceability(sourceInfo || {});
  if (validation.valid && sourceInfo?.sourceType && sourceInfo?.sourceId) {
    return sourceInfo as TraceabilityMetadata;
  }
  throw new Error(
    `Traceability required: ${outputType} must have source_type and source_id. ${validation.errors.join(' ')}`
  );
}

/**
 * Creates a ToolSession(type=MYWORK) as canonical source for MyWork → output conversions.
 */
export async function materializeMyWorkSession(
  sources: MyWorkDerivedSource[]
): Promise<MyWorkSession> {
  if (!sources?.length) {
    throw new Error('materializeMyWorkSession requires at least one source');
  }
  const name =
    sources.length === 1 ? sources[0].title : `MyWork session (${sources.length} sources)`;
  const snapshotJson = {
    derived_from: sources,
    materialized_at: new Date().toISOString(),
  };
  const result = await Api.createToolSession({
    toolType: 'MYWORK',
    name,
    projectId: null,
    derivedFrom: sources,
    snapshotJson,
  });
  trackFunnelEvent('mywork_session_materialized', {
    reason: 'convert',
    sourceCount: sources.length,
  });
  return {
    id: result.id,
    type: 'MYWORK',
    derivedFrom: sources,
    snapshotJson,
    createdAt: new Date().toISOString(),
    status: result.status || 'DRAFT',
  };
}

/**
 * Fetches source metadata for display (source title, createdBy, createdAt).
 */
export async function getSourceMetadata(
  sourceType: SourceType,
  sourceId: string
): Promise<TraceabilityMetadata | null> {
  const fetcher = SOURCE_TYPE_TO_API[sourceType];
  if (!fetcher) return null;
  const raw = await fetcher(sourceId);
  if (!raw) return null;
  const sourceTitle = (raw as any).name ?? (raw as any).title ?? sourceId;
  return {
    sourceType,
    sourceId,
    sourceTitle: String(sourceTitle),
    createdBy: (raw as any).createdBy ?? '',
    createdAt: (raw as any).createdAt ?? new Date().toISOString(),
  };
}

/**
 * Validates traceability metadata completeness.
 */
export function validateTraceability(metadata: Partial<TraceabilityMetadata>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!metadata.sourceType) errors.push('sourceType is required');
  if (!metadata.sourceId) errors.push('sourceId is required');
  return {
    valid: errors.length === 0,
    errors,
  };
}
