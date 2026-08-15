import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capacity: vi.fn(),
  query: vi.fn(),
  chat: vi.fn(),
}));

vi.mock('../workloadCapacityService.js', () => ({ getCapacityOverview: mocks.capacity }));
vi.mock('../../utils/DbPromise.js', () => ({
  default: { all: mocks.query },
  all: mocks.query,
}));
vi.mock('../aiService.js', () => ({ generateChatResponse: mocks.chat }));

import { getWorkloadAssessment } from '../aiWorkloadAssessment.js';

describe('aiWorkloadAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capacity.mockResolvedValue({
      windowStart: '2026-08-10',
      windowEnd: '2026-08-16',
      users: [
        {
          userId: 'u1',
          name: 'Anna',
          capacityHours: 40,
          allocatedHours: 36,
          backlogHours: 4,
          utilizationPercent: 90,
          actualHours: 0,
          overloaded: false,
        },
      ],
    });
    mocks.query.mockResolvedValue([
      {
        user_id: 'u1',
        start_at: '2026-08-11T09:00:00.000Z',
        end_at: '2026-08-11T13:00:00.000Z',
      },
    ]);
  });

  it('combines task and calendar load and uses only the supplied user index from AI', async () => {
    mocks.chat.mockResolvedValue({
      content: JSON.stringify({
        assessments: [
          {
            i: 0,
            status: 'overloaded',
            assessment: '36h tasks plus 4h meetings.',
            recommendation: 'Move one task.',
          },
        ],
      }),
    });

    const result = await getWorkloadAssessment('org-ai-success', { refresh: true });

    expect(result.aiUsed).toBe(true);
    expect(result.users[0]).toMatchObject({
      userId: 'u1',
      taskLoadHours: 36,
      meetingHours: 4,
      meetingLoadPercent: 10,
      combinedLoadPercent: 100,
      status: 'overloaded',
      assessment: '36h tasks plus 4h meetings.',
    });
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });

  it('returns an explicitly non-AI heuristic result when synthesis fails', async () => {
    mocks.chat.mockRejectedValue(new Error('provider unavailable'));

    const result = await getWorkloadAssessment('org-ai-fallback', { refresh: true });

    expect(result.aiUsed).toBe(false);
    expect(result.users[0]).toMatchObject({
      status: 'optimal',
      combinedLoadPercent: 100,
    });
    expect(result.users[0].assessment).toContain('36h');
  });
});
