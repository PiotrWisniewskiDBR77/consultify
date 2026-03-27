import { describe, expect, it, vi } from 'vitest';

import { executeChatNavigate } from '@/services/chatNavigator';

describe('chatNavigator finance routing', () => {
  it('navigates economics targets to the canonical /finance route', () => {
    const navigate = vi.fn();

    const result = executeChatNavigate(
      {
        type: 'NAVIGATE',
        targetModule: 'economics',
        surface: 'list',
      },
      navigate,
    );

    expect(result.success).toBe(true);
    expect(result.route).toBe('/finance');
    expect(navigate).toHaveBeenCalledWith('/finance');
  });
});
