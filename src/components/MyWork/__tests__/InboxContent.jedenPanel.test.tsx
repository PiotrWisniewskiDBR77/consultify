/**
 * @vitest-environment jsdom
 *
 * P1 DEC-397 (docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md)
 * — Skrzynka: naprawa zamieniła bespoke `<aside data-preview-pane>` (StandardPreview
 * poza kanonicznym wzorcem, bez zakładki Teresa, bez lepkiego zamknięcia) na
 * `JedenPrawyPanel` (rodzina B, wzorzec z `ExecutionHub.tsx`).
 *
 * ZLECENIE 1.2 T1: dokładnie jeden `[data-right-panel]` przy zaznaczonym
 * wierszu i otwartej Teresie.
 * ZLECENIE 1.2 T2: X jest lepki — klik w inny wiersz po zamknięciu NIE
 * otwiera panelu ponownie.
 *
 * `InboxContent.photo002.contract.test.ts` notes InboxContent "pulls in the
 * full My Work provider stack" and sticks to source-contract checks — but
 * `InboxContent` itself only needs `Api`/`V8MyWorkApi`/`useAppStore` mocked
 * (grep of its imports confirms no other context/hook dependency), so a real
 * mount is tractable with the same mock shape `InterviewHub.smoke.test.tsx`
 * already uses successfully for its own API layer.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


// `vi.hoisted`: `vi.mock('@/i18n', …)` below is hoisted above normal
// top-level `const`s by vitest, so `tEn` must be created inside a hoisted
// block too (bit InboxContent.jedenPanel picked up from a first failed run:
// "Cannot access 'tEn' before initialization").
const { tEn } = vi.hoisted(() => {
  const resolveEnKey = (key: string): string | undefined => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        require('../../../../public/locales/en/translation.json') as unknown
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
  return { tEn };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en', getFixedT: () => tEn, t: tEn },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/i18n', () => ({ default: { t: tEn, language: 'en' } }));

vi.mock('@/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <textarea aria-label="Teresa composer" />,
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { top: 0, bottom: 0 } }),
}));

const { getCanonicalInboxTable, getCanonicalInboxStats, materializeCanonicalInbox, appStoreState } =
  vi.hoisted(() => ({
    getCanonicalInboxTable: vi.fn(),
    getCanonicalInboxStats: vi.fn(async () => null),
    materializeCanonicalInbox: vi.fn(async () => ({})),
    appStoreState: {
      isChatCollapsed: true,
      currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@e.com' },
      currentOrganization: { id: 'org-1', name: 'Acme' },
    },
  }));

const toggleChatCollapse = vi.fn(() => {
  appStoreState.isChatCollapsed = !appStoreState.isChatCollapsed;
});

vi.mock('@/services/api', () => ({
  Api: {
    shouldFallbackToLegacyMyWorkInbox: () => false,
    inboxGetTable: vi.fn(async () => ({ items: [] })),
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    materializeInbox: vi.fn(async () => null),
  },
}));

vi.mock('@/services/api/v8/my-work', () => ({
  V8MyWorkApi: {
    getCanonicalInboxTable,
    getCanonicalInboxStats,
    materializeCanonicalInbox,
    triageCanonicalInboxItem: vi.fn(async () => ({})),
    bulkTriageCanonicalInbox: vi.fn(async () => ({})),
    aiAssistInboxItem: vi.fn(async () => ({ result: null })),
  },
}));

// Ten sam powód co w InterviewHub.jedenPanel.test.tsx: `useJedenPanel`
// wewnątrz `JedenPrawyPanel` woła `useAppStore(selector)` — mock musi
// wspierać ZARÓWNO wywołanie bez selektora (`useAppStore()`, jak w
// `InboxContent.tsx:1337/2181`), jak i z selektorem.
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const store = {
      currentUser: appStoreState.currentUser,
      currentOrganization: appStoreState.currentOrganization,
      emitMyWorkEvent: vi.fn(),
      isChatCollapsed: appStoreState.isChatCollapsed,
      toggleChatCollapse,
    };
    return typeof selector === 'function' ? selector(store) : store;
  },
}));

import { resetJedenPanelForTests } from '@/components/shared/PreviewPane/useJedenPanel';

import { InboxContent } from '../InboxContent';

const canonicalItem = (id: string, title: string) => ({
  id,
  itemType: 'task' as const,
  section: 'assigned_tasks',
  title,
  description: 'Opis pozycji skrzynki.',
  sourceEntityType: 'task',
  sourceEntityId: id,
  createdAt: '2026-09-01T10:00:00.000Z',
  priority: 'medium',
  status: 'pending',
  userId: 'user-1',
  organizationId: 'org-1',
});

const renderInbox = () =>
  render(
    <MemoryRouter initialEntries={['/my-work']}>
      <InboxContent searchQuery="" onCountsChange={() => undefined} />
    </MemoryRouter>
  );

beforeEach(() => {
  getCanonicalInboxTable.mockReset();
  getCanonicalInboxTable.mockResolvedValue({
    items: [canonicalItem('ci-1', 'Pierwsza pozycja skrzynki'), canonicalItem('ci-2', 'Druga pozycja skrzynki')],
  });
  getCanonicalInboxStats.mockReset();
  getCanonicalInboxStats.mockResolvedValue(null);
  materializeCanonicalInbox.mockReset();
  materializeCanonicalInbox.mockResolvedValue({});
  appStoreState.isChatCollapsed = true;
  toggleChatCollapse.mockClear();
  resetJedenPanelForTests();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InboxContent — jeden prawy panel (P1 DEC-397)', () => {
  /*
   * ★ DEC-404 (06.09.2026) — PRZEPISANE. Do 06.09 ten przypadek klikał
   * zakładkę „Teresa" w panelu podglądu i sprawdzał, że czat pokazuje się
   * W ŚRODKU tej kolumny. Właściciel odrzucił ten kształt („tu nie jest jej
   * miejsce"). Teraz mierzymy kontrakt DEC-404: panel podglądu = TYLKO rekord,
   * bez rzędu zakładek i bez czatu.
   */
  it('T1: panel podglądu = tylko rekord, bez zakładek i bez Teresy (MUTACJA: przywróć zakładkę → RED)', async () => {
    const { container } = renderInbox();

    const row = await screen.findByText('Pierwsza pozycja skrzynki');
    fireEvent.click(row);

    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    const panel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(within(panel).queryAllByRole('tab')).toHaveLength(0);
    expect(within(panel).queryByLabelText('Teresa composer')).toBeNull();
  });

  it('T2 DEC-397b (nadpisuje DEC-397): klik w inny wiersz po zamknięciu PONOWNIE otwiera panel z tym wierszem (MUTACJA: usuń `jedenPanel.otworz()` w `preview()` → RED)', async () => {
    const { container } = renderInbox();

    const row1 = await screen.findByText('Pierwsza pozycja skrzynki');
    fireEvent.click(row1);
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

    // ★ DEC-397b (właściciel, 06.09.2026 15:47): „preview (…) działa przy
    // pojedynczym kliknięciu na linię" — klik w drugi wiersz MA otworzyć
    // podgląd tego wiersza, mimo że panel był wcześniej świadomie zamknięty.
    const row2 = await screen.findByText('Druga pozycja skrzynki');
    fireEvent.click(row2);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });
    const panel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(within(panel).getAllByText('Druga pozycja skrzynki').length).toBeGreaterThan(0);
  });

  it('T4: markup korzenia panelu nie wprowadza klas spoza tokenów', async () => {
    const { container } = renderInbox();
    const row = await screen.findByText('Pierwsza pozycja skrzynki');
    fireEvent.click(row);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    // DEC-404: rzędu zakładek już nie ma — mierzymy sam korzeń panelu.
    const panel = container.querySelector('[data-right-panel]') as HTMLElement;
    expect(panel.getAttribute('class') ?? '').not.toMatch(/primary-|navy-|slate-/);
  });

  it('T4 (źródło): bespoke <aside data-preview-pane> nie istnieje już w InboxContent.tsx', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../InboxContent.tsx'), 'utf8');
    // Tylko wzmianka w komentarzu historycznym może zostać — sprawdzamy, że
    // atrybut nie występuje już jako JSX (poza treścią komentarza).
    const jsxOccurrences = source
      .split('\n')
      .filter((line) => line.includes('data-preview-pane') && !line.trim().startsWith('data-preview-pane>`'));
    expect(jsxOccurrences).toHaveLength(0);
    expect(source).toContain('JedenPrawyPanel');
  });
});
