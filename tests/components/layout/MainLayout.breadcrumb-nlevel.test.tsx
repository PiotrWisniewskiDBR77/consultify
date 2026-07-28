/**
 * @vitest-environment jsdom
 *
 * FAZA B3 (2026-07-27) — Materiały studios (Document Studio, Prezentacje,
 * Excel) wyrzucały użytkownika z powłoki Materiałów: breadcrumb pokazywał
 * dwa razy to samo ("Document Studio › Document Studio") bo MainLayout
 * obsługiwał twardo tylko 2 segmenty. Ten plik dowodzi, że:
 *   - MainLayout renderuje dowolną liczbę segmentów (>=3) zachowując
 *     zachowanie dla 1-2 (patrz MainLayout.breadcrumb-a11y.test.tsx, wciąż
 *     zielony po tej zmianie);
 *   - segment z `to` jest klikalny i nawiguje;
 *   - ostatni segment zawsze zostaje bieżącą, nieklikalną stroną.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../../../src/layouts/MainLayout';
import { AppView } from '../../../src/types';

const appState: any = {
  currentView: AppView.MY_WORK,
  currentUser: { firstName: 'Piotr', role: 'ADMIN' },
  currentOrganization: null,
  setCurrentView: vi.fn(),
  setIsSidebarOpen: vi.fn(),
  isSidebarOpen: false,
  isChatCollapsed: false,
  toggleChatCollapse: vi.fn(),
};

const conversationState = {
  isSidebarOpen: false,
  toggleSidebar: vi.fn(),
  activeConversationId: null,
  setDisplayMode: vi.fn(),
  setWorkspaceContext: vi.fn(),
  expandToFullScreen: vi.fn(),
  workspaceContext: null,
};

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
      i18n: { language: 'en', resolvedLanguage: 'en' },
    }),
  };
});

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector?: any) => (typeof selector === 'function' ? selector(appState) : appState),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: Object.assign(
    (selector?: any) =>
      typeof selector === 'function' ? selector(conversationState) : conversationState,
    { getState: () => conversationState }
  ),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false }),
}));

vi.mock('../../../src/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <div data-testid="chat-panel" />,
}));

vi.mock('../../../src/components/layout/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notifications" />,
}));

vi.mock('../../../src/components/layout/UserProfileMenu', () => ({
  UserProfileMenu: () => <div data-testid="user-menu" />,
}));

vi.mock('../../../src/components/TaskDropdown', () => ({
  TaskDropdown: () => <div data-testid="task-dropdown" />,
}));

vi.mock('../../../src/components/LLMSelector', () => ({
  LLMSelector: () => <div data-testid="llm-selector" />,
}));

vi.mock('../../../src/components/SystemHealth', () => ({
  SystemHealth: () => <div data-testid="system-health" />,
}));

vi.mock('../../../src/components/layout/GlobalAccessBanners', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../../../src/components/AIFreezeBanner', () => ({
  AIFreezeBanner: () => null,
}));

vi.mock('../../../src/components/demo/DemoSessionManager', () => ({
  DemoSessionManager: () => null,
}));

vi.mock('../../../src/components/Help/HelpDeepLinkListener', () => ({
  HelpDeepLinkListener: () => null,
}));

vi.mock('../../../src/components/Help/HelpSidePanel', () => ({
  HelpSidePanel: () => null,
}));

vi.mock('../../../src/components/Help/HelpToggleButton', () => ({
  HelpToggleButton: () => null,
}));

vi.mock('../../../src/components/layout/DemoModeBanner', () => ({
  DemoModeBanner: () => null,
}));

vi.mock('../../../src/components/TrialExpiredGate', () => ({
  TrialExpiredGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../src/components/navigation/Sidebar/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../../../src/components/Onboarding/OnboardingFirstLoginCTA', () => ({
  OnboardingFirstLoginCTA: () => null,
}));

describe('MainLayout breadcrumb — N segments (FAZA B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3 segments (Materiały studio shape) with the last as the current page', () => {
    render(
      <MemoryRouter>
        <MainLayout
          breadcrumbs={[
            { label: 'Materiały', to: '/presentations' },
            { label: 'Dokumenty', to: '/presentations?tab=documents' },
            'Nowy dokument',
          ]}
        >
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('Materiały')).toBeInTheDocument();
    expect(screen.getByText('Dokumenty')).toBeInTheDocument();
    const current = screen.getByText('Nowy dokument');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Materiały')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Dokumenty')).not.toHaveAttribute('aria-current');
  });

  it('does not duplicate the same label across segments (regression for the reported bug)', () => {
    render(
      <MemoryRouter>
        <MainLayout
          breadcrumbs={[
            { label: 'Materiały', to: '/presentations' },
            { label: 'Dokumenty', to: '/presentations?tab=documents' },
            'Nowy dokument',
          ]}
        >
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    expect(screen.queryAllByText('Document Studio')).toHaveLength(0);
  });

  it('renders a clickable control for segments with `to`, and navigates on click', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MainLayout
          breadcrumbs={[
            { label: 'Materiały', to: '/presentations' },
            { label: 'Dokumenty', to: '/presentations?tab=documents' },
            'Nowy dokument',
          ]}
        >
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    const materialsCrumb = screen.getByRole('button', { name: 'Materiały' });
    await user.click(materialsCrumb);
    expect(mockNavigate).toHaveBeenCalledWith('/presentations');

    const tabCrumb = screen.getByRole('button', { name: 'Dokumenty' });
    await user.click(tabCrumb);
    expect(mockNavigate).toHaveBeenCalledWith('/presentations?tab=documents');

    // The current (last) segment is never a clickable control.
    expect(screen.queryByRole('button', { name: 'Nowy dokument' })).not.toBeInTheDocument();
  });

  it('keeps the legacy 2-string-segment behaviour unchanged', () => {
    render(
      <MemoryRouter>
        <MainLayout breadcrumbs={['Tools', 'Strategic Analysis']}>
          <div>content</div>
        </MainLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('Strategic Analysis')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Tools')).not.toHaveAttribute('aria-current');
    // Legacy plain-string segments (no `to`) stay non-interactive, same as before.
    expect(screen.queryByRole('button', { name: 'Tools' })).not.toBeInTheDocument();
  });
});
