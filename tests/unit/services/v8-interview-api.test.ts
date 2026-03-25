import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8InterviewApi } from '@/services/api/v8/interview';
import { v8Get } from '@/services/api/v8/client';

describe('V8InterviewApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests interview sessions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ sessions: [] });

    await V8InterviewApi.getSessions('active');

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions', { status: 'active' });
  });

  it('requests interview session detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ session: { id: 'sess-1' } });

    const data = await V8InterviewApi.getSession('sess-1');

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions/sess-1');
    expect(data.session.id).toBe('sess-1');
  });
});
