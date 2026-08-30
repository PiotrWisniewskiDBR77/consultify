import { describe, expect, it, vi } from 'vitest';

import {
  downloadDecisionAttachment,
  loadDecisionAttachments,
  selectDecisionAttachments,
} from '../DecisionDetailView';
import { loadTaskAttachments } from '../TaskDetailView';

const serverAttachment = {
  id: 'att-155',
  fileName: 'day155-evidence.txt',
  mimeType: 'text/plain',
  sizeBytes: 18,
  createdBy: 'day155-user',
  createdAt: '2026-08-30T10:00:00.000Z',
};

describe('day155 attachment persistence callers', () => {
  it('reloads task attachments from the canonical object-attachments endpoint', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: { data: [serverAttachment] } }) };

    const result = await loadTaskAttachments(api, 'task-155');

    expect(api.get).toHaveBeenCalledWith('/my-work/object-attachments/task/task-155');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'att-155',
        name: 'day155-evidence.txt',
        url: '/my-work/object-attachments/task/task-155/att-155/download',
      }),
    ]);
  });

  it('reloads decision attachments from the canonical endpoint', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: { data: [serverAttachment] } }) };

    const result = await loadDecisionAttachments(api, 'decision-155');

    expect(api.get).toHaveBeenCalledWith('/my-work/object-attachments/decision/decision-155');
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'att-155',
        url: '/my-work/object-attachments/decision/decision-155/att-155/download',
      })
    );
  });

  it('keeps server attachments authoritative over a stale local snapshot', () => {
    const server = [{ id: 'server-current', name: 'current.txt' }] as any;
    const staleLocal = [{ id: 'local-stale', name: 'stale.txt' }] as any;

    expect(selectDecisionAttachments(server, staleLocal)).toBe(server);
    expect(selectDecisionAttachments([], staleLocal)).toEqual([]);
  });

  it('downloads a decision attachment through the authenticated API caller', async () => {
    const blob = new Blob(['day155-download'], { type: 'text/plain' });
    const api = { downloadObjectAttachment: vi.fn().mockResolvedValue(blob) };

    await expect(
      downloadDecisionAttachment(api, 'decision-155', 'att-155')
    ).resolves.toBe(blob);
    expect(api.downloadObjectAttachment).toHaveBeenCalledWith(
      '/my-work/object-attachments/decision/decision-155/att-155/download'
    );
  });
});
