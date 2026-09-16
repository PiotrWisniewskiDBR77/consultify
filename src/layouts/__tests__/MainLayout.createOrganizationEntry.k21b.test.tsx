/** @vitest-environment jsdom */
/**
 * K-21b (FEEDBACK-1 DEC-575, zgłoszenie testera Tomka #61 „nie da się utworzyć
 * organizacji") — [ODMROZENIE 15_SETTINGS DEC-575]
 *
 * PREMISA ZMIERZONA na `8bb6ec7fd7`: `src/components/settings/
 * OrganizationSettings.tsx` (naprawiony w K-21) ma w produkcie ZERO importerów
 * — jedyne wołania to test jednostkowy i `dev-render`. Ustawienia nie mają
 * sekcji „organization" (`SettingsSidebar.SettingsSection` jej nie wymienia),
 * więc naprawa K-21 była dla testera niewidzialna.
 *
 * Lekcja „wołacz istnieje ≠ renderuje się": ten test NIE renderuje komponentu
 * w izolacji. Montuje REALNĄ powłokę produktu (`MainLayout`) z NIEZAMOCKOWANYM
 * `UserProfileMenu` i przechodzi ścieżkę użytkownika: nagłówek → menu profilu →
 * „Switch Organization" (jedyna lista organizacji w produkcie) → „Create
 * Organization".
 *
 * Test nie tworzy żadnej organizacji — `Api.createOrganization` jest atrapą i
 * nie jest wołane (sprawdzamy tylko, że modal się otwiera).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../MainLayout';
import { AppView } from '../../types';

const appState: any = {
  currentView: AppView.MY_WORK,
  currentUser: {
    id: 'u-1',
    firstName: 'Tomek',
    lastName: 'Tester',
    email: 'tomek@example.com',
    role: 'MEMBER',
    isAuthenticated: true,
  },
  currentOrganization: { id: 'org-1', name: 'Acme' },
  currentProjectId: null,
  theme: 'light',
  sessionMode: null,
  setSessionMode: vi.fn(),
  toggleTheme: vi.fn(),
  logout: vi.fn(),
  setCurrentOrganization: vi.fn(),
  setCurrentProjectId: vi.fn(),
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
      i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: vi.fn() },
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

vi.mock('../../hooks/useDemo', () => ({
  useDemo: () => ({
    isDemoMode: false,
    demoExperienceType: null,
    demoOrganization: null,
    isDemoLoading: false,
    toggleDemoMode: vi.fn(),
  }),
}));

vi.mock('../../services/tokenService', () => ({
  tokenService: { getToken: () => 'test-token', saveTokens: vi.fn() },
}));

// Atrapa całego klienta API — test NIE tworzy organizacji.
const createOrganization = vi.fn();
vi.mock('../../services/api', () => ({
  Api: { createOrganization: (...args: any[]) => createOrganization(...args) },
}));

vi.mock('../../components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="unified-chat-panel" />,
}));
vi.mock('../../components/layout/NotificationDropdown', () => ({
  NotificationDropdown: () => null,
}));
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
vi.mock('../../components/Onboarding/FirstRunOnboarding', () => ({
  FirstRunOnboarding: () => null,
}));
vi.mock('../../components/Onboarding/OnboardingFirstLoginCTA', () => ({
  OnboardingFirstLoginCTA: () => null,
}));
vi.mock('../../components/documents/DocumentSidePanel', () => ({ DocumentSidePanel: () => null }));
vi.mock('../../components/documents/DocumentToggleButton', () => ({
  DocumentToggleButton: () => null,
}));
vi.mock('../../components/Feedback/FeedbackSidePanel', () => ({ FeedbackSidePanel: () => null }));
vi.mock('../../components/Feedback/FeedbackToggleButton', () => ({
  FeedbackToggleButton: () => null,
}));
vi.mock('../../components/access/AccessBlockedModal', () => ({ AccessBlockedModal: () => null }));
vi.mock('../../components/shared/embeddedModuleChatHost', () => ({
  useEmbeddedModuleChatHost: () => false,
}));
vi.mock('../../components/ui/composed/CommandPalette', () => ({
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../contexts/HelpContext', () => ({
  useHelp: () => ({}),
  useHelpSidePanel: () => ({ isOpen: false, close: vi.fn(), open: vi.fn() }),
  HelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function mockOrganizations(role: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any) => {
      if (String(input).includes('/api/organizations/current')) {
        return {
          ok: true,
          json: async () => ({
            organizations: [{ id: 'org-1', name: 'Acme', role, is_current: true }],
          }),
        } as any;
      }
      return { ok: false, json: async () => ({}) } as any;
    })
  );
}

async function openOrganizationSwitcher() {
  fireEvent.click(await screen.findByLabelText('Open user profile menu'));
  fireEvent.click(await screen.findByText('Switch Organization'));
  await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0));
}

function renderLayout() {
  return render(
    <MemoryRouter>
      <MainLayout breadcrumbs={['K-21b']}>
        <div>content</div>
      </MainLayout>
    </MemoryRouter>
  );
}

describe('MainLayout — wejście „Create Organization" w realnej powłoce [K-21b]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appState.currentUser.role = 'MEMBER';
  });

  it('MEMBER nie widzi przycisku tworzenia organizacji (serwer i tak by odrzucił POST)', async () => {
    appState.currentUser.role = 'MEMBER';
    mockOrganizations('MEMBER');
    renderLayout();
    await openOrganizationSwitcher();
    expect(screen.queryByTestId('user-menu-create-organization')).toBeNull();
  });

  it('ADMIN widzi przycisk w realnej powłoce, a klik otwiera modal', async () => {
    appState.currentUser.role = 'ADMIN';
    mockOrganizations('ADMIN');
    renderLayout();
    await openOrganizationSwitcher();

    const entry = await screen.findByTestId('user-menu-create-organization');
    expect(entry).toBeTruthy();
    expect(screen.queryByTestId('create-organization-modal')).toBeNull();

    fireEvent.click(entry);

    expect(await screen.findByTestId('create-organization-modal')).toBeTruthy();
    // Modal tylko się otwiera — żadna organizacja nie powstaje.
    expect(createOrganization).not.toHaveBeenCalled();
  });
});
