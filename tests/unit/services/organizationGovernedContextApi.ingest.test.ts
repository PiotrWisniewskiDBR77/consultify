import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadChatAttachment = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/api', () => ({
  Api: { uploadChatAttachment },
}));

import { organizationGovernedContextApi } from '../../../src/services/organizationGovernedContextApi';

describe('organizationGovernedContextApi.ingestDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates the exact File to the canonical authenticated multipart writer', async () => {
    const file = new File(['governed'], 'source.txt', { type: 'text/plain' });
    const receipt = { success: true, docId: 'doc-1', filename: 'source.txt' };
    uploadChatAttachment.mockResolvedValue(receipt);
    await expect(organizationGovernedContextApi.ingestDocument(file, 'idem-1')).resolves.toBe(receipt);
    expect(uploadChatAttachment).toHaveBeenCalledTimes(1);
    expect(uploadChatAttachment).toHaveBeenCalledWith(file, 'idem-1');
  });

  it('propagates writer failure instead of manufacturing a claim receipt', async () => {
    uploadChatAttachment.mockRejectedValue(new Error('unauthorized'));
    await expect(
      organizationGovernedContextApi.ingestDocument(new File(['x'], 'x.txt'), 'idem-2')
    ).rejects.toThrow('unauthorized');
  });

  it('canonical multipart writer sends bearer and the exact optional Idempotency-Key', async () => {
    const { Api } = await vi.importActual<typeof import('../../../src/services/api')>(
      '../../../src/services/api'
    );
    localStorage.setItem('token', 'signed-test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, docId: 'doc-1', filename: 'source.txt' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await Api.uploadChatAttachment(
        new File(['governed'], 'source.txt', { type: 'text/plain' }),
        'stable-key-1'
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
        headers: {
          Authorization: 'Bearer signed-test-token',
          'Idempotency-Key': 'stable-key-1',
        },
      });
    } finally {
      localStorage.removeItem('token');
      vi.unstubAllGlobals();
    }
  });
});
