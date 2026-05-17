import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsApi } from '@/services/api/settings.api';

describe('SettingsApi preference endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses real regional and AI memory preference routes', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/settings/preferences/regional') && !init?.method) {
        return new Response(
          JSON.stringify({
            preferences: {
              timezone: 'Europe/Warsaw',
              units: 'metric',
              currency: 'PLN',
              numberFormat: 'pl-PL',
              dateFormat: 'DD.MM.YYYY',
              timeFormat: '24h',
              firstDayOfWeek: 'monday',
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/settings/preferences/regional') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      if (url.endsWith('/settings/preferences/ai-memory') && !init?.method) {
        return new Response(
          JSON.stringify({
            preferences: {
              enabled: false,
              retentionDays: 45,
              includeConversations: false,
              includePreferences: true,
              includeContext: false,
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/settings/preferences/ai-memory') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      if (url.endsWith('/settings/preferences/ai-memory/clear') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: `Unexpected URL ${url}` }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(SettingsApi.getRegionalPreferences()).resolves.toMatchObject({
      preferences: { timezone: 'Europe/Warsaw' },
    });
    await expect(
      SettingsApi.updateRegionalPreferences({
        timezone: 'Europe/Warsaw',
        units: 'metric',
        currency: 'PLN',
        numberFormat: 'pl-PL',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24h',
        firstDayOfWeek: 'monday',
      })
    ).resolves.toEqual({ success: true });

    await expect(SettingsApi.getAIMemoryPreferences()).resolves.toMatchObject({
      preferences: { enabled: false, retentionDays: 45 },
    });
    await expect(
      SettingsApi.updateAIMemoryPreferences({
        enabled: false,
        retentionDays: 45,
        includeConversations: false,
        includePreferences: true,
        includeContext: false,
      })
    ).resolves.toEqual({ success: true });
    await expect(SettingsApi.clearAIMemoryPreferences()).resolves.toEqual({ success: true });

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/ai-settings/user'),
      expect.anything()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/settings/preferences/ai-memory'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
