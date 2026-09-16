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
      // K-21c: atrapa musi umieć to, co robi i18next w produkcie — `defaultValue`
      // + interpolacja `{{name}}`. Wcześniej zwracała surowy obiekt opcji, więc
      // każdy komunikat z parametrem był w teście niewidzialny.
      t: (_key: string, fallback?: string | Record<string, unknown>) => {
        if (typeof fallback === 'string') return fallback;
        if (fallback && typeof fallback.defaultValue === 'string') {
          return fallback.defaultValue.replace(/\{\{(\w+)\}\}/g, (_m, nazwa) =>
            String(fallback[nazwa] ?? '')
          );
        }
        return _key;
      },
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

// K-21d: token jest STANOWY, bo serwer odpowiada na `/api/organizations/current`
// wg TOKENU, a nie wg intencji klienta. Bez tego atrapa oddaje świeżą listę
// nawet na starym tokenie i test przepuszcza wyścig, który widać na zrzucie.
const stanTokenu = vi.hoisted(() => ({ wartosc: 'token-org-1' }));
vi.mock('../../services/tokenService', () => ({
  tokenService: {
    getToken: () => stanTokenu.wartosc,
    saveTokens: (token: string) => {
      stanTokenu.wartosc = token;
    },
  },
}));

// Atrapa całego klienta API — test NIE tworzy organizacji.
const createOrganization = vi.fn();
vi.mock('../../services/api', () => ({
  Api: { createOrganization: (...args: any[]) => createOrganization(...args) },
}));

// K-21c: komunikat jest częścią naprawy (użytkownik ma WIEDZIEĆ, gdzie wylądował).
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
  default: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
  Toaster: () => null,
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


/**
 * ★ K-21c (KANAL Wpis 143, DEC-575) — [ODMROZENIE 15_SETTINGS DEC-575]
 *
 * PREMISA ZMIERZONA na `151111ce06`: po `POST /api/organizations` modal robił
 * tylko `toast.success('Organization created successfully!')` i zamykał się.
 * Użytkownik ZOSTAWAŁ w starej organizacji, a nowa nie pojawiała się nigdzie —
 * `fetchOrgs` jest jednorazowe (`orgs.length > 0` → return), więc nawet lista
 * w menu jej nie pokazywała do przeładowania strony. Twórca jest OWNER-em
 * nowej organizacji i ma w niej wylądować.
 *
 * Test idzie CAŁĄ ścieżką użytkownika w REALNEJ powłoce (`MainLayout` +
 * niezamockowany `UserProfileMenu` + prawdziwy `CreateOrganizationModal`) —
 * lekcja „wołacz istnieje ≠ renderuje się". Mockowany jest wyłącznie transport.
 *
 * Czerwony PRZED naprawą (`switch-organization` nie wołane), zielony PO.
 */
describe('MainLayout — po utworzeniu organizacji użytkownik w niej ląduje [K-21c]', () => {
  const NOWA = { id: 'org-2', name: 'Baltic Robotics' };

  function mockTransport(role: string) {
    const wywolania: { url: string; body: any }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any, init?: any) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(init.body) : null;
        wywolania.push({ url, body });
        if (url.includes('/api/organizations/current')) {
          return {
            ok: true,
            json: async () => ({
              organizations: [{ id: 'org-1', name: 'Acme', role, is_current: true }],
            }),
          } as any;
        }
        if (url.includes('/api/auth/switch-organization')) {
          return {
            ok: true,
            json: async () => ({
              token: 't',
              refreshToken: 'r',
              organization: NOWA,
            }),
          } as any;
        }
        return { ok: false, json: async () => ({}) } as any;
      })
    );
    return wywolania;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    appState.currentUser.role = 'ADMIN';
    createOrganization.mockResolvedValue(NOWA);
  });

  it('woła `switch-organization` z ID NOWEJ organizacji i mówi, gdzie użytkownik jest', async () => {
    const wywolania = mockTransport('ADMIN');
    renderLayout();
    await openOrganizationSwitcher();

    fireEvent.click(await screen.findByTestId('user-menu-create-organization'));
    const modal = await screen.findByTestId('create-organization-modal');

    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: NOWA.name },
    });
    fireEvent.click(
      Array.from(modal.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Create Organization'
      ) as HTMLElement
    );

    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith(NOWA.name));

    // Sedno naprawy: przełączenie na NOWĄ organizację tą samą ścieżką, której
    // używa lista organizacji — nie drugą, równoległą.
    await waitFor(() => {
      const przelaczenie = wywolania.find((w) => w.url.includes('/api/auth/switch-organization'));
      expect(przelaczenie?.body).toEqual({ organizationId: NOWA.id });
    });

    // Kontekst aplikacji idzie za tokenem, nie zostaje w starej organizacji.
    await waitFor(() =>
      expect(appState.setCurrentOrganization).toHaveBeenCalledWith({
        id: NOWA.id,
        name: NOWA.name,
      })
    );

    // Jeden komunikat, mówiący GDZIE użytkownik jest — nie dwa ogólniki.
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Organization created — you are now in Baltic Robotics'
      )
    );
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('modal zamyka się po utworzeniu (nie zostaje nad przełączoną organizacją)', async () => {
    mockTransport('ADMIN');
    renderLayout();
    await openOrganizationSwitcher();

    fireEvent.click(await screen.findByTestId('user-menu-create-organization'));
    const modal = await screen.findByTestId('create-organization-modal');
    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: NOWA.name },
    });
    fireEvent.click(
      Array.from(modal.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Create Organization'
      ) as HTMLElement
    );

    await waitFor(() => expect(screen.queryByTestId('create-organization-modal')).toBeNull());
  });
});


/**
 * ★ K-21d (odbiór CTO paczki K-21c, P2 ze zrzutu `k21c-toast-en-light.png`).
 *
 * PREMISA ZMIERZONA na `977df5da6d`: nagłówek po utworzeniu pokazywał
 * „Baltic Robotics", ale rozwinięta lista „Switch Organization" NADAL miała
 * ptaszek przy starej organizacji i nowej w ogóle nie zawierała. Powód nie
 * leżał w atrapie harnessu: `handleOrganizationCreated` czyścił listę PRZED
 * przełączeniem, więc efekt pobierał ją jeszcze STARYM tokenem, a bramka
 * jednorazowości (`orgs.length > 0`) blokowała pobranie po przełączeniu.
 *
 * Test idzie tą samą realną powłoką co K-21c; atrapa transportu jest STANOWA —
 * `/api/organizations/current` oddaje to, co widziałby serwer dla aktualnego
 * tokenu (przed przełączeniem jedną organizację, po przełączeniu dwie).
 */
describe('MainLayout — lista organizacji po utworzeniu [K-21d]', () => {
  const NOWA = { id: 'org-2', name: 'Baltic Robotics' };

  function mockTransportStanowy() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any, init?: any) => {
        const url = String(input);
        if (url.includes('/api/organizations/current')) {
          // Odpowiedź zależy od TOKENU w nagłówku — dokładnie jak na serwerze.
          const token = String(init?.headers?.Authorization || '');
          const lista = token.includes('token-org-2')
            ? [
                { id: 'org-1', name: 'Acme', role: 'ADMIN', is_current: false },
                { id: NOWA.id, name: NOWA.name, role: 'OWNER', is_current: true },
              ]
            : [{ id: 'org-1', name: 'Acme', role: 'ADMIN', is_current: true }];
          return { ok: true, json: async () => ({ organizations: lista }) } as any;
        }
        if (url.includes('/api/auth/switch-organization')) {
          const cel = JSON.parse(init?.body || '{}').organizationId;
          // Realne opóźnienie sieci — bez niego atrapa odpowiada w tym samym
          // mikro-tasku, efekt Reacta zdąża pobrać listę już NOWYM tokenem i
          // wyścig widoczny w przeglądarce znika z testu.
          await new Promise((gotowe) => setTimeout(gotowe, 20));
          return {
            ok: true,
            json: async () => ({
              token: `token-${cel}`,
              refreshToken: 'r',
              organization: NOWA,
            }),
          } as any;
        }
        return { ok: false, json: async () => ({}) } as any;
      })
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    appState.currentUser.role = 'ADMIN';
    appState.currentOrganization = { id: 'org-1', name: 'Acme' };
    stanTokenu.wartosc = 'token-org-1';
    createOrganization.mockResolvedValue(NOWA);
    // Kontekst aplikacji ma realnie iść za tokenem — inaczej test mierzyłby
    // tylko atrapę, a nie to, co zobaczy użytkownik.
    appState.setCurrentOrganization.mockImplementation((org: any) => {
      appState.currentOrganization = org;
    });
  });

  it('po utworzeniu lista zawiera NOWĄ organizację i to ona jest bieżąca', async () => {
    mockTransportStanowy();
    renderLayout();
    await openOrganizationSwitcher();

    // PRZED: tylko stara organizacja, ona jest bieżąca.
    expect(screen.queryAllByTestId(`user-menu-org-${NOWA.id}`)).toHaveLength(0);

    fireEvent.click(await screen.findByTestId('user-menu-create-organization'));
    const modal = await screen.findByTestId('create-organization-modal');
    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: NOWA.name },
    });
    fireEvent.click(
      Array.from(modal.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Create Organization'
      ) as HTMLElement
    );

    // PO: nowa organizacja JEST na liście...
    const nowyWiersz = await screen.findByTestId(`user-menu-org-${NOWA.id}`);
    expect(nowyWiersz.textContent).toContain(NOWA.name);
    // ...i to ona jest oznaczona jako bieżąca (ptaszek = `aria-current`).
    expect(nowyWiersz.getAttribute('aria-current')).toBe('true');
    // Stara przestaje być bieżąca — nie dwa ptaszki.
    await waitFor(() =>
      expect(screen.getByTestId('user-menu-org-org-1').getAttribute('aria-current')).toBeNull()
    );
  });
});
