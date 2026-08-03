import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8PostMultipart: vi.fn(),
  v8Delete: vi.fn(),
  v8Put: vi.fn(),
}));

import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';
import { v8Delete, v8Get, v8Post, v8PostMultipart, v8Put } from '@/services/api/v8/client';

describe('V8FinanceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed finance dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      dashboard: {
        ingestionPipeline: {
          totalCount: 8,
          byState: { ready: 5, review_required: 3 },
          confidenceBands: { high: 4, medium: 2, low: 1, unknown: 1 },
          averageConfidence: 0.82,
        },
        linkageHealth: {
          totalLinkages: 11,
          byLinkageType: { initiative: 6, statement_pack: 5 },
          unlinkedInitiativesCount: 2,
        },
        unresolvedEscalationsCount: 3,
        staleSourceRefreshesCount: 1,
        promotionGatePassRate: 0.75,
      },
    });

    const data = await V8FinanceApi.getDashboard();

    expect(v8Get).toHaveBeenCalledWith('/finance/dashboard');
    expect(data.dashboard.ingestionPipeline.totalCount).toBe(8);
    expect(data.dashboard.linkageHealth.totalLinkages).toBe(11);
  });

  it('requests governed finance analyses from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      analyses: [
        {
          id: 'analysis-1',
          title: 'Working capital analysis',
          description: null,
          status: 'DRAFT',
          analysisType: 'financial',
          periods: ['2025-Q4'],
          currency: 'PLN',
          sourceStatementIds: [],
          createdAt: '2026-03-26T10:00:00.000Z',
          updatedAt: '2026-03-26T10:05:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getAnalyses({ status: 'DRAFT', projectId: 'project-1' });

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses', {
      status: 'DRAFT',
      projectId: 'project-1',
    });
    expect(data.count).toBe(1);
    expect(data.analyses[0].title).toBe('Working capital analysis');
  });

  it('requests governed finance models from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      models: [
        {
          id: 'model-1',
          name: 'Revenue forecast',
          status: 'draft',
          currency: 'PLN',
          horizon_months: 36,
          start_date: '2026-01-01',
          updated_at: '2026-03-27T09:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getModels();

    expect(v8Get).toHaveBeenCalledWith('/finance/models');
    expect(data.count).toBe(1);
    expect(data.models[0].name).toBe('Revenue forecast');
  });

  it('creates governed finance models through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      model: {
        id: 'model-1',
        name: 'Created model',
        status: 'draft',
        start_date: '2026-01-01',
      },
    } as any);

    const data = await V8FinanceApi.createModel({
      name: 'Created model',
      startDate: '2026-01-01',
      currency: 'PLN',
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/models', {
      name: 'Created model',
      startDate: '2026-01-01',
      currency: 'PLN',
    });
    expect(data.model.id).toBe('model-1');
  });

  it('requests governed finance model detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      model: {
        id: 'model-1',
        name: 'Revenue forecast',
        status: 'draft',
        currency: 'PLN',
        assumptions_json: { initialCash: 100 },
        source_statement_pack: { id: 'pack-1', entity_name: 'Acme Sp. z o.o.' },
        events: [{ id: 'event-1', name: 'Revenue uplift' }],
      },
    });

    const data = await V8FinanceApi.getModel('model-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/models/model-1');
    expect(data.model.id).toBe('model-1');
    expect((data.model.source_statement_pack as any)?.entity_name).toBe('Acme Sp. z o.o.');
    expect(data.model.events).toHaveLength(1);
  });

  it('requests governed finance model validations from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      validations: [
        {
          id: 'validation-1',
          check_code: 'BALANCE',
          check_name: 'Balance sheet balances',
          status: 'warning',
        },
      ],
      summary: {
        total: 1,
        pass: 0,
        fail: 0,
        warning: 1,
      },
    });

    const data = await V8FinanceApi.getModelValidations('model-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/models/model-1/validations');
    expect(data.validations).toHaveLength(1);
    expect(data.summary.warning).toBe(1);
  });

  it('requests governed finance model outputs from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      raw: [{ period_label: '2026-01', statement_type: 'P&L', line_code: 'REV', value: 100 }],
      grouped: {
        '2026-01': {
          'P&L': [{ lineCode: 'REV', lineName: 'Revenue', value: 100 }],
        },
      },
    });

    const data = await V8FinanceApi.getModelOutputs('model-1', { scenario: 'base' });

    expect(v8Get).toHaveBeenCalledWith('/finance/models/model-1/outputs', { scenario: 'base' });
    expect(data.grouped['2026-01']['P&L']).toHaveLength(1);
    expect(data.grouped['2026-01']['P&L'][0].lineName).toBe('Revenue');
  });

  it('posts governed finance model compute through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      overallStatus: 'warning',
      periodCount: 2,
      validationSummary: { total: 2, pass: 1, fail: 0, warning: 1 },
    });

    const data = await V8FinanceApi.computeModel('model-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/models/model-1/compute', {});
    expect(data.success).toBe(true);
    expect(data.periodCount).toBe(2);
    expect(data.validationSummary.warning).toBe(1);
  });

  it('posts governed finance model approve through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      status: 'approved',
    });

    const data = await V8FinanceApi.approveModel('model-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/models/model-1/approve', {});
    expect(data.success).toBe(true);
    expect(data.status).toBe('approved');
  });

  it('updates governed finance model assumptions through the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
    });

    const data = await V8FinanceApi.updateModel('model-1', {
      assumptions: { initialCash: 1000 },
    });

    expect(v8Put).toHaveBeenCalledWith('/finance/models/model-1', {
      assumptions: { initialCash: 1000 },
    });
    expect(data.success).toBe(true);
  });

  it('posts governed finance model events through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      id: 'event-1',
    } as any);

    const data = await V8FinanceApi.addModelEvent('model-1', {
      eventType: 'revenue',
      name: 'New contract',
      amount: 120000,
      periodStart: '2026-01-01',
      cfClassification: 'operating',
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/models/model-1/events', {
      eventType: 'revenue',
      name: 'New contract',
      amount: 120000,
      periodStart: '2026-01-01',
      cfClassification: 'operating',
    });
    expect(data.success).toBe(true);
    expect(data.id).toBe('event-1');
  });

  it('deletes governed finance model events through the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({
      success: true,
      deleted: 'event-1',
    } as any);

    const data = await V8FinanceApi.deleteModelEvent('event-1');

    expect(v8Delete).toHaveBeenCalledWith('/finance/events/event-1');
    expect(data.success).toBe(true);
    expect(data.deleted).toBe('event-1');
  });

  it('deletes governed finance models through the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({
      success: true,
      deleted: 'model-1',
    });

    const data = await V8FinanceApi.deleteModel('model-1');

    expect(v8Delete).toHaveBeenCalledWith('/finance/models/model-1');
    expect(data.success).toBe(true);
    expect(data.deleted).toBe('model-1');
  });

  it('requests governed finance statement packs from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      statementPacks: [
        {
          id: 'pack-1',
          entity_name: 'Acme Sp. z o.o.',
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          period_label: 'Q1 2026',
          currency: 'PLN',
          pack_status: 'pending',
          pack_readiness_status: 'recoverable',
          source_statement_count: 2,
          updated_at: '2026-03-27T12:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getStatementPacks({ readiness: 'recoverable' });

    expect(v8Get).toHaveBeenCalledWith('/finance/statement-packs', {
      readiness: 'recoverable',
    });
    expect(data.count).toBe(1);
    expect(data.statementPacks[0].entity_name).toBe('Acme Sp. z o.o.');
  });

  it('requests governed finance statement-pack detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        statements: [],
        validations: [],
      },
    });

    const data = await V8FinanceApi.getStatementPack('pack-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/statement-packs/pack-1');
    expect(data.pack.id).toBe('pack-1');
    expect(data.pack.entity_name).toBe('Acme Sp. z o.o.');
  });

  it('requests governed finance child statement detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        values: [],
        validationLedger: [],
      },
    });

    const data = await V8FinanceApi.getStatement('statement-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/statements/statement-1');
    expect(data.statement.id).toBe('statement-1');
    expect(data.statement.statement_type).toBe('P&L');
  });

  it('requests governed finance statement analytics from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      periods: [{ label: 'Q1 2026', index: 0 }],
      rows: [{ id: 'row-1', label: 'Revenue', value: 100 }],
    });

    const data = await V8FinanceApi.getStatementAnalytics('statement-1', { level: 3 });

    expect(v8Get).toHaveBeenCalledWith('/finance/statements/statement-1/analytics', {
      level: '3',
    });
    expect(data.periods?.[0]?.label).toBe('Q1 2026');
    expect(data.rows?.[0]?.id).toBe('row-1');
  });

  it('requests governed finance statements list from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      statements: [
        {
          id: 'statement-1',
          statement_type: 'P&L',
          period_label: 'Q1 2026',
          source_file_name: 'acme-q1.csv',
          readiness_status: 'recoverable',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getStatements({ readiness: 'recoverable' });

    expect(v8Get).toHaveBeenCalledWith('/finance/statements', {
      readiness: 'recoverable',
    });
    expect(data.count).toBe(1);
    expect(data.statements[0].id).toBe('statement-1');
  });

  it('uploads and analyzes finance statements through the V8 namespace', async () => {
    vi.mocked(v8PostMultipart).mockResolvedValue({
      success: true,
      mode: 'legacy',
      statementIds: ['statement-1'],
    } as any);

    const formData = new FormData();
    formData.append('file', new Blob(['revenue']), 'statement.csv');

    const data = await V8FinanceApi.uploadAndAnalyzeStatement(formData);

    // FIN-005 Fix 2: uploadAndAnalyzeStatement now threads an optional
    // extraHeaders 3rd param (e.g. Idempotency-Key) through to
    // v8PostMultipart — undefined here since this call site doesn't pass one.
    expect(v8PostMultipart).toHaveBeenCalledWith(
      '/finance/statements/upload-and-analyze',
      formData,
      undefined
    );
    expect(data.mode).toBe('legacy');
    expect(data.statementIds).toEqual(['statement-1']);
  });

  it('threads an Idempotency-Key header through to v8PostMultipart when provided', async () => {
    vi.mocked(v8PostMultipart).mockResolvedValue({
      success: true,
      mode: 'smart',
      statementIds: ['statement-2'],
    } as any);

    const formData = new FormData();
    formData.append('file', new Blob(['revenue']), 'statement.csv');

    await V8FinanceApi.uploadAndAnalyzeStatement(formData, { 'Idempotency-Key': 'key-abc' });

    expect(v8PostMultipart).toHaveBeenCalledWith(
      '/finance/statements/upload-and-analyze',
      formData,
      { 'Idempotency-Key': 'key-abc' }
    );
  });

  it('requests governed finance statement ratios from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [{ code: 'CURRENT_RATIO', name: 'Current Ratio', value: 1.42, status: 'ok' }],
        coverageSummary: { total: 1, computed: 1, na: 0, coveragePct: 100 },
      },
    });

    const data = await V8FinanceApi.getStatementRatios('statement-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/statements/statement-1/ratios');
    expect(data.ratios.statementId).toBe('statement-1');
    expect(data.ratios.coverageSummary?.coveragePct).toBe(100);
  });

  it('requests governed finance statement document-intelligence search from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      statementId: 'statement-1',
      query: 'revenue',
      matches: [
        {
          chunkText: 'Revenue increased due to seasonality.',
          score: 0.91,
        },
      ],
      authoritativeForNumbers: false,
    });

    const data = await V8FinanceApi.searchStatementDocumentIntelligence('statement-1', {
      q: 'revenue',
      limit: 3,
    });

    expect(v8Get).toHaveBeenCalledWith('/finance/statements/statement-1/document-intelligence/search', {
      q: 'revenue',
      limit: '3',
    });
    expect(data.statementId).toBe('statement-1');
    expect(data.matches[0].chunkText).toBe('Revenue increased due to seasonality.');
  });

  it('posts governed finance statement detect through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      statementId: 'statement-1',
      statementPackId: 'pack-1',
      ingestRunId: 'ingest-run-1',
      detection: {
        statementType: 'P&L',
        periodLabel: 'Q1 2026',
      },
    });

    const data = await V8FinanceApi.detectStatement('statement-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/statements/statement-1/detect', {});
    expect(data.statementId).toBe('statement-1');
    expect((data.detection as Record<string, unknown>).statementType).toBe('P&L');
  });

  it('posts governed finance statement extract through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      statementId: 'statement-1',
      ingestRunId: 'ingest-run-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
      lineCount: 1,
      extractionStrategy: 'local_parser',
      documentClass: 'financial_statement',
    });

    const data = await V8FinanceApi.extractStatement('statement-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/statements/statement-1/extract', {});
    expect(data.statementId).toBe('statement-1');
    expect(data.lines[0].originalLabel).toBe('Revenue');
  });

  it('posts governed finance statement map through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      statementId: 'statement-1',
      ingestRunId: 'ingest-run-1',
      mappedLines: [{ originalLabel: 'Revenue', value: 100, suggestedCanonicalId: 'line-1' }],
      policyAssessment: { coveragePct: 100 },
    });

    const data = await V8FinanceApi.mapStatement('statement-1', {
      lines: [{ originalLabel: 'Revenue', value: 100 }],
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/statements/statement-1/map', {
      lines: [{ originalLabel: 'Revenue', value: 100 }],
    });
    expect(data.mappedLines[0].suggestedCanonicalId).toBe('line-1');
  });

  it('posts governed finance statement confirm through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      statementId: 'statement-1',
      statementPackId: 'pack-1',
      ingestRunId: 'ingest-run-1',
      status: 'confirmed',
    });

    const data = await V8FinanceApi.confirmStatement('statement-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/statements/statement-1/confirm', {});
    expect(data.success).toBe(true);
    expect(data.statementPackId).toBe('pack-1');
  });

  it('puts governed finance statement values through the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      statementId: 'statement-1',
      statementPackId: 'pack-1',
      ingestRunId: 'ingest-run-1',
      savedCount: 1,
      readiness: { readinessStatus: 'recoverable' },
      validation: { status: 'warnings' },
    });

    const data = await V8FinanceApi.putStatementValues('statement-1', {
      values: [{ canonicalLineId: 'line-1', originalLabel: 'Revenue', value: 100 }],
    });

    expect(v8Put).toHaveBeenCalledWith('/finance/statements/statement-1/values', {
      values: [{ canonicalLineId: 'line-1', originalLabel: 'Revenue', value: 100 }],
    });
    expect(data.savedCount).toBe(1);
    expect(data.statementPackId).toBe('pack-1');
  });

  it('requests governed finance canonical lines from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      canonicalLines: [
        {
          id: 'line-1',
          statement_type: 'P&L',
          line_code: 'revenue',
          line_name: 'Revenue',
          line_name_pl: 'Przychody',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getCanonicalLines();

    expect(v8Get).toHaveBeenCalledWith('/finance/canonical-lines');
    expect(data.count).toBe(1);
    expect(data.canonicalLines[0].line_name).toBe('Revenue');
  });

  it('requests governed finance valuations from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      valuations: [
        {
          id: 'valuation-1',
          title: 'DCF valuation',
          status: 'draft',
          source_type: 'financial_model',
          currency: 'PLN',
          horizon_years: 5,
          updated_at: '2026-03-27T10:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getValuations();

    expect(v8Get).toHaveBeenCalledWith('/finance/valuations');
    expect(data.count).toBe(1);
    expect(data.valuations[0].title).toBe('DCF valuation');
  });

  it('requests governed finance budgets from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      budgets: [
        {
          id: 'budget-1',
          title: 'FY26 operating budget',
          status: 'draft',
          currency: 'PLN',
          granularity: 'monthly',
          period_start: '2026-01-01',
          period_end: '2026-12-31',
          updated_at: '2026-03-27T11:00:00.000Z',
        },
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getBudgets();

    expect(v8Get).toHaveBeenCalledWith('/finance/budgets');
    expect(data.count).toBe(1);
    expect(data.budgets[0].title).toBe('FY26 operating budget');
  });

  it('requests governed finance analysis ratios from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      ratios: [
        {
          category: 'liquidity',
          ratio_code: 'current_ratio',
          ratio_name: 'Current ratio',
          value: 1.42,
        },
      ],
    });

    const data = await V8FinanceApi.getAnalysisRatios('analysis-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses/analysis-1/ratios');
    expect(data.ratios[0].ratio_code).toBe('current_ratio');
  });

  it('requests governed finance initiative proposals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          title: 'Reduce overdue receivables',
          summary: 'Shorten DSO with collections sprint',
          kind: 'action',
          priority: 9,
        },
      ],
    });

    const data = await V8FinanceApi.getInitiativeProposals('analysis-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses/analysis-1/initiative-proposals');
    expect(data.proposals[0].kind).toBe('action');
  });

  it('creates initiatives from an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      initiativeIds: ['initiative-1'],
    } as any);

    const data = await V8FinanceApi.createInitiativesFromAnalysis('analysis-1', {
      acceptedProposalIds: ['proposal-1'],
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/initiatives', {
      acceptedProposalIds: ['proposal-1'],
    });
    expect(data.initiativeIds[0]).toBe('initiative-1');
  });

  it('creates an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      analysis: {
        id: 'analysis-1',
        title: 'Created analysis',
        status: 'DRAFT',
        analysisType: 'comprehensive',
        periods: [],
        currency: 'PLN',
        sourceStatementIds: [],
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    } as any);

    const data = await V8FinanceApi.createAnalysis({
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses', {
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });
    expect(data.analysis.title).toBe('Created analysis');
  });

  it('deletes an analysis through the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({
      success: true,
      deleted: 'analysis-1',
    } as any);

    const data = await V8FinanceApi.deleteAnalysis('analysis-1');

    expect(v8Delete).toHaveBeenCalledWith('/finance/analyses/analysis-1');
    expect(data.deleted).toBe('analysis-1');
  });

  it('runs an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      result: { ratios: [{ ratio_code: 'current_ratio', value: 1.42 }] },
    } as any);

    const data = await V8FinanceApi.runAnalysis('analysis-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/run', {});
    expect(data.success).toBe(true);
  });

  it('approves an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
    } as any);

    const data = await V8FinanceApi.approveAnalysis('analysis-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/approve', {});
    expect(data.success).toBe(true);
  });

  it('falls back to legacy finance routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacyFinance({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacyFinance({ status: 501 })).toBe(true);
    expect(shouldFallbackToLegacyFinance({ status: 500 })).toBe(false);
  });
});
