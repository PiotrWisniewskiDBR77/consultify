import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8InterviewApi } from '@/services/api/v8/interview';
import { v8Get, v8Post } from '@/services/api/v8/client';

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

  it('requests accepted interview sessions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ sessions: [] });

    await V8InterviewApi.getAcceptedSessions();

    expect(v8Get).toHaveBeenCalledWith('/interview/sessions/accepted');
  });

  it('requests my interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getMyAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/my');
  });

  it('requests managed interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getManagedAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/managed');
  });

  it('requests overdue interview assignments from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] });

    await V8InterviewApi.getOverdueAssignments();

    expect(v8Get).toHaveBeenCalledWith('/interview/assignments/overdue');
  });

  it('posts interview assignment workflow writes to the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true } as any);

    await V8InterviewApi.startAssignment('asg-1', { projectId: 'proj-1' });
    await V8InterviewApi.remindAssignment('asg-2');
    await V8InterviewApi.sendBackAssignment('asg-3', { reason: 'Missing answers' });
    await V8InterviewApi.approveAssignment('asg-4');

    expect(v8Post).toHaveBeenNthCalledWith(
      1,
      '/interview/assignments/asg-1/start',
      { projectId: 'proj-1' }
    );
    expect(v8Post).toHaveBeenNthCalledWith(2, '/interview/assignments/asg-2/remind', {});
    expect(v8Post).toHaveBeenNthCalledWith(
      3,
      '/interview/assignments/asg-3/send-back',
      { reason: 'Missing answers' }
    );
    expect(v8Post).toHaveBeenNthCalledWith(4, '/interview/assignments/asg-4/approve', {});
  });
});
