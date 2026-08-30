import { describe, expect, it, vi } from 'vitest';

import {
  deleteDecisionAttachmentAndReload,
  uploadDecisionAttachmentsAndReload,
} from '../DecisionDetailView';
import {
  deleteTaskAttachmentAndReload,
  downloadTaskAttachment,
  uploadTaskAttachmentsAndReload,
} from '../TaskDetailView';

const serverAttachment = {
  id: 'att-1',
  objectType: 'task',
  objectId: 'task-1',
  organizationId: 'org-1',
  fileName: 'evidence.txt',
  mimeType: 'text/plain',
  sizeBytes: 8,
  storageKey: 'object-attachments/org-1/task/task-1/att-1-evidence.txt',
  createdBy: 'user-1',
  createdAt: '2026-08-30T09:00:00.000Z',
};

describe('day148 object attachment callers', () => {
  it('uploads every task file, reloads server state, and maps the download route', async () => {
    const api = {
      postMultipart: vi.fn().mockResolvedValue({ data: { data: serverAttachment } }),
      get: vi.fn().mockResolvedValue({ data: { data: [serverAttachment] } }),
      delete: vi.fn(),
    };
    const files = [new File(['evidence'], 'evidence.txt', { type: 'text/plain' })];

    const result = await uploadTaskAttachmentsAndReload(api, 'task-1', files);

    expect(api.postMultipart).toHaveBeenCalledWith(
      '/my-work/object-attachments/task/task-1',
      expect.any(FormData)
    );
    expect(api.get).toHaveBeenCalledWith('/my-work/object-attachments/task/task-1');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'att-1',
        name: 'evidence.txt',
        type: 'text/plain',
        size: 8,
        uploadedBy: 'user-1',
        url: '/my-work/object-attachments/task/task-1/att-1/download',
      }),
    ]);
  });

  it('deletes a task attachment and only then reloads server state', async () => {
    const api = {
      postMultipart: vi.fn(),
      delete: vi.fn().mockResolvedValue({ data: undefined }),
      get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    };

    await expect(deleteTaskAttachmentAndReload(api, 'task-1', 'att-1')).resolves.toEqual([]);
    expect(api.delete).toHaveBeenCalledWith('/my-work/object-attachments/task/task-1/att-1');
    expect(api.delete.mock.invocationCallOrder[0]).toBeLessThan(
      api.get.mock.invocationCallOrder[0]
    );
  });

  it('downloads a task attachment through the authenticated API caller', async () => {
    const blob = new Blob(['evidence'], { type: 'text/plain' });
    const api = { downloadObjectAttachment: vi.fn().mockResolvedValue(blob) };

    await expect(downloadTaskAttachment(api, 'task-1', 'att-1')).resolves.toBe(blob);
    expect(api.downloadObjectAttachment).toHaveBeenCalledWith(
      '/my-work/object-attachments/task/task-1/att-1/download'
    );
  });

  it('uses the same server-first contract for decision upload and delete', async () => {
    const decisionAttachment = {
      ...serverAttachment,
      objectType: 'decision',
      objectId: 'decision-1',
    };
    const api = {
      postMultipart: vi.fn().mockResolvedValue({ data: { data: decisionAttachment } }),
      delete: vi.fn().mockResolvedValue({ data: undefined }),
      get: vi
        .fn()
        .mockResolvedValueOnce({ data: { data: [decisionAttachment] } })
        .mockResolvedValueOnce({ data: { data: [] } }),
    };
    const files = [new File(['evidence'], 'evidence.txt', { type: 'text/plain' })];

    const uploaded = await uploadDecisionAttachmentsAndReload(api, 'decision-1', files);
    const afterDelete = await deleteDecisionAttachmentAndReload(api, 'decision-1', 'att-1');

    expect(uploaded[0]).toEqual(
      expect.objectContaining({
        url: '/my-work/object-attachments/decision/decision-1/att-1/download',
      })
    );
    expect(afterDelete).toEqual([]);
    expect(api.postMultipart).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });
});
