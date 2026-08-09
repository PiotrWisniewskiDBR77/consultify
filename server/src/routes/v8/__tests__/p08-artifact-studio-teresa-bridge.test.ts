import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);
const mockCreateLocalEditProposal = vi.fn().mockResolvedValue({ proposalId: 'doc-proposal-1' });
const mockApproveEditProposal = vi.fn().mockResolvedValue({
  proposal: { versionAfterId: 'doc-version-8' },
});
const mockApplyPresentationEdit = vi.fn().mockResolvedValue({
  deckId: 'deck-1',
  operationId: 'ppt-operation-1',
  versionBefore: 12,
  versionAfter: 13,
  actions: ['made copy concise'],
  skippedLockedSlides: [6],
  reply: 'Applied: made copy concise.',
});

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/workbook/workbookCommandService.js', () => ({
  applyWorkbookCommand: vi.fn(),
  undoWorkbookCommand: vi.fn(),
  WorkbookCommandError: class WorkbookCommandError extends Error {},
}));

vi.mock('../../../services/documentStudio/documentStudioService.js', () => ({
  createLocalEditProposal: (...args: unknown[]) => mockCreateLocalEditProposal(...args),
  createSectionEditProposal: vi.fn(),
  createGlobalEditProposal: vi.fn(),
  approveEditProposal: (...args: unknown[]) => mockApproveEditProposal(...args),
}));

vi.mock('../../../services/presentationTeresaBridgeService.js', () => ({
  applyApprovedPresentationTeresaEdit: (...args: unknown[]) =>
    mockApplyPresentationEdit(...args),
}));

const { createChatProposal, executeProposal } = await import(
  '../../../services/v8/teresaCopilotService.js'
);
const { P08_HANDOFF_TARGET_MODULES, validateTargetPayload } = await import(
  '../../../services/v8/teresaCopilotCanon.js'
);

const ORG = '00000000-0000-4000-8000-000000000d01';
const USER = '00000000-0000-4000-8000-000000000d02';
const SESSION = '00000000-0000-4000-8000-000000000d03';

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
  mockCreateLocalEditProposal.mockResolvedValue({ proposalId: 'doc-proposal-1' });
  mockApproveEditProposal.mockResolvedValue({
    proposal: { versionAfterId: 'doc-version-8' },
  });
  mockApplyPresentationEdit.mockResolvedValue({
    deckId: 'deck-1',
    operationId: 'ppt-operation-1',
    versionBefore: 12,
    versionAfter: 13,
    actions: ['made copy concise'],
    skippedLockedSlides: [6],
    reply: 'Applied: made copy concise.',
  });
});

describe('Artifact Studio global Teresa bridge', () => {
  it('declares DOC and PPT payload contracts and rejects unsupported targets fail-closed', () => {
    expect(P08_HANDOFF_TARGET_MODULES).toContain('documents');
    expect(P08_HANDOFF_TARGET_MODULES).toContain('presentations');
    expect(
      validateTargetPayload('documents', {
        artifact_id: 'doc-1',
        instruction: 'Shorten the selected paragraph',
        document_context: { scope: 'local' },
      })
    ).toEqual({ valid: true, missing: [] });
    expect(validateTargetPayload('unknown' as never, {})).toEqual({
      valid: false,
      missing: ['unsupported_target:unknown'],
    });
  });

  it('creates a PPT proposal with immutable deck version context', async () => {
    const proposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Skróć prezentację i zachowaj zablokowane slajdy',
      assistantMessage: 'Przygotuję propozycję zmian.',
      context: {
        workspaceContext: {
          type: 'presentation',
          entityId: 'deck-1',
          entityData: {
            deckId: 'deck-1',
            versionId: 12,
            classification: 'Internal',
            lifecycle: 'Draft',
            language: 'pl',
            selection: { slideId: 'slide-3', blockId: 'block-kpi' },
          },
        },
        screenContext: { currentScreen: 'presentation-studio' },
      },
    });

    expect(proposal?.targetModule).toBe('presentations');
    const insert = mockDbRun.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO teresa_proposals')
    );
    const payload = JSON.parse(String((insert?.[1] as unknown[])[6]));
    expect(payload).toMatchObject({
      deck_id: 'deck-1',
      proposal_only: true,
      presentation_context: {
        version_id: 12,
        classification: 'Internal',
        lifecycle: 'Draft',
        slide_id: 'slide-3',
        block_id: 'block-kpi',
      },
    });
  });

  it('creates a governed local DOC proposal from stable global Teresa context', async () => {
    const proposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Popraw zaznaczony akapit w dokumencie',
      assistantMessage: 'Przygotuję propozycję zmiany.',
      context: {
        workspaceContext: {
          type: 'document',
          entityId: 'doc-1',
          entityData: {
            artifactId: 'doc-1',
            versionId: 'doc-version-7',
            classification: 'Internal',
            lifecycle: 'Draft',
            selection: { sectionId: 'section-1', blockId: 'block-2' },
          },
        },
        screenContext: { currentScreen: 'document-studio' },
      },
    });

    expect(proposal?.targetModule).toBe('documents');
    const insert = mockDbRun.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO teresa_proposals')
    );
    expect(insert).toBeTruthy();
    const params = insert?.[1] as unknown[];
    const payload = JSON.parse(String(params[6]));
    expect(payload).toMatchObject({
      artifact_id: 'doc-1',
      proposal_only: true,
      document_context: {
        version_id: 'doc-version-7',
        classification: 'Internal',
        lifecycle: 'Draft',
        scope: 'local',
        section_id: 'section-1',
        block_id: 'block-2',
      },
    });
  });

  it('executes an approved DOC envelope only through the Document Studio proposal writer', async () => {
    const handoffContext = {
      origin: 'teresa',
      user_intent: 'Shorten the selected paragraph',
      active_surface: 'document-studio',
      org_context_ref: `org:${ORG}`,
      bounded_context_pack: [],
      constraints: ['proposal_first', 'no_silent_writes'],
      assumptions: [],
      uncertainty_boundary: {
        missing_inputs: [],
        conflicts: [],
        what_would_change_next_action: [],
      },
      evidence_pointers: [],
      proposed_next_action: {
        target_module: 'documents',
        handoff_intent: 'append',
        requires_approval: true,
      },
      audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
    };
    mockDbGet.mockResolvedValueOnce({
      id: 'teresa-proposal-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      state: 'approved',
      handoff_context_json: JSON.stringify(handoffContext),
      target_module: 'documents',
      target_payload_json: JSON.stringify({
        artifact_id: 'doc-1',
        instruction: 'Shorten the selected paragraph',
        document_context: {
          scope: 'local',
          section_id: 'section-1',
          block_id: 'block-2',
        },
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await executeProposal({
      proposalId: 'teresa-proposal-1',
      organizationId: ORG,
      userId: USER,
    });

    expect(result).toMatchObject({
      success: true,
      state: 'completed',
      target_module: 'documents',
      handoff_result: {
        handoff: 'documents',
        artifact_ref: 'doc-1',
        domain_proposal_ref: 'doc-proposal-1',
        version_after: 'doc-version-8',
      },
    });
    expect(mockCreateLocalEditProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'doc-1',
        organizationId: ORG,
        userId: USER,
        input: expect.objectContaining({
          scope: 'local',
          sectionId: 'section-1',
          blockId: 'block-2',
        }),
      })
    );
    expect(mockApproveEditProposal).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 'doc-proposal-1' })
    );
  });

  it('executes an approved PPT envelope only through the versioned Presentation Studio writer', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'teresa-proposal-ppt-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      state: 'approved',
      handoff_context_json: JSON.stringify({
        origin: 'teresa',
        user_intent: 'Make the deck concise',
        active_surface: 'presentation-studio',
        org_context_ref: `org:${ORG}`,
        bounded_context_pack: [],
        constraints: ['proposal_first', 'no_silent_writes'],
        assumptions: [],
        uncertainty_boundary: {
          missing_inputs: [],
          conflicts: [],
          what_would_change_next_action: [],
        },
        evidence_pointers: [],
        proposed_next_action: {
          target_module: 'presentations',
          handoff_intent: 'append',
          requires_approval: true,
        },
        audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
      }),
      target_module: 'presentations',
      target_payload_json: JSON.stringify({
        deck_id: 'deck-1',
        instruction: 'Make the deck concise',
        presentation_context: { version_id: 12, language: 'en' },
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await executeProposal({
      proposalId: 'teresa-proposal-ppt-1',
      organizationId: ORG,
      userId: USER,
    });

    expect(result).toMatchObject({
      success: true,
      state: 'completed',
      target_module: 'presentations',
      handoff_result: {
        handoff: 'presentations',
        deck_ref: 'deck-1',
        operation_ref: 'ppt-operation-1',
        version_before: 12,
        version_after: 13,
        skipped_locked_slides: [6],
      },
    });
    expect(mockApplyPresentationEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'deck-1',
        organizationId: ORG,
        userId: USER,
        instruction: 'Make the deck concise',
        expectedVersion: 12,
      })
    );
  });
});
