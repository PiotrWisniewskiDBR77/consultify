/**
 * @vitest-environment jsdom
 *
 * ODBIÓR NA ŻYWO 05.09, pakiet 05-ocena, RUNDA 3 — `assessment-reports-table`.
 *
 * Zmierzone na żywo
 * (`evidence/odbior-zywo-20260905/05-ocena/assessment-reports-table.png`):
 * zakładka „Raporty" miała kolumny TYP | NAZWA | STATUS | POSTĘP | AUTOR |
 * ZAKTUALIZOWANO, a obraz zatwierdzony
 * (`evidence/grafika/20-tabele-szerokosc/assessment-reports-table__PO__light.png`)
 * ma jeszcze KONTEKST — z KTÓREJ OCENY raport pochodzi („DBR77 · Digital
 * Readiness Di…" + podpis „Ocena"). Bez tej kolumny raporty z różnych ocen są
 * nierozróżnialne.
 *
 * Test pilnuje trzech rzeczy naraz: kolumna istnieje, bierze nazwę z payloadu
 * ORAZ z dopasowania po `assessmentId` (raporty sesji Method Core nie mają
 * wiersza w `assessments`, więc serwerowy JOIN zwraca NULL), a brak obu źródeł
 * daje myślnik — nie wymyśloną nazwę.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, listMethodSessionsMock } = vi.hoisted(() => ({
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
}));

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

const OCENA_SIRI = {
  id: 'asm_siri_1',
  name: 'SIRI — hala 2',
  type: 'SIRI',
  status: 'DRAFT',
  updatedAt: '2026-04-11T08:00:00.000Z',
};

const RAPORTY = [
  {
    id: 'rep-1',
    name: 'DBR77 — Raport diagnostyczny Q3 2026',
    status: 'FINAL',
    assessmentId: 'asm_x',
    // nazwa przyszła z serwerowego JOIN-a
    assessmentName: 'DBR77 · Digital Readiness Diagnosis',
    assessmentType: 'DRD',
    updatedAt: '2026-07-10T08:00:00.000Z',
  },
  {
    id: 'rep-2',
    name: 'Raport bez JOIN-a',
    status: 'DRAFT',
    // JOIN zwrócił NULL (sesja Method Core) — zostaje dopasowanie po id
    assessmentId: 'asm_siri_1',
    assessmentName: null,
    updatedAt: '2026-07-09T08:00:00.000Z',
  },
  {
    id: 'rep-3',
    name: 'Raport bez kontekstu',
    status: 'DRAFT',
    assessmentId: null,
    assessmentName: null,
    updatedAt: '2026-07-08T08:00:00.000Z',
  },
];

function naglowki(): string {
  return Array.from(document.querySelectorAll('th'))
    .map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
    .join(' | ');
}

/** Indeks kolumny KONTEKST — czytany z nagłówków, nie zgadywany. */
function indeksKontekstu(): number {
  const th = Array.from(document.querySelectorAll('th'));
  const i = th.findIndex((el) => /Kontekst|Context/i.test(el.textContent || ''));
  if (i < 0) throw new Error(`Brak kolumny KONTEKST. Nagłówki: ${naglowki()}`);
  return i;
}

/** Komórka KONTEKST danego wiersza — po indeksie kolumny, nie po treści. */
function komorkaKontekstu(tr: HTMLElement): HTMLElement {
  const td = tr.querySelectorAll('td')[indeksKontekstu()];
  if (!td) throw new Error('Wiersz nie ma komórki w kolumnie KONTEKST');
  return td as HTMLElement;
}

function wiersz(nazwaRaportu: string): HTMLElement {
  const komorka = screen.getByText(nazwaRaportu);
  const tr = komorka.closest('tr');
  if (!tr) throw new Error(`Brak wiersza dla raportu: ${nazwaRaportu}`);
  return tr as HTMLElement;
}

describe('05-ocena · assessment-reports-table — kolumna KONTEKST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    apiMock.listAssessments.mockResolvedValue({ items: [OCENA_SIRI] });
    apiMock.getAssessmentReports.mockResolvedValue(RAPORTY);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
    listMethodSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
  });

  it('pokazuje z której oceny raport pochodzi — z payloadu, z dopasowania po id, a bez obu myślnik', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment?tab=reports']}>
        <AssessmentHub initialTab="reports" />
      </MemoryRouter>
    );

    await screen.findByText('DBR77 — Raport diagnostyczny Q3 2026');
    expect(naglowki()).toMatch(/Kontekst|Context/i);

    // 1. nazwa prosto z payloadu (`assessmentName` z serwerowego JOIN-a)
    const zPayloadu = komorkaKontekstu(wiersz('DBR77 — Raport diagnostyczny Q3 2026'));
    expect(within(zPayloadu).getByText('DBR77 · Digital Readiness Diagnosis')).toBeInTheDocument();
    // podpis pod nazwą — jak AUTOR ma dwie linie
    expect(within(zPayloadu).getByText(/^(Ocena|Assessment)$/)).toBeInTheDocument();

    // 2. JOIN zwrócił NULL — nazwa z listy ocen po `assessmentId`
    const zDopasowania = komorkaKontekstu(wiersz('Raport bez JOIN-a'));
    expect(within(zDopasowania).getByText('SIRI — hala 2')).toBeInTheDocument();

    // 3. brak obu źródeł = pusty stan (myślnik), nigdy wymyślona nazwa
    const bezKontekstu = komorkaKontekstu(wiersz('Raport bez kontekstu'));
    expect(bezKontekstu.textContent?.trim()).toBe('—');
  });
});
