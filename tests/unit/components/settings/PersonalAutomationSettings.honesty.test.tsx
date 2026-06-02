import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { PersonalAutomationSettings } from '@/components/settings/modules/PersonalAutomationSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('PersonalAutomationSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Automations down'));
  });

  it('does not render failed automation loads as empty automations', async () => {
    render(
      <PersonalAutomationSettings
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Automations unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No automations yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Automation/i })).toBeDisabled();
  });
});
