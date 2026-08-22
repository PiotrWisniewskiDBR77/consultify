/**
 * @vitest-environment jsdom
 *
 * Wave 3 Assessment regression: a mounted DRD route is owned by Method Core.
 * It must not call the retired legacy assessment reader/writer. Canonical
 * save/readback and false-success behavior are covered by
 * DrdHttpMethodWorkspaceScreen + drdHttpSessionRuntime suites.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getAssessmentMock, updateAssessmentMock, useAssessmentPermissionsMock } = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
  updateAssessmentMock: vi.fn(),
  useAssessmentPermissionsMock: vi.fn(() => ({
    role: 'viewer',
    permissions: { canView: false, canEdit: false },
    isLoading: false,
    requestAccess: vi.fn(),
    refreshPermissions: vi.fn(),
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ framework: 'drd', assessmentId: 'method-session-1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: {
    getAssessment: getAssessmentMock,
    updateAssessment: updateAssessmentMock,
    getWorkbench: vi.fn(),
    getWorkbenchPromotionPayload: vi.fn(),
    getUserState: vi.fn(),
    updateUserState: vi.fn(),
    listAssignments: vi.fn(),
    upsertAssignment: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      currentUser: { id: 'owner-1', role: 'owner' },
      isChatCollapsed: true,
      toggleChatCollapse: vi.fn(),
      setCurrentViewState: vi.fn(),
      currentProjectId: 'project-1',
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: (state: Record<string, unknown>) => unknown) => {
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

vi.mock('@/components/assessment/drd/DrdMethodWorkspaceScreen', () => ({
  DrdMethodWorkspaceScreen: ({ demoSessionId }: { demoSessionId: string }) => (
    <div data-testid="canonical-drd-workspace">{demoSessionId}</div>
  ),
}));

vi.mock('@/components/assessment/permissions', () => ({
  RequestAccessModal: () => null,
  useAssessmentPermissions: useAssessmentPermissionsMock,
}));

import { AssessmentSessionEditorView } from '../../../src/views/AssessmentSessionEditorView';

describe('AssessmentSessionEditorView — canonical DRD owner', () => {
  it('mounts Method Core before legacy loading and never calls a legacy reader or writer', () => {
    render(<AssessmentSessionEditorView />);

    expect(screen.getByTestId('canonical-drd-workspace')).toHaveTextContent('method-session-1');
    expect(useAssessmentPermissionsMock).toHaveBeenCalledWith('method-session-1', {
      enabled: false,
    });
    expect(getAssessmentMock).not.toHaveBeenCalled();
    expect(updateAssessmentMock).not.toHaveBeenCalled();
  });
});
