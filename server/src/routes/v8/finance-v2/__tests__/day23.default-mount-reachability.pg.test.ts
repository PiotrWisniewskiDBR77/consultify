import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { v8FeatureGate } from '../../../../middleware/v8FeatureGate.middleware.js';
import v8Router from '../../index.js';
import { mountedFinanceStatementRouter } from '../../financeStatementMountedSurface.js';

const CARD_READS = [
  ['Statements', '/api/v8/finance-v2/statements/not-a-real-pack/lines'],
  ['Analysis', '/api/v8/finance-v2/analysis/not-a-real-version/kpi-values'],
  ['Models/Baseline', '/api/v8/finance-v2/baseline/not-a-real-version/assumptions'],
  ['Prediction', '/api/v8/finance-v2/prediction/not-a-real-version/authoring'],
  ['Enterprise Valuation', '/api/v8/finance-v2/valuation/cases/not-a-real-case'],
] as const;

function productionMount() {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', mountedFinanceStatementRouter);
  app.use('/api/v8', v8FeatureGate, v8Router);
  return app;
}

describe('Finance day 23 — default production mount reachability', () => {
  const originalGlobalGate = process.env.ENABLE_V8_GLOBAL;

  afterEach(() => {
    if (originalGlobalGate === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalGlobalGate;
  });

  it.each(CARD_READS)(
    '%s is stopped by the default-OFF global gate before auth',
    async (_card, path) => {
      delete process.env.ENABLE_V8_GLOBAL;

      const response = await request(productionMount()).get(path);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'V8 features not available',
        code: 'V8_DISABLED',
      });
    }
  );

  it('the narrow legacy Statements bypass reaches authentication instead of the global gate', async () => {
    delete process.env.ENABLE_V8_GLOBAL;

    const response = await request(productionMount()).get(
      '/api/v8/finance/statements/not-a-real-statement'
    );

    expect(response.status).toBe(401);
    expect(response.body.code).not.toBe('V8_DISABLED');
  });
});
