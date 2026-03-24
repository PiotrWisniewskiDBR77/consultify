import { v8Get } from './client';

export type V8MyWorkRoofStatus = 'mixed_truth' | 'partially_coherent' | 'coherent';
export type V8MyWorkRoofMaturity =
  | 'backed_by_real_service'
  | 'partial_stitched'
  | 'placeholder_non_canonical';

export interface V8MyWorkRoofSummary {
  generatedAt: string;
  overallStatus: V8MyWorkRoofStatus;
  surfaceMode: string;
  contracts: {
    homeV2Endpoint: boolean;
    radarEndpoint: boolean;
    homeViewUsesAggregatedContract: boolean;
    outputsBridgeVisible: boolean;
  };
  homeBlocks: Array<{
    blockName: string;
    maturityLevel: V8MyWorkRoofMaturity;
    serviceRef: string | null;
    lastAuditedAt: string;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
  counts: Record<V8MyWorkRoofMaturity, number>;
  inboxMaterialization: {
    avgLatencyMs: number;
    latencyBandDistribution: {
      near_realtime: number;
      operational: number;
      degraded: number;
    };
    status: 'observed' | 'not_proven_yet';
  };
  calendar: Array<{
    phaseName: string;
    status: string;
    blockedBy: string | null;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
}

export const V8MyWorkApi = {
  getRoofSummary: () => v8Get<V8MyWorkRoofSummary>('/my-work/roof/summary'),
};
