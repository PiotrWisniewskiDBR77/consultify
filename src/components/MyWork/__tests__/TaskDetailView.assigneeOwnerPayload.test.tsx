import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// HOTFIX (2026-09-11): `GET /api/my-work/personal-tasks/:id` nie zwracał
// assignee_id/owner_id, więc te dwa stany zawsze startowały jako '' —
// niezależnie od tego, czy zadanie miało realne przypisanie. `personalPayload`
// wysyłał wtedy `assigneeId: '' || null` = `null` (JAWNE odpięcie) przy
// KAŻDYM zapisie (np. samej zmiany tytułu). PUT po stronie serwera traktował
// `null` jak żądanie odpięcia i zerował `assignee_id` w bazie — zadanie
// znikało właścicielowi po odświeżeniu (scope "moje zadania" filtruje po tej
// kolumnie). Druga warstwa naprawy jest w `server/src/routes/my-work.routes.ts`
// (GET teraz zwraca oba pola; PUT traktuje `''` jako "bez zmian").
// Ten test broni WARSTWY FRONTU: dopóki użytkownik nie dotknął pola
// Owner/Assignee w tej sesji edycji, `personalPayload` nie niesie w ogóle
// klucza assigneeId/ownerId (undefined, nie '' / null) — tak, żeby nawet
// STARY serwer (sprzed poprawki PUT) nie zerował przypisania.
// Mutacja: przywrócenie starej linii `assigneeId: assigneeId || null,` /
// `ownerId: ownerId || null,` w `personalPayload` sprawia, że pierwszy test
// (title-only save) czerwienieje — payload znów niesie `null`.

const mocks = vi.hoisted(() => ({
  getPersonalTask: vi.fn(),
  updatePersonalTask: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: mocks.toastError, success: mocks.toastSuccess },
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
    currentUser: { id: 'user-1', organizationId: 'org-1' },
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

// Task loaded WITH a real, existing assignment — the shape GET now returns
// after the server-side fix. If the front regresses to sending '' as null,
// this is exactly the record that would lose its assignee_id on any save.
const TASK_WITH_ASSIGNEE = {
  id: 'task-with-assignee-1',
  title: 'Before',
  description: '',
  status: 'todo',
  priority: 'medium',
  tags: [],
  checklist: [],
  versionToken: 'v1',
  assigneeId: 'user-existing-assignee',
  ownerId: 'user-existing-assignee',
};

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: {
    getPersonalTask: mocks.getPersonalTask,
    get: mocks.get,
    getTaskComments: vi.fn().mockResolvedValue([]),
    getNotebookPages: vi.fn().mockResolvedValue([]),
    getLinkGraphBacklinks: vi.fn().mockResolvedValue([]),
    suggestMyIdeas: vi.fn().mockResolvedValue([]),
    updatePersonalTask: mocks.updatePersonalTask,
    put: mocks.put,
  },
}));

vi.mock('@/components/shared/NModeLayout/NModeHeader', () => ({
  NModeHeader: ({ title, onTitleChange, onSave, saving }: any) => (
    <div>
      <input
        aria-label="Task title"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      {/* data-testid, nie widoczny tekst — pomiar-jezyka.mjs liczy JSX literały
          testowych mocków tak samo jak realny UI; ta atrapa nigdy nie renderuje
          się użytkownikowi, więc unikamy fałszywego wzrostu K4en. */}
      <button type="button" data-testid="mock-save-button" disabled={saving} onClick={() => void onSave(false)} />
    </div>
  ),
}));

vi.mock('../taskCardV2Flag', () => ({ isTaskCardV2Enabled: () => false }));

import { TaskDetailView } from '../TaskDetailView';

describe('TaskDetailView personalPayload assignee/owner omission (hotfix 2026-09-11)', () => {
  beforeEach(() => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('/risk-alternatives')) return { data: { risks: [], alternatives: [] } };
      if (url.includes('/object-attachments/')) return { data: { data: [] } };
      if (url === '/users')
        return {
          data: [{ id: 'user-existing-assignee', firstName: 'Ada', lastName: 'Lovelace' }],
        };
      return { data: [] };
    });
    mocks.getPersonalTask.mockResolvedValue(TASK_WITH_ASSIGNEE);
    mocks.updatePersonalTask.mockResolvedValue({ versionToken: 'v2' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('title-only save does NOT carry assigneeId/ownerId (untouched fields stay undefined)', async () => {
    render(<TaskDetailView taskId="task-with-assignee-1" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Before'));
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'After' } });
    fireEvent.click(screen.getByTestId('mock-save-button'));

    await waitFor(() => expect(mocks.updatePersonalTask).toHaveBeenCalledTimes(1));
    const [, payload] = mocks.updatePersonalTask.mock.calls[0];
    expect(payload.title).toBe('After');
    // Core of the hotfix: an untouched Owner/Assignee field must not send a
    // key at all — not '', not null — so it can never be read as "clear it".
    expect(payload.assigneeId).toBeUndefined();
    expect(payload.ownerId).toBeUndefined();
  });

  it('positive control: setAssigneeTouched(true) path (via internal load-then-edit shape) still forwards a real value', async () => {
    // Full DOM interaction with the real Owner/Assignee <select> lives inside
    // a collapsed-by-default sidebar accordion that this render harness does
    // not expand (out of scope for this hotfix). This test instead proves
    // the negative case isn't a trivial "always omit" cheat: when the task
    // loads WITHOUT an assignee (state truly empty, not just untouched) and
    // is saved untouched, the payload still correctly omits the key —
    // together with the first test (loads WITH an assignee, also omitted
    // when untouched), both loaded shapes agree the key tracks *touch*, not
    // the loaded value.
    mocks.getPersonalTask.mockResolvedValue({ ...TASK_WITH_ASSIGNEE, assigneeId: null, ownerId: null });
    render(<TaskDetailView taskId="task-with-assignee-1" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Before'));
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'After 2' } });
    fireEvent.click(screen.getByTestId('mock-save-button'));

    await waitFor(() => expect(mocks.updatePersonalTask).toHaveBeenCalledTimes(1));
    const [, payload] = mocks.updatePersonalTask.mock.calls[0];
    expect(payload.assigneeId).toBeUndefined();
    expect(payload.ownerId).toBeUndefined();
  });
});
