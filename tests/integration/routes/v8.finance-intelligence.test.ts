/**
 * Wiring test for the 7 previously orphaned M16 Finance intelligence engines
 * (server/src/services/{crossStatementTieOutService,statementCompletenessService,
 * financeAnomalyDetectorService,varianceNarrationService,businessCaseGeneratorService,
 * llmFinancialPipelineService,livingBusinessCaseService}.ts — 0 importers before
 * server/src/routes/v8/finance-intelligence.routes.ts).
 *
 * Scope: routing -> service. Pure engines are exercised for real (only the DB
 * layer is mocked); the LLM pipeline service is mocked at module level so the
 * wiring (org context propagation, validation, rate-limit slot) is verified
 * without an OpenAI dependency.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockAll(...args),
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

const mockRunPipeline = vi.fn();
const mockRunDocumentPipeline = vi.fn();

vi.mock('../../../server/src/services/llmFinancialPipelineService.js', () => ({
  runLlmFinancialPipeline: (...args: unknown[]) => mockRunPipeline(...args),
  runDocumentPipeline: (...args: unknown[]) => mockRunDocumentPipeline(...args),
}));

import financeIntelligenceRoutes from '../../../server/src/routes/v8/finance-intelligence.routes.js';

const ORG = 'org-1';
const UID = 'user-1';
const PACK_ID = 'pack-1';
const ANALYSIS_ID = 'analysis-1';

function createApp(withContext = true): Express {
  const app = express();
  app.use(express.json());
  if (withContext) {
    app.use((req: any, _res, next) => {
      req.v8Context = { organizationId: ORG, userId: UID, userRole: 'owner', isSuperAdmin: false };
      req.user = { id: UID, organizationId: ORG, role: 'owner' };
      next();
    });
  }
  app.use('/api/v8/finance-intelligence', financeIntelligenceRoutes);
  return app;
}

describe('V8 Finance Intelligence — orphaned engine wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({ changes: 1 });
  });

  it('rejects requests without V8 org context (getV8Context throws -> 500, never 200)', async () => {
    const res = await request(createApp(false)).post(
      '/api/v8/finance-intelligence/variance/narrate'
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  describe('GET /packs/:packId/tie-out -> crossStatementTieOutService', () => {
    it('404s when the pack is not owned by the caller org', async () => {
      mockGet.mockResolvedValueOnce(null); // pack lookup (org-scoped)
      const res = await request(createApp()).get(
        `/api/v8/finance-intelligence/packs/${PACK_ID}/tie-out`
      );
      expect(res.status).toBe(404);
      // Pack lookup query carries [packId, organizationId]
      expect(mockGet).toHaveBeenCalledWith(expect.any(String), [PACK_ID, ORG]);
    });

    it('runs the five tie-out calculations plus the required-lines integrity check', async () => {
      mockGet.mockResolvedValueOnce({ id: PACK_ID, organization_id: ORG }); // pack
      mockAll
        .mockResolvedValueOnce([
          { id: 'st-pl', statement_type: 'P&L' },
          { id: 'st-bs', statement_type: 'BS' },
          { id: 'st-cf', statement_type: 'CF' },
        ]) // statements
        .mockResolvedValueOnce([]) // pack validations
        .mockResolvedValueOnce([
          // value maps (statement_id, line_code, value)
          { statement_id: 'st-pl', line_code: 'NET_INCOME', value: 8 },
          { statement_id: 'st-bs', line_code: 'TOTAL_ASSETS', value: 100 },
          { statement_id: 'st-bs', line_code: 'TOTAL_LIABILITIES', value: 60 },
          { statement_id: 'st-bs', line_code: 'TOTAL_EQUITY', value: 40 },
          { statement_id: 'st-bs', line_code: 'CASH', value: 10 },
          { statement_id: 'st-bs', line_code: 'RETAINED_EARNINGS', value: 8 },
          { statement_id: 'st-cf', line_code: 'CF_OPERATING', value: 5 },
          { statement_id: 'st-cf', line_code: 'CF_INVESTING', value: -2 },
          { statement_id: 'st-cf', line_code: 'CF_FINANCING', value: -1 },
          { statement_id: 'st-cf', line_code: 'CF_NET_CHANGE_IN_CASH', value: 2 },
          { statement_id: 'st-cf', line_code: 'CF_CLOSING_CASH', value: 10 },
          { statement_id: 'st-cf', line_code: 'CF_CHANGE_IN_WORKING_CAPITAL', value: 3 },
        ]);

      const res = await request(createApp()).get(
        `/api/v8/finance-intelligence/packs/${PACK_ID}/tie-out`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.packId).toBe(PACK_ID);
      expect(res.body.data.checks).toHaveLength(6);
      const byCheck = Object.fromEntries(
        res.body.data.checks.map((c: { check: string; status: string }) => [c.check, c.status])
      );
      expect(byCheck.BS_BALANCES).toBe('pass'); // 100 = 60 + 40
      expect(byCheck.CLOSING_CASH_MATCH).toBe('pass'); // 10 = 10
      expect(byCheck.CF_SECTIONS_SUM).toBe('pass'); // 5 - 2 - 1 = 2
      expect(byCheck.CF_INDIRECT_RECONCILE).toBe('pass'); // 8 + 0 - 3 = 5
      // The mounted route currently has no prior-period BS input, so the
      // service must expose the missing prerequisite instead of returning a
      // false-clean result for the five arithmetic checks.
      expect(byCheck.REQUIRED_LINES_PRESENT).toBe('fail');
      expect(res.body.data.summary.isClean).toBe(false);
      expect(res.body.meta.contract).toBe('finance_intelligence_runtime_v1');
    });
  });

  describe('POST /anomalies/detect -> financeAnomalyDetectorService (rule-based, no LLM)', () => {
    it('400s without lines[]', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/anomalies/detect')
        .send({ type: 'balance_sheet' });
      expect(res.status).toBe(400);
    });

    it('flags a tie-out break as critical and blocks confirmation', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/anomalies/detect')
        .send({
          type: 'balance_sheet',
          assets: 100,
          liabilities: 40,
          equity: 40, // 100 != 80 -> break
          lines: [{ code: 'total_assets', value: 100 }],
        });

      expect(res.status).toBe(200);
      const types = res.body.data.anomalies.map((a: { type: string }) => a.type);
      expect(types).toContain('TIE_OUT_BREAK');
      expect(res.body.data.summary.critical).toBeGreaterThan(0);
      expect(res.body.data.summary.blocksConfirm).toBe(true);
      expect(mockAll).not.toHaveBeenCalled(); // pure engine — no DB reads
    });
  });

  describe('POST /variance/narrate -> varianceNarrationService (rule-based, no LLM)', () => {
    it('400s without bridge[]', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/variance/narrate')
        .send({});
      expect(res.status).toBe(400);
    });

    it('narrates a plan-vs-actual bridge with drivers and severity', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/variance/narrate')
        .send({
          bridge: [
            { label: 'Revenue', plan: 1000, actual: 900 }, // -100 unfavorable
            { label: 'COGS', plan: 400, actual: 380, isCost: true }, // +20 favorable
          ],
          topN: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.narration.headline).toContain('Revenue');
      expect(res.body.data.drivers).toHaveLength(2);
      expect(res.body.data.drivers[0].line).toBe('Revenue');
      expect(res.body.data.severity).toBe('watch'); // |−80| / 1400 ≈ 5.7%
    });
  });

  describe('POST /completeness/* -> statementCompletenessService (pure)', () => {
    it('normalizes lines to the presentation currency via supplied FX rates', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/completeness/normalize-currency')
        .send({
          presentationCcy: 'PLN',
          rates: { EUR: 4.3, PLN: 1 },
          lines: [{ code: 'REVENUE', value: 100, currency: 'EUR' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.lines[0].value).toBeCloseTo(430, 5);
      expect(res.body.data.lines[0].originalCcy).toBe('EUR');
    });

    it('merges multi-year statements and computes YoY for a requested code', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/completeness/multi-year')
        .send({
          yoyCode: 'REVENUE',
          statements: [
            { period: '2024', lines: [{ code: 'REVENUE', value: 100 }] },
            { period: '2025', lines: [{ code: 'REVENUE', value: 120 }] },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.merged.periods).toEqual(['2024', '2025']);
      expect(res.body.data.merged.byCode.REVENUE).toEqual([100, 120]);
      expect(res.body.data.yoy[1].yoyPct).toBeCloseTo(20, 5);
    });

    it('reports readiness against REQUIRED lines only', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/completeness/readiness')
        .send({
          coverage: { REVENUE: true, TOTAL_ASSETS: false },
          requiredCoverage: ['REVENUE', 'TOTAL_ASSETS'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.ready).toBe(false);
      expect(res.body.data.reason).toContain('TOTAL_ASSETS');
    });
  });

  describe('POST /business-case/* -> businessCaseGeneratorService (pure NPV/IRR math)', () => {
    it('generates a one-pager with verdict at the supplied WACC', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/business-case/one-pager')
        .send({
          waccPct: 10,
          initiative: {
            id: 'ini-1',
            name: 'Automation',
            capex: 100,
            opexAnnual: 10,
            benefitAnnual: 60,
            horizonYears: 5,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.onePager.npv).toBeGreaterThan(0);
      expect(res.body.data.onePager.verdict).toBe('go');
      expect(res.body.data.onePager.paybackYears).not.toBeNull();
    });

    it('ranks a portfolio by NPV', async () => {
      const base = { capex: 100, opexAnnual: 10, horizonYears: 5 };
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/business-case/compare')
        .send({
          waccPct: 10,
          initiatives: [
            { id: 'weak', name: 'Weak', ...base, benefitAnnual: 20 },
            { id: 'strong', name: 'Strong', ...base, benefitAnnual: 80 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.comparison[0].id).toBe('strong');
      expect(res.body.data.comparison[0].rank).toBe(1);
      expect(res.body.data.comparison[1].id).toBe('weak');
    });
  });

  describe('POST /business-case/from-analysis/:analysisId -> livingBusinessCaseService (DB-grounded)', () => {
    it('404s when the analysis is not owned by the caller org', async () => {
      mockAll.mockResolvedValueOnce([]); // listAnalyses(ORG) -> none
      const res = await request(createApp())
        .post(`/api/v8/finance-intelligence/business-case/from-analysis/${ANALYSIS_ID}`)
        .send({ capex: 100 });
      expect(res.status).toBe(404);
      // Ownership check is org-scoped
      expect(mockAll).toHaveBeenCalledWith(expect.stringContaining('financial_analyses'), [ORG]);
    });

    it('reconstructs the benefit stream from the REAL roi_pct ratio (grounded fallback) and recomputes at live WACC', async () => {
      mockAll
        .mockResolvedValueOnce([{ id: ANALYSIS_ID, organization_id: ORG }]) // listAnalyses
        .mockResolvedValueOnce([
          {
            analysis_id: ANALYSIS_ID,
            category: 'growth',
            ratio_code: 'roi_pct',
            ratio_name: 'ROI %',
            value: 50,
            benchmark_value: null,
            interpretation: null,
          },
        ]); // getAnalysisRatios

      const res = await request(createApp())
        .post(`/api/v8/finance-intelligence/business-case/from-analysis/${ANALYSIS_ID}`)
        .send({ capex: 100, horizonYears: 5, discountRatePct: 10, waccPct: 12 });

      expect(res.status).toBe(200);
      // ROI 50% on capex 100 -> total net benefit 50 -> 10/yr over 5y (flat approximation)
      expect(res.body.data.economics.capex).toBe(100);
      expect(res.body.data.economics.cashflows).toHaveLength(5);
      expect(res.body.data.economics.cashflows[0]).toBeCloseTo(10, 5);
      expect(res.body.data.economics.costSavings).toBeGreaterThan(0);
      expect(typeof res.body.data.computed.npv).toBe('number');
      expect(res.body.data.roiAssumptions).toMatchObject({
        capex: 100,
        horizonMonths: 60,
        expectedRoiPercent: 50,
      });
    });
  });

  describe('POST /pipeline/* -> llmFinancialPipelineService (LLM, grounded in supplied text)', () => {
    it('400s without text', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/pipeline/run')
        .send({ statementType: 'BS' });
      expect(res.status).toBe(400);
      expect(mockRunPipeline).not.toHaveBeenCalled();
    });

    it('413s when text exceeds the cap', async () => {
      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/pipeline/run')
        .send({ statementType: 'BS', text: 'x'.repeat(200_001) });
      expect(res.status).toBe(413);
      expect(mockRunPipeline).not.toHaveBeenCalled();
    });

    it('propagates the caller org into the pipeline options', async () => {
      mockRunPipeline.mockResolvedValueOnce({
        statementType: 'BS',
        lines: [],
        unmappedLines: [],
        checks: [],
        qualityScore: 90,
        verdict: 'APPROVED',
        phases: {
          phase1: { total: 0, accepted: 0, rejected: 0 },
          phase2: { mapped: 0, corrected: 0, confirmed: 0 },
          phase3: { checksRun: 0, issuesFound: 0, corrections: 0 },
        },
        warnings: [],
      });

      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/pipeline/run')
        .send({ statementType: 'BS', text: 'Aktywa razem 100', options: { currency: 'PLN' } });

      expect(res.status).toBe(200);
      expect(res.body.data.result.verdict).toBe('APPROVED');
      expect(mockRunPipeline).toHaveBeenCalledWith(
        'Aktywa razem 100',
        'BS',
        expect.objectContaining({ organizationId: ORG, currency: 'PLN' })
      );
    });

    it('runs the whole-document pipeline and serializes the per-type result map', async () => {
      mockRunDocumentPipeline.mockResolvedValueOnce({
        documentName: 'annual.pdf',
        results: new Map([
          ['BS', { qualityScore: 92, verdict: 'APPROVED' }],
          ['P&L', { qualityScore: 88, verdict: 'APPROVED_WITH_NOTES' }],
        ]),
        overallScore: 90,
        overallVerdict: 'APPROVED_WITH_NOTES',
      });

      const res = await request(createApp())
        .post('/api/v8/finance-intelligence/pipeline/document')
        .send({ documentName: 'annual.pdf', text: 'Bilans ... Rachunek ...' });

      expect(res.status).toBe(200);
      expect(res.body.data.overallScore).toBe(90);
      expect(res.body.data.results.BS.verdict).toBe('APPROVED');
      expect(res.body.data.results['P&L'].verdict).toBe('APPROVED_WITH_NOTES');
      expect(mockRunDocumentPipeline).toHaveBeenCalledWith(
        expect.any(String),
        'annual.pdf',
        expect.objectContaining({ organizationId: ORG })
      );
    });
  });

  describe('GET /canonical-lines/:statementType', () => {
    it('returns the canonical catalog for a statement type', async () => {
      const res = await request(createApp()).get(
        '/api/v8/finance-intelligence/canonical-lines/BS'
      );
      expect(res.status).toBe(200);
      expect(res.body.data.statementType).toBe('BS');
      expect(Array.isArray(res.body.data.lines)).toBe(true);
      expect(res.body.data.lines.length).toBeGreaterThan(0);
    });
  });
});
