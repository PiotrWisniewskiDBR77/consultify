export type ADMATransformationId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';

/**
 * Seed/example "Average Scan Responses" benchmark per ADMA pillar (5 axes).
 * SSOT pillar order: strategy, smart_products, smart_operations, smart_supply, data_driven.
 * NOTE: these are illustrative/example values (dane przykładowe), NOT real peer data.
 */
export const ADMA_DEFAULT_PEER_SCORES: number[] = [3.1, 2.7, 2.9, 2.6, 2.8];

export type ADMADimensionScore = {
  current?: number | null;
  target?: number | null;
};

export type ADMATransformationScore = {
  id: ADMATransformationId;
  name: string;
  current: number | null;
  target: number | null;
  fofBenchmark: number;
  gapToFoF: number | null;
};

type MappingSpec = {
  id: ADMATransformationId;
  name: string;
  weights: Record<string, number>;
};

// SSOT: docs/product/ADMA_ASSESSMENT_PACK_V3.md (Mapping v1 + default weights)
const DEFAULT_MAPPING_V1: MappingSpec[] = [
  {
    id: 'T1',
    name: 'Advanced Manufacturing Technologies',
    weights: { production_tech: 0.7, digital_investments: 0.3 },
  },
  {
    id: 'T2',
    name: 'Digital Factory',
    weights: { production_it: 0.45, data_collection: 0.35, data_analytics: 0.2 },
  },
  {
    id: 'T3',
    name: 'ECO Factory',
    weights: { data_collection: 0.4, data_analytics: 0.35, production_tech: 0.25 },
  },
  {
    id: 'T4',
    name: 'End-to-end Customer Focused Engineering',
    weights: { product_data: 0.55, product_features: 0.3, digital_strategy: 0.15 },
  },
  {
    id: 'T5',
    name: 'Human Centred Organisation',
    weights: { digital_culture: 0.7, digital_strategy: 0.3 },
  },
  {
    id: 'T6',
    name: 'Smart Manufacturing',
    weights: { data_analytics: 0.45, production_it: 0.3, production_tech: 0.25 },
  },
  {
    id: 'T7',
    name: 'Value Chain Oriented Open Factory',
    weights: { supply_visibility: 0.5, supply_integration: 0.35, digital_strategy: 0.15 },
  },
];

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function weightedAvg(
  dims: Record<string, ADMADimensionScore | undefined>,
  weights: Record<string, number>,
  field: 'current' | 'target'
): number | null {
  let sum = 0;
  let wSum = 0;
  for (const [dimId, w] of Object.entries(weights)) {
    const v = safeNum(dims?.[dimId]?.[field]);
    if (v === null) continue;
    sum += v * w;
    wSum += w;
  }
  if (wSum <= 0) return null;
  return Math.round((sum / wSum) * 10) / 10;
}

export function computeADMATransformationScores(params: {
  dimensions: Record<string, ADMADimensionScore | undefined>;
  fofBenchmark?: number;
  mapping?: MappingSpec[];
}): ADMATransformationScore[] {
  const fof = Number.isFinite(Number(params.fofBenchmark)) ? Number(params.fofBenchmark) : 4.0;
  const mapping = params.mapping || DEFAULT_MAPPING_V1;

  return mapping.map((m) => {
    const current = weightedAvg(params.dimensions, m.weights, 'current');
    const target = weightedAvg(params.dimensions, m.weights, 'target');
    return {
      id: m.id,
      name: m.name,
      current,
      target,
      fofBenchmark: fof,
      gapToFoF: current === null ? null : Math.round((fof - current) * 10) / 10,
    };
  });
}
