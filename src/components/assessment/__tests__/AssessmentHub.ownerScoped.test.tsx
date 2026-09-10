/**
 * @vitest-environment jsdom
 *
 * F4a (rodzina po E1b/E1c, [ODMROZENIE 04_ASSESSMENT DEC-453]).
 *
 * `AssessmentHub.handleOpenTaskFromInitiative` otwiera `TaskDetailView` dla
 * zadania z karty inicjatywy (Ocena → Inicjatywy → karta → Zadania →
 * „Otwórz zadanie"). `TaskDetailView.loadTask` domyślnie czyta przez
 * `Api.getPersonalTask` → `GET /api/my-work/personal-tasks/:id`, filtrowane
 * PO WŁAŚCICIELU — 404 dla każdego zadania nieprzypisanego do oglądającego.
 * Dokładnie ta sama rodzina defektu co `InitiativesHub` (naprawiona w E1c,
 * commit 93517a117d) — tam `AssessmentHub.tsx` był jawnie zgłoszony jako
 * NIE naprawiony ("04_ASSESSMENT NIE jest w zakresie DEC-453").
 *
 * Ten test broni WOŁACZA (AssessmentHub → TaskDetailView), nie samego
 * przełącznika `ownerScoped` (ten ma już pełne pokrycie w
 * `MyWork/__tests__/TaskDetailView.ownerScoped.test.tsx`) — rodzina defektu
 * „wołacz istnieje ≠ podłączony": samo istnienie propa w komponencie
 * niczego nie chroni, jeśli konkretny caller go nie przekazuje.
 *
 * Ścieżka wymuszona w teście (mirror realnego przepływu, ciężkie liście
 * zamockowane — wzorzec z `Initiatives/__tests__/InitiativesHub.smoke.test.tsx`):
 *   1. AssessmentHub montuje się na zakładce „Initiatives" (`initialTab`).
 *   2. Podwójny klik na (zamockowanym) wierszu `StandardTable` woła
 *      `handleOpenDocument` → otwiera dokument typu 'initiative'.
 *   3. Zamockowany `InitiativeDocumentView` natychmiast woła
 *      `onOpenTask('task-foreign-1')` (przyciskiem w stubie) →
 *      `handleOpenTaskFromInitiative` → otwiera dokument typu 'task'.
 *   4. `renderContent` renderuje `TaskDetailView` — zamockowany, żeby
 *      przechwycić realne propsy, którymi AssessmentHub go woła.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _k,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }) };
});

const { apiMocks, appStoreState, conversationStoreState } = vi.hoisted(() => ({
  apiMocks: {
    getUsers: vi.fn(async () => []),
    listAssessments: vi.fn(async () => ({ assessments: [] })),
    getAssessmentReports: vi.fn(async () => ({ reports: [] })),
    listReportImports: vi.fn(async () => ({ imports: [] })),
    get: vi.fn(async (url: string) => {
      if (url.includes('/initiatives')) return { data: [] };
      return { data: [] };
    }),
  },
  appStoreState: {
    currentProjectId: 'proj-1',
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
  },
  conversationStoreState: {
    createConversation: vi.fn(),
    activeConversationId: null,
    setActiveConversation: vi.fn(),
    setWorkspaceContext: vi.fn(),
    addMessage: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));

vi.mock('@/method-core/api/methodCoreApi', () => ({
  listSessions: vi.fn(async () => ({ sessions: [] })),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof appStoreState) => unknown) =>
    typeof selector === 'function' ? selector(appStoreState) : appStoreState,
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: (s: typeof conversationStoreState) => unknown) =>
    typeof selector === 'function' ? selector(conversationStoreState) : conversationStoreState,
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/components/standard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/standard')>();
  return {
    ...actual,
    StandardTable: (props: any) => (
      <div data-testid="assessment-hub-standard-table">
        <button
          type="button"
          onClick={() =>
            props.onRowDoubleClick?.({ id: 'initiative-test-1', name: 'Test Initiative', status: 'DRAFT' })
          }
        >
          {'Open initiative row'}
        </button>
      </div>
    ),
  };
});

vi.mock('./AssessmentMenu3ActionBar', () => ({
  AssessmentMenu3ActionBar: () => <div data-testid="assessment-hub-menu3" />,
}));

vi.mock('../../Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: (props: { onOpenTask?: (taskId: string) => void }) => (
    <div data-testid="assessment-hub-initiative-doc">
      <button type="button" onClick={() => props.onOpenTask?.('task-foreign-1')}>
        {'Open task from initiative card'}
      </button>
    </div>
  ),
}));

const taskDetailViewSpy = vi.fn();
vi.mock('../../MyWork/TaskDetailView', () => ({
  TaskDetailView: (props: any) => {
    taskDetailViewSpy(props);
    return <div data-testid="assessment-hub-task-detail" data-owner-scoped={String(props.ownerScoped)} />;
  },
}));

import { AssessmentHub } from '../AssessmentHub';

describe('AssessmentHub → TaskDetailView wiring (F4a)', () => {
  afterEach(() => {
    taskDetailViewSpy.mockClear();
  });

  it('RED before the fix / GREEN after: opening a task from an initiative card passes ownerScoped={false} to TaskDetailView, not the My-Work-scoped default', async () => {
    render(
      <MemoryRouter>
        <AssessmentHub initialTab={'initiatives' as any} />
      </MemoryRouter>
    );

    // Step 1: open the (stubbed) initiative row -> activeDocumentId becomes
    // the initiative doc, rendering the (stubbed) InitiativeDocumentView.
    (await screen.findByText('Open initiative row')).click();
    const openTaskButton = await screen.findByText('Open task from initiative card');

    // Step 2: from inside the initiative card, open a task not owned by the
    // viewer (the exact shape that 404-ed before E1c/F1 in InitiativesHub,
    // and was explicitly left unfixed for AssessmentHub at the time).
    openTaskButton.click();

    await screen.findByTestId('assessment-hub-task-detail');

    expect(taskDetailViewSpy).toHaveBeenCalled();
    const lastCallProps = taskDetailViewSpy.mock.calls.at(-1)?.[0];
    expect(lastCallProps.taskId).toBe('task-foreign-1');
    // This is the actual regression guard: without the F4a fix, AssessmentHub
    // renders <TaskDetailView taskId=... onClose=... onSaved=... /> with no
    // ownerScoped prop at all (undefined -> defaults to true inside
    // TaskDetailView, i.e. the "My Work" owner-scoped read that 404s here).
    expect(lastCallProps.ownerScoped).toBe(false);
    expect(screen.getByTestId('assessment-hub-task-detail')).toHaveAttribute(
      'data-owner-scoped',
      'false'
    );
  });
});
