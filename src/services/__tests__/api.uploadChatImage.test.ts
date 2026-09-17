/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../api';

describe('Api.uploadChatImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts multipart `file` to the dedicated image endpoint and returns its image payload', async () => {
    const responseBody = {
      success: true,
      image: {
        name: 'screen.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,cG5n',
        width: 32,
        height: 24,
        size: 3,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['png'], 'screen.png', { type: 'image/png' });

    await expect(Api.uploadChatImage(file)).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/ai\/chat\/images$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });
});
