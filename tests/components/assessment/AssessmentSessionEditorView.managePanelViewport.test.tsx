/**
 * @vitest-environment jsdom
 *
 * Odbiór 05.09 (05-ocena, defekt 1): po kliknięciu „Zarządzaj" panel
 * „Zarządzanie" był w DOM, ale renderował się dokładnie POD dolną krawędzią
 * okna (zmierzone top = wysokość okna: 900 przy oknie 900, 1600 przy 1600)
 * i nie dało się do niego doscrollować.
 *
 * Przyczyna: pasy rozwijane (panel AI · ład korporacyjny · Info) mieszkały
 * WEWNĄTRZ kompaktowego nagłówka — dziecka flex-column z `min-height:auto`.
 * Gdy pas ładu urósł ponad wysokość okna, nagłówek nie mógł się skurczyć,
 * siostrzany region edytora (`flex-1`) dostawał zero wysokości i startował
 * dokładnie na dolnej krawędzi okna. Nic w tym łańcuchu nie przewijało.
 *
 * jsdom nie liczy layoutu, więc test broni MECHANIZMU, który tę geometrię
 * gwarantuje (każdy z czterech warunków sam w sobie przywraca defekt):
 *  a) treść pasów NIE jest w kompaktowym nagłówku,
 *  b) pas rozwijany ma własny limit wysokości + własne przewijanie,
 *  c) region edytora ma `flex-1 min-h-0` (może się skurczyć, więc mieści się w oknie),
 *  d) panel „Zarządzanie" renderuje się WEWNĄTRZ regionu edytora.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssessmentMock } = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ framework: 'siri', assessmentId: 'asm_siri_1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/services/api', () => ({
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

vi.mock('@/components/assessment/AssessmentMenu3ActionBar', () => ({
  AssessmentMenu3ActionBar: () => <div data-testid="menu3-bar" />,
}));
// The two tall lane panels that used to blow the compact header past the viewport.
vi.mock('@/components/assessment/AssessmentV8CanonPanel', () => ({
  AssessmentV8CanonPanel: () => <div data-testid="v8-canon-panel" />,
}));
vi.mock('@/components/assessment/AssessmentWorkbenchPanel', () => ({
  AssessmentWorkbenchPanel: () => <div data-testid="v8-workbench-panel" />,
}));
vi.mock('@/components/assessment/adma/ADMAAssessmentEditor', () => ({
  ADMAAssessmentEditor: () => null,
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
  AssessmentManagePanel: () => <div data-testid="assessment-manage-panel">Zarządzanie</div>,
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
// Real SIRI editor renders `leftOverride` for us; keep the contract, drop the body.
vi.mock('@/components/assessment/siri/SIRIAssessmentEditor', () => ({
  SIRIAssessmentEditor: ({ leftOverride }: { leftOverride?: React.ReactNode }) =>
    leftOverride ? <div className="h-full">{leftOverride}</div> : <div>siri editor</div>,
}));
vi.mock('@/components/assessment/tools/CMPracticeForm', () => ({ CMPracticeForm: () => null }));
vi.mock('@/components/assessment/tools/LeanForm', () => ({ LeanForm: () => null }));
vi.mock('@/components/assessment/tools/DRDForm', () => ({ DRDForm: () => null }));
vi.mock('@/components/Initiatives/InitiativeSuggestionBadge', () => ({
  InitiativeSuggestionBadge: () => null,
}));
vi.mock('@/components/shared/ArtifactPermalinkButton', () => ({
  ArtifactPermalinkButton: () => null,
}));

import { AssessmentSessionEditorView } from '../../../src/views/AssessmentSessionEditorView';

function siriAssessment() {
  return {
    id: 'asm_siri_1',
    name: 'SIRI session',
    status: 'DRAFT',
    backendStatus: 'DRAFT',
    assessment_type: 'SIRI',
    completion_percent: 10,
    confidence_avg: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    created_by: 'user-123',
    updated_at: '2026-07-01T00:00:00.000Z',
    updated_by: 'user-123',
    answers: { siri: {} },
    contextSnapshot: {},
    navigation: null,
  };
}

describe('AssessmentSessionEditorView — panel „Zarządzanie" musi zostać w oknie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAssessmentMock.mockResolvedValue({ assessment: siriAssessment() });
  });

  it('trzyma pasy rozwijane poza kompaktowym nagłówkiem, w osobnym ograniczonym pasie', async () => {
    render(<AssessmentSessionEditorView />);

    const header = await screen.findByTestId('assessment-editor-header');
    const lanes = await screen.findByTestId('assessment-editor-lanes');

    // Governance (the tall lane used below as proof-content) is secondary for
    // non-DRD sessions since 2026-09-05 (dyżur "sesja SIRI otwiera warsztat"):
    // hidden until the user opts in via the „Governance" switch — see
    // AssessmentSessionEditorView.siriGovernanceLane.test.tsx. Open it here so
    // this test can still prove ITS structural placement, without weakening
    // that default-hidden behaviour.
    const governanceToggle = await screen.findByRole('button', { name: 'Governance' });
    fireEvent.click(governanceToggle);

    // (a) tall governance content is NOT inside the compact header any more
    const canon = await screen.findByTestId('v8-canon-panel');
    expect(header.contains(canon)).toBe(false);
    expect(lanes.contains(canon)).toBe(true);
    // Menu 3 stays in the compact chrome
    expect(header.contains(screen.getByTestId('menu3-bar'))).toBe(true);

    // (b) the lanes band is height-capped and scrolls on its own
    expect(lanes.className).toContain('max-h-[45vh]');
    expect(lanes.className).toContain('overflow-y-auto');
    expect(lanes.className).toContain('shrink-0');

    // header must not be squeezed away by the band
    expect(header.className).toContain('shrink-0');
  });

  it('renderuje panel „Zarządzanie" w regionie edytora, który może się skurczyć do okna', async () => {
    render(<AssessmentSessionEditorView />);

    const manageButton = await screen.findByTitle('Manage assessment');
    fireEvent.click(manageButton);

    const panel = await screen.findByTestId('assessment-manage-panel');
    const region = screen.getByTestId('assessment-editor-region');
    const lanes = screen.getByTestId('assessment-editor-lanes');
    const header = screen.getByTestId('assessment-editor-header');

    // (d) the panel lives in the editor region…
    expect(region.contains(panel)).toBe(true);
    expect(lanes.contains(panel)).toBe(false);
    expect(header.contains(panel)).toBe(false);

    // (c) …and that region is the flexible one: `flex-1` alone is not enough,
    // `min-h-0` is what lets it shrink instead of being pushed below the fold.
    expect(region.className).toContain('flex-1');
    expect(region.className).toContain('min-h-0');
    expect(region.className).toContain('overflow-auto');

    // header → lanes → editor region are siblings in one flex column
    const root = region.parentElement as HTMLElement;
    expect(root.className).toContain('flex-col');
    expect(Array.from(root.children)).toEqual(
      expect.arrayContaining([header, lanes, region])
    );
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keepWaitFor = waitFor;
