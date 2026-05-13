import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsExportImport } from '@/components/settings/advanced/SettingsExportImport';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'object' ? (fallback.defaultValue ?? _key) : (fallback ?? _key);

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    exportSettings: vi.fn(),
    importSettings: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

describe('SettingsExportImport honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };
  const importPayload = {
    version: '1.0.0',
    userId: 'user-1',
    settings: {
      privacy: { showOnlineStatus: false },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not claim import success when backend confirms no imported categories', async () => {
    vi.mocked(Api.importSettings).mockResolvedValue({ success: true, imported: [], skipped: ['privacy'] });
    const { container } = render(
      <SettingsExportImport currentUser={user as any} onUpdateUser={vi.fn()} />
    );
    const file = new File([JSON.stringify(importPayload)], 'settings.json', {
      type: 'application/json',
    });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify(importPayload)),
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: /Import Settings/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Settings import did not confirm any imported categories')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText('Last import result')).not.toBeInTheDocument();
  });
});
