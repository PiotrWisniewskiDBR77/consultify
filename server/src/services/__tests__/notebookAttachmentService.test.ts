import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
const mockRename = vi.fn();
const mockAccess = vi.fn();

let uuidCounter = 0;

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: () => {
    uuidCounter += 1;
    return `attachment-${uuidCounter}`;
  },
}));

vi.mock('fs/promises', () => {
  const api = {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    access: (...args: unknown[]) => mockAccess(...args),
  };

  return {
    ...api,
    default: api,
  };
});

import {
  addNotebookAttachmentsToPage,
  removeNotebookAttachmentFromPage,
} from '../notebookAttachmentService.js';

describe('notebookAttachmentService', () => {
  beforeEach(() => {
    uuidCounter = 0;
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  it('cleans up stored uploads when compare-and-swap never succeeds', async () => {
    mockQueryOne.mockResolvedValue({ attachmentsJson: JSON.stringify([]) });
    mockQueryRun.mockResolvedValue({ changes: 0 });

    await expect(
      addNotebookAttachmentsToPage({
        organizationId: 'org-1',
        pageId: 'page-1',
        userId: 'user-1',
        files: [
          {
            buffer: Buffer.from('hello world'),
            originalname: 'brief.pdf',
            mimetype: 'application/pdf',
          },
        ],
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'NOTEBOOK_ATTACHMENT_WRITE_CONFLICT',
    });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockQueryRun).toHaveBeenCalledTimes(3);
    expect(mockQueryRun.mock.calls[0]?.[0]).toContain("COALESCE(attachments_json, '[]')::jsonb = ?::jsonb");
    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it('retries attachment append against the latest row state', async () => {
    const peerAttachment = {
      id: 'att-peer',
      name: 'peer.pdf',
      type: 'application/pdf',
      size: 12,
      uploadedAt: '2026-03-28T10:00:00.000Z',
      storageKey: 'org-1/page-1/peer.pdf',
    };

    mockQueryOne
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([]) })
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([peerAttachment]) });
    mockQueryRun.mockResolvedValueOnce({ changes: 0 }).mockResolvedValueOnce({ changes: 1 });

    const result = await addNotebookAttachmentsToPage({
      organizationId: 'org-1',
      pageId: 'page-1',
      userId: 'user-1',
      files: [
        {
          buffer: Buffer.from('hello world'),
          originalname: 'brief.pdf',
          mimetype: 'application/pdf',
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'att-peer' }),
        expect.objectContaining({ name: 'brief.pdf' }),
      ])
    );

    const secondUpdatePayload = mockQueryRun.mock.calls[1]?.[1]?.[0];
    expect(JSON.parse(secondUpdatePayload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'att-peer' }),
        expect.objectContaining({ name: 'brief.pdf' }),
      ])
    );
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('stages deletes and restores the file before retrying on conflict', async () => {
    const targetAttachment = {
      id: 'att-delete',
      name: 'remove.txt',
      type: 'text/plain',
      size: 7,
      uploadedAt: '2026-03-28T10:00:00.000Z',
      storageKey: 'org-1/page-1/remove.txt',
    };
    const peerAttachment = {
      id: 'att-peer',
      name: 'keep.txt',
      type: 'text/plain',
      size: 5,
      uploadedAt: '2026-03-28T10:00:00.000Z',
      storageKey: 'org-1/page-1/keep.txt',
    };

    mockQueryOne
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([targetAttachment]) })
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([targetAttachment, peerAttachment]) });
    mockQueryRun.mockResolvedValueOnce({ changes: 0 }).mockResolvedValueOnce({ changes: 1 });

    const result = await removeNotebookAttachmentFromPage({
      pageId: 'page-1',
      attachmentId: 'att-delete',
    });

    expect(result).toEqual([peerAttachment]);
    expect(mockRename).toHaveBeenCalledTimes(3);
    expect(mockRename.mock.calls[1]?.[0]).toContain('.staging-delete');
    expect(mockRename.mock.calls[1]?.[1]).toContain('remove.txt');
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink.mock.calls[0]?.[0]).toContain('.staging-delete');
  });
});
