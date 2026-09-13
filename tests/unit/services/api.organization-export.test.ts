import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '@/services/api';

describe('Organization export client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  it('uses the encoded tenant endpoint and authentication and returns original bytes', async () => {
    localStorage.setItem('token', 'test-token');
    const body = '{"organization":{"id":"org/a"}}';
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    const blob = await Api.exportOwnOrganizationData('org/a');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/organizations\/org%2Fa\/export\?format=json$/);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer test-token',
    });
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(text).toBe(body);
  });
  it.each([401, 403, 423, 500])(
    'rejects HTTP %s without exposing an error body as a file',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('private server detail', { status }))
      );
      await expect(Api.exportOwnOrganizationData('org-a')).rejects.toMatchObject({ status });
      await expect(Api.exportOwnOrganizationData('org-a')).rejects.not.toThrow(
        'private server detail'
      );
    }
  );
});
