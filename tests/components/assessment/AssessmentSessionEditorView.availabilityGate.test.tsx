/**
 * @vitest-environment jsdom
 *
 * RB-021 — availability parity: the direct assessment-editor route must
 * honor the same `isFrameworkComingSoon` gate (decision D-B, CMMI/LEAN
 * beta placeholders) as the library picker (NewAssessmentModal). Before
 * this fix, a legacy or directly-navigated CMMI/LEAN assessmentId reached
 * an editable `CMPracticeForm`/`LeanForm` even though every other entry
 * point blocks starting a session for these frameworks.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssessmentMock } = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
}));

let currentFramework = 'cmmi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ framework: currentFramework, assessmentId: 'asm_legacy_1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/services/api', () => ({
  API_URL: '',
  getHeaders: () => ({}),
  Api: {
    get: vi.fn().mockResolvedValue({}),
    put: vi.fn(),
    post: vi.fn(),
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: {
    getAssessment: getAssessmentMock,
    updateAssessment: vi.fn(),
    getWorkbench: vi.fn().mockResolvedValue({ workbench: null, whatNext: [] }),
    getWorkbenchPromotionPayload: vi.fn().mockResolvedValue(null),
    getUserState: vi.fn().mockResolvedValue({ navigation: null }),
    updateUserState: vi.fn().mockResolvedValue({}),
    listAssignments: vi.fn().mockResolvedValue({ assignments: [] }),
    upsertAssignment: vi.fn().mockResolvedValue({}),
  },
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

const cmPracticeFormRenderSpy = vi.fn();
vi.mock('@/components/assessment/tools/CMPracticeForm', () => ({
  CMPracticeForm: (props: any) => {
    cmPracticeFormRenderSpy(props);
    return <div data-testid="cm-practice-form-editable">editable CMMI form</div>;
  },
}));
const leanFormRenderSpy = vi.fn();
vi.mock('@/components/assessment/tools/LeanForm', () => ({
  LeanForm: (props: any) => {
    leanFormRenderSpy(props);
    return <div data-testid="lean-form-editable">editable Lean form</div>;
  },
}));
vi.mock('@/components/assessment/tools/DRDForm', () => ({ DRDForm: () => null }));
vi.mock('@/components/Initiatives/InitiativeSuggestionBadge', () => ({
  InitiativeSuggestionBadge: () => null,
}));
vi.mock('@/components/shared/ArtifactPermalinkButton', () => ({
  ArtifactPermalinkButton: () => null,
}));

import { AssessmentSessionEditorView } from '../../../src/views/AssessmentSessionEditorView';

function buildLegacyAssessmentDetail(assessmentType: string) {
  return {
    id: 'asm_legacy_1',
    name: `Legacy ${assessmentType} Assessment`,
    status: 'DRAFT',
    backendStatus: 'DRAFT',
    assessment_type: assessmentType,
    completion_percent: 10,
    confidence_avg: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    created_by: 'user-123',
    updated_at: '2026-07-01T00:00:00.000Z',
    updated_by: 'user-123',
    answers: { cmmi: { maturityLevel: 1, categories: {}, overallScore: 0 } },
    contextSnapshot: {},
    navigation: null,
  };
}

describe('AssessmentSessionEditorView — RB-021 availability parity (direct route gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a legacy CMMI session on the direct route with the same coming-soon gate as the library', async () => {
    currentFramework = 'cmmi';
    getAssessmentMock.mockResolvedValue({ assessment: buildLegacyAssessmentDetail('CMMI') });

    render(<AssessmentSessionEditorView />);

    await waitFor(() => {
      expect(screen.getByText('This framework is coming soon')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cm-practice-form-editable')).not.toBeInTheDocument();
    expect(cmPracticeFormRenderSpy).not.toHaveBeenCalled();
  });

  it('blocks a legacy LEAN session on the direct route the same way', async () => {
    currentFramework = 'lean';
    getAssessmentMock.mockResolvedValue({ assessment: buildLegacyAssessmentDetail('LEAN') });

    render(<AssessmentSessionEditorView />);

    await waitFor(() => {
      expect(screen.getByText('This framework is coming soon')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('lean-form-editable')).not.toBeInTheDocument();
    expect(leanFormRenderSpy).not.toHaveBeenCalled();
  });
});
