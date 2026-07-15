/**
 * V8 Advisory business-case route — integration tests (Oxford O4 wiring).
 *
 * Covers:
 *  - happy path: prompt → BusinessCaseService.generate() → model in response
 *  - validation: missing/empty prompt → 400
 *  - security: organizationId is ALWAYS taken from the authenticated request
 *    context (getV8Context), never from the request body — a client cannot
 *    make the service run for a different org by spoofing body.organizationId.
 *  - failure: service throwing does not leak internals, returns 502.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

const mockGenerate = vi.fn();
vi.mock('../../../server/src/services/advisory/BusinessCaseService.js', () => ({
  default: {
    generate: (...args: unknown[]) => mockGenerate(...args),
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import advisoryRoutes from '../../../server/src/routes/v8/advisory.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/advisory', advisoryRoutes);
  return app;
}

const AUTH_ORG = 'org-authenticated-abc';
const AUTH_USER = 'user-authenticated-xyz';

describe('POST /api/v8/advisory/business-case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({
      organizationId: AUTH_ORG,
      userId: AUTH_USER,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    });
  });

  it('generates a business case and returns the full model + narrative', async () => {
    const fakeResult = {
      id: 'bc-1',
      plan: { problem: 'x', options: [], drivers: [{ label: 'd', role: 'benefit' }], scenarios: [], horizonYears: 5, waccPct: 12, currency: 'PLN' },
      model: { base: { npv: 1000, irrPct: 15, paybackYears: 2, roiPct: 20, totalInvestment: 500 }, scenarios: [], waccPct: 12, horizonYears: 5, currency: 'PLN' },
      narrative: 'Rekomendacja...',
      narrativeCheck: { consistent: true, unverifiedNumbers: [] },
      llmReviewIssues: [],
      pipelineLog: [],
      waccResolution: { waccPct: 12, source: 'client', guidance: {}, grade: {} },
      generatedAt: '2026-07-15T00:00:00.000Z',
    };
    mockGenerate.mockResolvedValue(fakeResult);

    const res = await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'Czy warto zainwestować w automatyzację raportowania?' });

    expect(res.status).toBe(200);
    expect(res.body?.data?.id).toBe('bc-1');
    expect(res.body?.data?.model?.base?.npv).toBe(1000);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Czy warto zainwestować w automatyzację raportowania?',
        organizationId: AUTH_ORG,
        userId: AUTH_USER,
      })
    );
  });

  it('rejects a missing prompt with 400 and never calls the service', async () => {
    const res = await request(createApp()).post('/api/v8/advisory/business-case').send({});

    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects a blank/whitespace-only prompt with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: '   ' });

    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('returns 401 when the request context has no organizationId/userId', async () => {
    mockGetV8Context.mockReturnValue({ organizationId: '', userId: '', userRole: '', isSuperAdmin: false });

    const res = await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'valid prompt' });

    expect(res.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('CROSS-ORG: ignores an organizationId supplied in the body — always uses the authenticated context org', async () => {
    mockGenerate.mockResolvedValue({ id: 'bc-2', model: {}, plan: {}, narrative: '', narrativeCheck: { consistent: true, unverifiedNumbers: [] }, llmReviewIssues: [], pipelineLog: [], waccResolution: {}, generatedAt: 'now' });

    await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'valid prompt', organizationId: 'attacker-controlled-other-org' });

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerate.mock.calls[0][0];
    // The org actually used must be the authenticated context's org, never the
    // spoofed body value — this is the whole point of reading org from
    // getV8Context(req) instead of req.body.
    expect(callArgs.organizationId).toBe(AUTH_ORG);
    expect(callArgs.organizationId).not.toBe('attacker-controlled-other-org');
  });

  it('CROSS-ORG: two different authenticated orgs never see each other\'s org id echoed', async () => {
    mockGenerate.mockResolvedValue({ id: 'bc-a', model: {}, plan: {}, narrative: '', narrativeCheck: { consistent: true, unverifiedNumbers: [] }, llmReviewIssues: [], pipelineLog: [], waccResolution: {}, generatedAt: 'now' });
    mockGetV8Context.mockReturnValue({ organizationId: 'org-A', userId: 'user-A', userRole: 'ADMIN', isSuperAdmin: false });
    await request(createApp()).post('/api/v8/advisory/business-case').send({ prompt: 'from org A' });
    expect(mockGenerate.mock.calls[0][0].organizationId).toBe('org-A');

    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({ id: 'bc-b', model: {}, plan: {}, narrative: '', narrativeCheck: { consistent: true, unverifiedNumbers: [] }, llmReviewIssues: [], pipelineLog: [], waccResolution: {}, generatedAt: 'now' });
    mockGetV8Context.mockReturnValue({ organizationId: 'org-B', userId: 'user-B', userRole: 'ADMIN', isSuperAdmin: false });
    await request(createApp()).post('/api/v8/advisory/business-case').send({ prompt: 'from org B' });
    expect(mockGenerate.mock.calls[0][0].organizationId).toBe('org-B');
  });

  it('returns 502 (not a silent empty result) when the service throws', async () => {
    mockGenerate.mockRejectedValue(new Error('PLAN phase failed to produce a valid plan'));

    const res = await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'valid prompt' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
    // Must not fabricate a fake success payload with empty sections (BUG-07 pattern).
    expect(res.body.data).toBeUndefined();
  });

  it('rejects an over-length prompt with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/advisory/business-case')
      .send({ prompt: 'x'.repeat(9000) });

    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
