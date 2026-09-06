/**
 * @vitest-environment jsdom
 *
 * Smoke tests for InitiativesHub (Module 05 — Inicjatywy).
 * Mocks the V8 planning / economics services so the hub mounts deterministically
 * offline. Asserts: the empty portfolio renders the honest empty state, a
 * populated portfolio renders the initiative, and the "New Initiative" CTA opens
 * the create modal.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (k === 'initiatives.form.newInitiative') return 'New Initiative';
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const {
  getPortfolio,
  getInitiative,
  listRegisteredInitiatives,
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
  demoModeState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
  apiGet: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
  demoModeState: { enabled: false },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio: getPortfolio,
    getPendingDecisions: vi.fn(async () => []),
    getInitiativeSnapshot: vi.fn(async () => null),
    getInitiative,
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getUsers: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => demoModeState.enabled,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: ({ isOpen, onCreated }: { isOpen: boolean; onCreated: Function }) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'initiative-wizard-modal' },
          React.createElement(
            'button',
            {
              onClick: () => onCreated([{ id: 'fresh-1', name: 'Fresh draft', status: 'DRAFT' }]),
            },
            'Complete wizard'
          )
        )
      : null,
}));

vi.mock('../InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => React.createElement('div', { 'data-testid': 'legacy-initiative' }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationStoreState) => unknown) =>
    selector(conversationStoreState),
}));

vi.mock('../../../store/portfolioSlice', () => ({
  usePortfolioStore: (selector: (state: typeof portfolioStoreState) => unknown) =>
    selector(portfolioStoreState),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => appStoreState,
}));

import { InitiativesHub, readV8InitiativeId } from '../InitiativesHub';
import { resetInitiativeBridgeFlagCache } from '@/utils/initiativeBridgeFlag';

const renderHub = () =>
  render(
    <MemoryRouter initialEntries={['/initiatives']}>
      <InitiativesHub />
    </MemoryRouter>
  );

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <InitiativesHub />
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
  resetInitiativeBridgeFlagCache();
  demoModeState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InitiativesHub smoke', () => {
  it('keeps the accepted-classic bridge absent when its flag is off', async () => {
    renderHub();
    await screen.findByTestId('initiatives-hub');
    // DEC-420: moved from a standalone Menu 3 button into the "Więcej" kebab —
    // with the flag off, the kebab itself must not render.
    expect(screen.queryByTestId('initiatives-menu3-kebab')).not.toBeInTheDocument();
    expect(screen.queryByText('Przejmij klasyczną inicjatywę')).not.toBeInTheDocument();
  });

  it('confirms and calls the accepted-classic bridge when its flag is on', async () => {
    window.localStorage.setItem('ff.initiative_bridge', '1');
    resetInitiativeBridgeFlagCache();
    const prompt = vi.spyOn(window, 'prompt');
    prompt.mockReturnValueOnce('classic-initiative-1').mockReturnValueOnce('candidate-1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ status: 'APPLIED' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    renderHub();
    // DEC-420: the action now lives in the Menu 3 "Więcej" kebab — open it
    // before clicking the (Polish) menu item.
    fireEvent.click(await screen.findByTestId('initiatives-menu3-kebab'));
    fireEvent.click(await screen.findByText('Przejmij klasyczną inicjatywę'));

    // DEC-397 (MVP fix 2026-09-05): InitiativesHub's fetchData now also
    // backfills legacy rows via `listLegacyInitiatives` (GET
    // `/api/initiatives`), which goes through this same stubbed global
    // `fetch` — on mount and again on the post-adoption refresh. So the
    // adoption POST is no longer necessarily the only (or first) call;
    // find it by URL instead of assuming call count/order.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([callUrl]) => callUrl === '/api/initiatives/runtime-v1/adoptions/accepted-classic'
        )
      ).toBe(true)
    );
    const [url, request] = fetchMock.mock.calls.find(
      ([callUrl]) => callUrl === '/api/initiatives/runtime-v1/adoptions/accepted-classic'
    )!;
    expect(url).toBe('/api/initiatives/runtime-v1/adoptions/accepted-classic');
    expect(JSON.parse(String((request as RequestInit).body))).toMatchObject({
      candidateId: 'candidate-1',
      initiativeId: 'classic-initiative-1',
      projectId: 'proj-1',
      initiativeOwnerId: 'u1',
      expectedVersion: 0,
      visibility: 'PROJECT',
    });
  });

  it('reads a V8 initiative id from direct and canonical envelopes and fails closed otherwise', () => {
    expect(readV8InitiativeId({ id: 'direct-1' })).toBe('direct-1');
    expect(readV8InitiativeId({ initiative: { id: 'enveloped-1' } })).toBe('enveloped-1');
    expect(readV8InitiativeId({ initiative: null })).toBe('');
    expect(readV8InitiativeId({})).toBe('');
  });

  it('mounts and renders the hub shell with an empty portfolio', async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByTestId('initiatives-hub')).toBeInTheDocument();
    });
  });

  it('fails closed in DEV when the canonical register read fails', async () => {
    listRegisteredInitiatives.mockRejectedValue(
      Object.assign(new Error('canonical unavailable'), { status: 500, code: 'API_UNAVAILABLE' })
    );

    renderHub();

    expect(
      await screen.findByText('Failed to load initiatives from the active data source.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Post-Merger KPI Harmonization')).not.toBeInTheDocument();
  });

  it('renders an initiative card when the portfolio has one initiative', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [
        {
          version: 1,
          updatedAt: '2026-08-22T00:00:00.000Z',
          initiative: {
            initiativeId: 'init-1',
            lifecycleState: 'IN_EXECUTION',
            title: 'Automate Onboarding',
            problem: 'Manual onboarding',
            projectId: 'proj-1',
            readiness: 'NOT_EVALUATED',
            source: {
              proposalId: 'proposal-1',
              proposalVersion: 1,
              sourceType: 'assessment-finding',
              sourceId: 'finding-1',
              sourceVersion: 1,
              freshness: 'CURRENT',
            },
          },
        },
      ],
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('Automate Onboarding')).toBeInTheDocument();
    });
  });

  it('keeps a historical initiative visible when its source envelope is absent', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [
        {
          version: 1,
          updatedAt: '2026-08-22T00:00:00.000Z',
          initiative: {
            initiativeId: 'legacy-init-1',
            lifecycleState: 'IN_EXECUTION',
            title: 'Historical Initiative',
            problem: 'Created before source lineage was required',
            projectId: 'proj-1',
            readiness: 'NOT_EVALUATED',
          },
        },
      ],
    });

    renderHub();

    await waitFor(() => {
      expect(screen.getByText('Historical Initiative')).toBeInTheDocument();
    });
  });

  it('exposes the canonical "New Initiative" CTA and opens the wizard in default table view', async () => {
    renderHub();
    await waitFor(() => expect(screen.getByTestId('initiatives-hub')).toBeInTheDocument());
    const [primaryWizardButton] = await screen.findAllByRole('button', {
      name: 'New Initiative',
    });
    fireEvent.click(primaryWizardButton);
    await waitFor(() => {
      expect(screen.getByTestId('initiative-wizard-modal')).toBeInTheDocument();
    });
  });

  it('opens a wizard-created draft in the persisted initiative document, not unregistered runtime', async () => {
    renderHub();
    const [primaryWizardButton] = await screen.findAllByRole('button', { name: 'New Initiative' });
    fireEvent.click(primaryWizardButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Complete wizard' }));

    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-initiative')).not.toBeInTheDocument();
  });

  it('opens a 404-unregistered deep link in the persisted initiative document', async () => {
    apiGet
      .mockRejectedValueOnce(Object.assign(new Error('not registered'), { status: 404 }))
      .mockResolvedValueOnce({ id: 'legacy-1', name: 'Legacy persisted', status: 'DRAFT' });
    renderHubAt('/initiatives?open=legacy-1&mode=doc');
    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-initiative')).not.toBeInTheDocument();
  });

  // Decyzja właściciela 2026-09-03: KAŻDA inicjatywa (także zarejestrowana w runtime-v1)
  // otwiera zatwierdzony rekord InitiativeDocumentView; osobny „canonical card" usunięty z repo
  // (bezpiecznik: tests/unit/initiatives/initiativeRecordCanon.test.ts).
  it('opens a runtime-v1 registered deep link in the approved initiative document', async () => {
    apiGet.mockResolvedValueOnce({ id: 'runtime-1' });
    getInitiative.mockResolvedValueOnce({
      initiative: { id: 'runtime-1', name: 'Registered runtime', status: 'DRAFT' },
    });
    renderHubAt('/initiatives?open=runtime-1&mode=doc');
    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-initiative')).not.toBeInTheDocument();
  });

  // [ODMROZENIE 05_INITIATIVES DEC-397] INI-404 (2026-09-06).
  //
  // Tu stał test „fails closed when the runtime-v1 registration read fails unexpectedly":
  // 500 z sondy `GET /initiatives/runtime-v1/initiatives/<id>` miało BLOKOWAĆ otwarcie karty.
  // To był fail-closed bez chronionego przedmiotu (por. pamięć „zamknięte przez wygaszenie"):
  // po usunięciu `CanonicalInitiativeCardWorkspace` (aed131a2ab) odpowiedź sondy nie
  // zmieniała już ani renderera, ani danych — karta czyta rekord z `/api/v8/planning/
  // initiatives/:id` i `/api/initiatives/:id`, a izolacja organizacji siedzi na TAMTYCH
  // trasach (`WHERE i.id = ? AND i.organization_id = ?`), nie na sondzie. Jedynym realnym
  // skutkiem sondy było `404` i czerwony błąd konsoli na KAŻDYM rekordzie klasycznego
  // rejestru (zmierzone: 71 wierszy DBR77, 0 wierszy w projekcji runtime-v1).
  //
  // Kontrakt po naprawie: odczyt deep-linku nie pyta runtime-v1 o pojedynczą inicjatywę
  // w ogóle, a karta otwiera się z tras, które rekord znają.
  it('nie pyta runtime-v1 o pojedynczą inicjatywę przy otwieraniu deep-linku', async () => {
    apiGet.mockClear();
    getInitiative.mockClear();
    getInitiative.mockResolvedValueOnce({
      initiative: { id: 'legacy-2', name: 'Legacy persisted', status: 'DRAFT' },
    });
    renderHubAt('/initiatives?open=legacy-2&mode=doc');

    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    const runtimeProbes = apiGet.mock.calls.filter((call) =>
      String(call[0]).startsWith('/initiatives/runtime-v1/initiatives/')
    );
    expect(runtimeProbes).toEqual([]);
  });
});
