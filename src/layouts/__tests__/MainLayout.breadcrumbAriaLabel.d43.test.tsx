/** @vitest-environment jsdom */
/**
 * D-43 — `aria-label` nawigacji okruszków NIE może być komunikatem błędu biblioteki.
 *
 * Pomiar na żywym stagingu (`fa075366be`, 5 ekranów): czytnik ekranu czytał jako nazwę
 * nawigacji zdanie `key 'layout.breadcrumb (en)' returned an object instead of string.`
 * Przyczyna: `layout.breadcrumb` jest w obu plikach locale OBIEKTEM (`module`, `page`),
 * a `MainLayout.tsx:430` wołał go jak string — i18next zwraca wtedy swój komunikat,
 * a nie `defaultValue`.
 *
 * Test renderuje REALNĄ powłokę `MainLayout` na REALNYM i18next z REALNYMI zasobami
 * `public/locales/{en,pl}` (atrapa `t` z `tests/setup.ts` zwraca `defaultValue` i nigdy
 * by tego wycieku nie pokazała), w EN i w PL.
 */
import { render } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';
import plTranslation from '../../../public/locales/pl/translation.json';
import { AppView } from '../../types';
import { MainLayout } from '../MainLayout';

vi.unmock('react-i18next');

const appState: any = {
  currentView: AppView.MY_WORK,
  currentUser: {
    id: 'u-1',
    firstName: 'Anna',
    lastName: 'K',
    email: 'anna@example.com',
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
  tokenService: { getToken: () => 'token-org-1', saveTokens: vi.fn() },
}));

vi.mock('../../services/api', () => ({ Api: { createOrganization: vi.fn() } }));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock('../../components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="unified-chat-panel" />,
}));
vi.mock('../../components/layout/NotificationDropdown', () => ({ NotificationDropdown: () => null }));
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
vi.mock('../../components/layout/MfaEnrollmentBanner', () => ({ default: () => null }));
vi.mock('../../components/layout/UserProfileMenu', () => ({ UserProfileMenu: () => null }));
vi.mock('../../components/layout/NotificationDropdown', () => ({ NotificationDropdown: () => null }));
vi.mock('../../components/Trial/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../components/navigation/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../../components/navigation/BottomNavigation', () => ({ BottomNavigation: () => null }));
vi.mock('../../components/Onboarding/FirstRunOnboarding', () => ({ FirstRunOnboarding: () => null }));
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
vi.mock('../../components/access/ForbiddenAccessBanner', () => ({
  ForbiddenAccessBanner: () => null,
}));
vi.mock('../../components/Projects/ProjectContextSwitcher', () => ({
  ProjectContextSwitcher: () => null,
}));
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

let instance: i18n;

beforeAll(async () => {
  instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: false,
    resources: {
      en: { translation: enTranslation },
      pl: { translation: plTranslation },
    },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) }) as any));
});

function renderLayout() {
  return render(
    <I18nextProvider i18n={instance}>
      <MemoryRouter>
        <MainLayout breadcrumbs={['Interview', 'Sessions']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    </I18nextProvider>
  );
}

const navLabels = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('nav')).map((node) => node.getAttribute('aria-label') ?? '');

describe('D-43 — aria-label nawigacji okruszków w realnej powłoce MainLayout', () => {
  it('EN: nawigacja nazywa się „Breadcrumb", a nie komunikatem błędu i18next', async () => {
    await instance.changeLanguage('en');
    const { container } = renderLayout();

    const labels = navLabels(container);
    expect(labels.some((label) => label.includes('returned an object instead of string'))).toBe(
      false
    );
    expect(labels).toContain('Breadcrumb');
  });

  it('PL: ta sama nawigacja ma polską nazwę z pliku locale', async () => {
    await instance.changeLanguage('pl');
    const { container } = renderLayout();

    const labels = navLabels(container);
    expect(labels.some((label) => label.includes('returned an object instead of string'))).toBe(
      false
    );
    expect(labels).toContain('Okruszki nawigacyjne');
  });

  it('żaden element nawigacyjny w powłoce nie niesie surowego klucza ani obiektu', async () => {
    await instance.changeLanguage('en');
    const { container } = renderLayout();

    for (const label of navLabels(container)) {
      expect(label).not.toMatch(/^layout\./);
      expect(label).not.toContain('returned an object');
    }
  });
});
