/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 04_ASSESSMENT DEC-397] Ocena → Raporty → wiersz → podgląd →
 * „Otwórz" ma pokazać RAPORT OCENY, nigdy pustego Kreatora raportów.
 *
 * ★ ZMIERZONE 06.09 (stanowisko lokalne, realny serwer na :4100, zrzuty
 * `evidence/ocena-otworz/03-…` i `04-…`): wiersz „DRD Manufacturing —
 * Executive Summary & Deep Analysis (C-suite)" z plakietką „Zatwierdzone"
 * i postępem 100 % otwierał `/reports/builder/report-drd-test-exec`, gdzie
 * ekran mówił „Zacznij budować raport" — zero bloków (`GET /api/report-builder/
 * report-drd-test-exec` nie ma w ogóle pola `sections`). Ta sama ocena pod
 * `/assessment/outputs/ocena~assess-drd-manufacturing-01/report` rysuje
 * cztery rozdziały, macierz DRD dla 7 osi / 39 obszarów i przepisaną treść
 * raportu (17 pozycji) — zrzut `05-…`.
 *
 * ★ CO TEN TEST BRONI (a nie: co go przypadkiem uruchamia). Broni CELU
 * NAWIGACJI ścieżki właściciela — dlatego klika realny wiersz i realny
 * przycisk „Otwórz" w podglądzie, a nie woła funkcji pomocniczej. Mutacja
 * kontrolna: przywrócenie w `handleOpenDocument` gałęzi
 * `navigate('/reports/builder/…')` dla raportu z oceną źródłową → ten test
 * jest CZERWONY (asercja na pathname), bo sama funkcja
 * `trasaOtwarciaRaportuOceny` mogłaby zostać w repo bez ani jednego wołacza
 * („biblioteka bez wywołania").
 *
 * Drugi przypadek pilnuje, żeby naprawa nie przejęła dokumentów, które
 * NAPRAWDĘ są w kreatorze: raport bez oceny źródłowej dalej idzie do
 * `/reports/builder/:id`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, listMethodSessionsMock, navigateMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
  listMethodSessionsMock: vi.fn(),
  navigateMock: vi.fn(),
}));

// Ten sam wzorzec, co w istniejacych testach tego huba
// (`AssessmentHub.method-core-cutover.test.tsx`,
// `AssessmentHub.rate-limit-resilience.test.tsx`): cel nawigacji czytamy
// z argumentu `navigate`, bo to JEDYNY szew, na ktorym da sie odroznic
// „trasa raportu" od „trasa kreatora" bez montowania calego drzewa tras.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));
vi.mock('../../../src/method-core/api/methodCoreApi', () => ({
  listSessions: listMethodSessionsMock,
}));
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
  FeatureFlagsProvider: ({ children }: any) => children,
}));
vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => <div data-testid="assessment-library-tab">Library stub</div>,
  METHODOLOGY_CATALOG: [],
}));
vi.mock('../../../src/components/Initiatives/InitiativeCompactPanel', () => ({
  InitiativeCompactPanel: () => null,
}));
vi.mock('../../../src/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => null,
}));
vi.mock('../../../src/components/MyWork/DecisionDetailView', () => ({
  DecisionDetailView: () => null,
}));
vi.mock('../../../src/components/MyWork/TaskDetailView', () => ({ TaskDetailView: () => null }));
vi.mock('../../../src/components/assessment/ImportedReportDetailView', () => ({
  ImportedReportDetailView: () => null,
}));
vi.mock('../../../src/components/assessment/InitiativesGenerationWizardModal', () => ({
  InitiativesGenerationWizardModal: () => null,
}));
vi.mock('../../../src/components/assessment/modals/NewAssessmentReportModal', () => ({
  NewAssessmentReportModal: () => null,
}));
vi.mock('../../../src/components/assessment/NewAssessmentModal', () => ({
  NewAssessmentModal: () => null,
}));

import { AssessmentHub } from '../../../src/components/assessment/AssessmentHub';

/** Ocena z magazynu ZASTANEGO — typ DRD, czyli dokładnie ten przypadek,
 * którego `assessments` w hubie nie pokazuje (kanonem listy jest jądro),
 * a który mimo to musi dostać przestrzeń `ocena~`. */
const OCENA_DRD_ZASTANA = {
  id: 'asm_drd_1',
  name: 'DRD — Testowy (Manufacturing)',
  type: 'DRD',
  status: 'APPROVED',
  updatedAt: '2026-09-02T08:00:00.000Z',
};

const RAPORTY = [
  {
    id: 'rep-1',
    name: 'DRD Manufacturing — Executive Summary',
    status: 'APPROVED',
    assessmentId: 'asm_drd_1',
    assessmentName: 'DRD — Testowy (Manufacturing)',
    assessmentType: 'DRD',
    builderReportId: 'rep-1',
    updatedAt: '2026-09-03T08:00:00.000Z',
  },
  {
    id: 'rep-2',
    name: 'Raport bez oceny zrodlowej',
    status: 'DRAFT',
    assessmentId: null,
    assessmentName: null,
    builderReportId: 'rep-2',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
];

function pokazHub() {
  return render(
    <MemoryRouter initialEntries={['/assessment?tab=reports']}>
      <AssessmentHub initialTab="reports" />
    </MemoryRouter>
  );
}

/** Ostatnia trasa, o ktora poproszono router — bez zgadywania z DOM-u. */
function ostatniaTrasa(): string {
  const wywolania = navigateMock.mock.calls.filter((c) => typeof c[0] === 'string');
  if (wywolania.length === 0) throw new Error('„Otworz" nie poprosil o zadna trase');
  return String(wywolania[wywolania.length - 1][0]);
}

async function otworzZPodgladu(nazwaRaportu: string) {
  const uzytkownik = userEvent.setup();
  const komorka = await screen.findByText(nazwaRaportu);
  const wiersz = komorka.closest('tr');
  if (!wiersz) throw new Error(`Brak wiersza dla raportu: ${nazwaRaportu}`);
  await uzytkownik.click(wiersz);
  const otworz = await screen.findByRole('button', { name: /^(Otwórz|Open)$/i });
  await uzytkownik.click(otworz);
}

describe('[DEC-397] Ocena → Raporty → „Otwórz" — cel nawigacji', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    apiMock.listAssessments.mockResolvedValue({ items: [OCENA_DRD_ZASTANA] });
    apiMock.getAssessmentReports.mockResolvedValue(RAPORTY);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
    listMethodSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
  });

  it('raport z oceną źródłową otwiera RAPORT OCENY, nie Kreator raportów', async () => {
    pokazHub();
    // Zbiór id magazynu zastanego musi być już wczytany — bez tego „Otwórz"
    // wybrałoby identyfikator surowy (poprawny, ale to nie ta asercja).
    await waitFor(() => expect(apiMock.listAssessments).toHaveBeenCalled());
    await otworzZPodgladu('DRD Manufacturing — Executive Summary');

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(ostatniaTrasa()).toBe('/assessment/outputs/ocena~asm_drd_1/report');
    // Mutacja kontrolna celuje dokladnie tutaj: powrot do galezi kreatora
    // daje '/reports/builder/rep-1' i ta asercja jest CZERWONA.
    expect(ostatniaTrasa()).not.toMatch(/^\/reports\/builder\//);
  });

  it('raport BEZ oceny źródłowej dalej idzie do Kreatora raportów', async () => {
    pokazHub();
    await waitFor(() => expect(apiMock.listAssessments).toHaveBeenCalled());
    await otworzZPodgladu('Raport bez oceny zrodlowej');

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(ostatniaTrasa()).toBe('/reports/builder/rep-2');
  });
});
