/**
 * @vitest-environment jsdom
 *
 * Z-55 (fala D3, 2026-09-14) — kebab „Delete" na liście Procesów.
 *
 * PREMISA ZMIERZONA na 08c1bb7a26, zanim ten plik powstał:
 * lista Procesów scala dwa źródła (`loadAssessmentListCore`,
 * AssessmentHub.tsx:718-722) — kanoniczne sesje z `method_sessions`
 * (`listSessions`, znacznik `source: 'method-core'`) i wiersze LEGACY z
 * `assessments`. Kebab „Delete" wołał BEZWARUNKOWO
 * `Api.delete('/assessment-workflow-v2/<id>')` (AssessmentHub.tsx:1543),
 * a ta trasa szuka wiersza w tabeli `assessments` po `id`. Dla wiersza
 * kanonicznego `id` to `method_sessions.id`, więc SELECT nie trafiał, trasa
 * zwracała 404 i kebab „nic nie robił". Potwierdzenie było natywnym
 * `window.confirm` — poza kanonem, niewidoczne na zrzucie, nietestowalne.
 *
 * Ten test broni PRZEWODU, nie tylko istnienia wołacza (rodzina „wołacz
 * istnieje ≠ podłączony"): sprawdza, że wiersz kanoniczny idzie na
 * `deleteSession` z method-core, wiersz legacy zostaje na starej trasie, oraz
 * że bez potwierdzenia w dialogu NIE leci żadne żądanie.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/**
 * StandardTable zastąpiony przyciskiem, który odpala DOKŁADNIE ten kontrakt
 * kebaba, który powłoka deklaruje (`rowMenu(row).destructive.onClick`) —
 * czyli realną ścieżkę `handleRowAction('delete', row)`, a nie ręcznie
 * wywołany handler. Gdyby powłoka przestała podawać `destructive`, przycisk
 * zniknie i test się wywali — o to chodzi.
 */
vi.mock('@/components/standard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/standard')>();
  return {
    ...actual,
    StandardTable: (props: any) => (
      <div data-testid="assessment-hub-standard-table">
        {(props.data ?? []).map((row: any) => {
          const menu = props.rowMenu?.(row);
          return (
            <button
              key={row.id}
              type="button"
              data-testid={`kebab-delete-${row.id}`}
              disabled={!menu?.destructive?.onClick}
              onClick={() => menu?.destructive?.onClick?.()}
            >
              {`Delete ${row.id}`}
            </button>
          );
        })}
      </div>
    ),
  };
});

vi.mock('../AssessmentMenu3ActionBar', () => ({
  AssessmentMenu3ActionBar: () => <div data-testid="assessment-hub-menu3" />,
}));

import { AssessmentHub } from '../AssessmentHub';

const CANONICAL_SESSION = {
  id: 'sess-canonical-1',
  organizationId: 'org-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: 'v1',
  state: 'draft',
  mode: 'guided_manual',
  ownerUserId: 'user-1',
  domainStage: null,
  projectId: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const LEGACY_ROW = {
  id: 'legacy-assessment-1',
  name: 'Legacy assessment',
  type: 'CMMI',
  status: 'DRAFT',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

function renderHub() {
  return render(
    <MemoryRouter>
      <AssessmentHub initialTab={'list' as any} />
    </MemoryRouter>
  );
}

/** Klika przycisk potwierdzenia WEWNĄTRZ kanonicznego dialogu (role="dialog"),
 *  nie byle „Delete" na ekranie. */
async function confirmInDialog() {
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/i }));
}

describe('Z-55 — AssessmentHub kebab Delete (lista Procesów)', () => {
  beforeEach(() => {
    methodCoreMocks.listSessions.mockResolvedValue({
      sessions: [CANONICAL_SESSION] as any,
      total: 1,
    });
    // `loadAssessmentListCore` czyta `.items` (nie `.assessments`) i sam
    // dokleja wierszom zastanym `source: 'legacy'`.
    apiMocks.listAssessments.mockResolvedValue({ items: [LEGACY_ROW] } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('wiersz KANONICZNY (method-core) idzie na DELETE /api/method/sessions/:id, nie na trasę legacy', async () => {
    renderHub();

    const kebab = await screen.findByTestId(`kebab-delete-${CANONICAL_SESSION.id}`);
    fireEvent.click(kebab);

    await confirmInDialog();

    await waitFor(() => {
      expect(methodCoreMocks.deleteSession).toHaveBeenCalledWith(CANONICAL_SESSION.id);
    });
    // ★ SEDNO Z-55: stara trasa nie może już dostać kanonicznego id — to
    // właśnie ona zwracała 404 i sprawiała, że kebab „nic nie robił".
    expect(apiMocks.delete).not.toHaveBeenCalledWith(
      `/assessment-workflow-v2/${CANONICAL_SESSION.id}`
    );
  });

  it('wiersz LEGACY zostaje na starej trasie (nie regresujemy działającej ścieżki)', async () => {
    renderHub();

    const kebab = await screen.findByTestId(`kebab-delete-${LEGACY_ROW.id}`);
    fireEvent.click(kebab);

    await confirmInDialog();

    await waitFor(() => {
      expect(apiMocks.delete).toHaveBeenCalledWith(`/assessment-workflow-v2/${LEGACY_ROW.id}`);
    });
    expect(methodCoreMocks.deleteSession).not.toHaveBeenCalled();
  });

  it('anulowanie w dialogu nie wysyła ŻADNEGO żądania usunięcia', async () => {
    renderHub();

    const kebab = await screen.findByTestId(`kebab-delete-${CANONICAL_SESSION.id}`);
    fireEvent.click(kebab);

    const dialog = await screen.findByRole('dialog');
    // Dialog ma DWA wyjścia o tej samej nazwie (krzyżyk aria-label + stopka).
    // Bierzemy ten ze stopki — ostatni w drzewie.
    const cancels = within(dialog).getAllByRole('button', { name: /^Cancel$/i });
    fireEvent.click(cancels[cancels.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(methodCoreMocks.deleteSession).not.toHaveBeenCalled();
    expect(apiMocks.delete).not.toHaveBeenCalled();
  });
});
