import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../WorkCanvasDocumentPanel';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-1' },
      currentOrganization: { id: 'org-1' },
      isAuthInitializing: false,
    }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    workCanvasListDrafts: vi.fn().mockResolvedValue([]),
    workCanvasExportDraft: vi.fn(),
    workCanvasApplyOperation: vi.fn(),
    workCanvasCreateOutput: vi.fn(),
    workCanvasFinalizeResearchReport: vi.fn(),
    workCanvasShare: vi.fn(),
    workCanvasRevokeShare: vi.fn(),
    workCanvasCreateWorkflow: vi.fn(),
    workCanvasResumeWorkflow: vi.fn(),
    workCanvasRunWorkflowStep: vi.fn(),
    workCanvasUpdateWorkflowCollaboration: vi.fn(),
    workCanvasAddWorkflowComment: vi.fn(),
    workCanvasGetVersions: vi.fn().mockResolvedValue({ data: [] }),
    workCanvasRestoreVersion: vi.fn(),
    uploadChatAttachment: vi.fn(),
    createResearchSession: vi.fn(),
  },
}));

vi.mock('@/services/api/workCanvas', () => ({
  WorkCanvasApi: {
    createProposal: vi.fn(),
    approveProposal: vi.fn(),
  },
}));

vi.mock('../CanvasArtifactSwitcher', () => ({
  CanvasArtifactSwitcher: () => <div data-testid="canvas-artifact-switcher" />,
}));

vi.mock('../CanvasEditor/CanvasRichEditor', async () => {
  const actual = await vi.importActual<typeof import('../CanvasEditor/CanvasRichEditor')>(
    '../CanvasEditor/CanvasRichEditor'
  );
  return {
    ...actual,
    CanvasRichEditor: ({ contentMd }: { contentMd: string }) => (
      <div data-testid="canvas-rich-editor">{contentMd}</div>
    ),
  };
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <WorkCanvasDocumentPanel conversationId="conv-quick-add" initialStarterId="document" />
    </MemoryRouter>
  );

describe('WorkCanvasDocumentPanel quick add render path', () => {
  beforeEach(() => {
    window.localStorage.setItem('token', 'token-1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/ai/chat/quick') {
          return new Response(JSON.stringify({ response: 'AI generated canvas paragraph.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url === '/api/work-canvas/drafts') {
          const body = JSON.parse(String(init?.body || '{}'));
          return new Response(
            JSON.stringify({
              data: {
                id: 'draft-1',
                draftId: 'draft-1',
                title: body.title,
                contentMd: body.contentMd,
                content: body.contentMd,
                kind: body.kind,
                canonicalFormat: body.canonicalFormat,
                updatedAt: '2026-09-18T23:30:00.000Z',
                provenance: body.provenance,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('uses the rendered WorkCanvas quick-add flow to call AI and persist the generated block', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('radio', { name: 'Doc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Canvas menu' }));

    fireEvent.change(screen.getByLabelText('Element instruction for Teresa'), {
      target: { value: 'Add a customer risk paragraph' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to canvas' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/ai/chat/quick',
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/work-canvas/drafts',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const aiCall = vi.mocked(globalThis.fetch).mock.calls.find(
      ([input]) => String(input) === '/api/ai/chat/quick'
    );
    expect(JSON.parse(String(aiCall?.[1]?.body))).toMatchObject({
      message: expect.stringContaining('Add a customer risk paragraph'),
      context: { source: 'canvas_selection', selectedText: 'Add a customer risk paragraph' },
    });

    const saveCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input]) => String(input) === '/api/work-canvas/drafts');
    const quickAddSave = saveCalls.find(([, init]) =>
      String(init?.body || '').includes('AI generated canvas paragraph.')
    );
    expect(quickAddSave).toBeTruthy();
    expect(JSON.parse(String(quickAddSave?.[1]?.body))).toMatchObject({
      conversationId: 'conv-quick-add',
      contentMd: expect.stringContaining('AI generated canvas paragraph.'),
    });
  });
});
