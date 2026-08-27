import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanScenarioSurface } from '../../../src/components/Initiatives/PlanScenarioSurface';
import {
  createPlanAnalysisProposal,
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  writePlanScenario,
  reviewPlanAnalysisProposal,
} from '../../../src/services/initiatives-execution/runtimeApi';

const PLAN_TRANSLATIONS: Record<string, string> = {
  'initiatives.planScenario.activePlan': 'Aktywny plan',
  'initiatives.planScenario.activePlanAria': 'Aktywny scenariusz planu',
  'initiatives.planScenario.archiveNote': 'Historia opublikowanego planu jest niezmienna',
  'initiatives.planScenario.aside.analysisFailed': 'Analiza nie powiodła się; szkic nie został zmieniony.',
  'initiatives.planScenario.aside.analysisInput': 'Wejście: plan w{{scenarioVersion}}, agregat w{{aggregateVersion}}',
  'initiatives.planScenario.aside.analysisProposalAria': 'Propozycja analizy planu',
  'initiatives.planScenario.aside.analysisProposalTitle': 'Propozycja analizy',
  'initiatives.planScenario.aside.applyToDraft': 'Zastosuj do szkicu',
  'initiatives.planScenario.aside.assumptions': 'Założenia',
  'initiatives.planScenario.aside.assumptionsAndChanges': 'Założenia i zmiany',
  'initiatives.planScenario.aside.assumptionsAria': 'Założenia planu',
  'initiatives.planScenario.aside.baseVersion': 'Wersja bazowa',
  'initiatives.planScenario.aside.baseVersionAria': 'Bazowa wersja planu',
  'initiatives.planScenario.aside.changesAndConflicts': 'Zmiany: {{changes}} · Konflikty: {{conflicts}}',
  'initiatives.planScenario.aside.changesCount': 'Zmiany ({{count}})',
  'initiatives.planScenario.aside.compareFailed': 'Nie udało się odczytać porównania. Plan nie został zmieniony.',
  'initiatives.planScenario.aside.compareUnavailable': 'Porównanie będzie dostępne po zapisaniu co najmniej dwóch wersji planu.',
  'initiatives.planScenario.aside.compareVersions': 'Porównanie wersji',
  'initiatives.planScenario.aside.compareVersionsAction': 'Porównaj wersje',
  'initiatives.planScenario.aside.comparedVersion': 'Wersja porównywana',
  'initiatives.planScenario.aside.comparedVersionAria': 'Porównywana wersja planu',
  'initiatives.planScenario.aside.diffAria': 'Różnice planu',
  'initiatives.planScenario.aside.moveNote': 'Przesuwanie zmienia tylko ten szkic. Publikacja tworzy rządzoną prawdę scenariusza planu; nigdy nie ustala bazowo ani nie zapisuje dat inicjatywy/zadania.',
  'initiatives.planScenario.aside.noDiff': 'Brak różnic w oknach inicjatyw dla wybranych wersji.',
  'initiatives.planScenario.aside.rejectProposal': 'Odrzuć',
  'initiatives.planScenario.aside.saveAndPublishSeparate': 'Zapis i publikacja pozostają oddzielnymi decyzjami.',
  'initiatives.planScenario.columns.backlogState': 'Stan backlogu',
  'initiatives.planScenario.columns.capacity': 'Moc przerobowa',
  'initiatives.planScenario.columns.capacityState': 'Stan mocy przerobowej',
  'initiatives.planScenario.columns.conflict': 'Konflikt',
  'initiatives.planScenario.columns.costOfDelay': 'Koszt opóźnienia',
  'initiatives.planScenario.columns.dependencies': 'Zależności',
  'initiatives.planScenario.columns.dependencyReadiness': 'Gotowość zależności',
  'initiatives.planScenario.columns.earliest': 'Najwcześniej',
  'initiatives.planScenario.columns.initiative': 'Inicjatywa',
  'initiatives.planScenario.columns.latest': 'Najpóźniej',
  'initiatives.planScenario.columns.mandatoryDeadline': 'Obowiązkowy termin',
  'initiatives.planScenario.columns.nextAction': 'Następna akcja',
  'initiatives.planScenario.columns.proposedTarget': 'Proponowany termin docelowy',
  'initiatives.planScenario.columns.roughDemand': 'Szacunkowe zapotrzebowanie',
  'initiatives.planScenario.columns.scheduleConfidence': 'Pewność harmonogramu',
  'initiatives.planScenario.columns.tentativeWindow': 'Wstępny najwcześniejszy / docelowy / najpóźniejszy',
  'initiatives.planScenario.columns.window': 'Okno',
  'initiatives.planScenario.conflictError': 'Plan zmienił się albo jego baza portfela jest nieaktualna. Otwórz ponownie przed próbą zapisu.',
  'initiatives.planScenario.destructiveNote': 'Plany są zastępowane, nie usuwane',
  'initiatives.planScenario.emptyDescription': 'Zmień filtr albo dodaj inicjatywę w narzędziach aktywnego planu.',
  'initiatives.planScenario.emptyTitle': 'Brak inicjatyw w tym zakresie',
  'initiatives.planScenario.form.createPlan': 'Utwórz plan',
  'initiatives.planScenario.form.horizonStart': 'Początek horyzontu',
  'initiatives.planScenario.form.horizonStartAria': 'Data rozpoczęcia planu',
  'initiatives.planScenario.form.monthOption': 'Miesiąc',
  'initiatives.planScenario.form.planName': 'Nazwa planu',
  'initiatives.planScenario.form.planNameAria': 'Identyfikator scenariusza planu',
  'initiatives.planScenario.form.portfolioVersion': 'Wersja portfela',
  'initiatives.planScenario.form.portfolioVersionAria': 'Wersja scenariusza portfela',
  'initiatives.planScenario.form.sourcePortfolio': 'Źródłowy portfel',
  'initiatives.planScenario.form.sourcePortfolioAria': 'Identyfikator scenariusza portfela',
  'initiatives.planScenario.form.timezone': 'Strefa czasowa',
  'initiatives.planScenario.form.timezoneAria': 'Strefa czasowa planu',
  'initiatives.planScenario.form.weekCount': 'Liczba tygodni',
  'initiatives.planScenario.form.weekCountAria': 'Liczba tygodni planu',
  'initiatives.planScenario.form.weekOption': 'Tydzień',
  'initiatives.planScenario.form.windowUnit': 'Jednostka czasu',
  'initiatives.planScenario.form.windowUnitAria': 'Jednostka okna planu',
  'initiatives.planScenario.heading': 'Plan inicjatyw',
  'initiatives.planScenario.loading': 'Wczytywanie rejestru planu…',
  'initiatives.planScenario.newPlan': 'Nowy plan',
  'initiatives.planScenario.noWindowAssigned': 'Nie przypisano okna planu',
  'initiatives.planScenario.openWorkspace': 'Otwórz narzędzia planu',
  'initiatives.planScenario.portfolioLabel': 'Portfel',
  'initiatives.planScenario.preview.aiDisabledTooltip': 'Sugestie AI wymagają jawnego, rządzonego żądania analizy.',
  'initiatives.planScenario.preview.aiHintDependencies': 'Zakwestionuj zależności',
  'initiatives.planScenario.preview.aiHintSequencing': 'Porównaj kolejność',
  'initiatives.planScenario.preview.windowLabel': 'Okno inicjatywy w planie',
  'initiatives.planScenario.preview.windowText': 'Wyłącznie wstępna kolejność. Otwarcie narzędzia edytuje szkic planu, nigdy dat inicjatywy.',
  'initiatives.planScenario.retry': 'Ponów',
  'initiatives.planScenario.sectionAria': 'Scenariusze planu',
  'initiatives.planScenario.status.draft': 'Szkic',
  'initiatives.planScenario.status.published': 'Opublikowany',
  'initiatives.planScenario.status.superseded': 'Zastąpiony',
  'initiatives.planScenario.subheading': 'Kolejność, okna czasowe i zależności zatwierdzonego portfela.',
  'initiatives.planScenario.unavailable': 'Trwały rejestr planu jest niedostępny.',
  'initiatives.planScenario.workbench.addConstraint': 'Dodaj ograniczenie',
  'initiatives.planScenario.workbench.addPeriod': 'Dodaj okres',
  'initiatives.planScenario.workbench.allStatuses': 'Wszystkie statusy',
  'initiatives.planScenario.workbench.assignAria': 'Przypisz {{name}} do {{period}}',
  'initiatives.planScenario.workbench.closeAria': 'Zamknij narzędzia planu',
  'initiatives.planScenario.workbench.confidence': 'Pewność',
  'initiatives.planScenario.workbench.confidenceAria': 'Pewność {{id}}',
  'initiatives.planScenario.workbench.confidenceRationaleColumn': 'Pewność / uzasadnienie',
  'initiatives.planScenario.workbench.constraintsColumn': 'Ograniczenia',
  'initiatives.planScenario.workbench.defaultConstraintDetail': 'Ograniczenie wymaga weryfikacji',
  'initiatives.planScenario.workbench.defaultRationale': 'Szkic okna wymaga weryfikacji',
  'initiatives.planScenario.workbench.dependenciesAria': 'Zależności {{id}}',
  'initiatives.planScenario.workbench.draftWindowColumn': 'Szkic okna: najwcześniej / docelowo / najpóźniej',
  'initiatives.planScenario.workbench.horizon': 'Horyzont planowania',
  'initiatives.planScenario.workbench.inPlanCount': 'W planie: {{count}} / {{total}}',
  'initiatives.planScenario.workbench.includeAria': 'Uwzględnij {{name}}',
  'initiatives.planScenario.workbench.initiativeScope': 'Zakres inicjatyw',
  'initiatives.planScenario.workbench.initiativeStatus': 'Status inicjatywy',
  'initiatives.planScenario.workbench.initiativeStatusFilterAria': 'Filtr statusu inicjatyw planu',
  'initiatives.planScenario.workbench.initiativeVersionAria': 'Wersja inicjatywy {{id}}',
  'initiatives.planScenario.workbench.moveDownAria': 'Przesuń {{id}} w dół',
  'initiatives.planScenario.workbench.moveLeftAria': 'Przesuń {{name}} w lewo',
  'initiatives.planScenario.workbench.moveRightAria': 'Przesuń {{name}} w prawo',
  'initiatives.planScenario.workbench.moveUpAria': 'Przesuń {{id}} w górę',
  'initiatives.planScenario.workbench.noInitiativesInPlan': 'Brak inicjatyw w tym planie',
  'initiatives.planScenario.workbench.noMatchingDescription': 'Żadna inicjatywa nie pasuje do tego zakresu.',
  'initiatives.planScenario.workbench.noMatchingTitle': 'Brak pasujących okien planu',
  'initiatives.planScenario.workbench.noWindowsSelected': 'Wybierz co najmniej jedną inicjatywę, aby zbudować wariant planu.',
  'initiatives.planScenario.workbench.orderSnapshotColumn': 'Kolejność / migawka inicjatywy',
  'initiatives.planScenario.workbench.periodFrom': 'Od',
  'initiatives.planScenario.workbench.periodFromAria': 'Początek okresu {{index}}',
  'initiatives.planScenario.workbench.periodName': 'Nazwa okresu',
  'initiatives.planScenario.workbench.periodNameAria': 'Nazwa okresu {{index}}',
  'initiatives.planScenario.workbench.periodTo': 'Do',
  'initiatives.planScenario.workbench.periodToAria': 'Koniec okresu {{index}}',
  'initiatives.planScenario.workbench.periodsAria': 'Okresy planu',
  'initiatives.planScenario.workbench.proposedWindow': 'Proponowane okno',
  'initiatives.planScenario.workbench.publish': 'Publikuj scenariusz planu',
  'initiatives.planScenario.workbench.rationaleAria': 'Uzasadnienie okna {{id}}',
  'initiatives.planScenario.workbench.removePeriodAria': 'Usuń okres {{index}}',
  'initiatives.planScenario.workbench.saveDraft': 'Zapisz szkic',
  'initiatives.planScenario.workbench.sequenceByDependencies': 'Uporządkuj wg zależności',
  'initiatives.planScenario.workbench.statusUnknown': 'Status nieznany',
  'initiatives.planScenario.workbench.timelineAria': 'Tygodniowa oś czasu planu',
  'initiatives.planScenario.workbench.timelineHint': 'Kliknij tydzień, aby przypisać okno. Strzałki przesuwają inicjatywę o jeden okres.',
  'initiatives.planScenario.workbench.timelineTitle': 'Oś czasu',
  'initiatives.planScenario.workbench.timezoneAria': 'Strefa czasowa planu w warsztacie',
  'initiatives.planScenario.workbench.title': 'Warsztat planu',
  'initiatives.planScenario.workbench.unknownTimeBasis': 'Nieznana baza czasowa — wymagane są dokładna jednostka okna, strefa czasowa i uporządkowane okresy; zapis i publikacja pozostają zablokowane.',
  'initiatives.planScenario.workbench.windowFieldAria.earliest': 'Najwcześniejszy termin {{id}}',
  'initiatives.planScenario.workbench.windowFieldAria.latest': 'Najpóźniejszy termin {{id}}',
  'initiatives.planScenario.workbench.windowFieldAria.target': 'Termin docelowy {{id}}',
  'initiatives.planScenario.workbench.windowUnitAria': 'Jednostka okna planu w warsztacie',
  'initiatives.planScenario.workbenchAria': 'Warsztat scenariusza planu',
  'initiatives.planScenario.writeError': 'Operacja na planie nie powiodła się; żadna data inicjatywy ani zadania nie została zmieniona.',
  'common.cancel': 'Anuluj',
  'common.close': 'Zamknij',
  'common.delete': 'Usuń',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (key: string, options?: Record<string, unknown>) => {
      const template = PLAN_TRANSLATIONS[key] ?? key;
      if (!options) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
        options[name] !== undefined ? String(options[name]) : `{{${name}}}`
      );
    },
  }),
}));

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  createPlanAnalysisProposal: vi.fn(),
  listPlanScenarioRegister: vi.fn(),
  readPlanScenario: vi.fn(),
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(),
  writePlanScenario: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
}));

const plan = {
  scenarioId: 'plan-q4',
  scenarioVersion: 1,
  status: 'DRAFT' as const,
  portfolioScenarioId: 'portfolio-q4',
  portfolioScenarioVersion: 3,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'w1', start: '2026-09-01T00:00:00Z', end: '2026-09-08T00:00:00Z' },
    { periodId: 'w2', start: '2026-09-08T00:00:00Z', end: '2026-09-15T00:00:00Z' },
  ],
  windows: [
    {
      initiativeId: 'initiative-1',
      initiativeVersion: 7,
      earliest: '2026-10-01T00:00:00.000Z',
      target: '2026-10-15T00:00:00.000Z',
      latest: '2026-10-31T00:00:00.000Z',
      confidence: 'MEDIUM' as const,
      rationale: 'Draft planning envelope',
      dependencySnapshot: [],
      constraintSnapshot: [
        { constraintId: 'c1', state: 'UNKNOWN' as const, detail: 'Supplier window unconfirmed' },
      ],
    },
  ],
  assumptions: ['No baseline commitment'],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: null,
  publishedAt: null,
};

describe('PlanScenarioSurface', () => {
  beforeEach(() => {
    vi.mocked(listPlanScenarioRegister)
      .mockReset()
      .mockResolvedValue({
        scenarios: [
          {
            id: 'plan-q4',
            name: 'Q4 plan',
            state: 'DRAFT',
            version: 1,
            portfolioRef: { scenarioId: 'portfolio-q4', scenarioVersion: 3 },
            window: { earliest: plan.windows[0].earliest, latest: plan.windows[0].latest },
            timeBasis: {
              windowUnit: 'WEEK',
              timezone: 'Europe/Warsaw',
              periods: plan.periods,
              knowledgeState: 'KNOWN',
            },
            updatedAt: '2026-08-09T12:00:00.000Z',
          },
        ],
      });
    vi.mocked(readPlanScenario).mockReset().mockResolvedValue({ version: 4, scenario: plan });
    vi.mocked(readPlanScenarioDiff).mockReset().mockResolvedValue({ changes: [] });
    vi.mocked(readPlanScenarioHistory)
      .mockReset()
      .mockResolvedValue({
        versions: [
          { ...plan, scenarioVersion: 1 },
          {
            ...plan,
            scenarioVersion: 2,
            windows: [{ ...plan.windows[0], target: '2026-10-22T00:00:00.000Z' }],
          },
        ],
      });
    vi.mocked(writePlanScenario)
      .mockReset()
      .mockResolvedValue({ aggregateVersion: 5, response: { ...plan, scenarioVersion: 2 } });
    vi.mocked(createPlanAnalysisProposal)
      .mockReset()
      .mockResolvedValue({
        response: {
          proposalId: 'proposal-1',
          inputAggregateVersion: 4,
          inputScenarioVersion: 1,
          status: 'PENDING_REVIEW',
          assumptions: ['Dependencies precede dependants'],
          rationale: 'No source record changed.',
          conflicts: [],
          changes: [
            {
              initiativeId: 'initiative-1',
              before: plan.windows[0],
              after: { ...plan.windows[0], target: '2026-09-01T00:00:00Z' },
            },
          ],
        },
      });
    vi.mocked(reviewPlanAnalysisProposal).mockReset().mockResolvedValue({});
  });

  it('loads the persistent register and opens exact Plan Workbench with Enter', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    expect((await screen.findByLabelText('Aktywny scenariusz planu')).textContent).toContain('Szkic');
    expect(screen.queryByText(/\bDRAFT\b/)).not.toBeInTheDocument();
    const row = (await screen.findByText('Automation')).closest('tr')!;
    fireEvent.click(row);
    expect(screen.getByText('Okno inicjatywy w planie')).toBeInTheDocument();
    const layout = row.closest('div[tabindex="0"]')!;
    layout.focus();
    fireEvent.keyDown(layout, { key: 'Enter' });
    expect(
      await screen.findByRole('region', { name: 'Warsztat scenariusza planu' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Okno inicjatywy w planie')).not.toBeInTheDocument()
    );
    expect(readPlanScenario).toHaveBeenCalledWith('plan-q4');
    expect(screen.getByLabelText('Termin docelowy initiative-1')).toHaveValue('2026-10-15T00:00');
    expect(screen.getByText('UNKNOWN: Supplier window unconfirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij narzędzia planu' }));
    expect(screen.queryByRole('region', { name: 'Warsztat scenariusza planu' })).toBeNull();
  });

  it('keeps move/window edits in draft and publishes only through Plan Scenario API', async () => {
    render(
      <PlanScenarioSurface
        initiatives={[
          { id: 'initiative-1', name: 'Automation', lifecycle: 'IN_EXECUTION' },
          { id: 'initiative-2', name: 'Digital', lifecycle: 'SCHEDULED' },
        ]}
      />
    );
    fireEvent.doubleClick((await screen.findByText('Automation')).closest('tr')!);
    await screen.findByRole('region', { name: 'Warsztat scenariusza planu' });
    expect(screen.getByLabelText('Uwzględnij Automation')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Filtr statusu inicjatyw planu'), {
      target: { value: 'SCHEDULED' },
    });
    expect(screen.queryByLabelText('Uwzględnij Automation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Uwzględnij Digital'));
    fireEvent.click(screen.getByLabelText('Przypisz Digital do w1'));
    expect(screen.getByLabelText('Przypisz Digital do w1')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Przesuń Digital w prawo'));
    expect(screen.getByLabelText('Przypisz Digital do w2')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Przesuń initiative-2 w górę'));
    expect(writePlanScenario).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Założenia planu'), {
      target: { value: 'Dependency validated\nWindow remains draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenCalledWith(
        'plan-q4',
        expect.objectContaining({
          operation: 'UPDATE',
          expectedVersion: 4,
          scenario: expect.objectContaining({
            windowUnit: 'WEEK',
            timezone: 'Europe/Warsaw',
            periods: plan.periods,
            windows: expect.arrayContaining([
              expect.objectContaining({
                initiativeId: 'initiative-2',
                target: '2026-09-08T00:00:00Z',
              }),
            ]),
          }),
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publikuj scenariusz planu' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenLastCalledWith(
        'plan-q4',
        expect.objectContaining({ operation: 'PUBLISH' })
      )
    );
  });

  it('shows UNKNOWN and blocks save/publish for a legacy Plan without canonical time basis', async () => {
    vi.mocked(readPlanScenario).mockResolvedValueOnce({
      version: 4,
      scenario: { ...plan, windowUnit: undefined, timezone: undefined, periods: undefined },
    } as any);
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Warsztat scenariusza planu' });
    expect(screen.getByRole('alert')).toHaveTextContent('Nieznana baza czasowa');
    expect(screen.getByRole('button', { name: 'Zapisz szkic' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publikuj scenariusz planu' })).toBeDisabled();
  });

  it('compares two persistent Plan versions without mutating the scenario', async () => {
    vi.mocked(readPlanScenarioDiff).mockResolvedValueOnce({
      changes: [
        {
          initiativeId: 'initiative-1',
          before: plan.windows[0],
          after: { ...plan.windows[0], target: '2026-10-22T00:00:00.000Z' },
        },
      ],
    });
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Warsztat scenariusza planu' });

    expect(readPlanScenarioHistory).toHaveBeenCalledWith('plan-q4');
    expect(screen.getByLabelText('Bazowa wersja planu')).toHaveValue('1');
    expect(screen.getByLabelText('Porównywana wersja planu')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Porównaj wersje' }));

    await waitFor(() => expect(readPlanScenarioDiff).toHaveBeenCalledWith('plan-q4', 1, 2));
    expect(screen.getByText(/initiative-1:.*2026-10-15.*2026-10-22/)).toBeInTheDocument();
    expect(writePlanScenario).not.toHaveBeenCalled();
  });

  it('keeps current initiatives visible as unscheduled when the scenario has no window', async () => {
    vi.mocked(readPlanScenario).mockResolvedValueOnce({
      version: 4,
      scenario: { ...plan, status: 'PUBLISHED', windows: [] },
    });
    render(
      <PlanScenarioSurface
        initiatives={[{ id: 'initiative-in-execution', name: 'Automation in execution' }]}
      />
    );
    expect(await screen.findByText('Automation in execution')).toBeInTheDocument();
    expect(screen.getByText('Nie przypisano okna planu')).toBeInTheDocument();
    expect(screen.getByText('ADD_TO_PLAN_OR_EXCLUDE')).toBeInTheDocument();
  });

  it('creates a weekly planning horizon without exposing raw JSON', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    await screen.findByLabelText('Aktywny scenariusz planu');

    fireEvent.click(screen.getByRole('button', { name: 'Nowy plan' }));
    expect(screen.queryByText('Ordered periods JSON')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Identyfikator scenariusza planu'), {
      target: { value: 'plan-transformation' },
    });
    fireEvent.change(screen.getByLabelText('Identyfikator scenariusza portfela'), {
      target: { value: 'portfolio-approved' },
    });
    fireEvent.change(screen.getByLabelText('Data rozpoczęcia planu'), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByLabelText('Liczba tygodni planu'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz plan' }));

    expect(
      await screen.findByRole('region', { name: 'Warsztat scenariusza planu' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa okresu 1')).toHaveValue('Tydzień 1');
    expect(screen.getByLabelText('Początek okresu 1')).toHaveValue('2026-09-07');
    expect(screen.getByLabelText('Koniec okresu 2')).toHaveValue('2026-09-21');

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenCalledWith(
        'plan-transformation',
        expect.objectContaining({
          operation: 'CREATE',
          scenario: expect.objectContaining({
            periods: [
              expect.objectContaining({
                periodId: 'Tydzień 1',
                start: '2026-09-07T00:00:00.000Z',
                end: '2026-09-14T00:00:00.000Z',
              }),
              expect.objectContaining({
                periodId: 'Tydzień 2',
                start: '2026-09-14T00:00:00.000Z',
                end: '2026-09-21T00:00:00.000Z',
              }),
            ],
          }),
        })
      )
    );
  });

  it('reviews an analysis proposal before applying it to the unsaved draft', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Warsztat scenariusza planu' });
    fireEvent.click(screen.getByRole('button', { name: 'Uporządkuj wg zależności' }));
    expect(await screen.findByRole('region', { name: 'Propozycja analizy planu' })).toHaveTextContent(
      'PENDING_REVIEW'
    );
    expect(writePlanScenario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj do szkicu' }));
    await waitFor(() => expect(reviewPlanAnalysisProposal).toHaveBeenCalled());
    expect(screen.getByLabelText('Termin docelowy initiative-1')).toHaveValue('2026-09-01T00:00');
    expect(writePlanScenario).not.toHaveBeenCalled();
  });
});
