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
}));
vi.mock('@/services/initiativeWriteTruth', () => ({
  saveInitiativeWriteTruth: (id: string, payload: Record<string, unknown>) =>
    fixture.write(id, payload),
  transitionInitiativeWriteTruth: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({}),
  Api: new Proxy({}, { get: () => async (path: unknown) => String(path).endsWith('/cards') ? {initiativeVersion:1,cards:[]} : String(path).endsWith('/gates/definition/readiness') ? {readiness:'BLOCKED',findings:[]} : [] }),
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
