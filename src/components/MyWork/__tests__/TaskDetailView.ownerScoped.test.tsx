import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// E1c/F1 (rodzina po E1b, 2026-09-10): `TaskDetailView.loadTask` domyślnie
// czyta przez `Api.getPersonalTask` → `GET /api/my-work/personal-tasks/:id`,
// filtrowane PO WŁAŚCICIELU — 404 dla zadania nieprzypisanego do
// oglądającego. Ten sam komponent jest osadzany poza „Moją Pracą" (karta
// inicjatywy → Zadania → „Otwórz zadanie" w `InitiativesHub.tsx`), gdzie
// oglądający zwykle NIE jest właścicielem. `ownerScoped={false}` przełącza
// odczyt na kanoniczne `Api.getTask` (org-scoped, zero filtra właściciela).
//
// ZMIERZONE na kopii (`consultify_kopia_e1c`): zadanie `2a4d39f7-…`
// przypisane do Katarzyny Wójcik → jako `audyt@dbr77.local` (ADMIN, nie
// assignee) `GET /api/my-work/personal-tasks/:id` → 404 `TASK_NOT_FOUND`,
// `GET /api/tasks/:id` → 200. Ten test broni PRZEŁĄCZNIKA po stronie
// front-endu — bez niego `ownerScoped={false}` byłby kodem bez efektu
// (rodzina defektu „wołacz istnieje ≠ działa").

const mocks = vi.hoisted(() => ({
  getPersonalTask: vi.fn(),
  getTask: vi.fn(),
  get: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: mocks.toastError, success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => {
    const t = (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key;
    return {
      t,
      i18n: { language: 'en', getFixedT: () => t },
    };
  },
}));

vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({ mode: 'n', setMode: vi.fn() }),
}));

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
    setChatKickoffMessage: vi.fn(),
    emitMyWorkEvent: vi.fn(),
    currentUser: { id: 'audyt-dbr77-admin-e1c', organizationId: 'org-1' },
  }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({ updateWorkspaceFromView: vi.fn() }),
}));

vi.mock('@/services/initiativeService', () => ({
  InitiativeService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

vi.mock('@/components/shared/CapabilityGate', () => ({
  CapabilityGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: {
    getPersonalTask: mocks.getPersonalTask,
    getTask: mocks.getTask,
    get: mocks.get,
    getTaskComments: vi.fn().mockResolvedValue([]),
    getNotebookPages: vi.fn().mockResolvedValue([]),
    getLinkGraphBacklinks: vi.fn().mockResolvedValue([]),
    suggestMyIdeas: vi.fn().mockResolvedValue([]),
    updatePersonalTask: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/components/shared/NModeLayout/NModeHeader', () => ({
  NModeHeader: ({ title }: any) => (
    <div>
      <input aria-label="Task title" value={title} readOnly />
    </div>
  ),
}));

vi.mock('../taskCardV2Flag', () => ({ isTaskCardV2Enabled: () => false }));

import { TaskDetailView } from '../TaskDetailView';

const OWNED_TASK = {
  id: 'task-owned-1',
  title: 'My own task (personal-tasks shape)',
  description: '',
  status: 'todo',
  priority: 'medium',
  tags: [],
  checklist: [],
  versionToken: 'v1',
};

const FOREIGN_TASK = {
  id: 'task-foreign-1',
  title: 'Azure DevOps project configuration',
  description: '',
  status: 'done',
  priority: 'medium',
  tags: [],
  checklist: [],
  assigneeId: 'katarzyna-wojcik',
  ownerId: null,
};

describe('TaskDetailView ownerScoped switch (E1c/F1)', () => {
  beforeEach(() => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('/risk-alternatives')) return { data: { risks: [], alternatives: [] } };
      if (url.includes('/object-attachments/')) return { data: { data: [] } };
      if (url === '/users') return { data: [] };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mocks.getPersonalTask.mockReset();
    mocks.getTask.mockReset();
    mocks.toastError.mockReset();
  });

  it('default (ownerScoped omitted, My Work behavior unchanged): calls Api.getPersonalTask, never Api.getTask', async () => {
    mocks.getPersonalTask.mockResolvedValue(OWNED_TASK);
    render(<TaskDetailView taskId="task-owned-1" onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Task title')).toHaveValue('My own task (personal-tasks shape)')
    );
    expect(mocks.getPersonalTask).toHaveBeenCalledWith('task-owned-1');
    expect(mocks.getTask).not.toHaveBeenCalled();
  });

  it('RED before the fix / GREEN after: ownerScoped=false opens a task NOT owned by the viewer via canonical Api.getTask, instead of 404-ing on Api.getPersonalTask', async () => {
    // Reproduces the measured shape: the owner-scoped lookup would 404 for
    // this viewer (not the assignee) — exactly what broke "Otwórz zadanie"
    // from the initiative card before this fix.
    mocks.getPersonalTask.mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    );
    mocks.getTask.mockResolvedValue(FOREIGN_TASK);

    render(<TaskDetailView taskId="task-foreign-1" onClose={vi.fn()} ownerScoped={false} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Task title')).toHaveValue('Azure DevOps project configuration')
    );
    expect(mocks.getTask).toHaveBeenCalledWith('task-foreign-1');
    expect(mocks.getPersonalTask).not.toHaveBeenCalled();
    // No "not found" toast/state — the card renders the foreign task cleanly.
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('ownerScoped=false still shows the honest "not found" state for a genuinely missing task (404 preserved via Api.getTask status)', async () => {
    mocks.getTask.mockRejectedValue(Object.assign(new Error('Failed to fetch task'), { status: 404 }));

    render(<TaskDetailView taskId="task-does-not-exist" onClose={vi.fn()} ownerScoped={false} />);

    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
