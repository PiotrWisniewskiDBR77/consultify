import { v8Get } from './client';

export interface V8FinanceDashboard {
  ingestionPipeline: {
    totalCount: number;
    byState: Record<string, number>;
    confidenceBands: {
      high: number;
      medium: number;
      low: number;
      unknown: number;
    };
    averageConfidence: number | null;
  };
  linkageHealth: {
    totalLinkages: number;
    byLinkageType: Record<string, number>;
    unlinkedInitiativesCount: number;
  };
  unresolvedEscalationsCount: number;
  staleSourceRefreshesCount: number;
  promotionGatePassRate: number | null;
}

export const V8FinanceApi = {
  getDashboard: () => v8Get<{ dashboard: V8FinanceDashboard }>('/finance/dashboard'),
};
