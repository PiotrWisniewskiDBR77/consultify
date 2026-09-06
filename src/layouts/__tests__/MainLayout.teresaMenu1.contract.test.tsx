/** @vitest-environment jsdom */
/**
 * DEC-404 — KONTRAKT: ikona Teresy w Menu 1 istnieje w KAŻDYM module.
 *
 * Zgłoszenie właściciela (06.09.2026): „we wszystkich tych modułach nie ma
 * ikony Teresy w Menu 1 i nie mogę otworzyć panelu AI w tym module".
 *
 * Przyczyna, przed którą broni ten plik: przycisk wisiał pod
 * `shouldShowChatPanel`, który zawierał człon „nikt nie osadza Teresy u
 * siebie" — więc każdy ekran listowy z gospodarzem P1
 * (`JedenPrawyPanel`/`TableWithPreviewLayout`) tracił ikonę.
 *
 * ★ UZUPEŁNIENIE DEC-404 (06.09, po odrzuceniu przez właściciela pierwszej
 * naprawy): rejestr gospodarzy P1 NIE gasi już doku. Klik ikony montuje
 * STANDARDOWY dok — ten sam co na /results — a gospodarz P1 chowa wtedy swoją
 * kolumnę podglądu (`useJedenPanel.dokOtwarty`, kontrakt mierzony
 * w `jedenPanel.contract.test.tsx` T2b). Dok NIE staje obok podglądu.
 *
 * MUTACJE, które MUSZĄ zapalić czerwień:
 *   (a) przywróć `{shouldShowChatPanel && (` przy `data-testid="menu1-teresa"`
 *       → pada „ekran listowy z gospodarzem ma ikonę";
 *   (b) przywróć `hasEmbeddedModuleChatByPath || embeddedModuleChatHosted`
 *       w `hasEmbeddedModuleChat` → pada „przy gospodarzu P1 dok MONTUJE się";
 *   (c) usuń `path.startsWith('/wordy')` → pada „ekran z własną powierzchnią
 *       czatu (ścieżka) nie dostaje drugiego doku".
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

  /*
   * ★ DEC-404 (uzupełnienie 06.09) — TEN PRZYPADEK JEST ODWRÓCONY względem
   * wersji z 1.1-G. Wtedy dok ustępował gospodarzowi, a Teresa lądowała
   * w kolumnie podglądu jako zakładka. Właściciel to odrzucił („tu nie jest
   * jej miejsce"), więc dok montuje się TAKŻE na ekranie listowym — to
   * gospodarz chowa swój podgląd.
   */
  it('przy gospodarzu P1 dok MONTUJE dokładnie jeden UnifiedChatPanel (MUTACJA: przywróć gaszenie rejestrem → RED)', () => {
    gospodarzP1 = true;
    appState.isChatCollapsed = false;
    ekran('/my-work?tab=inbox');
    expect(screen.queryAllByTestId('unified-chat-panel')).toHaveLength(1);
  });

  it('ekran z WŁASNĄ powierzchnią czatu (ścieżka) nadal nie dostaje doku', () => {
    appState.isChatCollapsed = false;
    ekran('/wordy');
    expect(screen.queryAllByTestId('unified-chat-panel')).toHaveLength(0);
    expect(screen.queryByTestId('menu1-teresa')).toBeNull();
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
