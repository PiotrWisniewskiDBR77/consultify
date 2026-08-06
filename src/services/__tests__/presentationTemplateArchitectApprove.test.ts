import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/services/api', () => ({
  Api: { post: (...args: unknown[]) => post(...args) },
}));

import { approvePresentationTemplate } from '../presentationTemplateArchitect';

describe('approvePresentationTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets the Architect call the governed approval transition used by OWNER/ADMIN', async () => {
    post.mockResolvedValue({
      data: { data: { record: { id: 'tpl-1', lifecycle_state: 'approved' } } },
    });

    const result = await approvePresentationTemplate('tpl-1');

    expect(post).toHaveBeenCalledWith('/presentations/templates/tpl-1/governance/transition', {
      targetState: 'approved',
    });
    expect(result).toEqual({ record: { id: 'tpl-1', lifecycle_state: 'approved' } });
  });

  it('URL-encodes the template id', async () => {
    post.mockResolvedValue({ data: { data: { record: null } } });
    await approvePresentationTemplate('tpl with space');
    expect(post).toHaveBeenCalledWith(
      '/presentations/templates/tpl%20with%20space/governance/transition',
      { targetState: 'approved' }
    );
  });
});
