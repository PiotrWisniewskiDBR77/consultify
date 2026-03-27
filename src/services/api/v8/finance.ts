import { v8Delete, v8Get, v8Post } from './client';

export const shouldFallbackToLegacyFinance = (error: any) => {
  const status = Number(error?.status);
  return [400, 404, 405, 501].includes(status);
};

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

export interface V8FinanceAnalysisSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  analysisType: string;
  periods: string[];
  currency: string | null;
  sourceStatementIds: string[];
  sourceStatementPackId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface V8FinanceModelSummary {
  id: string;
  name: string;
  description?: string | null;
  project_id?: string | null;
  initiative_id?: string | null;
  currency?: string | null;
  horizon_months?: number | null;
  start_date?: string | null;
  granularity?: string | null;
  scenario?: string | null;
  status?: string | null;
  version?: number | null;
  source_statement_id?: string | null;
  source_statement_pack_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceValuationSummary {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  horizon_years?: number | null;
  currency?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceBudgetSummary {
  id: string;
  title: string;
  status?: string | null;
  currency?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  granularity?: string | null;
  version?: number | null;
  scenario?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceStatementPackSummary {
  id: string;
  entity_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  period_label?: string | null;
  currency?: string | null;
  scaling?: string | null;
  pack_status?: string | null;
  pack_readiness_status?: string | null;
  pack_readiness_score?: number | null;
  pack_quality_summary?: string | null;
  pack_quality_reason_codes?: string[] | string | null;
  source_statement_count?: number | null;
  missing_statement_types?: string[] | string | null;
  pl_count?: number | null;
  bs_count?: number | null;
  cf_count?: number | null;
  latest_statement_updated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceStatementPackDetail extends V8FinanceStatementPackSummary {
  validations?: Array<Record<string, unknown>>;
  statements?: Array<Record<string, unknown>>;
}

export interface V8FinanceAnalysisRatio {
  category: string | null;
  ratio_code: string;
  ratio_name: string;
  value: number | null;
  benchmark_value?: number | null;
  interpretation?: string | null;
  period?: string | null;
}

export interface V8FinanceInitiativeProposal {
  id: string;
  title: string;
  summary: string;
  kind: string;
  priority: number;
}

export interface V8FinanceInitiativeCreateResult {
  success: boolean;
  initiativeIds: string[];
}

export interface V8FinanceAnalysisCreatePayload {
  title: string;
  description?: string;
  projectId?: string;
  analysisType?: string;
  periods?: string[];
  statementData?: Record<string, unknown>;
  currency?: string;
  sourceStatementIds?: string[];
  sourceStatementPackId?: string;
}

export const V8FinanceApi = {
  getDashboard: () => v8Get<{ dashboard: V8FinanceDashboard }>('/finance/dashboard'),
  getModels: () =>
    v8Get<{ models: V8FinanceModelSummary[]; count: number }>('/finance/models'),
  getValuations: () =>
    v8Get<{ valuations: V8FinanceValuationSummary[]; count: number }>('/finance/valuations'),
  getBudgets: () =>
    v8Get<{ budgets: V8FinanceBudgetSummary[]; count: number }>('/finance/budgets'),
  getStatementPacks: (params?: { readiness?: string }) =>
    v8Get<{ statementPacks: V8FinanceStatementPackSummary[]; count: number }>(
      '/finance/statement-packs',
      {
        ...(params?.readiness ? { readiness: params.readiness } : {}),
      },
    ),
  getStatementPack: (packId: string) =>
    v8Get<{ pack: V8FinanceStatementPackDetail }>(`/finance/statement-packs/${packId}`),
  getAnalyses: (params?: { status?: string; projectId?: string }) =>
    v8Get<{ analyses: V8FinanceAnalysisSummary[]; count: number }>('/finance/analyses', {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.projectId ? { projectId: params.projectId } : {}),
    }),
  getAnalysisRatios: (analysisId: string) =>
    v8Get<{ ratios: V8FinanceAnalysisRatio[] }>(`/finance/analyses/${analysisId}/ratios`),
  getInitiativeProposals: (analysisId: string) =>
    v8Get<{ proposals: V8FinanceInitiativeProposal[] }>(
      `/finance/analyses/${analysisId}/initiative-proposals`,
    ),
  createInitiativesFromAnalysis: (analysisId: string, body: { acceptedProposalIds: string[] }) =>
    v8Post<V8FinanceInitiativeCreateResult>(
      `/finance/analyses/${analysisId}/initiatives`,
      body,
    ),
  createAnalysis: (body: V8FinanceAnalysisCreatePayload) =>
    v8Post<{ analysis: V8FinanceAnalysisSummary & Record<string, unknown> }>('/finance/analyses', body),
  deleteAnalysis: (analysisId: string) =>
    v8Delete<{ success: boolean; deleted: string }>(`/finance/analyses/${analysisId}`),
  runAnalysis: (analysisId: string) =>
    v8Post<{ success: boolean; result: unknown }>(`/finance/analyses/${analysisId}/run`, {}),
  approveAnalysis: (analysisId: string) =>
    v8Post<{ success: boolean }>(`/finance/analyses/${analysisId}/approve`, {}),
};
