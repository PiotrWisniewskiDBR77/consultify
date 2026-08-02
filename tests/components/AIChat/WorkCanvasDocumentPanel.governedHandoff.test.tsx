import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

const draft = {
  id: 'active-draft-1',
  title: 'Active Chat note',
  kind: 'markdown',
  contentMd: '# Active Chat note',
  saveState: 'saved',
  lifecycleState: 'draft',
  markdownProjectionStatus: 'synced',
  updatedAt: '2026-08-02T18:00:00.000Z',
};

const approvedReceipt = {
  id: 'proposal-note-1',
  draftId: draft.id,
  target: 'note',
  title: draft.title,
  summary: draft.title,
  status: 'approved',
  targetObjectId: 'note-owner-1',
  readBack: { url: '/my-work?view=notebook&pageId=note-owner-1' },
  createdAt: '2026-08-02T18:01:00.000Z',
  updatedAt: '2026-08-02T18:01:01.000Z',
};

describe('active Chat Canvas governed handoff', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('coalesces a fast double-click and restores the durable owner receipt after remount', async () => {
    let createCalls = 0;
    let approveCalls = 0;
    let approved = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/work-canvas/drafts/${draft.id}`) && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({ data: { draft, proposals: approved ? [approvedReceipt] : [] } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith(`/work-canvas/drafts/${draft.id}/proposals`)) {
        createCalls += 1;
        const body = JSON.parse(String(init?.body));
        expect(body.target).toBe('note');
        expect(body.idempotencyKey).toEqual(expect.any(String));
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(
          JSON.stringify({ data: { ...approvedReceipt, status: 'proposed', targetObjectId: null } }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith(`/work-canvas/proposals/${approvedReceipt.id}/approve`)) {
        approveCalls += 1;
        approved = true;
        return new Response(JSON.stringify({ data: approvedReceipt }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = render(<WorkCanvasDocumentPanel initialDraftId={draft.id} />);
    await screen.findByText('Active Chat note');
    const handoff = (await screen.findAllByRole('button', { name: 'Save as note' }))[0];
    fireEvent.click(handoff);
    fireEvent.click(handoff);

    expect(await screen.findByRole('link', { name: 'Open created object' })).toHaveAttribute(
      'href',
      approvedReceipt.readBack.url
    );
    expect(createCalls).toBe(1);
    expect(approveCalls).toBe(1);

    first.unmount();
    render(<WorkCanvasDocumentPanel initialDraftId={draft.id} />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Open created object' })).toHaveAttribute(
        'href',
        approvedReceipt.readBack.url
      )
    );
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent('Previously created');
  });
});
