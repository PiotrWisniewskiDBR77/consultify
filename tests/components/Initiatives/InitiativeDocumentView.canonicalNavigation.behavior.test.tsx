/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Keep the real canvas and navigation; jsdom has no animation completion frames.
vi.mock('framer-motion', async original => ({...(await original<any>()), AnimatePresence: ({children}: {children: React.ReactNode}) => <>{children}</>}));
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
  read: vi.fn<() => Promise<Record<string, any>>>(),
  amend: vi.fn<(id: string, command: Record<string, unknown>) => Promise<any>>(),
  write: vi.fn<(id: string, payload: Record<string, unknown>) => Promise<any>>(),
  updateForecast: vi.fn<(id: string, payload: Record<string, unknown>) => Promise<any>>(),
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
        if (key === 'getInitiative') return () => fixture.read();
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
  readRegisteredInitiative: async (id: string) => ({
    version: fixture.record.canonicalVersion ?? 1,
    updatedAt: '2026-09-13T12:00:00.000Z',
    initiative: {
      initiativeId: id,
      lifecycleState: fixture.record.lifecycle ?? fixture.record.status,
      title: fixture.record.name,
      projectId: 'project-1',
      readiness: 'READY',
    },
  }),
  readInitiativeCapabilities: async () => ({
    executionWrites: {
      forecast: { available: true, denialCode: null },
    },
  }),
  updateInitiativeForecast: (id: string, payload: Record<string, unknown>) =>
    fixture.updateForecast(id, payload),
}));
vi.mock('@/services/initiativeWriteTruth', () => ({
  saveInitiativeWriteTruth: (id: string, payload: Record<string, unknown>) =>
    fixture.write(id, payload),
  transitionInitiativeWriteTruth: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: new Proxy({}, { get: () => async (path: unknown) => String(path).endsWith('/cards') ? {initiativeVersion:1,cards:[]} : String(path).endsWith('/gates/definition/readiness') ? {readiness:'BLOCKED',findings:[]} : String(path).endsWith('/milestones') ? {milestones:[{id:'ms-native-1',name:'Native milestone row',targetDate:'2026-10-01',status:'PENDING'}]} : String(path).startsWith('/tasks?') ? [{id:'task-native-1',title:'Native task row',status:'todo',priority:'medium',source:'manual'}] : [] }),
}));
vi.mock('@/services/initiatives-execution/definitionApprovalApi', () => ({
 readDefinitionApproval: async () => ({enabled:true, actorId:'u-1', initiativeId:fixture.record.id, lifecycleState:'REGISTERED_DRAFT', capabilities:{edit:false,review:false,request:false,decide:false}, participants:[],authorities:[],decision:null}),
}));
import { InitiativeDocumentView } from '@/components/Initiatives/InitiativeDocumentView';


afterEach(() => {cleanup(); window.history.replaceState(null, '', '/'); Object.assign(window.location,{href:'http://localhost:3000/',search:''});});
it('keeps a canonical Gates deep link while the document is pending and renders that card after resolution without writes', async () => {
  localStorage.clear();
  Object.assign(fixture.record, {documentOrigin:'initiatives-runtime-v1', canonicalVersion:1, status:'DRAFT', name:'Pending initiative'});
  let resolve!: (value: Record<string, any>) => void;
  fixture.read.mockImplementation(() => new Promise(done => {resolve=done;}));
  window.history.replaceState(null, '', `/initiatives?mode=doc&open=${fixture.record.id}&card=gates-approvals&return=preparation`);
  // tests/setup replaces location with a plain snapshot; synchronize it explicitly.
  Object.assign(window.location,{href:`http://localhost:3000/initiatives?mode=doc&open=${fixture.record.id}&card=gates-approvals&return=preparation`,search:`?mode=doc&open=${fixture.record.id}&card=gates-approvals&return=preparation`});
  render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
  await waitFor(() => expect(fixture.read).toHaveBeenCalled());
  await act(async () => {resolve(fixture.record);});
  await waitFor(() => expect(screen.getByRole('heading', {name:'Definition approval'})).toBeVisible());
  expect(new URL(window.location.href).searchParams.get('card')).toBe('gates-approvals');
  expect(fixture.write).not.toHaveBeenCalled();
  expect(fixture.amend).not.toHaveBeenCalled();
});

it('opens the requested card when the same document mount switches to another initiative', async () => {
  localStorage.clear(); fixture.read.mockReset(); fixture.write.mockClear(); fixture.amend.mockClear();
  const firstId = '11111111-1111-4111-8111-111111111111';
  const secondId = '22222222-2222-4222-8222-222222222222';
  const setUrl = (id: string, card: string) => {
    const search = `?mode=doc&open=${id}&card=${card}&return=preparation`;
    window.history.replaceState(null, '', `/initiatives${search}`);
    Object.assign(window.location, { href:`http://localhost:3000/initiatives${search}`, search });
  };
  Object.assign(fixture.record, {id:firstId, documentOrigin:'initiatives-runtime-v1', canonicalVersion:1, status:'DRAFT', name:'First initiative'});
  fixture.read.mockImplementation(async () => ({...fixture.record}));
  setUrl(firstId, 'summary-scope');
  const view = render(<InitiativeDocumentView initiativeId={firstId} />);
  await waitFor(() => expect(fixture.read).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('heading', {name:'Definition approval'})).not.toBeInTheDocument());
  Object.assign(fixture.record, {id:secondId, name:'Second initiative'});
  setUrl(secondId, 'gates-approvals');
  view.rerender(<InitiativeDocumentView initiativeId={secondId} />);
  await waitFor(() => expect(screen.getByRole('heading', {name:'Definition approval'})).toBeVisible());
  expect(new URL(window.location.href).searchParams.get('card')).toBe('gates-approvals');
  expect(fixture.write).not.toHaveBeenCalled(); expect(fixture.amend).not.toHaveBeenCalled();
});

it('switches native Tasks and Milestones in the mounted document even without a template task section', async () => {
  localStorage.clear(); fixture.read.mockReset(); fixture.write.mockClear(); fixture.amend.mockClear();
  Object.assign(fixture.record, {documentOrigin:'initiatives-runtime-v1', canonicalVersion:1, status:'DRAFT', name:'Milestone split initiative'});
  fixture.read.mockImplementation(async () => ({...fixture.record}));
  const search = `?mode=doc&open=${fixture.record.id}&card=milestones&return=preparation`;
  window.history.replaceState(null, '', `/initiatives${search}`);
  Object.assign(window.location,{href:`http://localhost:3000/initiatives${search}`,search});
  const historySpy = vi.spyOn(window.history, 'replaceState');
  render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
  await waitFor(() => expect(screen.getAllByRole('heading', {name:'Milestones'}).at(-1)).toBeVisible());
  await waitFor(() => expect(screen.getAllByText('Native milestone row').at(-1)).toBeVisible());
  expect(new URL(window.location.href).searchParams.get('card')).toBe('milestones');
  const tasksNav = document.querySelector<HTMLButtonElement>('[data-nmode-section-item="tasks"]');
  expect(tasksNav).toBeTruthy();
  historySpy.mockClear();
  fireEvent.click(tasksNav!);
  await waitFor(() => expect(historySpy.mock.calls.some(call => String(call[2]).includes('card=tasks'))).toBe(true));
  await waitFor(() => expect(screen.getAllByRole('heading', {name:'Tasks'}).at(-1)).toBeVisible());
  expect(await screen.findByText('Native task row')).toBeVisible();
  expect(screen.queryByText('Native milestone row')).not.toBeInTheDocument();
  const milestonesNav = document.querySelector<HTMLButtonElement>('[data-nmode-section-item="milestones"]');
  expect(milestonesNav).toBeTruthy();
  historySpy.mockClear();
  fireEvent.click(milestonesNav!);
  await waitFor(() => expect(historySpy.mock.calls.some(call => String(call[2]).includes('card=milestones'))).toBe(true));
  await waitFor(() => expect(screen.getAllByText('Native milestone row').at(-1)).toBeVisible());
  expect(screen.queryByText('Native task row')).not.toBeInTheDocument();
  expect(fixture.write).not.toHaveBeenCalled(); expect(fixture.amend).not.toHaveBeenCalled();
});

it('does not expose the native milestone writer in the actual document Preview mode', async () => {
  localStorage.clear(); fixture.read.mockReset(); fixture.write.mockClear(); fixture.amend.mockClear();
  Object.assign(fixture.record, {
    id:'33333333-3333-4333-8333-333333333333',
    documentOrigin:'initiatives-runtime-v1',
    canonicalVersion:1,
    status:'CLOSED',
    name:'Read-only milestone initiative'
  });
  fixture.read.mockImplementation(async () => ({...fixture.record}));
  const search = `?mode=doc&open=${fixture.record.id}&card=milestones&return=preparation`;
  window.history.replaceState(null, '', `/initiatives${search}`);
  Object.assign(window.location,{href:`http://localhost:3000/initiatives${search}`,search});
  render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
  await waitFor(() => expect(screen.getAllByText('Native milestone row').at(-1)).toBeVisible());
  await waitFor(() => expect(screen.queryByText('Add milestone')).not.toBeInTheDocument());
  expect(fixture.write).not.toHaveBeenCalled();
  expect(fixture.amend).not.toHaveBeenCalled();
});

it('keeps the legacy mounted Tasks and Milestones card combined', async () => {
  localStorage.clear(); fixture.read.mockReset(); fixture.write.mockClear(); fixture.amend.mockClear();
  Object.assign(fixture.record, {
    id:'44444444-4444-4444-8444-444444444444',
    documentOrigin:undefined,
    canonicalVersion:undefined,
    status:'DRAFT',
    name:'Legacy combined initiative'
  });
  fixture.read.mockImplementation(async () => ({...fixture.record}));
  const search = `?mode=doc&open=${fixture.record.id}&card=tasks&return=preparation`;
  window.history.replaceState(null, '', `/initiatives${search}`);
  Object.assign(window.location,{href:`http://localhost:3000/initiatives${search}`,search});
  render(<InitiativeDocumentView initiativeId={fixture.record.id} />);
  await waitFor(() => expect(screen.getAllByRole('heading', {name:'Tasks'}).at(-1)).toBeVisible());
  expect(await screen.findByText('Native task row')).toBeVisible();
  expect(await screen.findByText('Native milestone row')).toBeVisible();
  expect(document.querySelector('[data-nmode-section-item="timeline"]')).not.toBeInTheDocument();
  expect(fixture.write).not.toHaveBeenCalled();
  expect(fixture.amend).not.toHaveBeenCalled();
});

it('renders the real operational forecast editor in the mounted canonical Timeline card', async () => {
  localStorage.clear();
  fixture.read.mockReset();
  fixture.write.mockClear();
  fixture.amend.mockClear();
  fixture.updateForecast.mockClear();
  Object.assign(fixture.record, {
    id: '55555555-5555-4555-8555-555555555555',
    documentOrigin: 'initiatives-runtime-v1',
    canonicalVersion: 49,
    lifecycle: 'IN_EXECUTION',
    status: 'IN_EXECUTION',
    name: 'Native operational forecast initiative',
  });
  fixture.read.mockImplementation(async () => ({ ...fixture.record }));
  const search = `?mode=doc&open=${fixture.record.id}&card=timeline&return=execution`;
  window.history.replaceState(null, '', `/initiatives${search}`);
  Object.assign(window.location, {
    href: `http://localhost:3000/initiatives${search}`,
    search,
  });

  render(<InitiativeDocumentView initiativeId={fixture.record.id} sourceModule="execution" />);

  // Framer's initial opacity does not complete in jsdom; component identity and
  // content prove that the mounted document composed the real Timeline renderer.
  expect(await screen.findByTestId('operational-forecast-editor')).toBeInTheDocument();
  expect(screen.getByText('Operational forecast')).toBeInTheDocument();
  expect(
    screen.queryByText('No published content is available for this card.')
  ).not.toBeInTheDocument();
  expect(fixture.updateForecast).not.toHaveBeenCalled();
  expect(fixture.write).not.toHaveBeenCalled();
  expect(fixture.amend).not.toHaveBeenCalled();
});
