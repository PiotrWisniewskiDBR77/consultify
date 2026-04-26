import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SettingsTemplates } from '@/components/settings/advanced/SettingsTemplates';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSettingsTemplates: vi.fn(),
    applySettingsTemplate: vi.fn(),
    exportSettings: vi.fn(),
    createSettingsTemplate: vi.fn(),
    deleteSettingsTemplate: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('SettingsTemplates honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getSettingsTemplates).mockRejectedValue(new Error('Templates down'));
  });

  it('does not render failed template loads as empty custom templates', async () => {
    render(
      <SettingsTemplates
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Settings templates unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No custom templates yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Current as Template/i })).toBeDisabled();
  });
});
