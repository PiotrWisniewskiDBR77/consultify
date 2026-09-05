/**
 * @vitest-environment jsdom
 *
 * SESJA SIRI OTWIERA SIĘ NA PRACY, NIE NA ŚCIANIE KAFLI (2026-09-05).
 *
 * Zmierzone na żywo (`evidence/odbior-zywo-20260905/05-ocena/wyniki.json`):
 * otwarcie jedynej sesji SIRI pokazywało stronę „V8 SHARED WORKBENCH"
 * z kaflami „Punkty kontrolne workbencha", a wszystko poniżej — łącznie
 * z panelem „Zarządzanie" — miało zmierzone `top` równe DOKŁADNIE wysokości
 * okna i nie dawało się doscrollować. Cztery zgłoszenia, jedna przyczyna:
 * lane governance renderował się zawsze dla metodyk innych niż DRD.
 *
 * DOWÓD MUTACYJNY: przywróć w `AssessmentSessionEditorView` warunek
 * `framework !== 'drd' || showGovernance` → oba testy poniżej stają się
 * czerwone (kafle są na ekranie od pierwszej klatki).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * ★ SESJA MA SIĘ NAPRAWDĘ WYRENDEROWAĆ. Pierwsza wersja tego pliku miała
 * `getAssessment: vi.fn()` (jak sąsiedni test DRD, gdzie ekran w ogóle nie
 * dochodzi do tej ścieżki) i ekran stał na „Loading assessment…". Test „nie ma
 * ściany kafli" przechodził wtedy dlatego, że NIC nie było na ekranie — to jest
 * dokładnie kształt „zamknięte przez wygaszenie". Dlatego mock zwraca realną
 * odpowiedź, a drugi test dowodzi, że sesja się otworzyła (przełącznik
 * „Governance" jest widoczny i działa w obie strony).
 */
const { getAssessmentMock, updateAssessmentMock, useAssessmentPermissionsMock } = vi.hoisted(() => ({
  getAssessmentMock: vi.fn().mockResolvedValue({
    assessment: {
      id: 'siri-session-1',
      name: 'SIRI — sesja odbiorowa',
      status: 'DRAFT',
      assessmentType: 'siri',
      completionPercent: 10,
      answers: { siri: {} },
    },
  }),
  updateAssessmentMock: vi.fn().mockResolvedValue({}),
  useAssessmentPermissionsMock: vi.fn(() => ({
    role: 'owner',
    permissions: { canView: true, canEdit: true, canApprove: true, canManage: true },
    isLoading: false,
    requestAccess: vi.fn(),
    refreshPermissions: vi.fn(),
  })),
}));

/**
 * ★ `getFixedT` — bez tego test mierzy PUSTY EKRAN, nie ekran sesji.
 * Globalny mock `react-i18next` w `tests/setup.ts` nie ma `getFixedT`, a jeden
 * z komponentów sesji SIRI po niego sięga; wyjątek wywalał całe drzewo Reacta
 * i `document.body` zostawał pusty. Test „nie ma ściany kafli" przechodził
 * wtedy, bo NIE BYŁO NICZEGO — to samo w sobie jest pułapką, przed którą
 * ostrzega nagłówek tego pliku, więc mock jest tu uzupełniany, a nie omijany.
 */
vi.mock('react-i18next', async () => {
  const t = (key: string, fallbackOrOptions?: unknown) =>
    typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
  const i18n = {
    language: 'pl',
    changeLanguage: vi.fn(),
    getFixedT: () => t,
    getResourceBundle: vi.fn(() => ({})),
    hasResourceBundle: vi.fn(() => false),
    addResourceBundle: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  return {
    useTranslation: () => ({ t, i18n, ready: true }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Translation: ({ children }: any) => children({ t, i18n }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ framework: 'siri', assessmentId: 'siri-session-1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getConversation: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: {
    getAssessment: getAssessmentMock,
    updateAssessment: updateAssessmentMock,
    getWorkbench: vi.fn(),
    getWorkbenchPromotionPayload: vi.fn(),
    getUserState: vi.fn(),
    updateUserState: vi.fn(),
    listAssignments: vi.fn(),
    upsertAssignment: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      currentUser: { id: 'owner-1', role: 'owner' },
      isChatCollapsed: true,
      toggleChatCollapse: vi.fn(),
      setCurrentViewState: vi.fn(),
      currentProjectId: 'project-1',
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      createConversation: vi.fn(),
      activeConversationId: null,
      setActiveConversation: vi.fn(),
      setWorkspaceContext: vi.fn(),
      addMessage: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/components/assessment/drd/DrdMethodWorkspaceScreen', () => ({
  DrdMethodWorkspaceScreen: ({ demoSessionId }: { demoSessionId: string }) => (
    <div data-testid="canonical-drd-workspace">{demoSessionId}</div>
  ),
}));

vi.mock('@/components/assessment/permissions', () => ({
  RequestAccessModal: () => null,
  useAssessmentPermissions: useAssessmentPermissionsMock,
}));

import { fireEvent, screen as ekran } from '@testing-library/react';

import { AssessmentSessionEditorView } from '../../../src/views/AssessmentSessionEditorView';

const NAPIS_KAFLI = /Ta sesja dziala w modelu wspolnego workbencha/i;

describe('AssessmentSessionEditorView — sesja SIRI: lane governance jest wtórny', () => {
  it('po otwarciu sesji NIE ma ściany kafli „shared workbench"', async () => {
    render(<AssessmentSessionEditorView />);
    // Najpierw dowód, że sesja NAPRAWDĘ się otworzyła — inaczej „nie ma
    // kafli" znaczyłoby tylko „nie ma niczego".
    await ekran.findByRole('button', { name: 'Governance' });
    expect(ekran.queryByText(NAPIS_KAFLI)).not.toBeInTheDocument();
    expect(ekran.queryByText(/Punkty kontrolne workbencha/i)).not.toBeInTheDocument();
  });

  it('lane governance jest osiągalny — przełącznik „Governance" go pokazuje i chowa', async () => {
    render(<AssessmentSessionEditorView />);
    const przelacznik = await ekran.findByRole('button', { name: 'Governance' });
    expect(przelacznik).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(przelacznik);
    expect(ekran.getByText(NAPIS_KAFLI)).toBeInTheDocument();
    expect(przelacznik).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(przelacznik);
    expect(ekran.queryByText(NAPIS_KAFLI)).not.toBeInTheDocument();
  });
});
