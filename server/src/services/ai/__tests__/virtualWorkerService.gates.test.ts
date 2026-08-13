import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({
    query: mockQuery,
  }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  activateWorkerRelease,
  createWorkerEvaluation,
  createWorkerRelease,
  VirtualWorkerValidationError,
} from '../virtualWorkerService.js';

describe('virtualWorkerService release and evaluation gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects passed evaluations without dataset, results, and score', async () => {
    await expect(
      createWorkerEvaluation({
        worker_id: 'worker-1',
        name: 'Anna regression',
        status: 'passed',
        dataset_json: [],
        results_json: {},
        score: null,
      })
    ).rejects.toMatchObject({
      code: 'VW_EVAL_DATASET_REQUIRED',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects ready releases when evaluation is not passed', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'worker-1',
            slug: 'anna',
            name: 'Anna',
            role: 'sales_lp',
            status: 'active',
            surface: 'landing_page',
            voice_enabled: true,
            locale_default: 'pl',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-1',
            worker_id: 'worker-1',
            version: 2,
            system_prompt: 'Prompt',
            memory_policy: {},
            channel_policy: {},
            retrieval_policy: {},
            cta_policy: {},
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'eval-1',
            worker_id: 'worker-1',
            name: 'Eval',
            status: 'failed',
            dataset_json: [{ input: 'x' }],
            results_json: { summary: 'failed' },
            score: 45,
          },
        ],
      });

    await expect(
      createWorkerRelease({
        worker_id: 'worker-1',
        profile_id: 'profile-1',
        evaluation_id: 'eval-1',
        status: 'ready',
      })
    ).rejects.toMatchObject({
      code: 'VW_RELEASE_EVAL_NOT_PASSED',
    });
  });

  it('activates only ready releases and rolls back the previously active one', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'release-1',
            worker_id: 'worker-1',
            profile_id: 'profile-1',
            evaluation_id: 'eval-1',
            release_type: 'profile_version',
            status: 'ready',
            notes: null,
            payload_json: {},
            created_by: 'admin-1',
            created_at: '2026-04-06T10:00:00Z',
            activated_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'profile-1',
            worker_id: 'worker-1',
            version: 2,
            system_prompt: 'Prompt',
            memory_policy: {},
            channel_policy: {},
            retrieval_policy: {},
            cta_policy: {},
            is_active: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'eval-1',
            worker_id: 'worker-1',
            name: 'Eval',
            status: 'passed',
            dataset_json: [{ input: 'x' }],
            results_json: { summary: 'passed' },
            score: 92,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ worker_id: 'worker-1' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'release-1',
            worker_id: 'worker-1',
            profile_id: 'profile-1',
            evaluation_id: 'eval-1',
            release_type: 'profile_version',
            status: 'active',
            notes: null,
            payload_json: {},
            created_by: 'admin-1',
            created_at: '2026-04-06T10:00:00Z',
            activated_at: '2026-04-06T10:05:00Z',
          },
        ],
      });

    const result = await activateWorkerRelease('release-1');

    expect(result?.status).toBe('active');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHEN status = 'active' THEN 'rolled_back'"),
      ['release-1', 'worker-1']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE virtual_worker_profiles SET is_active = 1, activated_at = NOW()'
      ),
      ['profile-1']
    );
  });
});
