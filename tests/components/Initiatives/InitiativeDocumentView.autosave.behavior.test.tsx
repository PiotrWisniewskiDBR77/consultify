/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/store/useAppStore', () => {
  const state = {
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
    setCurrentView: vi.fn(),
    setMyWorkIntent: vi.fn(),
    currentUser: { id: 'u-1', name: 'Tester' },
    // ★ 2026-09-01 („jedna Teresa"): karta publikuje kontekst i komendy do
    // JEDNEGO okna Teresy zamiast renderować własny czat, więc czyta z uiSlice
    // te dwa settery (i sprząta `chatContextActions` przy odmontowaniu).
    // Bez nich atrapa store'u wywracała odmontowanie widoku.
    setChatSystemPrompt: vi.fn(),
    setChatContextActions: vi.fn(),
  };
  return { useAppStore: () => state };
});

vi.mock('@/store/useConversationStore', () => {
  const state = { updateWorkspaceFromView: vi.fn() };
  return { useConversationStore: () => state };
});

vi.mock('@/hooks/usePresentationMode', () => {
  const state = { mode: 'n', setMode: vi.fn() };
  return { usePresentationMode: () => state };
});

const fixture = vi.hoisted(() => ({
  record: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Canonical displayed title',
    title: 'Inherited title',
    status: 'CLOSED',
    summary: '',
    description: 'Stored narrative',
    planned_end_date: '2026-09-20',
    priority: 'medium',
    ownerId: 'u-1',
  } as Record<string, any>,
  amend: vi.fn<(id: string, command: Record<string, unknown>) => Promise<any>>(),
  write: vi.fn<(id: string, payload: Record<string, unknown>) => Promise<any>>(),
  gate: {
    capabilities: {
      cards: { canEditCards: false },
      topBar: { canEditOwner: false, canEditPriority: false, canEditTargetDate: false },
      ctaBar: { canUseAi: false, contextCreateActions: [], workflowActions: [] },
    },
    availableTransitions: [],
    userRoles: [],
  },
}));
vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'getInitiative') return async () => fixture.record;
        if (key === 'getGateReadiness') return async () => fixture.gate;
        return async () => [];
      },
    }
  ),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', async (original) => ({
  ...(await original<any>()),
  amendRegisteredInitiative: (id: string, command: Record<string, unknown>) =>
    fixture.amend(id, command),
}));
vi.mock('@/services/initiativeWriteTruth', () => ({
  saveInitiativeWriteTruth: (id: string, payload: Record<string, unknown>) =>
    fixture.write(id, payload),
  transitionInitiativeWriteTruth: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: new Proxy({}, { get: () => async () => [] }),
}));
import { InitiativeDocumentView } from '@/components/Initiatives/InitiativeDocumentView';

const initialRecord = structuredClone(fixture.record);
describe('Initiative document autosave behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fixture.record = structuredClone(initialRecord);
    fixture.write.mockImplementation(async () => {
      throw new Error('READONLY_WRITE_FORBIDDEN');
    });
    fixture.record.status = 'CLOSED';
    fixture.record.name = 'Canonical displayed title';
    fixture.record.title = 'Inherited title';
    fixture.gate.capabilities.cards.canEditCards = false;
    fixture.gate.capabilities.topBar = {
      canEditOwner: false,
      canEditPriority: false,
      canEditTargetDate: false,
    };
  });
  afterEach(cleanup);
  function editable() {
    fixture.record.status = 'DRAFT';
    fixture.record.name = fixture.record.title = 'Editable title';
    fixture.gate.capabilities.cards.canEditCards = true;
    fixture.write.mockImplementation(async (_id, payload) => ({
      initiative: { ...fixture.record, ...payload, name: payload.title || fixture.record.name },
      gateReadiness: fixture.gate,
      history: [],
      statusHistory: [],
    }));
  }

  it('opening CLOSED with inherited display aliases remains clean and emits no save after two debounce periods', async () => {
    const { unmount } = render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    await waitFor(
      () => expect(screen.getAllByText('Canonical displayed title').length).toBeGreaterThan(0),
      { timeout: 10000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 3300));
    expect(fixture.write).not.toHaveBeenCalled();
    expect(screen.queryByText('sharedComponents.nModeHeader.unsavedLabel')).not.toBeInTheDocument();
    unmount();
  }, 15000);
  it('authorized card title edit saves the latest value once after debounce', async () => {
    editable();
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editable title' }));
    const title = screen.getByDisplayValue('Editable title');
    fireEvent.change(title, { target: { value: 'First real edit' } });
    await new Promise((resolve) => setTimeout(resolve, 700));
    fireEvent.change(title, { target: { value: 'Latest real edit' } });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(1), { timeout: 3500 });
    expect(fixture.write.mock.calls[0][1].title).toBe('Latest real edit');
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(1);
  }, 10000);
  it('switching to read mode while debounce is pending cancels the old editable save', async () => {
    editable();
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editable title' }));
    fireEvent.change(screen.getByDisplayValue('Editable title'), {
      target: { value: 'Pending local edit' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    await new Promise((resolve) => setTimeout(resolve, 3300));
    expect(fixture.write).not.toHaveBeenCalled();
    expect(screen.getByText('Pending local edit')).toBeInTheDocument();
  }, 10000);

  it('top-bar-only capability saves priority without sending or absorbing a dirty card', async () => {
    editable();
    fixture.gate.capabilities.cards.canEditCards = false;
    fixture.gate.capabilities.topBar.canEditPriority = true;
    // A pending local card draft survives loss of its edit capability.
    const backupKey = `consultify-initiative-definition-draft:v1:${fixture.record.id}`;
    localStorage.setItem(backupKey, JSON.stringify({ symptomDraft: 'Pending card content' }));
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    const priority = await screen.findByRole('combobox', { name: 'Priority' });
    fireEvent.change(priority, { target: { value: 'high' } });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(1), { timeout: 3500 });
    expect(fixture.write.mock.calls[0][1]).toEqual({ priority: 'high' });
    expect(screen.getByText('Pending card content')).toBeInTheDocument();
    expect(screen.getByText('sharedComponents.nModeHeader.unsavedLabel')).toBeInTheDocument();
    expect(localStorage.getItem(backupKey)).toContain('Pending card content');
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(1);
  }, 10000);
  it('clearing an authorized date sends explicit null, not a JSON-omitted undefined', async () => {
    editable();
    fixture.gate.capabilities.cards.canEditCards = false;
    fixture.gate.capabilities.topBar.canEditTargetDate = true;
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.change(await screen.findByLabelText('Target date'), { target: { value: '' } });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(1), { timeout: 3500 });
    expect(JSON.parse(JSON.stringify(fixture.write.mock.calls[0][1]))).toEqual({
      plannedEndDate: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(1);
  }, 10000);

  it('server readback revokes card capability during an in-flight edit; top-bar save and reload preserve the newer card backup', async () => {
    editable();
    fixture.gate.capabilities.topBar.canEditPriority = true;
    let finishFirst: (value: any) => void = () => {
      throw new Error('NO_PENDING_WRITE');
    };
    fixture.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        })
    );
    const { unmount } = render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editable title' }));
    fireEvent.change(screen.getByDisplayValue('Editable title'), {
      target: { value: 'First saved edit' },
    });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(1), { timeout: 3500 });
    const backupKey = `consultify-initiative-definition-draft:v1:${fixture.record.id}`;
    fireEvent.change(screen.getByPlaceholderText('initiatives.whatProblemAreWeSolvingWhat2'), {
      target: { value: 'Newer pending problem' },
    });
    expect(localStorage.getItem(backupKey)).toContain('Newer pending problem');
    const deniedCards = {
      ...fixture.gate,
      capabilities: { ...fixture.gate.capabilities, cards: { canEditCards: false } },
    };
    await act(async () =>
      finishFirst({
        initiative: { ...fixture.record, name: 'First saved edit', title: 'First saved edit' },
        gateReadiness: deniedCards,
        history: [],
        statusHistory: [],
      })
    );
    expect(screen.getByDisplayValue('Newer pending problem')).toBeInTheDocument();
    expect(localStorage.getItem(backupKey)).toContain('Newer pending problem');
    expect(screen.getByText('sharedComponents.nModeHeader.unsavedLabel')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(1);
    fixture.write.mockImplementation(async (_id, payload) => ({
      initiative: {
        ...fixture.record,
        name: 'First saved edit',
        title: 'First saved edit',
        ...payload,
      },
      gateReadiness: deniedCards,
      history: [],
      statusHistory: [],
    }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Priority' }), {
      target: { value: 'high' },
    });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(2), { timeout: 3500 });
    expect(fixture.write.mock.calls[1][1]).toEqual({ priority: 'high' });
    expect(screen.getByDisplayValue('Newer pending problem')).toBeInTheDocument();
    expect(localStorage.getItem(backupKey)).toContain('Newer pending problem');
    expect(screen.getByText('sharedComponents.nModeHeader.unsavedLabel')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(2);
    unmount();
    fixture.record = {
      ...fixture.record,
      name: 'First saved edit',
      title: 'First saved edit',
      priority: 'high',
    };
    fixture.gate = deniedCards;
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    await screen.findByDisplayValue('Newer pending problem');
    expect(localStorage.getItem(backupKey)).toContain('Newer pending problem');
    expect(fixture.write).toHaveBeenCalledTimes(2);
  }, 12000);

  it('hydrating structured problem and legacy array aliases stays clean', async () => {
    Object.assign(fixture.record, {
      problemDefinition: { symptom: 'Stored problem', rootCause: 'Stored cause' },
      scope_in: ['Line 4'],
      success_criteria: ['Measured result'],
      toolsNeeded: ['Torque sensor'],
    });
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    await screen.findByText('Canonical displayed title');
    await new Promise((resolve) => setTimeout(resolve, 3300));
    expect(fixture.write).not.toHaveBeenCalled();
    expect(screen.queryByText('sharedComponents.nModeHeader.unsavedLabel')).not.toBeInTheDocument();
  }, 10000);

  it('clearing an authorized legacy owner sends explicit null and remains clean', async () => {
    editable();
    fixture.gate.capabilities.cards.canEditCards = false;
    fixture.gate.capabilities.topBar.canEditOwner = true;
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Owner' }), {
      target: { value: '' },
    });
    await waitFor(() => expect(fixture.write).toHaveBeenCalledTimes(1), { timeout: 3500 });
    expect(JSON.parse(JSON.stringify(fixture.write.mock.calls[0][1]))).toEqual({ ownerId: null });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(fixture.write).toHaveBeenCalledTimes(1);
  }, 10000);
  it('runtime-only title edits use canonical metadata writer and advance expected version, with no legacy PUT', async () => {
    editable();
    Object.assign(fixture.record, {
      documentOrigin: 'initiatives-runtime-v1',
      canonicalVersion: 6,
      planned_end_date: '',
      summary: '',
      description: '',
      ownerId: '',
    });
    fixture.amend.mockImplementation(async (_id, command) => ({
      initiative: {
        version: Number(command.expectedVersion) + 1,
        updatedAt: '2026-09-12T00:00:00Z',
        initiative: {
          initiativeId: fixture.record.id,
          title: command.title,
          problem: '',
          proposedOutcome: null,
          priority: 'MEDIUM',
          projectId: 'project-1',
          initiativeOwnerId: '',
          lifecycleState: 'REGISTERED_DRAFT',
          visibility: 'PROJECT',
          source: {
            sourceType: 'MANUAL_HUB',
            sourceId: 'source-1',
            sourceVersion: 1,
            proposalId: 'proposal-1',
            proposalVersion: 1,
            freshness: 'CURRENT',
          },
          governance: { policyId: 'local', policyVersion: 1 },
          readiness: 'NOT_EVALUATED',
        },
      },
    }));
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editable title' }));
    fireEvent.change(screen.getByDisplayValue('Editable title'), {
      target: { value: 'Canonical first' },
    });
    await waitFor(() => expect(fixture.amend).toHaveBeenCalledTimes(1), { timeout: 3500 });
    expect(fixture.amend.mock.calls[0][1]).toMatchObject({
      expectedVersion: 6,
      title: 'Canonical first',
    });
    fireEvent.change(screen.getByDisplayValue('Canonical first'), {
      target: { value: 'Canonical second' },
    });
    await waitFor(() => expect(fixture.amend).toHaveBeenCalledTimes(2), { timeout: 3500 });
    expect(fixture.amend.mock.calls[1][1]).toMatchObject({
      expectedVersion: 7,
      title: 'Canonical second',
    });
    expect(fixture.write).not.toHaveBeenCalled();
  }, 10000);

  it('runtime-only owner clear remains an explicit unsaved error instead of sending an invalid owner or pretending success', async () => {
    editable();
    Object.assign(fixture.record, {
      documentOrigin: 'initiatives-runtime-v1',
      canonicalVersion: 6,
      planned_end_date: '',
      summary: '',
      description: '',
      ownerId: 'u-1',
    });
    render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Owner' }), {
      target: { value: '' },
    });
    await new Promise((resolve) => setTimeout(resolve, 3300));
    expect(fixture.amend).not.toHaveBeenCalled();
    expect(fixture.write).not.toHaveBeenCalled();
    expect(screen.getByText('initiatives.runtimeOnlyEditBlocked')).toBeInTheDocument();
  }, 10000);
});
