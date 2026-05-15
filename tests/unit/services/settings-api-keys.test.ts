import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsApi } from '@/services/api/settings.api';

describe('SettingsApi API keys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the mounted /settings/api-keys endpoints instead of stale user routes', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/settings/api-keys') && !init?.method) {
        return new Response(JSON.stringify({ keys: [{ id: 'key-1' }] }), { status: 200 });
      }
      if (url.endsWith('/settings/api-keys') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true, key: { id: 'key-2' } }), {
          status: 200,
        });
      }
      if (url.endsWith('/settings/api-keys/key-1/rotate') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: true, key: 'sk_test_rotated' }), {
          status: 200,
        });
      }
      if (url.endsWith('/settings/api-keys/key-1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: `Unexpected URL ${url}` }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(SettingsApi.getUserApiKeys()).resolves.toEqual([{ id: 'key-1' }]);
    await expect(SettingsApi.createUserApiKey('Demo', ['read'])).resolves.toMatchObject({
      success: true,
    });
    await expect(SettingsApi.rotateApiKey('key-1')).resolves.toMatchObject({ success: true });
    await expect(SettingsApi.deleteUserApiKey('key-1')).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/user/api-keys'),
      expect.anything()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/settings/api-keys'),
      expect.anything()
    );
  });
});
