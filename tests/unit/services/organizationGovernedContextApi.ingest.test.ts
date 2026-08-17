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
    await expect(organizationGovernedContextApi.ingestDocument(file)).resolves.toBe(receipt);
    expect(uploadChatAttachment).toHaveBeenCalledTimes(1);
    expect(uploadChatAttachment).toHaveBeenCalledWith(file);
  });

  it('propagates writer failure instead of manufacturing a claim receipt', async () => {
    uploadChatAttachment.mockRejectedValue(new Error('unauthorized'));
    await expect(
      organizationGovernedContextApi.ingestDocument(new File(['x'], 'x.txt'))
    ).rejects.toThrow('unauthorized');
  });
});
