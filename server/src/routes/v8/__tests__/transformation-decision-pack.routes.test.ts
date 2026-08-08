import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('U05 portfolio decision resolution route contract', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'server/src/routes/v8/transformation-cases.routes.ts'),
    'utf8'
  );

  it('requires Idempotency-Key before calling the governed resolver', () => {
    const start = source.indexOf("'/:transformationCaseId/portfolio-decision/resolve'");
    const section = source.slice(start, start + 2200);
    expect(start).toBeGreaterThan(0);
    expect(section).toContain("req.header('Idempotency-Key')");
    expect(section).toContain('IDEMPOTENCY_KEY_REQUIRED');
    expect(section).toContain('resolvePortfolioDecision');
    expect(section.indexOf('IDEMPOTENCY_KEY_REQUIRED')).toBeLessThan(
      section.indexOf('resolvePortfolioDecision')
    );
  });

  it('serializes same-key contenders before receipt replay and terminal-state checks', () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), 'server/src/services/v8/transformationCaseService.ts'),
      'utf8'
    );
    const start = service.indexOf('export async function resolvePortfolioDecision');
    const section = service.slice(start, start + 9000);
    const lock = section.indexOf('pg_advisory_xact_lock');
    const receiptReplay = section.indexOf('transformation_portfolio_decision_receipts');
    const terminalGuard = section.indexOf('TRANSFORMATION_DECISION_ALREADY_RESOLVED');
    expect(lock).toBeGreaterThan(0);
    expect(receiptReplay).toBeGreaterThan(lock);
    expect(terminalGuard).toBeGreaterThan(receiptReplay);
    expect(section).toContain('TRANSFORMATION_DECISION_IDEMPOTENCY_CONFLICT');
  });
});
