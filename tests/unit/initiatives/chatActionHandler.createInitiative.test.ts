/**
 * M13 flow redesign — chat CREATE_INITIATIVE lands in the initiative document.
 * The handler must extract the created id and navigate to the canonical
 * /initiatives?open=<id>&mode=doc deep link.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { handleChatAction } from '@/services/chatActionHandler';

const baseDeps = () => ({
  navigate: vi.fn(),
  context: { projectId: 'proj-1' } as any,
});

describe('handleChatAction CREATE_INITIATIVE', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
  });

  it('creates the initiative and navigates to its DOCUMENT deep link', async () => {
    apiPostMock.mockResolvedValue({ id: 'init-42', name: 'X', message: 'Initiative created' });
    const deps = baseDeps();

    const result = await handleChatAction(
      { type: 'CREATE_INITIATIVE', params: { title: 'Chat-born initiative' } } as any,
      deps as any
    );

    expect(result.success).toBe(true);
    expect(apiPostMock).toHaveBeenCalledWith(
      '/initiatives',
      expect.objectContaining({ title: 'Chat-born initiative', projectId: 'proj-1' })
    );
    expect(deps.navigate).toHaveBeenCalledWith('/initiatives?open=init-42&mode=doc');
    expect(result.data).toEqual({ createdId: 'init-42' });
  });

  it('supports the { initiative: { id } } response envelope', async () => {
    apiPostMock.mockResolvedValue({ initiative: { id: 'init-7' } });
    const deps = baseDeps();

    const result = await handleChatAction(
      { type: 'CREATE_INITIATIVE', params: { title: 'T' } } as any,
      deps as any
    );

    expect(result.success).toBe(true);
    expect(deps.navigate).toHaveBeenCalledWith('/initiatives?open=init-7&mode=doc');
  });

  it('still succeeds without navigation when no id is returned', async () => {
    apiPostMock.mockResolvedValue({ message: 'ok' });
    const deps = baseDeps();

    const result = await handleChatAction(
      { type: 'CREATE_INITIATIVE', params: { title: 'T' } } as any,
      deps as any
    );

    expect(result.success).toBe(true);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('rejects an empty title without calling the API', async () => {
    const deps = baseDeps();

    const result = await handleChatAction(
      { type: 'CREATE_INITIATIVE', params: { title: '   ' } } as any,
      deps as any
    );

    expect(result.success).toBe(false);
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
