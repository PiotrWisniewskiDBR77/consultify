import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preview = vi.fn();
const confirm = vi.fn();
const read = vi.fn();

vi.mock('../../services/finance/financeDigitizationAnalysisCandidateHandoff.js', () => ({
  previewDigitizationAnalysisCandidate: (...args: unknown[]) => preview(...args),
  confirmDigitizationAnalysisCandidateHandoff: (...args: unknown[]) => confirm(...args),
  getDigitizationAnalysisCandidateHandoff: (...args: unknown[]) => read(...args),
}));

import router from '../financeCandidateHandoffDigitizationAnalysis.routes.js';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    next();
  });
  instance.use('/api/finance/candidate-handoff/digitization-analysis', router);
  return instance;
}

describe('digitization-analysis Candidate handoff routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mounts preview without mutation', async () => {
    preview.mockResolvedValue({ eligible: true, preview: { title: 'Analysis' } });
    const response = await request(app()).get(
      '/api/finance/candidate-handoff/digitization-analysis/analysis-1/preview'
    );
    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledWith({ organizationId: 'org-1', analysisId: 'analysis-1' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('returns 201 for a fresh Candidate and 200 for replay', async () => {
    confirm
      .mockResolvedValueOnce({ created: true, candidateId: 'candidate-1' })
      .mockResolvedValueOnce({ created: false, candidateId: 'candidate-1' });
    const path = '/api/finance/candidate-handoff/digitization-analysis/analysis-1/confirm';
    const first = await request(app()).post(path).send({});
    const replay = await request(app()).post(path).send({});
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(first.body.data.candidateId).toBe(replay.body.data.candidateId);
    expect(confirm).toHaveBeenCalledWith({
      organizationId: 'org-1',
      analysisId: 'analysis-1',
      createdBy: 'user-1',
    });
  });

  it('returns the persisted handoff or an explicit 404', async () => {
    read.mockResolvedValueOnce(null).mockResolvedValueOnce({ candidateId: 'candidate-1' });
    const path = '/api/finance/candidate-handoff/digitization-analysis/analysis-1';
    expect((await request(app()).get(path)).status).toBe(404);
    const found = await request(app()).get(path);
    expect(found.status).toBe(200);
    expect(found.body.data).toEqual({ candidateId: 'candidate-1' });
  });
});
