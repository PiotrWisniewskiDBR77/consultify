/** @vitest-environment jsdom */
/** INI-OWN-006: every creation entry must open the canonical wizard. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({ t, i18n: { language: lang } }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }));
}
vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});
const { getPortfolio, portfolioStoreState, appStoreState, conversationStoreState } = vi.hoisted(
  () => ({
    getPortfolio: vi.fn(),
    portfolioStoreState: { refreshTrigger: 0 },
    appStoreState: {
      currentProjectId: 'proj-1',
      currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
      currentOrganization: { id: 'org-1' },
    },
    conversationStoreState: { addMessage: vi.fn() },
  })
);
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listRegisteredInitiatives: vi.fn(async () => ({ initiatives: [] })),
}));
vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio,
    getPendingDecisions: vi.fn(async () => []),
    getInitiativeSnapshot: vi.fn(async () => null),
    getInitiative: vi.fn(async () => null),
  },
}));
vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({})), post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})), delete: vi.fn(async () => ({})),
    getUsers: vi.fn(async () => []), getProjects: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => false,
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: ({ isOpen }: { isOpen: boolean }) => isOpen
    ? React.createElement('div', {
        role: 'dialog', 'aria-label': 'Canonical initiative wizard',
        'data-testid': 'initiative-wizard-modal',
      })
    : null,
}));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationStoreState) => unknown) =>
    selector(conversationStoreState),
}));
vi.mock('../../../store/portfolioSlice', () => ({
  usePortfolioStore: (selector: (state: typeof portfolioStoreState) => unknown) =>
    selector(portfolioStoreState),
}));
vi.mock('../../../store/useAppStore', () => ({ useAppStore: () => appStoreState }));

let Hub: typeof import('../InitiativesHub');
async function mount(lang: 'en' | 'pl', route = '/initiatives') {
  vi.resetModules();
  mockI18n(lang);
  Hub = await import('../InitiativesHub');
  return render(<MemoryRouter initialEntries={[route]}><Hub.InitiativesHub /></MemoryRouter>);
}
beforeEach(() => {
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
});
afterEach(() => vi.clearAllMocks());

describe('InitiativesHub canonical creation entry points', () => {
  it.each([['en', 'New initiative'], ['pl', 'Nowa inicjatywa']] as const)(
    'routes both visible %s CTAs to the canonical wizard', async (lang, label) => {
      await mount(lang);
      const triggers = await waitFor(() => {
        const found = screen.getAllByRole('button', { name: label });
        expect(found.length).toBeGreaterThanOrEqual(2);
        return found;
      });
      fireEvent.click(triggers[triggers.length - 1]);
      expect(await screen.findByTestId('initiative-wizard-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Canonical initiative wizard');
      expect(screen.queryByText('Create new initiative')).not.toBeInTheDocument();
      expect(screen.queryByText('Utwórz nową inicjatywę')).not.toBeInTheDocument();
    }
  );
  it('routes ?new=1 to the canonical wizard', async () => {
    await mount('en', '/initiatives?new=1');
    expect(await screen.findByTestId('initiative-wizard-modal')).toBeInTheDocument();
  });
});
