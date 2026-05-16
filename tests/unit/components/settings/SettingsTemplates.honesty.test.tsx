import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
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
    vi.mocked(Api.exportSettings).mockResolvedValue({ data: { settings: { theme: 'dark' } } });
    vi.mocked(Api.createSettingsTemplate).mockResolvedValue({
      template: {
        id: 'tpl-1',
        name: 'My Template',
        description: 'Custom template',
        icon: '📋',
        type: 'custom',
        categories: ['All'],
      },
    });
    vi.mocked(Api.deleteSettingsTemplate).mockResolvedValue({ success: true });
    vi.stubGlobal('confirm', vi.fn(() => true));
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

  it('does not claim template creation success when list read-back is stale', async () => {
    vi.mocked(Api.getSettingsTemplates)
      .mockResolvedValueOnce({ templates: [] })
      .mockResolvedValueOnce({ templates: [] });

    render(
      <SettingsTemplates
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No custom templates yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Current as Template/i }));
    fireEvent.change(screen.getByPlaceholderText('My Settings Template'), {
      target: { value: 'My Template' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Settings template creation was not confirmed by the server')
          )
      ).toBe(true);
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
