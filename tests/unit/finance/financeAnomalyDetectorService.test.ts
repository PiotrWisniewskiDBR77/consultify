import { describe, it, expect } from 'vitest';

import {
  detectAnomalies,
  anomalySummary,
  type FinanceStatement,
} from '../../../server/src/services/financeAnomalyDetectorService.js';

describe('financeAnomalyDetectorService — detectAnomalies', () => {
  it('TIE_OUT_BREAK: flags critical when balance sheet does not tie out', () => {
    const stmt: FinanceStatement = {
      type: 'balance_sheet',
      lines: [{ code: 'total_assets', value: 1000 }],
      assets: 1000,
      liabilities: 600,
      equity: 200, // 600+200 = 800, off by 20% >> 1%
    };
    const anomalies = detectAnomalies(stmt);
    const tie = anomalies.find((a) => a.type === 'TIE_OUT_BREAK');
    expect(tie).toBeDefined();
    expect(tie?.severity).toBe('critical');
  });

  it('TIE_OUT_BREAK: does not flag when within 1% tolerance', () => {
    const stmt: FinanceStatement = {
      type: 'balance_sheet',
      lines: [{ code: 'total_assets', value: 1000 }],
      assets: 1000,
      liabilities: 600,
      equity: 405, // 1005 vs 1000 = 0.5% < 1%
    };
    const anomalies = detectAnomalies(stmt);
    expect(anomalies.find((a) => a.type === 'TIE_OUT_BREAK')).toBeUndefined();
  });

  it('SIGN_ERROR: flags warning when COGS is positive but should be negative', () => {
    const stmt: FinanceStatement = {
      type: 'income_statement',
      lines: [
        { code: 'revenue', value: 5000 },
        { code: 'cogs', value: 2000, signConvention: 'negative' },
      ],
    };
    const anomalies = detectAnomalies(stmt);
    const sign = anomalies.find((a) => a.type === 'SIGN_ERROR' && a.line === 'cogs');
    expect(sign).toBeDefined();
    expect(sign?.severity).toBe('warning');
  });

  it('SIGN_ERROR: does not flag when sign matches convention', () => {
    const stmt: FinanceStatement = {
      type: 'income_statement',
      lines: [
        { code: 'revenue', value: 5000 },
        { code: 'cogs', value: -2000, signConvention: 'negative' },
      ],
    };
    const anomalies = detectAnomalies(stmt);
    expect(anomalies.find((a) => a.type === 'SIGN_ERROR')).toBeUndefined();
  });

  it('MISSING_REQUIRED: flags critical when revenue is missing from income statement', () => {
    const stmt: FinanceStatement = {
      type: 'income_statement',
      lines: [{ code: 'cogs', value: -2000, signConvention: 'negative' }],
    };
    const anomalies = detectAnomalies(stmt);
    const missing = anomalies.find(
      (a) => a.type === 'MISSING_REQUIRED' && a.line === 'revenue',
    );
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('critical');
  });

  it('MISSING_REQUIRED: flags critical when total_assets is zero', () => {
    const stmt: FinanceStatement = {
      type: 'balance_sheet',
      lines: [{ code: 'total_assets', value: 0 }],
      assets: 0,
      liabilities: 0,
      equity: 0,
    };
    const anomalies = detectAnomalies(stmt);
    const missing = anomalies.find(
      (a) => a.type === 'MISSING_REQUIRED' && a.line === 'total_assets',
    );
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('critical');
  });

  it('OUTLIER_JUMP: flags a line whose YoY change dwarfs the cohort median', () => {
    const stmt: FinanceStatement = {
      type: 'income_statement',
      lines: [
        { code: 'revenue', value: 1050, priorValue: 1000 }, // +5%
        { code: 'sga', value: 510, priorValue: 500 }, // +2%
        { code: 'cogs', value: 615, priorValue: 600, signConvention: 'positive' }, // +2.5%
        { code: 'other_income', value: 9000, priorValue: 100 }, // +8900% outlier
      ],
    };
    const anomalies = detectAnomalies(stmt);
    const outlier = anomalies.find(
      (a) => a.type === 'OUTLIER_JUMP' && a.line === 'other_income',
    );
    expect(outlier).toBeDefined();
    expect(outlier?.severity).toBe('warning');
    // The small, stable lines must NOT be flagged.
    expect(
      anomalies.some((a) => a.type === 'OUTLIER_JUMP' && a.line === 'revenue'),
    ).toBe(false);
  });

  it('returns no anomalies for a clean, balanced statement', () => {
    const stmt: FinanceStatement = {
      type: 'balance_sheet',
      lines: [
        { code: 'total_assets', value: 1000 },
        { code: 'total_liabilities', value: 600 },
        { code: 'total_equity', value: 400 },
      ],
      assets: 1000,
      liabilities: 600,
      equity: 400,
    };
    expect(detectAnomalies(stmt)).toHaveLength(0);
  });

  it('handles malformed input defensively', () => {
    expect(detectAnomalies(undefined as unknown as FinanceStatement)).toEqual([]);
    expect(
      detectAnomalies({ type: 'x', lines: undefined } as unknown as FinanceStatement),
    ).toEqual([]);
  });
});

describe('financeAnomalyDetectorService — anomalySummary', () => {
  it('blocksConfirm is true when any critical anomaly is present', () => {
    const stmt: FinanceStatement = {
      type: 'balance_sheet',
      lines: [{ code: 'total_assets', value: 1000 }],
      assets: 1000,
      liabilities: 600,
      equity: 200, // tie-out break → critical
    };
    const summary = anomalySummary(detectAnomalies(stmt));
    expect(summary.critical).toBeGreaterThanOrEqual(1);
    expect(summary.blocksConfirm).toBe(true);
  });

  it('blocksConfirm is false when only warnings/info exist', () => {
    const stmt: FinanceStatement = {
      type: 'income_statement',
      lines: [
        { code: 'revenue', value: 5000 },
        { code: 'cogs', value: 2000, signConvention: 'negative' }, // warning
      ],
    };
    const summary = anomalySummary(detectAnomalies(stmt));
    expect(summary.critical).toBe(0);
    expect(summary.warning).toBeGreaterThanOrEqual(1);
    expect(summary.blocksConfirm).toBe(false);
  });

  it('counts severities correctly and tolerates empty/garbage input', () => {
    const summary = anomalySummary([
      { type: 'TIE_OUT_BREAK', severity: 'critical', message: 'x' },
      { type: 'SIGN_ERROR', severity: 'warning', message: 'y' },
      { type: 'MISCLASSIFICATION', severity: 'info', message: 'z' },
    ]);
    expect(summary).toEqual({ critical: 1, warning: 1, info: 1, blocksConfirm: true });
    expect(anomalySummary([])).toEqual({
      critical: 0,
      warning: 0,
      info: 0,
      blocksConfirm: false,
    });
    expect(anomalySummary(undefined as never).blocksConfirm).toBe(false);
  });
});
