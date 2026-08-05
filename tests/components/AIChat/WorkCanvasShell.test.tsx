/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasShell } from '../../../src/components/AIChat/WorkCanvas/WorkCanvasShell';

let unifiedChatProps: any = null;
const v8ArtifactRunControlMock = vi.fn();
const workCanvasApiMock = vi.hoisted(() => ({
  listDrafts: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  getDraft: vi.fn(),
  saveAsArtifact: vi.fn(),
  createProposal: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

function renderShell(initialEntries = ['/ai/work-canvas']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <WorkCanvasShell />
    </MemoryRouter>
  );
}

vi.mock('../../../src/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: (props: any) => {
    unifiedChatProps = props;
    return (
      <div data-testid="mock-unified-chat">
        <button type="button" onClick={() => props.onMessageSent?.('Zrób tabelę priorytetów')}>
          mock-send-table
        </button>
        <button type="button" onClick={() => props.onMessageSent?.('Uruchom głębokie badanie')}>
          mock-send-research
        </button>
      </div>
    );
  },
}));

vi.mock('../../../src/components/AIChat/ResearchSessionsDock', () => ({
  ResearchSessionsDock: (props: any) => (
    <div data-testid="research-sessions-dock">
      Research dock
      <button
        type="button"
        onClick={() =>
          props.onSessionSelected?.({
            sessionId: 'research-session-1',
            status: 'running',
          })
        }
      >
        mock-select-research-session
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/AIChat/V8ArtifactRunControl', () => ({
  V8ArtifactRunControl: (props: any) => {
    v8ArtifactRunControlMock(props);
    return <div data-testid="v8-artifact-run-control" />;
  },
}));

vi.mock('../../../src/components/AIChat/KimiWorkspace/WordyView', () => ({
  WordyView: () => <div data-testid="wordy-lane">Wordy lane</div>,
}));

vi.mock('../../../src/components/AIChat/KimiWorkspace/ExceleView', () => ({
  ExceleView: () => <div data-testid="excele-lane">Excele lane</div>,
}));

vi.mock('../../../src/components/AIChat/KimiWorkspace/PrezentacjeView', () => ({
  PrezentacjeView: () => <div data-testid="prezentacje-lane">Prezentacje lane</div>,
}));

vi.mock('../../../src/services/api/workCanvas', () => ({
  WorkCanvasApi: workCanvasApiMock,
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = {
      activeConversationId: 'conv-work-canvas-1',
      conversations: [
        {
          id: 'conv-work-canvas-1',
          projectId: 'project-1',
        },
      ],
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

describe('WorkCanvasShell', () => {
  beforeEach(() => {
    unifiedChatProps = null;
    v8ArtifactRunControlMock.mockClear();
    workCanvasApiMock.listDrafts.mockResolvedValue([]);
    workCanvasApiMock.getDraft.mockResolvedValue({
      draft: {
        id: 'draft-deep-link',
        conversationId: 'conv-work-canvas-1',
        kind: 'markdown',
        title: 'Deep linked draft',
        content: '# Deep linked draft',
        saveState: 'unsaved',
        lifecycleState: 'draft',
        dirtyState: 'dirty',
        visibility: 'project',
        auditStatus: 'not_required',
        sources: [],
        provenance: {},
        projectId: 'project-1',
        artifactVersion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      proposals: [],
    });
    workCanvasApiMock.createDraft.mockImplementation(async (input: any) => ({
      data: {
        id: 'draft-api-1',
        ...input,
        saveState: 'unsaved',
        lifecycleState: 'draft',
        dirtyState: 'dirty',
        visibility: 'project',
        auditStatus: 'not_required',
        sources: input.sources || [],
        provenance: input.provenance || {},
        projectId: input.projectId || null,
        ownerId: input.ownerId || null,
        artifactVersion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      auditEventId: 'audit-create',
    }));
    workCanvasApiMock.updateDraft?.mockResolvedValue?.({
      data: {
        id: 'draft-api-1',
        conversationId: 'conv-work-canvas-1',
        kind: 'research',
        title: 'Research draft',
        content: { mission: 'Research', questions: [], allowedSources: [], status: 'running' },
        researchSessionId: 'research-session-1',
        saveState: 'unsaved',
        lifecycleState: 'draft',
        dirtyState: 'dirty',
        visibility: 'project',
        auditStatus: 'not_required',
        sources: [],
        provenance: {},
        projectId: 'project-1',
        ownerId: null,
        artifactVersion: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      auditEventId: 'audit-update',
    });
    workCanvasApiMock.saveAsArtifact.mockImplementation(async (draftId: string) => ({
      data: {
        id: draftId,
        conversationId: 'conv-work-canvas-1',
        kind: 'markdown',
        title: 'Saved draft',
        content: '# Saved draft',
        saveState: 'saved',
        lifecycleState: 'draft',
        dirtyState: 'clean',
        visibility: 'project',
        auditStatus: 'recorded',
        sources: [],
        provenance: { artifactId: 'artifact-1' },
        artifactId: 'artifact-1',
        artifactVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      auditEventId: 'audit-save',
      readBack: { target: 'artifact', artifactId: 'artifact-1', auditEventId: 'audit-save' },
    }));
    workCanvasApiMock.createProposal.mockImplementation(
      async (draftId: string, target: string) => ({
        data: {
          id: `proposal-${target}`,
          draftId,
          target,
          title: `${target}: Saved draft`,
          summary:
            'Proposal created first. Approving this preview should be the only path to a durable business object mutation.',
          status: 'proposed',
          requiredCapability: `canvas.convert.${target}`,
          targetObjectId: null,
          readBack: null,
          auditEventId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        auditEventId: 'audit-proposal',
      })
    );
    workCanvasApiMock.approveProposal.mockImplementation(async (proposalId: string) => ({
      data: {
        id: proposalId,
        draftId: 'draft-api-1',
        target: 'idea',
        title: 'Idea: Saved draft',
        summary: 'Approved proposal',
        status: 'approved',
        targetObjectId: 'idea-1',
        readBack: {
          target: 'idea',
          targetObjectId: 'idea-1',
          status: 'approved',
          entityStatus: 'created',
          projectId: 'project-1',
          ownerId: 'user-1',
          auditEventId: 'audit-approve',
        },
        auditEventId: 'audit-approve',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));
  });

  it('renders the split chat shell and updates the right canvas from chat', async () => {
    renderShell();

    expect(screen.getByTestId('mock-unified-chat')).toBeInTheDocument();
    expect(screen.getByText('Consultify Work Canvas')).toBeInTheDocument();
    expect(unifiedChatProps.workspaceContext.type).toBe('canvas');

    fireEvent.click(screen.getByText('mock-send-table'));

    await waitFor(() => expect(workCanvasApiMock.createDraft).toHaveBeenCalled());
    expect(screen.getAllByText('Zrób tabelę priorytetów').length).toBeGreaterThan(0);
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getByText('Next step')).toBeInTheDocument();
  });

  it('loads a stable draft deep link and exposes source/download actions', async () => {
    renderShell(['/ai/work-canvas?draftId=draft-deep-link&conversationId=conv-work-canvas-1']);

    await waitFor(() => expect(workCanvasApiMock.getDraft).toHaveBeenCalledWith('draft-deep-link'));
    expect(screen.getAllByText('Deep linked draft').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Source'));
    expect(screen.getByText(/# Deep linked draft/)).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('shows proposal-first conversion preview for business chips', async () => {
    renderShell();

    fireEvent.click(screen.getByText('Idea'));

    await waitFor(() => expect(workCanvasApiMock.createProposal).toHaveBeenCalled());
    expect(screen.getByText(/idea:/i)).toBeInTheDocument();
    expect(screen.getByText(/Proposal created first/)).toBeInTheDocument();
    expect(workCanvasApiMock.createProposal).toHaveBeenCalledWith(
      expect.any(String),
      'idea',
      expect.objectContaining({
        projectId: 'project-1',
        source: 'work_canvas',
      })
    );
  });

  it('separates save state from lifecycle state and exposes artifact runtime', async () => {
    renderShell();

    expect(screen.getByText('Draft')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save artifact'));

    await waitFor(() => expect(workCanvasApiMock.saveAsArtifact).toHaveBeenCalled());
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Artifact read-back')).toBeInTheDocument();
    expect(screen.getByText('artifact-1')).toBeInTheDocument();
    expect(screen.getByText('Lifecycle:')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByTestId('v8-artifact-run-control')).toBeInTheDocument();
    expect(v8ArtifactRunControlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-work-canvas-1',
        snapshotContext: expect.objectContaining({
          projectId: 'project-1',
        }),
      })
    );
  });

  it('shows structured read-back after approving a proposal', async () => {
    renderShell();

    fireEvent.click(screen.getByText('Idea'));
    await waitFor(() => expect(workCanvasApiMock.createProposal).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Approve proposal'));

    await waitFor(() => expect(workCanvasApiMock.approveProposal).toHaveBeenCalled());
    expect(screen.getByText('Target id')).toBeInTheDocument();
    expect(screen.getByText('idea-1')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('project-1')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('audit-approve')).toBeInTheDocument();
  });

  it('maps capability and stale backend errors to business messages', async () => {
    workCanvasApiMock.createProposal.mockRejectedValueOnce(
      Object.assign(new Error('raw forbidden'), {
        data: { error: { code: 'CANVAS_CAPABILITY_REQUIRED' } },
      })
    );
    renderShell();

    fireEvent.click(screen.getByText('Idea'));

    // workCanvasErrorMessage() renders t('canvas.workShell.errCapabilityRequired', <english
    // fallback>). Commit c2f68c337c (2026-07-03, "wire Canvas toolbar, WorkCanvasShell and
    // panel labels to t() + en/pl keys") replaced the old hardcoded-Polish copy this
    // assertion used to check with that t()-wrapped call; the real Polish string now lives
    // in public/locales/pl/translation.json under the same key. The global react-i18next
    // mock (tests/setup.ts) does not load locale resources — when a string default value is
    // passed as the second t() argument it returns that fallback verbatim — so, like every
    // other text assertion in this file (e.g. 'Area', 'Draft', 'Saved' below), the only text
    // this suite can observe is the English fallback actually passed in the component code.
    expect(
      await screen.findByText('You do not have the required capability for this canvas action.')
    ).toBeInTheDocument();

    workCanvasApiMock.createProposal.mockResolvedValueOnce({
      data: {
        id: 'proposal-idea',
        draftId: 'draft-api-1',
        target: 'idea',
        title: 'Idea: Saved draft',
        summary: 'Proposal created first.',
        status: 'proposed',
        readBack: null,
        createdAt: new Date().toISOString(),
      },
    });
    workCanvasApiMock.approveProposal.mockRejectedValueOnce(
      Object.assign(new Error('raw stale'), {
        data: { code: 'STALE_CANVAS_PROPOSAL' },
      })
    );

    fireEvent.click(screen.getByText('Idea'));
    await waitFor(() => expect(screen.getByText('Approve proposal')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve proposal'));

    // Same t()-fallback contract as errCapabilityRequired above, for
    // canvas.workShell.errStaleProposal.
    expect(
      await screen.findByText(
        'The proposal is stale because the canvas changed after it was created. Generate the proposal again.'
      )
    ).toBeInTheDocument();
  });

  it('renders deep research as a canvas variant with existing research dock', async () => {
    renderShell();

    fireEvent.click(screen.getByText('mock-send-research'));

    await waitFor(() => expect(workCanvasApiMock.createDraft).toHaveBeenCalled());
    expect(screen.getByText('Deep research mission')).toBeInTheDocument();
    expect(screen.getByTestId('research-sessions-dock')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-select-research-session'));
    await waitFor(() =>
      expect(workCanvasApiMock.updateDraft).toHaveBeenCalledWith(
        'draft-api-1',
        expect.objectContaining({
          researchSessionId: 'research-session-1',
        })
      )
    );
  });

  it('keeps the split chat shell for document canvas kind', () => {
    renderShell(['/ai/work-canvas?kind=document']);

    expect(screen.getByTestId('mock-unified-chat')).toBeInTheDocument();
    expect(screen.getByText('Consultify Work Canvas')).toBeInTheDocument();
    expect(screen.getByText('Document canvas')).toBeInTheDocument();
    expect(screen.getByText(/shared split screen/)).toBeInTheDocument();
    expect(screen.queryByTestId('wordy-lane')).not.toBeInTheDocument();
  });
});
