/**
 * K3 (DEC-407, dyżur 1.1-Z1) — TaskDetailView „Generate AI description"/
 * "Generate AI outcome" zapisywały wynik AI WPROST do
 * `description`/`expectedOutcome` (`setDescription(generated)`), bez żadnej
 * propozycji do zatwierdzenia — złamanie `ZASADY_AI_TERESA_SSOT` §3
 * ("AI proposes. User reviews. System executes approved scope.").
 * Wzór już scalony: NotificationDetailView / AIFieldEnhancer (propozycja
 * w panelu, zapis dopiero po „Zatwierdź"/„Apply").
 *
 * Ten przycisk żyje w trybie prezentacji „c" (ClickUp-style — patrz
 * `src/hooks/usePresentationMode.ts`: modes 'n' (N-mode, karta z
 * AIFieldEnhancer, już bezpieczna) | 'c' (ten accordion), oba realne i
 * wybieralne przez użytkownika/URL `?view=c`, żadne nie jest martwe).
 *
 * Ten test dowodzi: wywołanie AI NIE mutuje pola przed kliknięciem
 * zatwierdzenia, a mutacja („zapis natychmiastowy") ma zaczerwienić testy —
 * patrz meldunek robotnika dla dowodu mutacyjnego wykonanego ręcznie
 * (przywrócenie starego `setDescription(generated)` w miejscu ustawienia
 * propozycji powoduje FAIL na asercji "description unchanged before approve").
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updatePersonalTask: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
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
  usePresentationMode: () => ({ mode: 'c', setMode: vi.fn() }),
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

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: {
    getPersonalTask: vi.fn().mockResolvedValue({
      id: 'task-175',
      title: 'Migrate billing job',
      description: '',
      expectedOutcome: '',
      status: 'todo',
      priority: 'medium',
      tags: [],
      checklist: [],
      versionToken: 'v1',
    }),
    get: mocks.get,
    post: mocks.post,
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
      <button type="button" disabled={saving} onClick={() => void onSave(false)}>
        Save task
      </button>
    </div>
  ),
}));

vi.mock('../taskCardV2Flag', () => ({ isTaskCardV2Enabled: () => false }));

import { TaskDetailView } from '../TaskDetailView';

describe('TaskDetailView — K3 AI proposal (nie zapisuje przed Zatwierdź)', () => {
  beforeEach(() => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('/risk-alternatives')) {
        return { data: { risks: [], alternatives: [] } };
      }
      if (url.includes('/object-attachments/')) return { data: { data: [] } };
      if (url === '/users') return { data: [] };
      return { data: [] };
    });
    mocks.post.mockImplementation(async (url: string) => {
      if (url === '/ai/generate') {
        return { text: 'Migrate the nightly billing job to the new queue runner.' };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('nie zapisuje wygenerowanego opisu do description przed kliknięciem Apply, dopiero po nim', async () => {
    render(<TaskDetailView taskId="task-175" onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Task description')).toBeInTheDocument());

    // Rozwiń akordeon „Task description".
    fireEvent.click(screen.getByText('Task description'));

    const descriptionField = await screen.findByPlaceholderText('Describe task details...');
    expect(descriptionField).toHaveValue('');

    // Uruchom generowanie AI.
    fireEvent.click(await screen.findByTitle('Generate AI description'));

    // Propozycja się pojawia...
    await screen.findByTestId('task-description-ai-proposal');
    expect(
      screen.getByText('Migrate the nightly billing job to the new queue runner.')
    ).toBeInTheDocument();

    // ...ale pole `description` NIE zmieniło się — to jest sedno K3.
    expect(descriptionField).toHaveValue('');

    // Dopiero „Apply" zapisuje do pola.
    fireEvent.click(screen.getByTestId('task-description-ai-approve'));

    await waitFor(() => expect(descriptionField).toHaveValue('Migrate the nightly billing job to the new queue runner.'));
    expect(screen.queryByTestId('task-description-ai-proposal')).not.toBeInTheDocument();
  });

  it('Odrzuć porzuca propozycję opisu bez dotykania pola', async () => {
    render(<TaskDetailView taskId="task-175" onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Task description')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Task description'));
    const descriptionField = await screen.findByPlaceholderText('Describe task details...');

    fireEvent.click(await screen.findByTitle('Generate AI description'));
    await screen.findByTestId('task-description-ai-proposal');

    fireEvent.click(screen.getByText('Discard'));

    expect(screen.queryByTestId('task-description-ai-proposal')).not.toBeInTheDocument();
    expect(descriptionField).toHaveValue('');
  });

  it('nie zapisuje wygenerowanego rezultatu do expectedOutcome przed Apply, dopiero po nim', async () => {
    render(<TaskDetailView taskId="task-175" onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Task description')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Expected Outcome'));
    const outcomeField = await screen.findByPlaceholderText('What should be the outcome of this task?');
    expect(outcomeField).toHaveValue('');

    fireEvent.click(await screen.findByTitle('Generate AI outcome'));
    await screen.findByTestId('task-outcome-ai-proposal');
    expect(outcomeField).toHaveValue('');

    fireEvent.click(screen.getByTestId('task-outcome-ai-approve'));
    await waitFor(() =>
      expect(outcomeField).toHaveValue('Migrate the nightly billing job to the new queue runner.')
    );
  });
});
