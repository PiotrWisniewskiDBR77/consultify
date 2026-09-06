/** @vitest-environment jsdom */
/**
 * DEC-404 — KONTRAKT: ikona Teresy w Menu 1 istnieje w KAŻDYM module.
 *
 * Zgłoszenie właściciela (06.09.2026): „we wszystkich tych modułach nie ma
 * ikony Teresy w Menu 1 i nie mogę otworzyć panelu AI w tym module".
 *
 * Przyczyna, przed którą broni ten plik: przycisk wisiał pod
 * `shouldShowChatPanel`, który zawiera człon `!hasEmbeddedModuleChat`.
 * Ten człon jest słuszny dla MONTOWANIA globalnego doku (inaczej byłyby dwa
 * panele Teresy naraz), ale gasił też WEJŚCIE — więc każdy ekran listowy
 * z gospodarzem P1 (`JedenPrawyPanel`/`TableWithPreviewLayout`) tracił ikonę.
 *
 * MUTACJA, która MUSI zapalić czerwień (sprawdzone ręcznie 06.09):
 *   w `MainLayout.tsx` przywróć `{shouldShowChatPanel && (` przy przycisku
 *   `data-testid="menu1-teresa"` → przypadek „ekran listowy z gospodarzem"
 *   pada, bo ikony nie ma.
 * Druga mutacja: usuń człon `!hasEmbeddedModuleChat` z `shouldShowChatPanel`
 *   → pada przypadek „dokładnie jeden UnifiedChatPanel" (dok montuje się
 *   obok panelu gospodarza).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../MainLayout';
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

/** Przełącznik gospodarza P1 — odpowiednik `JedenPrawyPanel` na ekranie. */
let gospodarzP1 = false;

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
  useEmbeddedModuleChatHost: () => gospodarzP1,
}));
vi.mock('../../components/ui/composed/CommandPalette', () => ({
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function ekran(sciezka: string) {
  return render(
    <MemoryRouter initialEntries={[sciezka]}>
      <MainLayout breadcrumbs={['DEC-404']}>
        <div>treść modułu</div>
      </MainLayout>
    </MemoryRouter>
  );
}

describe('DEC-404 — ikona Teresy w Menu 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gospodarzP1 = false;
    appState.currentView = AppView.MY_WORK;
    appState.isChatCollapsed = true;
  });

  it('ekran NIELISTOWY (bez gospodarza P1) ma ikonę Teresy w Menu 1', () => {
    ekran('/organization/profile');
    expect(screen.getByTestId('menu1-teresa')).toBeInTheDocument();
  });

  it('ekran LISTOWY z gospodarzem P1 ma ikonę Teresy w Menu 1 (MUTACJA: przywróć `shouldShowChatPanel &&` → RED)', () => {
    gospodarzP1 = true;
    ekran('/my-work?tab=inbox');
    expect(screen.getByTestId('menu1-teresa')).toBeInTheDocument();
  });

  it('ikona ma aria-label „Teresa" i oddaje stan panelu przez aria-pressed', () => {
    appState.isChatCollapsed = false;
    ekran('/interview');
    const ikona = screen.getByTestId('menu1-teresa');
    expect(ikona).toHaveAttribute('aria-label', 'Teresa');
    expect(ikona).toHaveAttribute('title', 'Teresa');
    expect(ikona).toHaveAttribute('aria-pressed', 'true');
  });

  it('klik woła toggleChatCollapse — to samo wejście dla doku i dla panelu P1', () => {
    gospodarzP1 = true;
    ekran('/initiatives');
    screen.getByTestId('menu1-teresa').click();
    expect(appState.toggleChatCollapse).toHaveBeenCalledTimes(1);
  });

  it('przy gospodarzu P1 globalny dok NIE montuje drugiego UnifiedChatPanel (MUTACJA: usuń `!hasEmbeddedModuleChat` → RED)', () => {
    gospodarzP1 = true;
    appState.isChatCollapsed = false;
    ekran('/my-work?tab=inbox');
    expect(screen.queryAllByTestId('unified-chat-panel')).toHaveLength(0);
  });

  it('bez gospodarza P1 dok montuje DOKŁADNIE JEDEN UnifiedChatPanel', () => {
    appState.isChatCollapsed = false;
    ekran('/organization/profile');
    expect(screen.queryAllByTestId('unified-chat-panel')).toHaveLength(1);
  });

  it('Czat pełnoekranowy nie dostaje martwego przycisku (sam jest Teresą)', () => {
    appState.currentView = AppView.AI_CHAT;
    ekran('/chat');
    expect(screen.queryByTestId('menu1-teresa')).toBeNull();
  });
});
