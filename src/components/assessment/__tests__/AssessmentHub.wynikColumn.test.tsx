/**
 * @vitest-environment jsdom
 *
 * QC0 / K-22 — DEC-661 (Wpis 155, wariant b): kolumna „Wynik" WRACA do listy
 * Ocen jako skalar `overall_score` z legacy `assessments`, z UCZCIWĄ etykietą
 * źródła w nagłówku („legacy score; DRD canon reports axes").
 *
 * Dlaczego z etykietą źródła: Method Core NIE ma kanonicznego rollupu osie→
 * overall (agregator DRD zwraca per-oś `byGroup`/`byGroupNorm`, nigdy jeden
 * skalar — `drdAdapter.aggregate`), a wartość pochodzi z bliźniaka legacy
 * dołączonego po `project_id` w `methodSessionToAssessment`. DEC-661 świadomie
 * uchyla DEC-513 TYLKO dla tej jednej kolumny i nakazuje nosić źródło w
 * nagłówku, żeby lista nie udawała kanonicznego wyniku.
 *
 * Test renderuje REALNY `<AssessmentHub initialTab="list">` z REALNYM
 * `StandardTable` (nie atrapą) i asertuje ARGUMENT/wyjście realnego komponentu:
 *  (A) nagłówek kolumny (rola `columnheader`) niesie etykietę źródła — to cel
 *      mutacyjny DEC-661 („podmiana/usunięcie etykiety źródła → RED");
 *  (B) wiersz z bliźniakiem legacy renderuje jego `overall_score`.
 * ZERO zmian w Method Core (lista czyta `method_sessions` + bliźniaka, jak przedtem).
 */

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _k,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(() => 'toast-1'),
      dismiss: vi.fn(),
    }),
  };
});

const { apiMocks, methodCoreMocks, appStoreState, conversationStoreState } = vi.hoisted(() => ({
  apiMocks: {
    getUsers: vi.fn(async () => []),
    listAssessments: vi.fn(async () => ({ items: [] })),
    getAssessmentReports: vi.fn(async () => ({ reports: [] })),
    listReportImports: vi.fn(async () => ({ imports: [] })),
    get: vi.fn(async () => ({ data: [] })),
    delete: vi.fn(async () => ({ success: true })),
  },
  methodCoreMocks: {
    listSessions: vi.fn(async () => ({ sessions: [], total: 0 })),
    deleteSession: vi.fn(async () => ({ deleted: true as const, id: 'sess-1' })),
  },
  appStoreState: {
    currentProjectId: 'proj-1',
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
  },
  conversationStoreState: {
    createConversation: vi.fn(),
    activeConversationId: null,
    setActiveConversation: vi.fn(),
    setWorkspaceContext: vi.fn(),
    addMessage: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));
vi.mock('@/method-core/api/methodCoreApi', () => methodCoreMocks);

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof appStoreState) => unknown) =>
    typeof selector === 'function' ? selector(appStoreState) : appStoreState,
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: (s: typeof conversationStoreState) => unknown) =>
    typeof selector === 'function' ? selector(conversationStoreState) : conversationStoreState,
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('../AssessmentMenu3ActionBar', () => ({
  AssessmentMenu3ActionBar: () => <div data-testid="assessment-hub-menu3" />,
}));

import { AssessmentHub } from '../AssessmentHub';

/** Źródłowa etykieta z DEC-661 — MUSI być nazwana, żeby mutacja mogła ją zepsuć. */
const SOURCE_LABEL = /legacy score; DRD canon reports axes/;

const SESS_WITH_TWIN = {
  id: 'sess-twin',
  organizationId: 'org-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: 'v1',
  state: 'frozen',
  mode: 'guided_manual',
  ownerUserId: 'user-1',
  domainStage: null,
  projectId: 'proj-twin',
  name: 'Northwind 2027 — Operational Maturity',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const SESS_NO_TWIN = {
  id: 'sess-notwin',
  organizationId: 'org-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: 'v1',
  state: 'draft',
  mode: 'guided_manual',
  ownerUserId: 'user-1',
  domainStage: null,
  projectId: 'proj-other',
  name: 'Canonical DRD without a legacy twin',
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
};

/** Legacy bliźniak DRD — jedyne źródło `overall_score` (DEC-661 wariant b). */
const LEGACY_TWIN = {
  id: 'legacy-twin',
  name: 'Northwind 2027 legacy',
  type: 'DRD',
  projectId: 'proj-twin',
  overall_score: 4.2,
  status: 'APPROVED',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

function renderHub() {
  return render(
    <MemoryRouter>
      <AssessmentHub initialTab={'list' as any} />
    </MemoryRouter>
  );
}

describe('QC0 / K-22 — DEC-661: kolumna „Wynik" z etykietą źródła (wariant b)', () => {
  beforeEach(() => {
    methodCoreMocks.listSessions.mockResolvedValue({
      sessions: [SESS_WITH_TWIN, SESS_NO_TWIN] as any,
      total: 2,
    });
    apiMocks.listAssessments.mockResolvedValue({ items: [LEGACY_TWIN] } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(A) nagłówek kolumny „Wynik" niesie etykietę źródła DEC-661 (cel mutacyjny)', async () => {
    renderHub();

    // Czekamy na realny nagłówek tabeli (rola `columnheader` = `<th>`).
    const headers = await screen.findAllByRole('columnheader');
    const scoreHeader = headers.find((th) => SOURCE_LABEL.test(th.textContent || ''));

    // ★ SEDNO DEC-661: źródło („legacy score; DRD canon reports axes") jest
    //   W NAGŁÓWKU kolumny. Usunięcie/podmiana etykiety w `AssessmentHub.tsx`
    //   (klucz `assessment.hub.table.scoreWithSource`) → ten assert RED.
    expect(
      scoreHeader,
      'score column header must carry the DEC-661 source label'
    ).toBeTruthy();
    // Etykieta źródła dopełnia nazwę kolumny, nie zastępuje jej.
    expect((scoreHeader as HTMLElement).textContent).toMatch(/Score/);
  });

  it('(B) wiersz z bliźniakiem legacy renderuje jego overall_score', async () => {
    renderHub();

    // Nagłówek musi istnieć (kolumna wpięta), a wartość bliźniaka (4.2) trafić
    // do komórki przez domyślny renderer FilterableTable.
    await screen.findAllByRole('columnheader');
    const cells = await screen.findAllByText('4.2');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('(C) wysłane tłumaczenia EN+PL niosą etykietę źródła (guard na produkcję, nie tylko default z t())', () => {
    const read = (lang: 'en' | 'pl') =>
      JSON.parse(
        readFileSync(resolve(process.cwd(), `public/locales/${lang}/translation.json`), 'utf8')
      ) as Record<string, any>;

    const enLabel = read('en')?.assessment?.hub?.table?.scoreWithSource;
    const plLabel = read('pl')?.assessment?.hub?.table?.scoreWithSource;

    // EN = dokładna fraza źródłowa z DEC-661; PL = jej para (usun/podmień w
    // translation.json → RED, niezależnie od defaultu w `AssessmentHub.tsx`).
    expect(typeof enLabel).toBe('string');
    expect(enLabel).toMatch(SOURCE_LABEL);
    expect(typeof plLabel).toBe('string');
    expect(plLabel).toMatch(/kanon DRD raportuje osie/);
  });
});
