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

  it('encodes initiative detail entityId and trims whitespace', () => {
    const navigate = vi.fn();
    const result = executeChatNavigate(
      {
        type: 'NAVIGATE',
        targetModule: 'initiatives',
        surface: 'detail',
        entityId: '  ini-1&mode=drawer  ',
      },
      navigate
    );

    expect(result.success).toBe(true);
    expect(result.route).toBe('/initiatives?open=ini-1%26mode%3Ddrawer&mode=doc');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/initiatives?open=ini-1%26mode%3Ddrawer&mode=doc');
  });

  it('encodes discovery tools detail docId without query-string breakage', () => {
    const navigate = vi.fn();
    const result = executeChatNavigate(
      {
        type: 'NAVIGATE',
        targetModule: 'tools',
        surface: 'detail',
        entityId: 'doc/1?x=1',
      },
      navigate
    );

    expect(result.success).toBe(true);
    expect(result.route).toBe('/discovery-tools?docId=doc%2F1%3Fx%3D1');
    expect(navigate).toHaveBeenCalledWith('/discovery-tools?docId=doc%2F1%3Fx%3D1');
  });

  it('encodes reports builder detail path segments', () => {
    const navigate = vi.fn();
    const result = executeChatNavigate(
      {
        type: 'NAVIGATE',
        targetModule: 'reports',
        surface: 'detail',
        entityId: 'rep/1',
      },
      navigate
    );

    expect(result.success).toBe(true);
    expect(result.route).toBe('/reports/builder/rep%2F1');
    expect(navigate).toHaveBeenCalledWith('/reports/builder/rep%2F1');
  });
});
