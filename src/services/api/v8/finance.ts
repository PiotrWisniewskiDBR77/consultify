import { v8Delete, v8Get, v8Post, v8PostMultipart, v8Put } from './client';

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
  /** FIN-04: null when this row IS an Investment Case root; otherwise the root's id. */
  case_id?: string | null;
  /** FIN-04: at most one TRUE per (org, case) — enforced server-side (see setBaseline). */
  is_baseline?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceModelDetail extends V8FinanceModelSummary {
  assumptions_json?: Record<string, unknown>;
  source_statement?: Record<string, unknown> | null;
  source_statement_pack?: Record<string, unknown> | null;
  events?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface V8FinanceModelValidation {
  id?: string;
  model_id?: string;
  period_date?: string | null;
  check_code: string;
  check_name: string;
  status: string;
  expected_value?: number | null;
  actual_value?: number | null;
  difference?: number | null;
  message?: string | null;
}

export interface V8FinanceModelValidationResult {
  validations: V8FinanceModelValidation[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    warning: number;
  };
}

export interface V8FinanceModelOutputLine {
  lineCode: string;
  lineName: string;
  value: number;
}

export interface V8FinanceModelOutputsResult {
  raw: Array<Record<string, unknown>>;
  grouped: Record<string, Record<string, V8FinanceModelOutputLine[]>>;
}

export interface V8FinanceModelComputeResult {
  success: boolean;
  overallStatus: string;
  periodCount: number;
  validationSummary: {
    total: number;
    pass: number;
    fail: number;
    warning: number;
  };
}

export interface V8FinanceModelApproveResult {
  success: boolean;
  status: string;
}

export interface V8FinanceModelCreatePayload {
  name: string;
  description?: string;
  currency?: string;
  horizonMonths?: number;
  startDate: string;
  granularity?: string;
  scenario?: string;
  assumptions?: Record<string, unknown>;
  projectId?: string;
  initiativeId?: string;
  sourceStatementId?: string;
  sourceStatementPackId?: string;
  /** FIN-04: create this model AS A SCENARIO of an existing Investment Case. */
  caseId?: string;
  /**
   * FIN-03: a client-generated key (e.g. uuid) that survives a retry — a
   * double-click or a network-retried POST with the SAME key returns the
   * original Investment Case/scenario instead of creating a duplicate.
   */
  idempotencyKey?: string;
}

export interface V8FinanceBudgetRegistrationPayload {
  title: string;
  description?: string;
  projectId?: string;
  periodStart: string;
  periodEnd: string;
  granularity: 'monthly' | 'quarterly' | 'annual';
  currency: string;
  sourceKind: 'manual' | 'tool_session';
  sourceToolSessionId?: string;
}

export interface V8FinanceBudgetRegistrationResult {
  budget: {
    id: string;
    organizationId: string;
    projectId?: string;
    title: string;
    description?: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    granularity: string;
    currency: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  lineCount: number;
  scenarioCount: number;
  replay: boolean;
}

export interface V8FinanceBudgetLineCommandPayload {
  expectedVersion: number;
  baselineValue?: string;
  source?: 'baseline' | 'manual' | 'driver' | 'formula';
  driverKpiId?: string | null;
  driverFormula?: string | null;
  isLocked?: boolean;
}

export interface V8FinanceBudgetLineCommandResult {
  budgetId: string;
  line: {
    id: string;
    lineCode: string;
    baselineValue: string;
    source: 'baseline' | 'manual' | 'driver' | 'formula';
    driverKpiId: string | null;
    driverFormula: string | null;
    isLocked: boolean;
  };
  budgetVersion: number;
  replay: boolean;
}

export interface V8FinanceCaseScenario {
  id: string;
  name: string;
  scenario?: string | null;
  status?: string | null;
  version?: number | null;
  is_baseline: boolean;
  case_id: string | null;
  currency?: string | null;
  start_date?: string | null;
  horizon_months?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V8FinanceModelEventCreatePayload {
  eventType: string;
  name: string;
  description?: string;
  amount: number;
  periodStart: string;
  periodEnd?: string;
  recurrence?: string;
  growthRate?: number;
  cfClassification: string;
  postingRules?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  sortOrder?: number;
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

export interface V8FinanceStatementDetail {
  id: string;
  statement_type: string;
  period_label?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  currency?: string | null;
  scaling?: string | null;
  source_file_name?: string | null;
  status?: string | null;
  validation_status?: string | null;
  statement_pack_id?: string | null;
  values?: Array<Record<string, unknown>>;
  validationLedger?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface V8FinanceStatementSummary {
  id: string;
  statement_type: string;
  period_start?: string | null;
  period_end?: string | null;
  period_label?: string | null;
  currency?: string | null;
  scaling?: string | null;
  source_file_name?: string | null;
  validation_status?: string | null;
  status?: string | null;
  readiness_status?: string | null;
  readiness_score?: number | null;
  total_line_count?: number | null;
  mapped_line_count?: number | null;
  unmapped_line_count?: number | null;
  non_financial_line_count?: number | null;
  is_workable?: boolean | null;
  [key: string]: unknown;
}

export interface V8FinanceCanonicalLineOption {
  id: string;
  statement_type?: string | null;
  line_code?: string | null;
  line_name: string;
  line_name_en?: string | null;
  line_name_pl?: string | null;
  parent_line_id?: string | null;
  sort_order?: number | null;
  aggregation_level?: number | null;
  required_level?: number | null;
  sign_convention?: string | null;
  is_total?: boolean | null;
  is_subtotal?: boolean | null;
  is_computed?: boolean | null;
  formula_json?: string | null;
  deaggregation_ready?: boolean | null;
  taxonomy_version?: string | null;
}

export interface V8FinanceStatementRatio {
  code: string;
  name: string;
  namePl?: string | null;
  value: number | null;
  status: string;
  category?: string | null;
  formula?: string | null;
  formulaDescription?: string | null;
  formulaDescriptionPl?: string | null;
  unit?: string | null;
  coveragePct?: number | null;
  missingLines?: string[] | null;
}

export interface V8FinanceStatementRatioResult {
  statementId: string;
  periodLabel: string;
  ratios: V8FinanceStatementRatio[];
  coverageSummary?: { total: number; computed: number; na?: number; coveragePct: number };
  compositeScores?: Record<string, unknown> | null;
}

export interface V8FinanceStatementDocumentIntelMatch {
  chunkText: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface V8FinanceStatementDocumentIntelResult {
  statementId: string;
  query: string;
  matches: V8FinanceStatementDocumentIntelMatch[];
  authoritativeForNumbers: boolean;
}

export interface V8FinanceStatementConfirmResult {
  success: boolean;
  statementId: string;
  statementPackId?: string | null;
  ingestRunId?: string | null;
  status: string;
  readiness?: Record<string, unknown>;
}

export interface V8FinanceStatementDetectResult {
  statementId: string;
  statementPackId?: string | null;
  ingestRunId?: string | null;
  detection: Record<string, unknown>;
  documentProfile?: Record<string, unknown>;
  columnSelection?: Record<string, unknown>;
}

export interface V8FinanceStatementExtractLine {
  originalLabel: string;
  value: number;
  confidence?: number;
  sourceRow?: number;
  isNonFinancial?: boolean;
  classificationReason?: string;
  selectedPeriodLabel?: string;
  [key: string]: unknown;
}

export interface V8FinanceStatementExtractResult {
  statementId: string;
  ingestRunId?: string | null;
  lines: V8FinanceStatementExtractLine[];
  sections?: Array<Record<string, unknown>>;
  columnSelection?: Record<string, unknown>;
  rawTableCount?: number;
  warnings?: string[];
  lineCount?: number;
  extractionStrategy?: string;
  documentClass?: string;
}

export interface V8FinanceStatementMappedLine extends V8FinanceStatementExtractLine {
  suggestedCanonicalId?: string;
  mappingReason?: string;
  mappingTier?: string;
}

export interface V8FinanceStatementMapResult {
  statementId: string;
  ingestRunId?: string | null;
  mappedLines: V8FinanceStatementMappedLine[];
  policyAssessment?: Record<string, unknown>;
}

export interface V8FinanceStatementValuesSaveResult {
  statementId: string;
  statementPackId?: string | null;
  ingestRunId?: string | null;
  savedCount: number;
  valuesVersion: number;
  readiness?: Record<string, unknown>;
  validation?: Record<string, unknown>;
}

export interface V8FinanceStatementSourceReceipt {
  receipt_id: string;
  original_file_name: string;
  content_sha256: string;
  size_bytes: number;
  mime_type: string;
  entity_name: string;
  periods_json: Array<Record<string, unknown>>;
  page_ranges_json: Array<Record<string, unknown>>;
  imported_by: string;
  imported_at: string;
  importer_name?: string;
  importer_version?: string;
  source_kind?: string;
}

export interface V8FinanceStatementAnalyticsResult {
  periods?: Array<{ label: string; index: number }>;
  rows?: Array<Record<string, unknown>>;
}

export interface V8FinanceStatementUploadAnalyzeResult {
  success: boolean;
  mode: 'smart' | 'fallback' | 'legacy';
  statementPackId?: string | null;
  statementIds: string[];
  analysis?: Record<string, unknown> | null;
  detection?: Record<string, unknown> | null;
  statements?: Array<Record<string, unknown>>;
  message?: string;
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

// ==========================================
// P05 Lane / Version / Degraded types
// ==========================================

export type FinanceLaneStep = 'import' | 'analysis' | 'mutation' | 'readback';
export type ImportOutcome =
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'queued'
  | 'running'
  | 'cancelled'
  | 'mapping_missing'
  | 'schema_drift';
export type MutationOutcome = 'applied' | 'failed' | 'conflict' | 'rolled_back';
export type FinanceVersionType = 'current' | 'actual';
export type KpiLinkageStatus = 'coherent' | 'stale' | 'unavailable';

export interface FinanceDegradedEntry {
  reason: string;
  detail: string;
  nextAction: string;
  at?: string;
}

export interface FinanceLaneRun {
  runId: string;
  organizationId: string;
  currentStep: FinanceLaneStep;
  importOutcome: ImportOutcome | null;
  analysisCompleted: boolean;
  mutationOutcome: MutationOutcome | null;
  readbackConfirmed: boolean;
  degraded: FinanceDegradedEntry[];
  auditTrail: Array<{
    at: string;
    step: FinanceLaneStep;
    actor: string;
    outcome: string;
    detail?: string;
  }>;
  versionType: FinanceVersionType;
  kpiLinkageStatus: KpiLinkageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceMutationAudit {
  auditId: string;
  organizationId: string;
  runId: string;
  mutationType: string;
  targetEntity: string;
  previousValue: string | null;
  newValue: string;
  outcome: MutationOutcome;
  actor: string;
  createdAt: string;
}

export interface FinanceVersionSnapshot {
  snapshotId: string;
  organizationId: string;
  versionType: FinanceVersionType;
  snapshotData: Record<string, unknown>;
  isFinalized: boolean;
  switchoverDate: string | null;
  switchoverActor: string | null;
  createdAt: string;
}

export interface KpiCoherenceResult {
  status: KpiLinkageStatus;
  detail: string;
  reconciliationMismatches?: Array<{
    reconciliationId: string;
    mismatchCategory: string;
  }>;
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

export type V8FinanceAnalysisUpdatePayload = Partial<
  Omit<V8FinanceAnalysisCreatePayload, 'projectId' | 'analysisType'> & {
    rebuildFromStatements: boolean;
  }
>;

export const V8FinanceApi = {
  getDashboard: () => v8Get<{ dashboard: V8FinanceDashboard }>('/finance/dashboard'),
  getModels: () => v8Get<{ models: V8FinanceModelSummary[]; count: number }>('/finance/models'),
  createModel: (body: V8FinanceModelCreatePayload) =>
    v8Post<{ model: V8FinanceModelDetail }>('/finance/models', body),
  getModel: (modelId: string) =>
    v8Get<{ model: V8FinanceModelDetail }>(`/finance/models/${modelId}`),
  getModelValidations: (modelId: string) =>
    v8Get<V8FinanceModelValidationResult>(`/finance/models/${modelId}/validations`),
  getModelOutputs: (modelId: string, params?: { scenario?: string }) =>
    v8Get<V8FinanceModelOutputsResult>(`/finance/models/${modelId}/outputs`, {
      ...(params?.scenario ? { scenario: params.scenario } : {}),
    }),
  computeModel: (modelId: string) =>
    v8Post<V8FinanceModelComputeResult>(`/finance/models/${modelId}/compute`, {}),
  approveModel: (modelId: string, opts?: { expectedVersion?: number; idempotencyKey?: string }) =>
    v8Post<V8FinanceModelApproveResult & { code?: string; serverVersion?: number }>(
      `/finance/models/${modelId}/approve`,
      {
        ...(opts?.expectedVersion !== undefined ? { expectedVersion: opts.expectedVersion } : {}),
        ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      }
    ),
  /** FIN-04: siblings (Base/Upside/Downside + case root) of modelId's Investment Case. */
  getCaseScenarios: (modelId: string) =>
    v8Get<{ scenarios: V8FinanceCaseScenario[]; count: number; baselineModelId: string | null }>(
      `/finance/models/${modelId}/case`
    ),
  /** FIN-04: atomically make modelId the baseline of its case (demotes the previous one). */
  setBaseline: (modelId: string) =>
    v8Post<{
      success: boolean;
      caseId: string;
      baselineModelId: string;
      previousBaselineModelId: string | null;
    }>(`/finance/models/${modelId}/set-baseline`, {}),
  refreshModelSource: (modelId: string) =>
    v8Post<{
      success: boolean;
      seededFrom: 'statement' | 'statement_pack';
      missingBaselineLines: string[];
    }>(`/finance/models/${modelId}/refresh-source`, {}),
  addModelEvent: (modelId: string, body: V8FinanceModelEventCreatePayload) =>
    v8Post<{ success: boolean; id: string }>(`/finance/models/${modelId}/events`, body),
  deleteModelEvent: (eventId: string) =>
    v8Delete<{ success: boolean; deleted: string }>(`/finance/events/${eventId}`),
  updateModel: (
    modelId: string,
    body: { assumptions?: Record<string, unknown> } & Record<string, unknown>,
    opts?: { expectedVersion?: number }
  ) =>
    v8Put<{ success: boolean; code?: string; serverVersion?: number }>(
      `/finance/models/${modelId}`,
      opts?.expectedVersion !== undefined
        ? { ...body, expectedVersion: opts.expectedVersion }
        : body
    ),
  deleteModel: (modelId: string) =>
    v8Delete<{ success: boolean; deleted: string }>(`/finance/models/${modelId}`),
  getValuations: () =>
    v8Get<{ valuations: V8FinanceValuationSummary[]; count: number }>('/finance/valuations'),
  getBudgets: () => v8Get<{ budgets: V8FinanceBudgetSummary[]; count: number }>('/finance/budgets'),
  createBudget: (body: V8FinanceBudgetRegistrationPayload, idempotencyKey: string) =>
    v8Post<V8FinanceBudgetRegistrationResult>('/finance/budgets', body, {
      extraHeaders: { 'Idempotency-Key': idempotencyKey },
    }),
  updateBudgetLine: (
    budgetId: string,
    lineId: string,
    body: V8FinanceBudgetLineCommandPayload,
    idempotencyKey: string
  ) =>
    v8Put<V8FinanceBudgetLineCommandResult>(`/finance/budgets/${budgetId}/lines/${lineId}`, body, {
      extraHeaders: { 'Idempotency-Key': idempotencyKey },
    }),
  getStatementPacks: (params?: { readiness?: string }) =>
    v8Get<{ statementPacks: V8FinanceStatementPackSummary[]; count: number }>(
      '/finance/statement-packs',
      {
        ...(params?.readiness ? { readiness: params.readiness } : {}),
      }
    ),
  getStatementPack: (packId: string) =>
    v8Get<{ pack: V8FinanceStatementPackDetail }>(`/finance/statement-packs/${packId}`),
  getStatements: (params?: { readiness?: string }) =>
    v8Get<{ statements: V8FinanceStatementSummary[]; count: number }>('/finance/statements', {
      ...(params?.readiness ? { readiness: params.readiness } : {}),
    }),
  uploadAndAnalyzeStatement: (formData: FormData, extraHeaders?: Record<string, string>) =>
    v8PostMultipart<V8FinanceStatementUploadAnalyzeResult>(
      '/finance/statements/upload-and-analyze',
      formData,
      extraHeaders
    ),
  getStatement: (statementId: string) =>
    v8Get<{ statement: V8FinanceStatementDetail }>(`/finance/statements/${statementId}`),
  getStatementAnalytics: (statementId: string, params?: { level?: 1 | 2 | 3 }) =>
    v8Get<V8FinanceStatementAnalyticsResult>(`/finance/statements/${statementId}/analytics`, {
      ...(typeof params?.level === 'number' ? { level: String(params.level) } : {}),
    }),
  getStatementRatios: (statementId: string) =>
    v8Get<{ ratios: V8FinanceStatementRatioResult }>(`/finance/statements/${statementId}/ratios`),
  searchStatementDocumentIntelligence: (
    statementId: string,
    params: { q: string; limit?: number }
  ) =>
    v8Get<{ matches: V8FinanceStatementDocumentIntelMatch[]; statementId: string; query: string }>(
      `/finance/statements/${statementId}/document-intelligence/search`,
      {
        q: params.q,
        ...(typeof params.limit === 'number' ? { limit: String(params.limit) } : {}),
      }
    ),
  detectStatement: (statementId: string, body: Record<string, unknown> = {}) =>
    v8Post<V8FinanceStatementDetectResult>(`/finance/statements/${statementId}/detect`, body),
  extractStatement: (statementId: string, body: Record<string, unknown> = {}) =>
    v8Post<V8FinanceStatementExtractResult>(`/finance/statements/${statementId}/extract`, body),
  mapStatement: (statementId: string, body: { lines?: Record<string, unknown>[] } = {}) =>
    v8Post<V8FinanceStatementMapResult>(`/finance/statements/${statementId}/map`, body),
  confirmStatement: (
    statementId: string,
    body: { sourceReceiptId: string; expectedValuesVersion: number },
    idempotencyKey: string
  ) =>
    v8Post<V8FinanceStatementConfirmResult>(`/finance/statements/${statementId}/confirm`, body, {
      extraHeaders: { 'Idempotency-Key': idempotencyKey },
    }),
  putStatementValues: (statementId: string, body: { values: Record<string, unknown>[] }) =>
    v8Put<V8FinanceStatementValuesSaveResult>(`/finance/statements/${statementId}/values`, body),
  getStatementSourceReceipt: (statementId: string) =>
    v8Get<{ receipt: V8FinanceStatementSourceReceipt }>(
      `/finance/statements/${statementId}/source-receipt`
    ),
  recordStatementManualMappingDecision: (
    statementId: string,
    body: Record<string, unknown>,
    idempotencyKey: string
  ) =>
    v8Post<{ decision: Record<string, unknown> }>(
      `/finance/statements/${statementId}/manual-mapping-decisions`,
      body,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  getCanonicalLines: () =>
    v8Get<{ canonicalLines: V8FinanceCanonicalLineOption[]; count: number }>(
      '/finance/canonical-lines'
    ),
  getAnalyses: (params?: { status?: string; projectId?: string }) =>
    v8Get<{ analyses: V8FinanceAnalysisSummary[]; count: number }>('/finance/analyses', {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.projectId ? { projectId: params.projectId } : {}),
    }),
  getAnalysisRatios: (analysisId: string) =>
    v8Get<{ ratios: V8FinanceAnalysisRatio[] }>(`/finance/analyses/${analysisId}/ratios`),
  getInitiativeProposals: (analysisId: string) =>
    v8Get<{ proposals: V8FinanceInitiativeProposal[] }>(
      `/finance/analyses/${analysisId}/initiative-proposals`
    ),
  createInitiativesFromAnalysis: (analysisId: string, body: { acceptedProposalIds: string[] }) =>
    v8Post<V8FinanceInitiativeCreateResult>(`/finance/analyses/${analysisId}/initiatives`, body),
  createAnalysis: (body: V8FinanceAnalysisCreatePayload) =>
    v8Post<{ analysis: V8FinanceAnalysisSummary & Record<string, unknown> }>(
      '/finance/analyses',
      body
    ),
  updateAnalysis: (analysisId: string, body: V8FinanceAnalysisUpdatePayload) =>
    v8Put<{ success: boolean; analysisId: string }>(`/finance/analyses/${analysisId}`, body),
  deleteAnalysis: (analysisId: string) =>
    v8Delete<{ success: boolean; deleted: string }>(`/finance/analyses/${analysisId}`),
  runAnalysis: (analysisId: string) =>
    v8Post<{ success: boolean; result: unknown }>(`/finance/analyses/${analysisId}/run`, {}),
  approveAnalysis: (analysisId: string) =>
    v8Post<{ success: boolean }>(`/finance/analyses/${analysisId}/approve`, {}),

  // P05 Lane endpoints
  startLaneRun: (versionType?: FinanceVersionType) =>
    v8Post<{ data: FinanceLaneRun }>('/finance/lane/start', {
      versionType: versionType || 'current',
    }),
  advanceLaneStep: (runId: string, outcome: string, detail?: string) =>
    v8Post<{ data: FinanceLaneRun }>(`/finance/lane/${runId}/advance`, { outcome, detail }),
  getLaneRun: (runId: string) => v8Get<{ data: FinanceLaneRun }>(`/finance/lane/${runId}`),
  getLaneRuns: (limit?: number) =>
    v8Get<{ data: FinanceLaneRun[] }>('/finance/lane', {
      ...(typeof limit === 'number' ? { limit: String(limit) } : {}),
    }),
  recordMutationAudit: (
    runId: string,
    params: {
      mutationType: string;
      targetEntity: string;
      previousValue?: string;
      newValue: string;
      outcome: string;
    }
  ) => v8Post<{ data: FinanceMutationAudit }>(`/finance/lane/${runId}/mutation-audit`, params),
  getMutationAudits: (runId: string) =>
    v8Get<{ data: FinanceMutationAudit[] }>(`/finance/lane/${runId}/mutation-audit`),
  checkKpiCoherence: (runId: string) =>
    v8Get<{ data: KpiCoherenceResult }>(`/finance/lane/${runId}/kpi-coherence`),

  // P05 Version endpoints
  createVersionSnapshot: (versionType: FinanceVersionType, snapshotData: Record<string, unknown>) =>
    v8Post<{ data: FinanceVersionSnapshot }>('/finance/versions/snapshot', {
      versionType,
      snapshotData,
    }),
  finalizeVersion: (snapshotId: string) =>
    v8Post<{ data: FinanceVersionSnapshot }>(`/finance/versions/${snapshotId}/finalize`, {}),
  getVersionSnapshots: (versionType?: FinanceVersionType) =>
    v8Get<{ data: FinanceVersionSnapshot[] }>('/finance/versions', {
      ...(versionType ? { versionType } : {}),
    }),

  // M16/6.5 — Model version history + diff
  // v8Get rozpakowuje jeden poziom koperty {data} — serwer wysyła {data:{versions,count}},
  // więc tu typ to już rozpakowana zawartość (NIE {data:{...}}, to był bug: podwójny .data
  // → komponent zawsze pokazywał pusty stan mimo działającego backendu; fix 2026-07-16).
  getModelVersions: (modelId: string) =>
    v8Get<{ versions: unknown[]; count: number }>(
      `/finance/models/${encodeURIComponent(modelId)}/versions`
    ),
  getModelVersionDiff: (modelId: string, from: string, to: string) =>
    v8Get<{ diff: unknown }>(`/finance/models/${encodeURIComponent(modelId)}/versions/diff`, {
      from,
      to,
    }),
};
