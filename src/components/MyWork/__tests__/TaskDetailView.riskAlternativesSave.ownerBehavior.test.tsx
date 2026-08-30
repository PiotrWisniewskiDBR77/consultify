import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updatePersonalTask: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  consoleWarn: vi.fn(),
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

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: {
    getPersonalTask: vi.fn().mockResolvedValue({
      id: 'task-175',
      title: 'Before',
      description: '',
      status: 'todo',
      priority: 'medium',
      tags: [],
      checklist: [],
      versionToken: 'v1',
    }),
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
      <button type="button" disabled={saving} onClick={() => void onSave(false)}>
        Save task
      </button>
    </div>
  ),
}));

vi.mock('../taskCardV2Flag', () => ({ isTaskCardV2Enabled: () => false }));

// FIX-175 (Z-1): only the "Add risk" affordance is needed to prove the
// section was touched in this editing session — everything else RiskCanvas
// renders is irrelevant to the dirty-check under test, so it's swapped for a
// minimal stand-in while every other NModeSections export stays real.
vi.mock('../../shared/NModeSections', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    RiskCanvas: ({ onAddRisk }: { onAddRisk: () => void }) => (
      <button type="button" onClick={onAddRisk}>
        Add risk (mock)
      </button>
    ),
  };
});

import { TaskDetailView } from '../TaskDetailView';

describe('TaskDetailView Risk & Alternatives save regression', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('/risk-alternatives')) {
        return { data: { risks: [], alternatives: [] } };
      }
      if (url.includes('/object-attachments/')) return { data: { data: [] } };
      if (url === '/users') return { data: [] };
      return { data: [] };
    });
    mocks.updatePersonalTask.mockResolvedValue({ versionToken: 'v2' });
    mocks.put.mockRejectedValue({
      status: 409,
      data: { code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' },
    });
    vi.spyOn(console, 'warn').mockImplementation(mocks.consoleWarn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does NOT call the gated risk-alternatives route when the section is untouched, and shows no error toast', async () => {
    const onSaved = vi.fn();
    render(<TaskDetailView taskId="task-175" onClose={vi.fn()} onSaved={onSaved} />);

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Before'));
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'After' } });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(mocks.updatePersonalTask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save task' })).toBeEnabled());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(900);
      await Promise.resolve();
    });

    // Core of Z-1: risks/alternatives were never touched in this session ->
    // zero PUT to the gated route, zero error toast about it, ever.
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.consoleWarn).not.toHaveBeenCalledWith(
      '[TaskDetailView] Risk & Alternatives were not saved',
      expect.anything()
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Task updated');

    // Second save (still untouched) confirms this isn't a one-shot fluke —
    // the loop stays quiet indefinitely for an untouched section.
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(mocks.updatePersonalTask).toHaveBeenCalledTimes(2));
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('calls the gated risk-alternatives route and reports the honest 409 when risks were edited in this session', async () => {
    const onSaved = vi.fn();
    render(<TaskDetailView taskId="task-175" onClose={vi.fn()} onSaved={onSaved} />);

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Before'));

    fireEvent.click(screen.getByRole('button', { name: 'Risk & Alternatives' }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add risk (mock)' }));
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));

    await waitFor(() => expect(mocks.updatePersonalTask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save task' })).toBeEnabled());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(900);
      await Promise.resolve();
    });
    // Loop still stays quiet: same edited-but-unpersisted risk state doesn't
    // spawn extra PUTs from the autosave interval on its own.
    expect(mocks.put).toHaveBeenCalledTimes(1);

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Task updated');
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Task saved, but Risk & Alternatives could not be saved'
    );
    expect(mocks.toastError).not.toHaveBeenCalledWith('Failed to save task');
    expect(mocks.consoleWarn).toHaveBeenCalledWith(
      '[TaskDetailView] Risk & Alternatives were not saved',
      expect.objectContaining({ status: 409 })
    );
  });
});
