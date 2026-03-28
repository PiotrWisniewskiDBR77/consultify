/**
 * Narrative Engine — Layer 1: Fact Extraction
 *
 * Deterministic extraction of structured facts from a ContextPack.
 * Normalizes units and dates, assigns categories based on section type.
 * No LLM calls — pure data transformation.
 */

import type { FactSet, NarrativeEngineInput } from './types.js';

const SECTION_CATEGORY_MAP: Record<string, string> = {
  summary: 'overview',
  cover: 'overview',
  methodology: 'methodology',
  matrix: 'assessment',
  axis_analysis: 'assessment',
  list: 'general',
  recommendations: 'recommendations',
  action_plan: 'execution',
  initiatives: 'strategy',
  financial: 'financial',
  kpi: 'performance',
  risk: 'risk',
  execution: 'execution',
  valuation: 'financial',
};

function resolveCategory(sectionType: string, label: string): string {
  if (SECTION_CATEGORY_MAP[sectionType]) {
    return SECTION_CATEGORY_MAP[sectionType];
  }
  const lower = label.toLowerCase();
  if (
    lower.includes('revenue') ||
    lower.includes('cost') ||
    lower.includes('profit') ||
    lower.includes('value')
  ) {
    return 'financial';
  }
  if (lower.includes('risk') || lower.includes('threat')) {
    return 'risk';
  }
  if (lower.includes('kpi') || lower.includes('metric') || lower.includes('target')) {
    return 'performance';
  }
  return 'general';
}

function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return undefined;
  const mapping: Record<string, string> = {
    '%': '%',
    percent: '%',
    pct: '%',
    PLN: 'PLN',
    pln: 'PLN',
    USD: 'USD',
    usd: 'USD',
    EUR: 'EUR',
    eur: 'EUR',
    x: 'x',
    days: 'days',
    months: 'months',
    years: 'years',
  };
  return mapping[unit] ?? unit;
}

function normalizeTimestamp(raw?: string): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toISOString();
}

function generateFactId(index: number, sourceId: string): string {
  return `fact_${sourceId.slice(0, 8)}_${index}`;
}

/**
 * Extract structured facts from the context_pack data.
 * Maps data_points and key_points into a flat FactSet array.
 */
export function extractFacts(input: NarrativeEngineInput): FactSet[] {
  const { context_pack, section_type } = input;
  const facts: FactSet[] = [];

  const dataPoints: any[] = context_pack?.data_points ?? [];
  const keyPoints: string[] = context_pack?.key_points ?? [];
  const sources: any[] = context_pack?.sources ?? [];

  const sourceMap = new Map<
    string,
    { artifact_id: string; artifact_type: string; artifact_name: string }
  >();
  for (const s of sources) {
    sourceMap.set(s.artifact_id, {
      artifact_id: s.artifact_id,
      artifact_type: s.artifact_type,
      artifact_name: s.artifact_name ?? s.artifact_type,
    });
  }

  const fallbackSource = {
    artifact_id: 'context_pack',
    artifact_type: 'context_pack',
    artifact_name: 'Context Pack',
  };

  for (let i = 0; i < dataPoints.length; i++) {
    const dp = dataPoints[i];
    const srcRef = sourceMap.get(dp.source_artifact_id) ?? fallbackSource;

    facts.push({
      fact_id: generateFactId(i, dp.source_artifact_id ?? 'dp'),
      category: resolveCategory(section_type, dp.label ?? ''),
      label: dp.label ?? `Data Point ${i + 1}`,
      value: dp.value,
      unit: normalizeUnit(dp.unit),
      source_ref: srcRef,
      timestamp: normalizeTimestamp(dp.period),
    });
  }

  for (let j = 0; j < keyPoints.length; j++) {
    const kp = keyPoints[j];
    const colonIdx = kp.indexOf(':');
    const label = colonIdx > 0 ? kp.slice(0, colonIdx).trim() : `Key Point ${j + 1}`;
    const value = colonIdx > 0 ? kp.slice(colonIdx + 1).trim() : kp;

    facts.push({
      fact_id: generateFactId(dataPoints.length + j, 'kp'),
      category: resolveCategory(section_type, label),
      label,
      value,
      source_ref: fallbackSource,
    });
  }

  return facts;
}
