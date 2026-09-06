/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../MainLayout';
import { ArtifactRightPanel } from '../../components/standard/ArtifactRightPanel';
import { AppView } from '../../types';

const appState: any = {
  currentView: AppView.MY_WORK,
  currentUser: { firstName: 'Piotr', role: 'ADMIN' },
  currentOrganization: null,
  currentProjectId: null,
  setCurrentView: vi.fn(),
  setIsSidebarOpen: vi.fn(),
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  isChatCollapsed: true,
  toggleChatCollapse: vi.fn(),
  chatPanelWidth: 360,
  setChatPanelWidth: vi.fn(),
  chatKickoffMessage: null,
  clearChatKickoffMessage: vi.fn(),
  chatSystemPrompt: null,
  chatQuickPrompts: null,
  chatContextActions: null,
};

const conversationState: any = {
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
  activeConversationId: 'main-conversation',
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  expandToFullScreen: vi.fn(),
  workspaceContext: null,
};

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
      i18n: { language: 'pl', resolvedLanguage: 'pl' },
    }),
  };
});

vi.mock('../../store/useAppStore', () => ({
  useAppStore: (selector?: any) => (typeof selector === 'function' ? selector(appState) : appState),
}));

vi.mock('../../store/useConversationStore', () => ({
  useConversationStore: Object.assign(
    (selector?: any) =>
      typeof selector === 'function' ? selector(conversationState) : conversationState,
    { getState: () => conversationState }
  ),
}));

vi.mock('../../hooks/useDeviceType', () => ({
  useDeviceType: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  }),
}));

vi.mock('../../components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="unified-chat-panel" />,
}));

vi.mock('../../components/layout/NotificationDropdown', () => ({ NotificationDropdown: () => null }));
vi.mock('../../components/layout/UserProfileMenu', () => ({ UserProfileMenu: () => null }));
vi.mock('../../components/TaskDropdown', () => ({ TaskDropdown: () => null }));
vi.mock('../../components/LLMSelector', () => ({ LLMSelector: () => null }));
vi.mock('../../components/SystemHealth', () => ({ SystemHealth: () => null }));
vi.mock('../../components/layout/GlobalAccessBanners', () => ({ default: () => null }));
vi.mock('../../components/AIFreezeBanner', () => ({ AIFreezeBanner: () => null }));
vi.mock('../../components/demo/DemoSessionManager', () => ({ DemoSessionManager: () => null }));
vi.mock('../../components/Help/HelpDeepLinkListener', () => ({ HelpDeepLinkListener: () => null }));
vi.mock('../../components/Help/HelpSidePanel', () => ({ HelpSidePanel: () => null }));
vi.mock('../../components/Help/HelpToggleButton', () => ({ HelpToggleButton: () => null }));
vi.mock('../../components/layout/DemoModeBanner', () => ({ DemoModeBanner: () => null }));
vi.mock('../../components/Trial/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../components/navigation/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../../components/navigation/BottomNavigation', () => ({ BottomNavigation: () => null }));
vi.mock('../../components/Onboarding/FirstRunOnboarding', () => ({ FirstRunOnboarding: () => null }));
vi.mock('../../components/Onboarding/OnboardingFirstLoginCTA', () => ({ OnboardingFirstLoginCTA: () => null }));
vi.mock('../../components/documents/DocumentSidePanel', () => ({ DocumentSidePanel: () => null }));
vi.mock('../../components/documents/DocumentToggleButton', () => ({ DocumentToggleButton: () => null }));
vi.mock('../../components/Feedback/FeedbackSidePanel', () => ({ FeedbackSidePanel: () => null }));
vi.mock('../../components/Feedback/FeedbackToggleButton', () => ({ FeedbackToggleButton: () => null }));
vi.mock('../../components/access/AccessBlockedModal', () => ({ AccessBlockedModal: () => null }));
vi.mock('../../components/shared/embeddedModuleChatHost', () => ({
  useEmbeddedModuleChatHost: () => false,
}));
vi.mock('../../components/ui/composed/CommandPalette', () => ({
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): przycisk-wejście w
 * sekcji Akcje panelu artefaktu (`ArtifactRightPanel.teresaEntry`) USUNIĘTY —
 * jedyne wejście do Teresy jest teraz ikona Menu 1 (`data-testid=
 * "menu1-teresa"`, DEC-404). Ten harness renderuje panel artefaktu BEZ
 * `teresaEntry` (prop jest deprecated/nieczytany — patrz ArtifactRightPanel),
 * a niezmiennik P8 (dokładnie jedna instancja `UnifiedChatPanel` po kliknięciu
 * wejścia) pilnujemy teraz na JEDYNYM realnym wejściu: ikonie Menu 1.
 */
function Harness() {
  return (
    <MainLayout breadcrumbs={['P8']}>
      <ArtifactRightPanel
        sections={[{ id: 'actions', label: 'Akcje', children: <button type="button">Inna akcja</button> }]}
      />
    </MainLayout>
  );
}

describe('P8 — pojedynczy wspólny panel Teresy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // useOpenChatWithContext leaves an already-open shared conversation in place.
    // This test guards the complementary invariant: an entry must not add a
    // module-local second panel beside the one owned by MainLayout.
    appState.isChatCollapsed = false;
  });

  it('po kliknięciu wejścia Menu 1 montuje dokładnie jedną instancję UnifiedChatPanel', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('unified-chat-panel')).toHaveLength(1);
    });
    // Panel artefaktu nie ma już własnego przycisku Teresy (DEC-419) —
    // jedyne wejście jest w Menu 1.
    expect(screen.queryByTestId('teresa-entry')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('menu1-teresa'));
    expect(screen.getAllByTestId('unified-chat-panel')).toHaveLength(1);
  });
});
