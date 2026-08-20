/**
 * Conversion service (V3-C02)
 * Handles MyWork item → output (Initiative/Report/Presentation) conversions.
 * Ensures traceability via materialized MyWork ToolSession.
 */

import { Api } from '@/services/api';
import { createRegisteredValuation } from '@/services/api/financeV2.api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { materializeMyWorkSession } from '@/services/traceabilityService';
import type { MyWorkDerivedSource } from '@/types/domain/traceability';

export type ConversionSourceType = 'idea' | 'notebook' | 'task' | 'decision';
export type ConversionTargetType =
  | 'initiative'
  | 'report'
  | 'presentation'
  | 'financial_model'
  | 'budget'
  | 'valuation'
  | 'analysis';

export interface ConversionResult {
  success: boolean;
  sessionId: string;
  outputId: string;
  outputType: string;
  error?: string;
}

export interface ConvertMyWorkItemParams {
  sourceType: ConversionSourceType;
  sourceId: string;
  sourceTitle: string;
  targetType: ConversionTargetType;
  additionalSources?: MyWorkDerivedSource[];
}

/**
 * Creates the target output from an already-materialized session.
 * Used when ConvertToDialog has already materialized the session.
 */
export async function createOutputFromSession(
  sessionId: string,
  targetType: ConversionTargetType,
  sourceTitle: string
): Promise<ConversionResult> {
  try {
    const { outputId } = await createTargetOutput(sessionId, targetType, sourceTitle);
    trackFunnelEvent('mywork_convert_completed', {
      toType: targetType,
      has_source: true,
    });
    return {
      success: true,
      sessionId,
      outputId,
      outputType: targetType,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Conversion failed';
    return {
      success: false,
      sessionId,
      outputId: '',
      outputType: targetType,
      error,
    };
  }
}

async function createTargetOutput(
  sessionId: string,
  targetType: ConversionTargetType,
  sourceTitle: string
): Promise<{ outputId: string }> {
  if (targetType === 'initiative') {
    // Chain gap #5 (Ideas/MyWork → Inicjatywy): the live POST /api/initiatives is
    // guarded by validateBody(CreateInitiativeSchema), which (a) REQUIRES `title`
    // (`name` alone → 400) and (b) only knows camelCase `sourceType`/`sourceId` —
    // snake_case keys were silently stripped, so the created initiative lost its
    // back-reference to the source session (source_type fell back to 'manual').
    const created = await Api.createInitiative({
      title: sourceTitle.slice(0, 255),
      name: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session`,
      sourceType: 'tool_session',
      sourceId: sessionId,
    });
    return { outputId: String(created?.id ?? '') };
  }
  if (targetType === 'report') {
    const response = await Api.post('/report-builder', {
      sourceType: 'TOOL',
      sourceId: sessionId,
      sourceName: sourceTitle.slice(0, 255),
      title: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session`,
    });
    const report = response?.report ?? response;
    return { outputId: String(report?.id ?? '') };
  }
  if (targetType === 'presentation') {
    const response = await Api.post('/presentations/generate/outline', {
      title: sourceTitle.slice(0, 255),
      audience: 'internal',
      goal: 'inform',
      language: 'en',
      theme: 'corporate',
      confidentiality: 'internal',
      sourceArtifacts: [
        {
          type: 'tool_session',
          id: sessionId,
          label: `MyWork session: ${sourceTitle.slice(0, 120)}`,
          data: {},
        },
      ],
    });
    const data = response?.data ?? response;
    return { outputId: String(data?.deckId ?? '') };
  }
  if (targetType === 'financial_model') {
    const response = await Api.post('/financial-modeling/models', {
      name: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session`,
      startDate: new Date().toISOString().slice(0, 10),
      sourceType: 'tool_session',
      sourceId: sessionId,
    });
    return { outputId: String(response?.model?.id ?? response?.id ?? '') };
  }
  if (targetType === 'analysis') {
    const response = await Api.post('/economics/analyses', {
      name: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session`,
      analysisType: 'financial',
      sourceType: 'tool_session',
      sourceId: sessionId,
    });
    return { outputId: String(response?.id ?? '') };
  }
  if (targetType === 'valuation') {
    const response = await createRegisteredValuation({
      title: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session ${sessionId}`,
      sourceType: 'manual',
      sourceId: null,
    });
    return { outputId: String(response?.id ?? '') };
  }
  if (targetType === 'budget') {
    const response = await Api.post('/economics/budgets', {
      name: sourceTitle.slice(0, 255),
      description: `Converted from MyWork session`,
      sourceType: 'tool_session',
      sourceId: sessionId,
    });
    const budget = response?.budget ?? response;
    return { outputId: String(budget?.id ?? '') };
  }
  throw new Error(`Unknown target type: ${targetType}`);
}

/**
 * Converts a MyWork item to an output (initiative, report, or presentation).
 * 1. Materializes a MyWork ToolSession as canonical source
 * 2. Creates the target output with source metadata
 */
export async function convertMyWorkItem(
  params: ConvertMyWorkItemParams
): Promise<ConversionResult> {
  const { sourceType, sourceId, sourceTitle, targetType, additionalSources = [] } = params;

  const sources: MyWorkDerivedSource[] = [
    { type: sourceType, id: sourceId, title: sourceTitle },
    ...additionalSources,
  ];

  try {
    // 1. Materialize MyWork session (canonical source)
    const session = await materializeMyWorkSession(sources);
    const sessionId = session.id;

    // 2. Create target output
    const { outputId } = await createTargetOutput(sessionId, targetType, sourceTitle);

    trackFunnelEvent('mywork_convert_completed', {
      toType: targetType,
      has_source: true,
    });

    return {
      success: true,
      sessionId,
      outputId,
      outputType: targetType,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Conversion failed';
    return {
      success: false,
      sessionId: '',
      outputId: '',
      outputType: targetType,
      error,
    };
  }
}
