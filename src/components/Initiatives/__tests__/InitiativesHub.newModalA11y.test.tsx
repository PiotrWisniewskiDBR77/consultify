/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-037 — the inline "New Initiative" overlay in InitiativesHub
 * (reached from the empty-portfolio state, distinct from the canonical
 * InitiativeWizardModal) must have the full dialog contract: named role,
 * focus entry, Escape-to-close, and focus return to the trigger. PL/EN
 * tests use the REAL shipped `public/locales/{lang}/translation.json` (via
 * `createRealT`) so a PL assertion fails if the Polish string is actually
 * missing or wrong.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t,
      i18n: { language: lang },
    }),
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
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getUsers: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'initiative-wizard-modal' }) : null,
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

let InitiativesHubImport: typeof import('../InitiativesHub');

const renderHub = () =>
  render(
    <MemoryRouter initialEntries={['/initiatives']}>
      <InitiativesHubImport.InitiativesHub />
    </MemoryRouter>
  );

const mountWithLang = async (lang: 'en' | 'pl') => {
  vi.resetModules();
  mockI18n(lang);
  InitiativesHubImport = await import('../InitiativesHub');
  return renderHub();
};

// Two controls share the visible label (real EN: "New initiative", real PL:
// "Nowa inicjatywa"): the always-present Menu 3 CTA (opens the canonical
// InitiativeWizardModal, mocked above) and the empty-portfolio state's own
// primary action (opens the inline overlay under test). The empty-state CTA
// only mounts once the async getPortfolio() call resolves, so wait for both
// before picking the last one (DOM order: Menu 3 CTA first, empty-state CTA
// second) — clicking the first one to "probe" it would re-render the tree
// and detach the second button's node reference before we ever get to click
// it.
const openInlineNewInitiativeModal = async (triggerName: string) => {
  const trigger = await waitFor(() => {
    const found = screen.getAllByRole('button', { name: triggerName });
    expect(found.length).toBeGreaterThanOrEqual(2);
    return found[found.length - 1] as HTMLElement;
  });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  return trigger;
};

beforeEach(() => {
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InitiativesHub — inline "New Initiative" overlay accessible contract (EN)', () => {
  it('opens a dialog named "Create new initiative" from the empty-state CTA', async () => {
    await mountWithLang('en');
    await openInlineNewInitiativeModal('New initiative');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Create new initiative');
  });

  it('associates the Title field label with its input, in English', async () => {
    await mountWithLang('en');
    await openInlineNewInitiativeModal('New initiative');

    // Real EN string: initiatives.form.titleRequired = "Title is required"
    expect(screen.getByLabelText('Title is required')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to a live "New Initiative" trigger', async () => {
    await mountWithLang('en');
    await openInlineNewInitiativeModal('New initiative');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // InitiativesHub's empty-state block can remount as a new DOM subtree
    // across this open/close cycle (pre-existing behavior, unrelated to this
    // fix), detaching the exact button instance that had focus when the
    // dialog opened. useDialogA11y's fallback resolver (wired via
    // data-testid="initiatives-new-modal-empty-cta") must land focus on the
    // LIVE re-queried button instead of silently falling back to <body>.
    await waitFor(() => {
      const liveTrigger = screen.getByTestId('initiatives-new-modal-empty-cta');
      expect(document.activeElement).toBe(liveTrigger);
      expect(document.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  it('the Cancel button closes the dialog and returns focus to a live "New Initiative" trigger', async () => {
    await mountWithLang('en');
    await openInlineNewInitiativeModal('New initiative');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => {
      const liveTrigger = screen.getByTestId('initiatives-new-modal-empty-cta');
      expect(document.activeElement).toBe(liveTrigger);
      expect(document.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  it('the Cancel button closes the dialog without creating anything', async () => {
    await mountWithLang('en');
    await openInlineNewInitiativeModal('New initiative');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('InitiativesHub — inline "New Initiative" overlay accessible contract (PL)', () => {
  it('opens a dialog named in real Polish, and labels the Title field in real Polish', async () => {
    await mountWithLang('pl');

    // Real PL string: initiatives.form.newInitiative = "Nowa inicjatywa"
    await openInlineNewInitiativeModal('Nowa inicjatywa');

    // Real PL string: initiatives.form.createNew = "Utwórz nową inicjatywę"
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Utwórz nową inicjatywę');
    expect(screen.queryByText('Create new initiative')).not.toBeInTheDocument();

    // Real PL string: initiatives.form.titleRequired = "Tytuł jest wymagany"
    expect(screen.getByLabelText('Tytuł jest wymagany')).toBeInTheDocument();
  });

  it('the real Polish Cancel button closes the dialog and returns focus to a live trigger', async () => {
    await mountWithLang('pl');
    await openInlineNewInitiativeModal('Nowa inicjatywa');

    // Real PL string: initiatives.form.cancel = "Anuluj"
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => {
      const liveTrigger = screen.getByTestId('initiatives-new-modal-empty-cta');
      expect(document.activeElement).toBe(liveTrigger);
      expect(document.contains(document.activeElement)).toBe(true);
    });
  });
});
