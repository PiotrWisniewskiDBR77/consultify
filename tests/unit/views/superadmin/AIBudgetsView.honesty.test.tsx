import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import AIBudgetsView from '@/views/superadmin/AIBudgetsView';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('AIBudgetsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('AI budgets backend down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render AI budget load failures as empty budgets or zero spend', async () => {
    render(<AIBudgetsView />);

    await waitFor(() => {
      expect(screen.getByText('AI budget controls unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('AI budgets backend down')).toBeInTheDocument();
    expect(screen.queryByText('No budgets configured')).not.toBeInTheDocument();
    expect(screen.queryByText('Total AI Spending')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Budget')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
});
