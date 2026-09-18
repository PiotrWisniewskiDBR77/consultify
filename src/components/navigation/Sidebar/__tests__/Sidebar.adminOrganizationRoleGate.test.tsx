/**
 * @vitest-environment jsdom
 *
 * K-18 (zgłoszenia testerów 57/58, TRIAGE 16.09: „I see Admin Panel /
 * Organization at the bottom of the menu", severity CRITICAL ×2, eskalacja
 * SLA). Triaż zmierzył rolę zgłaszającej = ADMIN i orzekł „nie defekt — konto
 * testowe": dla ADMIN-a te pozycje MAJĄ być widoczne. Bramka istnieje jako
 * JEDNA ścieżka renderu: `Sidebar.tsx` (stopka) renderuje `organizationMenuItem`
 * i `adminMenuItem` wyłącznie przy `isAdminOwnerOrSuperAdminRole(currentUser?.role)`
 * (`src/utils/roleGuards.ts` = ADMIN/OWNER/SUPERADMIN).
 *
 * Ten plik ZAMRAŻA tę bramkę na REALNYM `<Sidebar>` (pełny render, nie lustro
 * logiki), bo przed nim zero testów dotykało ról w stopce — nieudokumentowana
 * bramka odrasta. Macierz:
 *   - role poza bramką (MEMBER / CONSULTANT / VIEWER→GUEST) → BRAK „Admin"
 *     i „Organization" w stopce, ale „Settings" zostaje (stopka żyje);
 *   - role w bramce (ADMIN / OWNER / SUPERADMIN) → obie pozycje OBECNE.
 * Mutacja: zdjęcie warunku `isAdminOwnerOrSuperAdminRole(...) &&` z obu linii
 * stopki → testy „poza bramką" RED.
 *
 * Etykiety: mock i18n zwraca produkcyjne wartości EN
 * (`sidebar.adminPanel` = „Admin", `sidebar.organization` = „Organization"),
 * więc asercje czytają się jak zrzut z produktu.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let currentRole = 'MEMBER';

vi.mock('framer-motion', () => {
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      layout: _layout,
      layoutId: _layoutId,
      whileTap: _whileTap,
      whileHover: _whileHover,
      whileFocus: _whileFocus,
      whileDrag: _whileDrag,
      variants: _variants,
      drag: _drag,
      dragConstraints: _dragConstraints,
      ...rest
    } = props;
    return rest;
  };

  const motion = new Proxy(
    {},
    {
      get:
        (_target: unknown, tag: string) =>
        ({
          children,
          ...props
        }: Record<string, unknown> & { children?: React.ReactNode }) =>
          React.createElement(tag, stripMotionProps(props), children as React.ReactNode),
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: string) => {
      if (key === 'sidebar.adminPanel') return 'Admin';
      if (key === 'sidebar.organization') return 'Organization';
      if (key === 'sidebar.settings') return 'Settings';
      return def ?? key;
    },
  }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isTablet: false, isMobile: false, isTouchDevice: false }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({
    setDisplayMode: vi.fn(),
    setWorkspaceContext: vi.fn(),
    activeConversationId: null,
    isSidebarOpen: false,
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: { getPersonalTasks: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentView: 'AI_CHAT',
      setCurrentView: vi.fn(),
      navigateWithChatContext: vi.fn(),
      returnToFullChat: vi.fn(),
      logout: vi.fn(),
      isSidebarOpen: true,
      setIsSidebarOpen: vi.fn(),
      currentUser: { id: 'user-1', role: currentRole },
      freeSessionData: {},
      fullSessionData: {},
      theme: 'light',
      isSidebarCollapsed: false,
      toggleSidebarCollapse: vi.fn(),
      currentProjectId: null,
    }),
}));

import { Sidebar } from '../Sidebar';

afterEach(() => {
  vi.clearAllMocks();
});

describe('K-18 role gate on the sidebar footer (Admin / Organization)', () => {
  it.each(['MEMBER', 'CONSULTANT', 'VIEWER'])(
    'role %s outside the gate sees neither Admin nor Organization in the footer',
    (role) => {
      currentRole = role;
      render(<Sidebar />);

      expect(screen.queryByText('Admin')).toBeNull();
      expect(screen.queryByText('Organization')).toBeNull();
      // Stopka żyje — znika tylko to, co bramka roli chroni.
      expect(screen.queryByText('Settings')).not.toBeNull();
    }
  );

  it.each(['ADMIN', 'OWNER', 'SUPERADMIN'])(
    'role %s inside the gate sees both Admin and Organization in the footer',
    (role) => {
      currentRole = role;
      render(<Sidebar />);

      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Organization')).toBeInTheDocument();
    }
  );
});
