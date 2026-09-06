/**
 * @vitest-environment jsdom
 *
 * P1 DEC-397 (docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md)
 * — Wywiad, zakładka „my_assignments" (tryb list): naprawa zamieniła bespoke
 * `<aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 …">` na
 * `JedenPrawyPanel` (rodzina B, ten sam wzorzec co `ExecutionHub.tsx`).
 *
 * ZLECENIE 1.2 T3: „to samo dla Wywiadu" — jeden korzeń `[data-right-panel]`
 * przy zaznaczonym wierszu i otwartej Teresie; X jest lepki (klik w inny
 * wiersz po zamknięciu NIE otwiera panelu ponownie).
 * ZLECENIE 1.2 T4: markup panelu nie zawiera klas spoza tokenów `c-*`
 * (żadnego `bg-slate-50`, `dark:bg-navy-950`, `primary-`, `navy-`, `slate-`).
 *
 * Scaffolding (mocki Api/V8InterviewApi/permissions/store/HelpContext)
 * skopiowany 1:1 z `InterviewHub.smoke.test.tsx` — realny, już działający
 * mount tej samej zakładki. Dokłada tylko to, czego smoke nie potrzebował:
 * `useAppStore` ze wsparciem selektora (używanego przez `useJedenPanel`
 * wewnątrz `JedenPrawyPanel`) i mock `UnifiedChatPanel`/`useDeviceType`
 * (ciężkie zależności czatu, mockowane tak samo jak w
 * `PreviewPane/__tests__/jedenPanel.contract.test.tsx`).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en', getFixedT: () => tEn },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
  };
});

vi.mock('@/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <textarea aria-label="Teresa composer" />,
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { top: 0, bottom: 0 } }),
}));

const {
  apiGet,
  apiPost,
  getSessions,
  listInsights,
  getProjects,
  createProject,
  setCurrentProjectId,
  setInterviewBreadcrumbs,
  getMyAssignments,
  getSession,
  appStoreState,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getSessions: vi.fn(),
  listInsights: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
  setCurrentProjectId: vi.fn(),
  setInterviewBreadcrumbs: vi.fn(),
  getMyAssignments: vi.fn(async () => ({ assignments: [] })),
  getSession: vi.fn(async () => null),
  appStoreState: {
    currentProjectId: 'proj-1' as string | null,
    isChatCollapsed: true,
  },
}));

const toggleChatCollapse = vi.fn(() => {
  appStoreState.isChatCollapsed = !appStoreState.isChatCollapsed;
});

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: apiPost,
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
    getProjects,
    createProject,
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    getSessions,
    getManagedSessions: vi.fn(async () => []),
    getMyAssignments,
    getManagedAssignments: vi.fn(async () => []),
    getOverdueAssignments: vi.fn(async () => []),
    listInsights,
    getSession,
    remindAssignment: vi.fn(async () => ({})),
    startAssignment: vi.fn(async () => ({})),
    approveAssignment: vi.fn(async () => ({})),
    sendBackAssignment: vi.fn(async () => ({})),
    createInsight: vi.fn(async () => ({})),
    deleteInsight: vi.fn(async () => ({})),
    exportInsight: vi.fn(async () => ({})),
  },
}));

vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewPermissions: () => ({
    canAssign: true,
    canViewManaged: true,
    canViewOverdue: true,
    canSendReminder: true,
    canViewInsights: true,
    canCreateInsights: true,
    canReviewInsights: true,
    canPublishInsights: true,
    canHandoffInsights: true,
    assignmentScope: 'all',
    projectMemberships: [],
    isLoading: false,
    canAssignToUser: () => true,
    getAssignableProjects: () => [],
  }),
}));

// Realny zustand wspiera DWA sposoby wywołania: `useAppStore()` (cały obiekt)
// i `useAppStore(selector)` (np. `useJedenPanel`: `useAppStore((s) => s.isChatCollapsed)`).
// `InterviewHub.smoke.test.tsx` mockuje tylko pierwszy — `useJedenPanel`
// wewnątrz `JedenPrawyPanel` potrzebuje drugiego, inaczej `toggleChatCollapse?.()`
// wywołuje CAŁY obiekt store jako funkcję i wyrzuca TypeError.
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const store = {
      currentProjectId: appStoreState.currentProjectId,
      setCurrentProjectId,
      currentOrganization: { id: 'org-1', name: 'Acme' },
      currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@e.com' },
      setInterviewBreadcrumbs,
      isChatCollapsed: appStoreState.isChatCollapsed,
      toggleChatCollapse,
    };
    return typeof selector === 'function' ? selector(store) : store;
  },
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

import { resetJedenPanelForTests } from '@/components/shared/PreviewPane/useJedenPanel';

import { InterviewHub } from '../InterviewHub';

const renderInbox = () =>
  render(
    <MemoryRouter initialEntries={['/interview?tab=my_assignments']}>
      <InterviewHub />
    </MemoryRouter>
  );

const assignment = (id: string, name: string, dueAt: string) => ({
  id,
  organizationId: 'org-1',
  projectId: 'proj-1',
  assigneeUserId: 'user-1',
  templateId: `lib-tpl-${id}`,
  templateVersion: 1,
  status: 'assigned',
  dueAt,
  priority: 'medium',
  isTeamAssignment: false,
  createdBy: 'user-1',
  createdAt: '2026-04-30T18:17:04.091Z',
  updatedAt: '2026-08-09T07:00:01.893Z',
  template: { id: `lib-tpl-${id}`, name, description: 'Opis szablonu.', category: 'digital' },
  assignee: { id: 'user-1', name: 'Test User', email: 't@e.com' },
});

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiGet.mockResolvedValue([]);
  apiPost.mockResolvedValue({});
  getSessions.mockReset();
  getSessions.mockResolvedValue({ sessions: [] });
  listInsights.mockReset();
  listInsights.mockResolvedValue({ insights: [] });
  getProjects.mockReset();
  getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Project One' }]);
  createProject.mockReset();
  setCurrentProjectId.mockReset();
  appStoreState.currentProjectId = 'proj-1';
  appStoreState.isChatCollapsed = true;
  toggleChatCollapse.mockClear();
  getMyAssignments.mockReset();
  getMyAssignments.mockResolvedValue({
    assignments: [
      assignment('ia-1', 'Pierwsze zadanie', '2026-09-20T23:59:59.000Z'),
      assignment('ia-2', 'Drugie zadanie', '2026-09-21T23:59:59.000Z'),
    ],
  });
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  setInterviewBreadcrumbs.mockReset();
  resetJedenPanelForTests();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InterviewHub — my_assignments (list): jeden prawy panel (P1 DEC-397)', () => {
  /*
   * ★ DEC-404 (06.09.2026) — PRZEPISANE. Do 06.09 przypadek klikał zakładkę
   * „Teresa" w kolumnie podglądu; właściciel odrzucił ten kształt. Teraz
   * mierzy kontrakt DEC-404: panel podglądu = TYLKO rekord.
   */
  it('T3: panel podglądu = tylko rekord, bez zakładek i bez Teresy (MUTACJA: przywróć zakładkę → RED)', async () => {
    const { container } = renderInbox();

    const rows = await screen.findAllByText('Pierwsze zadanie');
    fireEvent.click(rows[rows.length - 1]);

    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    const panel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(within(panel).queryAllByRole('tab')).toHaveLength(0);
    expect(within(panel).queryByLabelText('Teresa composer')).toBeNull();
    expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
  });

  it('T3b (DEC-397b, nadpisuje DEC-397): zamknij X → klik wiersza PONOWNIE otwiera panel (MUTACJA: usuń jedenPanel.otworz() w onRowClick → RED)', async () => {
    const { container } = renderInbox();

    const rows1 = await screen.findAllByText('Pierwsze zadanie');
    fireEvent.click(rows1[rows1.length - 1]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    const closeButton = within(
      container.querySelector('[data-right-panel]') as HTMLElement
    ).getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector('[data-right-panel]')).toBeNull();
    });

    const rows2 = await screen.findAllByText('Drugie zadanie');
    fireEvent.click(rows2[rows2.length - 1]);
    // DEC-397b (właściciel, 06.09.2026 15:47): klik wiersza jest realna zmiana
    // zaznaczenia — PONOWNIE otwiera panel, mimo wcześniejszego X. Nadpisuje
    // DEC-397 „zamknięcie zostaje lepkie na klik" (test do 06.09 sprawdzał
    // dokładnie odwrotność tego zachowania).
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });
    const reopenedPanel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(within(reopenedPanel).getByText('Drugie zadanie')).toBeInTheDocument();
  });

  it('T4: markup korzenia panelu nie wprowadza klas spoza tokenów', async () => {
    // Zakres 1:1 z `PreviewPane/__tests__/jedenPanel.contract.test.tsx` T7:
    // klasa WŁASNA korzenia `[data-right-panel]` — nie cała
    // poddrzewo (które niesie już zaakceptowany, istniejący kanon
    // `PreviewPaneShell`/`StandardPreview` z klasami typu `border-slate-200/70`,
    // spoza zakresu tego zlecenia). To, co TO zlecenie naprawiało, to bespoke
    // `<aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 …">`
    // — usunięty, sprawdzony niżej source-checkiem.
    const { container } = renderInbox();

    const rows = await screen.findAllByText('Pierwsze zadanie');
    fireEvent.click(rows[rows.length - 1]);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    // DEC-404: rzędu zakładek już nie ma.
    const panel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(panel.getAttribute('class') ?? '').not.toMatch(/primary-|navy-|slate-/);
  });

  it('T4 (źródło): bespoke <aside bg-slate-50 dark:bg-navy-950> nie istnieje już w InterviewHub.tsx', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../InterviewHub.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/bg-slate-50 dark:bg-navy-950/);
    expect(source).not.toMatch(/<aside className="w-\[400px\]/);
    expect(source).toContain('JedenPrawyPanel');
  });
});
