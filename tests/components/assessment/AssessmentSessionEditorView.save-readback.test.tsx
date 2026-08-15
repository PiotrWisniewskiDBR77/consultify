/**
 * @vitest-environment jsdom
 *
 * ASM-001A — Task 4 coverage: "Form save kończy się GET/read-back; błąd
 * read-back nie daje fałszywego success" + visible V8/degraded-legacy
 * provenance badge.
 *
 * Full real mount of AssessmentSessionEditorView (framework=DRD). Every
 * heavy child editor/panel is stubbed to `() => null` — this suite is about
 * the save/read-back/provenance logic that lives in THIS component, not the
 * DRD form UI itself (covered elsewhere). Manual save (Ctrl+S) is used to
 * drive the assertions because it doesn't require faking the 600ms autosave
 * debounce timer and reads directly from already-loaded `answers` state.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAssessmentMock,
  updateAssessmentMock,
  getWorkbenchMock,
  getWorkbenchPromotionPayloadMock,
  getUserStateMock,
  updateUserStateMock,
  listAssignmentsMock,
  upsertAssignmentMock,
  apiGetMock,
  apiPutMock,
} = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
  updateAssessmentMock: vi.fn(),
  getWorkbenchMock: vi.fn(),
  getWorkbenchPromotionPayloadMock: vi.fn(),
  getUserStateMock: vi.fn(),
  updateUserStateMock: vi.fn(),
  listAssignmentsMock: vi.fn(),
  upsertAssignmentMock: vi.fn(),
  apiGetMock: vi.fn(),
  apiPutMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ framework: 'drd', assessmentId: 'asm_1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  Api: {
    get: apiGetMock,
    put: apiPutMock,
    post: vi.fn(),
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn(),
  },
  getHeaders: () => ({ Authorization: 'Bearer test-token' }),
}));

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: {
    getAssessment: getAssessmentMock,
    updateAssessment: updateAssessmentMock,
    getWorkbench: getWorkbenchMock,
    getWorkbenchPromotionPayload: getWorkbenchPromotionPayloadMock,
    getUserState: getUserStateMock,
    updateUserState: updateUserStateMock,
    listAssignments: listAssignmentsMock,
    upsertAssignment: upsertAssignmentMock,
  },
}));

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isEnabled: () => false }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: any) => {
    const state = {
      currentUser: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'owner' },
      isChatCollapsed: true,
      toggleChatCollapse: vi.fn(),
      setCurrentViewState: vi.fn(),
      currentProjectId: 'proj-1',
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = {
      createConversation: vi.fn(),
      activeConversationId: null,
      setActiveConversation: vi.fn(),
      setWorkspaceContext: vi.fn(),
      addMessage: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/components/assessment/adma/ADMAAssessmentEditor', () => ({
  ADMAAssessmentEditor: () => null,
}));
vi.mock('@/components/assessment/AssessmentMenu3ActionBar', () => ({
  AssessmentMenu3ActionBar: () => null,
}));
vi.mock('@/components/assessment/AssessmentV8CanonPanel', () => ({
  AssessmentV8CanonPanel: () => null,
}));
vi.mock('@/components/assessment/AssessmentWorkbenchPanel', () => ({
  AssessmentWorkbenchPanel: () => null,
}));
vi.mock('@/components/assessment/drd/DRDAssessmentEditor', () => ({
  DRDAssessmentEditor: () => null,
}));
vi.mock('@/components/assessment/drd/DRDMatrixSession', () => ({
  DRDMatrixSession: () => null,
}));
vi.mock('@/components/assessment/InitiativesGenerationWizardModal', () => ({
  InitiativesGenerationWizardModal: () => null,
}));
vi.mock('@/components/assessment/manage/AssessmentManagePanel', () => ({
  AssessmentManagePanel: () => null,
}));
vi.mock('@/components/assessment/modals/ReportTemplatePickerModal', () => ({
  ReportTemplatePickerModal: () => null,
}));
vi.mock('@/components/assessment/permissions', () => ({
  RequestAccessModal: () => null,
  useAssessmentPermissions: () => ({
    role: 'admin',
    permissions: {
      canView: true,
      canEdit: true,
      canManage: true,
      canManageTeam: true,
      canChangeStatus: true,
      canApprove: true,
      canDelete: true,
      canGenerateReport: true,
      canGenerateInitiatives: true,
      canRequestAccess: true,
    },
    isLoading: false,
    requestAccess: vi.fn(),
    refreshPermissions: vi.fn(),
  }),
}));
vi.mock('@/components/assessment/siri/SIRIAssessmentEditor', () => ({
  SIRIAssessmentEditor: () => null,
}));
vi.mock('@/components/assessment/tools/CMPracticeForm', () => ({ CMPracticeForm: () => null }));
vi.mock('@/components/assessment/tools/DRDForm', () => ({ DRDForm: () => null }));
vi.mock('@/components/assessment/tools/LeanForm', () => ({ LeanForm: () => null }));
vi.mock('@/components/Initiatives/InitiativeSuggestionBadge', () => ({
  InitiativeSuggestionBadge: () => null,
}));
vi.mock('@/components/shared/ArtifactPermalinkButton', () => ({
  ArtifactPermalinkButton: () => null,
}));

import { AssessmentSessionEditorView } from '../../../src/views/AssessmentSessionEditorView';

function buildV8AssessmentDetail(overrides: Record<string, any> = {}) {
  return {
    id: 'asm_1',
    name: 'Test DRD Assessment',
    status: 'DRAFT',
    backendStatus: 'DRAFT',
    assessment_type: 'DRD',
    completion_percent: 10,
    confidence_avg: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    created_by: 'user-123',
    updated_at: '2026-07-01T00:00:00.000Z',
    // Same as currentUser.id — skips the "resolve editor display name" fetch
    // (Api.get(`/users/${id}`)) that isn't mocked in this suite.
    updated_by: 'user-123',
    answers: { drd: { areas: {} } },
    contextSnapshot: {},
    navigation: null,
    ...overrides,
  };
}

async function mountAndWaitReady() {
  render(<AssessmentSessionEditorView />);
  await waitFor(() => {
    expect(screen.getByText('Test DRD Assessment')).toBeInTheDocument();
  });
}

describe('AssessmentSessionEditorView — save read-back (ASM-001A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkbenchMock.mockResolvedValue({ workbench: null, whatNext: [] });
    getWorkbenchPromotionPayloadMock.mockResolvedValue(null);
    getUserStateMock.mockResolvedValue({ navigation: null });
    updateUserStateMock.mockResolvedValue({});
    listAssignmentsMock.mockResolvedValue({ assignments: [] });
    upsertAssignmentMock.mockResolvedValue({});
  });

  it('manual save happy path: PUT + GET read-back match → shows success, no degraded state', async () => {
    const detail = buildV8AssessmentDetail();
    // Same content on both the initial load and the read-back after save —
    // the answers sent are exactly the answers already loaded (Ctrl+S with
    // no further edits), so the round-trip must be reported as verified.
    getAssessmentMock.mockResolvedValue({ assessment: detail });
    updateAssessmentMock.mockResolvedValue({ updatedAt: '2026-08-01T10:00:00.000Z' });

    await mountAndWaitReady();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(updateAssessmentMock).toHaveBeenCalledTimes(1);
    });
    // Read-back: one extra GET beyond the initial load's GET.
    await waitFor(() => {
      expect(getAssessmentMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Assessment saved successfully');
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assessment-editor-autosave-failed')).not.toBeInTheDocument();
    expect(screen.getByTestId('assessment-editor-provenance-badge')).toHaveTextContent('V8');
  });

  it('manual save failure path: GET read-back returns mismatched answers → no false success', async () => {
    const original = buildV8AssessmentDetail();
    const mismatched = buildV8AssessmentDetail({
      // Read-back returns different persisted answers than what was sent —
      // the save must NOT be reported as successful.
      answers: { drd: { areas: { '1A': { achievedLevel: 3 } } } },
    });
    getAssessmentMock
      .mockResolvedValueOnce({ assessment: original }) // initial load
      .mockResolvedValueOnce({ assessment: mismatched }); // read-back after save
    updateAssessmentMock.mockResolvedValue({ updatedAt: '2026-08-01T10:05:00.000Z' });

    await mountAndWaitReady();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(updateAssessmentMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getAssessmentMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    // The false-success guard: PUT succeeded, but success must not be reported.
    expect(toast.success).not.toHaveBeenCalledWith('Assessment saved successfully');
    expect(screen.getByTestId('assessment-editor-autosave-failed')).toBeInTheDocument();
  });

  it('fails closed when the canonical V8 assessment cannot be loaded', async () => {
    const fallbackError = Object.assign(new Error('Not found'), { status: 404 });
    getAssessmentMock.mockRejectedValueOnce(fallbackError);

    render(<AssessmentSessionEditorView />);
    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
    expect(apiGetMock).not.toHaveBeenCalledWith('/assessment-workflow-v2/asm_1');
  });
});
