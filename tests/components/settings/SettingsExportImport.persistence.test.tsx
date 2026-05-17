import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsExportImport } from '@/components/settings/advanced/SettingsExportImport';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    exportSettings: vi.fn(),
    importSettings: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      const template = String(fallbackOrOptions?.defaultValue || _key);
      return Object.entries(fallbackOrOptions || {}).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
        template
      );
    },
  }),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

const currentUser = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Piotr',
  lastName: 'Owner',
  role: 'OWNER',
} as any;

describe('SettingsExportImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:settings-export');
    URL.revokeObjectURL = vi.fn();
  });

  it('exports selected categories through the settings API and downloads non-empty JSON', async () => {
    (Api.exportSettings as any).mockResolvedValue({
      data: {
        version: '1.0.0',
        exportedAt: '2026-04-25T08:00:00.000Z',
        userId: 'user-1',
        settings: {
          profile: { firstName: 'Piotr' },
          appearance: { theme: 'dark' },
        },
      },
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<SettingsExportImport currentUser={currentUser} onUpdateUser={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /export selected/i }));

    await waitFor(() => {
      expect(Api.exportSettings).toHaveBeenCalledWith([
        'profile',
        'security',
        'privacy',
        'aiPreferences',
        'notifications',
        'integrations',
        'appearance',
        'keyboard',
      ]);
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:settings-export');
  });

  it('validates an import file, calls the API, and shows the import result', async () => {
    (Api.importSettings as any).mockResolvedValue({
      success: true,
      imported: ['profile', 'appearance'],
      skipped: [],
    });
    const file = new File(
      [
        JSON.stringify({
          version: '1.0.0',
          exportedAt: '2026-04-25T08:00:00.000Z',
          userId: 'user-1',
          settings: { profile: { firstName: 'Piotr' }, appearance: { theme: 'dark' } },
        }),
      ],
      'settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(file, 'text', {
      value: () =>
        Promise.resolve(
          JSON.stringify({
            version: '1.0.0',
            exportedAt: '2026-04-25T08:00:00.000Z',
            userId: 'user-1',
            settings: { profile: { firstName: 'Piotr' }, appearance: { theme: 'dark' } },
          })
        ),
    });

    const { container } = render(
      <SettingsExportImport currentUser={currentUser} onUpdateUser={vi.fn()} />
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText(/file validated successfully/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /import settings/i }));

    await waitFor(() => {
      expect(Api.importSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            profile: expect.objectContaining({ firstName: 'Piotr' }),
          }),
        }),
        true
      );
    });
    expect(await screen.findByText(/last import result/i)).toBeInTheDocument();
    expect(screen.getByText(/imported: 2\. skipped: 0\./i)).toBeInTheDocument();
  });
});
