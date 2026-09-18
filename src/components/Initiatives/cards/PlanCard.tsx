import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { DocumentCardMenu5 } from '@/components/standard/DocumentCardMenu5';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import { PLAN_CARD_CONTRACT } from '@/components/standard/documentCardContracts';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';
import type { ScheduleItem, ScheduleItemType } from '@/types/initiativeSchedule';

import { formatPlanSolverReason } from '../planSolverReason';
import { InitiativeGantt } from '../gantt';
import type { GanttRowLabel } from '../gantt';
import { isPlanTimelineV2Enabled } from '@/utils/planTimelineV2Flag';
import {
  PlanDependencyAnalysisPanel,
  type DependencyCriticalPath,
} from '../PlanDependencyAnalysisPanel';
import type {
  ConditionalDependencySnapshot,
  DependencyObservation,
  ObservationReview,
} from '../planDependencyReview';
import {
  GeneratorPlanuModal,
  type GeneratorInitiative,
  type GeneratorPlanInput,
  type GeneratorProposalRow,
  type PlanGenerationMode,
} from '../Generator/GeneratorPlanuModal';
// P15-K5 (DEC-421): edytor popytu per rola — jedyny dotyk PlanCard w tym kroku.
import { PlanRoleDemandEditor, type RoleDemandLine } from './PlanRoleDemandEditor';

export interface PlanCardWindow {
  initiativeId: string;
  earliest: string | null;
  target: string | null;
  latest: string | null;
  rationale: string;
  dependencySnapshot: string[];
  conditionalDependencySnapshot?: ConditionalDependencySnapshot[];
  constraintSnapshot: Array<{ detail: string }>;
  /** P15-K5: popyt na role w oknie tej inicjatywy (FTE) — wejscie analizy obciazenia. */
  roleDemand?: RoleDemandLine[];
}
/**
 * P15-K7 pkt 1 (DEC-421): WYNIK analizy obciazenia widziany z karty PLANU.
 * Tylko do odczytu — popyt zadaje sie nizej (`PlanRoleDemandEditor`), podaz
 * i korekty zyja w karcie analizy. `null` = „Nieznane", nigdy zero.
 */
export interface PlanCardCapacityAnalysis {
  scenarioId: string;
  name: string | null;
  scenarioVersion: number;
  periods: Array<{
    periodId: string;
    roles: Array<{
      roleId: string;
      roleLabel: string;
      demand: number | null;
      supply: number | null;
      supplySource: 'RESOURCE_PLAN' | 'MANUAL' | 'UNKNOWN';
    }>;
  }>;
}
export interface PlanCardScenario {
  scenarioId: string;
  name?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scenarioVersion: number;
  portfolioScenarioId: string;
  portfolioScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string }>;
  windows: PlanCardWindow[];
  assumptions: string[];
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
}

/** Zmiana okna wysyłana do zapisu — tylko daty, resztę okna niesie scenariusz. */
export interface PlanCardWindowPatch {
  earliest?: string | null;
  target?: string | null;
  latest?: string | null;
}

// [ODMROZENIE 05_INITIATIVES DEC-453] J6b: helpery daty/FTE dostają `locale` jawnie
// z hooka komponentu (`useTranslation().i18n.language`), zamiast czytać moduł-poziomowo
// z pakietu `i18next` (`localeListy()`) — ten sam powód co w komentarzu STOP wyżej: test
// tej karty mockuje TYLKO `@/i18n` i hook `react-i18next`, nie realny `i18next`, więc
// czytanie z singletona w teście widziało domyślny (nie-PL) język i psuło separator
// dziesiętny („5.5" zamiast „5,5"). Przekazanie `locale` jako argumentu usuwa tę zależność.
/** Kod języka konta (`i18n.language`, np. „pl"/„en") → tag BCP-47 dla `Intl`. */
const planCardLocaleTag = (language: string | null | undefined): string =>
  String(language || '')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl-PL'
    : 'en-GB';
const formatPolishDate = (value: string | null, locale: string) => {
  const unknown = locale.startsWith('pl') ? 'Nieznane' : 'Unknown';
  if (!value) return unknown;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? unknown : new Intl.DateTimeFormat(locale).format(date);
};
/** „Nieznane"/„Unknown" zamiast zera — brak liczby nie jest twierdzeniem o zerze. */
const fteText = (value: number | null, locale: string) =>
  value === null
    ? locale.startsWith('pl')
      ? 'Nieznane'
      : 'Unknown'
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
const windowUnitLabel = (value: string, locale: string) =>
  (locale.startsWith('pl')
    ? { WEEK: 'Tydzień', MONTH: 'Miesiąc', QUARTER: 'Kwartał' }
    : { WEEK: 'Week', MONTH: 'Month', QUARTER: 'Quarter' })[value] ?? value;
/** ISO → wartość `<input type="date">`; pusty napis dla braku daty. */
const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '');
const toDateIso = (value: string) => (value ? `${value}T00:00:00.000Z` : null);
/**
 * Przesunięcie daty `YYYY-MM-DD` o całe dni W UTC — niezależne od strefy
 * uruchomienia (lokalne `setDate` na `new Date('2026-09-28')` parsed jako UTC
 * północ dałoby off-by-one na zachód od Greenwich).
 */
const shiftDateOnly = (dateOnly: string, days: number): string => {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Całkowita liczba dni kalendarzowych między dwiema datami `YYYY-MM-DD` (to − from). */
const utcDayDiff = (fromDateOnly: string, toDateOnly: string): number =>
  Math.round(
    (Date.parse(`${toDateOnly}T00:00:00Z`) - Date.parse(`${fromDateOnly}T00:00:00Z`)) / 86400000
  );

/**
 * WALIDACJA OKNA (P15-K3, DEC-421): dokładnie ta sama reguła, co
 * `validatePlanScenario` na serwerze (`earliest <= target <= latest` oraz
 * całość wewnątrz horyzontu planu). Bez niej serwer odrzucał zapis regułą po
 * angielsku, a wiersz nie mówił, co jest nie tak.
 */
export function validatePlanWindowDates(
  window: { earliest: string | null; target: string | null; latest: string | null },
  horizon: { start: string; end: string } | null
): 'ORDER' | 'HORIZON' | null {
  const values = [window.earliest, window.target, window.latest];
  const [earliest, target, latest] = values;
  if (
    (earliest && target && earliest > target) ||
    (target && latest && target > latest) ||
    (earliest && latest && earliest > latest)
  )
    return 'ORDER';
  if (horizon && values.some((value) => value && (value < horizon.start || value > horizon.end)))
    return 'HORIZON';
  return null;
}

export function PlanCard({
  scenario,
  initiatives,
  plannable,
  proposal,
  proposalRows,
  proposalConflicts,
  savedLabel,
  errorLabel,
  busy,
  dependencyAnalysisEnabled,
  onBack,
  onAnalyze,
  onGenerate,
  onReview,
  onPublish,
  onAddInitiative,
  onRemoveInitiative,
  onWindowChange,
  onDependenciesChange,
  onRoleDemandChange,
  onNewDraftVersion,
  capacityAnalysis = null,
  onOpenCapacityAnalysis,
  onNewCapacityAnalysis,
}: {
  scenario: PlanCardScenario;
  initiatives: Array<{ id: string; name: string; lifecycle?: string }>;
  plannable?: GeneratorInitiative[];
  proposal?: {
    conflicts: string[];
    changes: unknown[];
    status: string;
    analysisSource?: 'SOLVER' | 'AI';
    dependencyObservations?: DependencyObservation[];
    criticalPaths?: DependencyCriticalPath[];
    analysisModel?: string | null;
  } | null;
  proposalRows?: GeneratorProposalRow[] | null;
  proposalConflicts?: string[];
  savedLabel?: string | null;
  /** Komunikat błędu zapisu (np. konflikt wersji) — karta musi go POKAZAĆ. */
  errorLabel?: string | null;
  busy?: boolean;
  /** Wave 2 dependency analysis gate. The established Plan workspace stays available at OFF. */
  dependencyAnalysisEnabled?: boolean;
  onBack: () => void;
  onAnalyze: (mode: PlanGenerationMode) => void;
  onGenerate?: (input: GeneratorPlanInput) => void;
  onReview: (outcome: 'ACCEPT' | 'REJECT', reviews?: ObservationReview[]) => void;
  onPublish: () => void;
  onAddInitiative?: (initiativeId: string) => void;
  onRemoveInitiative?: (initiativeId: string) => void;
  /**
   * SPEC §4.2: zapis okna idzie przez CAS całego scenariusza. Zwrot `false`
   * (lub Promise<boolean> = false) oznacza odrzucenie zapisu (np. 409) — oś
   * czasu cofa wtedy optimistic pasek. `void`/`undefined` = success (wstecznie).
   */
  onWindowChange?: (
    initiativeId: string,
    patch: PlanCardWindowPatch
  ) => void | Promise<boolean | void>;
  onDependenciesChange?: (initiativeId: string, dependsOn: string[]) => void;
  /** P15-K5 po scaleniu: zapis popytu per rola idzie tą samą drogą CAS, co reszta karty. */
  onRoleDemandChange?: (initiativeId: string, roleDemand: RoleDemandLine[]) => Promise<boolean>;
  onNewDraftVersion?: () => void;
  /** P15-K7 pkt 1 (DEC-421): arkusz okres x rola z POWIAZANEJ opublikowanej analizy. */
  capacityAnalysis?: PlanCardCapacityAnalysis | null;
  onOpenCapacityAnalysis?: () => void;
  onNewCapacityAnalysis?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const planCardLocale = planCardLocaleTag(i18n.language);
  /** DEC-608/DEC-615: oś czasu jako jedyne centrum — za flagą, domyślnie OFF. */
  const planTimelineV2 = isPlanTimelineV2Enabled();
  /**
   * D-96 (Wpis 102): pod flagą karta planu ląduje NA OSI (sekcja `dependencies`).
   * Startowe `horizon` sprawiało, że szkic otwierał się na liście okresów albo
   * formularzu dat i właściciel czytał to jako „oś się nie renderuje", choć oś
   * była jeden klik dalej. OFF zostaje przy `horizon` — zachowanie bez zmian.
   */
  const [section, setSection] = useState(planTimelineV2 ? 'dependencies' : 'horizon');
  const [generator, setGenerator] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [horizonMonths, setHorizonMonths] = useState<1 | 3 | 6 | 12>(3);
  const title = resolveBusinessDisplayLabel({
    displayName: scenario.name,
    rawId: scenario.scenarioId,
    fallback: 'Plan bez nazwy',
  });
  const editable = scenario.status === 'DRAFT' && !readMode;
  const names = useMemo(
    () =>
      new Map([
        ...initiatives.map((item) => [item.id, item.name] as const),
        ...(plannable ?? []).map((item) => [item.id, item.name] as const),
      ]),
    [initiatives, plannable]
  );
  const nameOf = (id: string) => names.get(id) ?? id;
  const lifecycleOf = (id: string) =>
    initiatives.find((initiative) => initiative.id === id)?.lifecycle ?? null;
  const horizon = useMemo(
    () =>
      scenario.periods.length
        ? { start: scenario.periods[0].start, end: scenario.periods[scenario.periods.length - 1].end }
        : null,
    [scenario.periods]
  );
  const inPlan = useMemo(
    () => new Set(scenario.windows.map((window) => window.initiativeId)),
    [scenario.windows]
  );
  const addable = useMemo(
    () => (plannable ?? []).filter((item) => !inPlan.has(item.id)),
    [inPlan, plannable]
  );
  const capacityConstraints = useMemo(
    () => [
      ...new Set(
        scenario.windows
          .flatMap((window) => window.constraintSnapshot.map((constraint) => constraint.detail))
          .filter((detail) => detail.trim())
      ),
    ],
    [scenario.windows]
  );
  /**
   * P15-K7 pkt 1: wiersze arkusza okres x rola z powiazanej analizy. Luka =
   * podaz - popyt (ujemna = brak ludzi); `null` gdy ktorakolwiek strona jest
   * nieznana — nie liczymy luki z domyslnego zera.
   */
  const capacitySheetRows = useMemo(
    () =>
      (capacityAnalysis?.periods ?? []).flatMap((period) =>
        period.roles.map((role) => ({
          key: `${period.periodId}|${role.roleId}`,
          periodId: period.periodId,
          roleLabel: role.roleLabel,
          demand: role.demand,
          supply: role.supply,
          gap:
            role.demand === null || role.supply === null
              ? null
              : Math.round((role.supply - role.demand) * 100) / 100,
        }))
      ),
    [capacityAnalysis]
  );
  /**
   * P15-K7 pkt 2: tryby zalezne od MOCY sa nieaktywne, dopoki nie ma powiazanej
   * opublikowanej analizy — z powodem widocznym ZANIM sie kliknie. Serwer i tak
   * odmawia regula CAPACITY_SCENARIO_REQUIRED; tu chodzi o to, zeby uzytkownik
   * nie musial sie o nia obic.
   */
  const capacityModesBlockedReason = capacityAnalysis
    ? null
    : t('initiatives.planCard.capacityModeBlocked', {
        defaultValue:
          'Tryb wg obciążenia ról wymaga opublikowanej analizy obciążenia dla tej wersji planu — utwórz ją w Obciążeniu.',
      });
  const [rowError, setRowError] = useState<Record<string, 'ORDER' | 'HORIZON'>>({});
  const ganttRange = useMemo(() => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + horizonMonths);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [horizonMonths]);
  /**
   * D-96 (Wpis 102), wariant (i): szkic utworzony przez „New plan" ma `windows: []`
   * i oś rysowała się wtedy jako pusty tor — człowiek widział „nic". Pod flagą,
   * gdy okien jeszcze nie ma, paski liczę z terminów inicjatyw już obecnych po
   * stronie klienta (`plannable`), bez dotykania serwera. Paski zastępcze są
   * tylko-do-odczytu: nie ma okna, które można by zapisać (brak `onReschedule`).
   */
  const fallbackItems = useMemo<ScheduleItem[]>(
    () =>
      planTimelineV2 && scenario.windows.length === 0
        ? (plannable ?? [])
            .filter((item) => Boolean(item.plannedStartDate && item.plannedEndDate))
            .map((item) => ({
              id: item.id,
              type: 'planned-hint' as const,
              title: nameOf(item.id),
              start: item.plannedStartDate as string,
              end: item.plannedEndDate as string,
              status: lifecycleOf(item.id),
              sourceId: item.id,
              sourceKind: 'planned-hint' as const,
            }))
        : [],
    [planTimelineV2, plannable, scenario.windows.length, initiatives]
  );
  const ganttItems = useMemo<ScheduleItem[]>(
    () =>
      scenario.windows.length
        ? scenario.windows.map((window) => ({
            id: window.initiativeId,
            type: 'phase',
            title: nameOf(window.initiativeId),
            start: window.earliest ?? window.target,
            end: window.latest ?? window.target,
            status: lifecycleOf(window.initiativeId),
            sourceId: window.initiativeId,
            sourceKind: 'phase',
          }))
        : fallbackItems,
    [fallbackItems, scenario.windows, initiatives]
  );
  const ganttDependencies = useMemo(
    () =>
      scenario.windows.flatMap((window) =>
        [
          ...window.dependencySnapshot,
          ...(dependencyAnalysisEnabled ? (window.conditionalDependencySnapshot ?? []) : [])
            .filter((dependency) => dependency.active)
            .map((dependency) => dependency.predecessorId),
        ]
          .filter((predecessorId, index, all) => all.indexOf(predecessorId) === index)
          .map((predecessorId) => ({
            fromId: predecessorId,
            toId: window.initiativeId,
          }))
      ),
    [dependencyAnalysisEnabled, scenario.windows]
  );
  const criticalPathIds = useMemo(
    () => [
      ...new Set(
        (dependencyAnalysisEnabled ? (proposal?.criticalPaths ?? []) : []).flatMap(
          (path) => path.initiativeIds
        )
      ),
    ],
    [dependencyAnalysisEnabled, proposal]
  );
  const frozenIds = useMemo(
    () =>
      scenario.windows
        .filter((window) =>
          ['IN_EXECUTION', 'EXECUTION', 'IN_PROGRESS'].includes(String(lifecycleOf(window.initiativeId)).toUpperCase())
        )
        .map((window) => window.initiativeId),
    [scenario.windows, initiatives]
  );
  /**
   * DEC-615: kolumna nazw (208 px). Nazwa stoi ZAWSZE w tym samym miejscu, bo
   * wpisana w pasek znikała razem z krótkim oknem — to był główny defekt starej
   * osi. Druga linia = stan + pierwsza rola z popytu okna.
   */
  const ganttRowLabels = useMemo<GanttRowLabel[]>(
    () =>
      scenario.windows.length
        ? scenario.windows.map((window) => {
            const id = window.initiativeId;
            const frozen = frozenIds.includes(id);
            const role = (window.roleDemand ?? [])
              .map((line) => line.roleLabel)
              .find((label) => label.trim());
            return {
              id,
              name: nameOf(id),
              meta: [
                frozen
                  ? t('initiatives.status.IN_EXECUTION')
                  : t('initiatives.timelineSection.planned'),
                role,
              ]
                .filter(Boolean)
                .join(' · '),
              frozen,
            };
          })
        : fallbackItems.map((item) => ({
            id: item.id,
            name: nameOf(item.id),
            meta: t('initiatives.timelineSection.planned'),
            frozen: false,
          })),
    [fallbackItems, frozenIds, scenario.windows, initiatives, t]
  );

  const box = 'rounded-xl border border-c-border-subtle bg-c-surface p-4';
  const field = 'rounded-lg border border-c-border bg-c-surface px-2 py-1 text-sm';
  const button =
    'inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50';

  /**
   * Plan opublikowany jest TYLKO DO ODCZYTU — zmiana idzie przez nową wersję.
   * Mechanizm istnieje w domenie: `UPDATE` opublikowanego planu podbija wersję
   * i wraca do stanu SZKIC (`planScenario.ts` — `status: op === 'PUBLISH' ? …`),
   * a poprzednia wersja zostaje w historii jako zastąpiona.
   */
  const publishedNotice = scenario.status !== 'DRAFT' && (
    <div className="mt-3 rounded-lg border border-c-border-subtle p-3 text-sm">
      <p>
        {t('initiatives.planCard.publishedReadOnly', {
          defaultValue: 'Plan opublikowany — utwórz nową wersję (szkic), aby zmienić.',
        })}
      </p>
      {onNewDraftVersion && (
        <button type="button" className={`mt-2 ${button}`} disabled={busy} onClick={onNewDraftVersion}>
          {t('initiatives.planCard.newDraftVersion', {
            defaultValue: 'Utwórz nową wersję (szkic)',
          })}
        </button>
      )}
    </div>
  );

  const changeWindow = async (
    initiativeId: string,
    patch: PlanCardWindowPatch
  ): Promise<boolean> => {
    const current = scenario.windows.find((window) => window.initiativeId === initiativeId);
    if (!current || !onWindowChange) return false;
    const problem = validatePlanWindowDates(
      {
        earliest: patch.earliest !== undefined ? patch.earliest : current.earliest,
        target: patch.target !== undefined ? patch.target : current.target,
        latest: patch.latest !== undefined ? patch.latest : current.latest,
      },
      horizon
    );
    setRowError((previous) => {
      const next = { ...previous };
      if (problem) next[initiativeId] = problem;
      else delete next[initiativeId];
      return next;
    });
    if (problem) return false;
    const result = await onWindowChange(initiativeId, patch);
    return result !== false;
  };

  /**
   * SPEC §4.2/§8 row 2 (etap 2): most między `onReschedule` osi czasu (itemId +
   * nowe okno) a zapisem CAŁEGO scenariusza. Drag o Δ dni → patch
   * `{earliest, target, latest}` przesunięty o to samo Δ (długość okna bez zmian).
   * Zwraca/throw tak, by `commit` w Gantcie cofnął pasek przy 409.
   */
  const handleGanttReschedule = useCallback(
    async (
      itemId: string,
      _sourceKind: ScheduleItemType,
      _sourceId: string,
      start: string
    ): Promise<void> => {
      const current = scenario.windows.find((window) => window.initiativeId === itemId);
      if (!current || !onWindowChange) return;
      const oldStart = current.earliest ?? current.target;
      if (!oldStart) return;
      const deltaDays = utcDayDiff(toDateInput(oldStart), toDateInput(start));
      if (deltaDays === 0) return;
      const shift = (value: string | null) =>
        value == null ? null : toDateIso(shiftDateOnly(toDateInput(value), deltaDays));
      const ok = await changeWindow(itemId, {
        earliest: shift(current.earliest),
        target: shift(current.target),
        latest: shift(current.latest),
      });
      if (ok === false) throw new Error('plan-window-write-rejected');
    },
    // changeWindow is a stable closure over scenario/onWindowChange/horizon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario.windows, onWindowChange, horizon]
  );

  const scopeSection = (
    <div className={box}>
      {scenario.windows.length ? (
        <ul className="space-y-1">
          {scenario.windows.map((window) => (
            <li
              key={window.initiativeId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border-subtle py-2 last:border-b-0"
            >
              <span className="min-w-0">
                {nameOf(window.initiativeId)} · {formatPolishDate(window.target, planCardLocale)}
              </span>
              {editable && onRemoveInitiative && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  aria-label={t('initiatives.planCard.removeFromPlanAria', {
                    defaultValue: 'Usuń „{{name}}" z planu',
                    name: nameOf(window.initiativeId),
                  })}
                  onClick={() => onRemoveInitiative(window.initiativeId)}
                >
                  {t('initiatives.planCard.removeFromPlan', { defaultValue: 'Usuń z planu' })}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-c-text-muted">
          {t('initiatives.planCard.emptyScope', {
            defaultValue:
              'Plan nie ma jeszcze żadnej inicjatywy w zakresie. Dodaj je niżej albo w generatorze.',
          })}
        </p>
      )}
      {editable && onAddInitiative && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={field}
            aria-label={t('initiatives.planCard.addInitiativeAria', {
              defaultValue: 'Inicjatywa do dodania do planu',
            })}
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          >
            <option value="">
              {t('initiatives.planCard.addInitiativePlaceholder', {
                defaultValue: 'Wybierz inicjatywę…',
              })}
            </option>
            {addable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.conditional
                  ? ` · ${t('initiatives.planGenerator.statusPending', 'Pending approval')}`
                  : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={button}
            disabled={busy || !candidate}
            onClick={() => {
              if (!candidate) return;
              onAddInitiative(candidate);
              setCandidate('');
            }}
          >
            {t('initiatives.planCard.addInitiative', { defaultValue: 'Dodaj inicjatywę' })}
          </button>
          {!addable.length && (
            <span className="text-sm text-c-text-muted">
              {t('initiatives.planCard.noAddable', {
                defaultValue: 'Wszystkie kwalifikujące się inicjatywy są już w planie.',
              })}
            </span>
          )}
        </div>
      )}
      {publishedNotice}
    </div>
  );

  const windowsSection = (
    <div className={box}>
      {scenario.windows.length ? (
        <div className="space-y-3">
          {scenario.windows.map((window, index) => (
            <div
              key={window.initiativeId}
              className="border-b border-c-border-subtle py-2 last:border-b-0"
            >
              <b>
                {index + 1}. {nameOf(window.initiativeId)}
              </b>
              {editable && onWindowChange ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {(
                    [
                      ['earliest', t('initiatives.planCard.earliest', { defaultValue: 'Najwcześniej' })],
                      ['target', t('initiatives.planCard.target', { defaultValue: 'Data docelowa' })],
                      ['latest', t('initiatives.planCard.latest', { defaultValue: 'Najpóźniej' })],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs text-c-text-muted">
                      {label}
                      <input
                        type="date"
                        className={`mt-1 block ${field}`}
                        aria-label={`${label} — ${nameOf(window.initiativeId)}`}
                        value={toDateInput(window[key])}
                        min={horizon ? toDateInput(horizon.start) : undefined}
                        max={horizon ? toDateInput(horizon.end) : undefined}
                        onChange={(event) =>
                          changeWindow(window.initiativeId, {
                            [key]: toDateIso(event.target.value),
                          } as PlanCardWindowPatch)
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p>
                  {formatPolishDate(window.earliest, planCardLocale)} → {formatPolishDate(window.target, planCardLocale)} →{' '}
                  {formatPolishDate(window.latest, planCardLocale)}
                </p>
              )}
              {rowError[window.initiativeId] && (
                <p role="alert" className="mt-1 text-sm text-c-danger">
                  {rowError[window.initiativeId] === 'ORDER'
                    ? t('initiatives.planCard.errorOrder', {
                        defaultValue:
                          'Zachowaj kolejność: najwcześniej ≤ data docelowa ≤ najpóźniej.',
                      })
                    : t('initiatives.planCard.errorHorizon', {
                        defaultValue: 'Data musi mieścić się w horyzoncie planu ({{from}} – {{to}}).',
                        from: formatPolishDate(horizon?.start ?? null, planCardLocale),
                        to: formatPolishDate(horizon?.end ?? null, planCardLocale),
                      })}
                </p>
              )}
              <div className="mt-2">
                <span className="text-xs text-c-text-muted">
                  {t('initiatives.planCard.afterInitiative', { defaultValue: 'Po inicjatywie' })}
                </span>
                {editable && onDependenciesChange ? (
                  <div className="mt-1 flex flex-wrap gap-3">
                    {scenario.windows
                      .filter((other) => other.initiativeId !== window.initiativeId)
                      .map((other) => (
                        <label
                          key={other.initiativeId}
                          className="flex items-center gap-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={window.dependencySnapshot.includes(other.initiativeId)}
                            aria-label={t('initiatives.planCard.afterInitiativeAria', {
                              defaultValue: '„{{name}}" po „{{predecessor}}"',
                              name: nameOf(window.initiativeId),
                              predecessor: nameOf(other.initiativeId),
                            })}
                            onChange={(event) =>
                              onDependenciesChange(
                                window.initiativeId,
                                event.target.checked
                                  ? [...window.dependencySnapshot, other.initiativeId]
                                  : window.dependencySnapshot.filter(
                                      (id) => id !== other.initiativeId
                                    )
                              )
                            }
                          />
                          {nameOf(other.initiativeId)}
                        </label>
                      ))}
                    {scenario.windows.length < 2 && (
                      <span className="text-sm text-c-text-muted">
                        {t('initiatives.planCard.noOtherInitiatives', {
                          defaultValue: 'Plan ma jedną inicjatywę — nie ma po czym jej ustawić.',
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">
                    {window.dependencySnapshot.length
                      ? window.dependencySnapshot.map(nameOf).join(', ')
                      : t('common.none', 'none')}
                  </p>
                )}
              </div>
              <p className="mt-2 text-sm text-c-text-muted">
                {formatPlanSolverReason(window.rationale, t, nameOf)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-c-text-muted">
          {t('initiatives.planCard.emptyWindows', {
            defaultValue: 'Plan nie ma jeszcze okien. Dodaj inicjatywy w „Zakres inicjatyw".',
          })}
        </p>
      )}
      {publishedNotice}
    </div>
  );

  // §4.1 pkt 3 i §4.0 D5: sekcja widoczna ZAWSZE („Brak konfliktów" zamiast
  // ukrycia — znikająca sekcja czytała się jak brak funkcji), a PROPOZYCJA
  // solvera renderuje się TU, nie tylko w oknie generatora. Bez tego „Pracuj
  // z AI → Analizuj" liczyło propozycję, której nie dało się ani zobaczyć,
  // ani zatwierdzić poza generatorem.
  const dependenciesSection = (
    <div className={box}>
      {dependencyAnalysisEnabled && proposal?.analysisSource === 'AI' && (
        <PlanDependencyAnalysisPanel
          proposal={proposal}
          editable={editable}
          busy={busy}
          resolveName={nameOf}
          onReview={onReview}
        />
      )}
      {proposalRows && proposalRows.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <h4 className="mb-1 font-medium">
            {t('initiatives.planCard.proposalTitle', {
              defaultValue: 'Propozycja solvera (do decyzji człowieka)',
            })}
          </h4>
          <table /* §27-exempt: read-only podglad propozycji w karcie (4 kolumny, bez sortowania/filtrow/kebaba) — nie jest przegladana lista encji */
            className="w-full text-sm"
            aria-label={t('initiatives.planGenerator.proposalAria', 'Proposed sequence')}
          >
            <thead>
              <tr className="text-left text-c-text-muted">
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnInitiative', 'Initiative')}
                </th>
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnWindow', 'Window from–to')}
                </th>
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnRationale', 'Justification')}
                </th>
                <th className="py-1">
                  {t('initiatives.planGenerator.columnConflict', 'Conflict')}
                </th>
              </tr>
            </thead>
            <tbody>
              {proposalRows.map((row) => (
                <tr key={row.initiativeId} className="border-t border-c-border-subtle align-top">
                  <td className="py-1 pr-3">{row.name}</td>
                  <td className="whitespace-nowrap py-1 pr-3">
                    {row.from} – {row.to}
                  </td>
                  <td className="py-1 pr-3">{formatPlanSolverReason(row.rationale, t, nameOf)}</td>
                  <td className="py-1">
                    {row.conflict
                      ? formatPlanSolverReason(row.conflict, t, nameOf)
                      : t('common.none', 'none')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editable && proposal?.status === 'PENDING_REVIEW' && proposal.analysisSource !== 'AI' && (
            <div className="mt-2 flex gap-2">
              <button type="button" className={button} disabled={busy} onClick={() => onReview('ACCEPT')}>
                {t('initiatives.planGenerator.accept', 'Approve')}
              </button>
              <button type="button" className={button} disabled={busy} onClick={() => onReview('REJECT')}>
                {t('initiatives.planGenerator.reject', 'Reject')}
              </button>
            </div>
          )}
        </div>
      )}
      {proposal?.conflicts.length ? (
        <ul className="list-disc pl-4 text-sm">
          {proposal.conflicts.map((conflict) => (
            <li key={conflict} className="text-c-danger">
              {formatPlanSolverReason(conflict, t, nameOf)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">
          {t('initiatives.planCard.noConflicts', { defaultValue: 'Brak konfliktów.' })}
        </p>
      )}
      {/*
        DEC-608 (cytat właściciela: „nie wiem, po co są te linie powyżej linii
        czasu") — pod flagą lista tekstowa ZNIKA z centrum; zależności czyta się
        z pasków. Klucze `afterList`/`noDependencies` zostają: użyje ich prawy
        panel „Relations" w etapie 3.
      */}
      {!planTimelineV2 && (
        <ul className="mt-3 space-y-1 text-sm">
          {scenario.windows.map((window) => (
            <li key={window.initiativeId}>
              {nameOf(window.initiativeId)} —{' '}
              {window.dependencySnapshot.length
                ? t('initiatives.planCard.afterList', {
                    defaultValue: 'po: {{list}}',
                    list: window.dependencySnapshot.map(nameOf).join(', '),
                  })
                : t('initiatives.planCard.noDependencies', { defaultValue: 'bez zależności' })}
            </li>
          ))}
        </ul>
      )}
      {/*
        SPEC §8 row 2 (DEC-627): komunikat zapisu musi być widoczny TAM, gdzie
        człowiek przeciąga pasek. `errorLabel` (409 → CONFLICT) renderował się
        dotąd tylko w sekcji „Decyzje" i w edytorze ról, więc po nieudanym
        zapisie okna w tej sekcji pasek wracał bez słowa wyjaśnienia.
      */}
      {errorLabel && (
        <p
          className="mt-3 text-sm text-c-danger"
          role="alert"
          data-testid="plan-window-conflict"
        >
          {errorLabel}
        </p>
      )}
      <div className="mt-5 border-t border-c-border-subtle pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-medium">{t('initiatives.planAnalysis.timelineTitle')}</h4>
            <p className="text-xs text-c-text-muted">
              {horizonMonths <= 3
                ? t('initiatives.planAnalysis.timelineWeeks')
                : t('initiatives.planAnalysis.timelineMonths')}
            </p>
            {planTimelineV2 && scenario.windows.length === 0 && fallbackItems.length > 0 && (
              <p className="mt-1 text-xs text-c-text-muted">
                {t('initiatives.planAnalysis.plannedHintCaption', {
                  defaultValue:
                    'Dashed bars come from initiative dates because this draft has no plan windows yet.',
                })}
              </p>
            )}
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-c-border">
            {([1, 3, 6, 12] as const).map((months) => (
              <button
                key={months}
                type="button"
                aria-pressed={horizonMonths === months}
                className={`px-3 py-1.5 text-sm ${
                  horizonMonths === months ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'
                }`}
                onClick={() => setHorizonMonths(months)}
              >
                {t('initiatives.planAnalysis.horizonMonths', { count: months })}
              </button>
            ))}
          </div>
        </div>
        <InitiativeGantt
          items={ganttItems}
          dependencies={ganttDependencies}
          criticalPathIds={criticalPathIds}
          frozenItemIds={frozenIds}
          rangeStart={ganttRange.start}
          rangeEnd={ganttRange.end}
          initialZoom={horizonMonths <= 3 ? 'week' : 'month'}
          rowLabels={planTimelineV2 ? ganttRowLabels : undefined}
          planStatus={planTimelineV2 ? scenario.status : undefined}
          onNewDraftVersion={planTimelineV2 ? onNewDraftVersion : undefined}
          onReschedule={
            planTimelineV2 && editable && scenario.windows.length
              ? handleGanttReschedule
              : undefined
          }
        />
        {!planTimelineV2 && (
          <p className="mt-2 text-xs text-c-text-muted">
            {t('initiatives.planAnalysis.frozenLegend')}
          </p>
        )}
      </div>
    </div>
  );

  const content: Record<string, React.ReactNode> = {
    horizon: (
      <div className={box}>
        <p>
          {windowUnitLabel(scenario.windowUnit, planCardLocale)} · {scenario.timezone}
        </p>
        <ul>
          {scenario.periods.map((period) => (
            <li key={period.periodId}>
              {formatPolishDate(period.start, planCardLocale)} – {formatPolishDate(period.end, planCardLocale)}
            </li>
          ))}
        </ul>
      </div>
    ),
    // P15-K2 (DEC-421): „Zakres inicjatyw" = OKNA PLANU, nie backlog całego modułu.
    // P15-K3: ten sam zakres jest EDYTOWALNY w szkicu (dodaj / usuń z planu).
    scope: scopeSection,
    windows: windowsSection,
    dependencies: dependenciesSection,
    // P15-K5 + P15-K3 (DEC-421): jedna sekcja niesie OBIE rzeczy — najpierw stan
    // z opublikowanej analizy obciążenia (K3: lista ograniczeń albo „Nieznane"),
    // pod nim edytor popytu per rola (K5), który ten popyt dopiero zadaje.
    capacity: (
      <div className={box}>
        {/* P15-K7 pkt 1 (DEC-421): WYNIK z powiązanej OPUBLIKOWANEJ analizy —
            arkusz okres × rola (popyt / podaż / luka), tylko do odczytu.
            Brak analizy = jawne „Nieznane" plus droga do jej utworzenia; nigdy
            arkusz zer, bo zero byłoby twierdzeniem, którego nie mamy. */}
        {capacitySheetRows.length ? (
          <div className="mb-4 overflow-x-auto">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-c-text-muted">
                {t('initiatives.planCard.capacityFromAnalysis', {
                  defaultValue: 'Wynik analizy „{{name}}" (wersja {{version}}).',
                  name:
                    capacityAnalysis?.name ??
                    t('initiatives.capacityAnalysis.unnamed', 'Untitled analysis'),
                  version: capacityAnalysis?.scenarioVersion ?? 0,
                })}
              </p>
              {onOpenCapacityAnalysis && (
                <button type="button" className={button} onClick={onOpenCapacityAnalysis}>
                  {t('initiatives.planCard.openCapacityAnalysis', {
                    defaultValue: 'Otwórz analizę',
                  })}
                </button>
              )}
            </div>
            <table /* §27-exempt: ARKUSZ okres x rola (siatka wartosci z analizy),
                     nie lista encji do przegladania — bez sortowania, filtrow i kebaba */
              className="w-full min-w-[560px] border-collapse text-sm"
              aria-label={t('initiatives.planCard.capacitySheetAria', {
                defaultValue: 'Obciążenie ról z analizy',
              })}
            >
              <thead>
                <tr className="border-b border-c-border-subtle text-left text-xs text-c-text-muted">
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.period', 'Period')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.role', 'Role')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.demand', 'Demand (FTE)')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.supply', 'Supply (FTE)')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.gap', 'Gap')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {capacitySheetRows.map((row) => (
                  <tr key={row.key} className="border-b border-c-border-subtle">
                    <td className="px-3 py-2">{row.periodId}</td>
                    <td className="px-3 py-2">{row.roleLabel}</td>
                    <td className="px-3 py-2">{fteText(row.demand, planCardLocale)}</td>
                    <td className="px-3 py-2">{fteText(row.supply, planCardLocale)}</td>
                    <td className="px-3 py-2">
                      {row.gap !== null && row.gap < 0 ? (
                        <span className="font-medium text-c-danger">{fteText(row.gap, planCardLocale)}</span>
                      ) : (
                        fteText(row.gap, planCardLocale)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-sm text-c-text-muted">
              {t('initiatives.planCard.capacityUnknown', {
                defaultValue: 'Nieznane — brak opublikowanej analizy obciążenia.',
              })}
            </p>
            {onNewCapacityAnalysis && (
              <button type="button" className={`mt-2 ${button}`} onClick={onNewCapacityAnalysis}>
                {t('initiatives.planCard.newCapacityAnalysis', {
                  defaultValue: 'Nowa analiza z tego planu',
                })}
              </button>
            )}
          </div>
        )}
        {capacityConstraints.length > 0 && (
          <ul className="mb-3 list-disc pl-4 text-sm text-c-text-muted">
            {capacityConstraints.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <PlanRoleDemandEditor
          windows={scenario.windows}
          initiativeNames={names}
          editable={scenario.status === 'DRAFT'}
          busy={busy}
          errorLabel={errorLabel}
          onChange={onRoleDemandChange}
        />
      </div>
    ),
    decisions: (
      <div className={box}>
        <p>
          {scenario.publishedAt
            ? `${t('initiatives.planCard.publishedOn', 'Published')} ${formatPolishDate(scenario.publishedAt, planCardLocale)}`
            : t('initiatives.planCard.remainsDraft', 'The plan remains a draft.')}
        </p>
        {savedLabel && (
          <p className="text-sm text-c-text-muted" role="status">
            {savedLabel}
          </p>
        )}
        {errorLabel && (
          <p className="text-sm text-c-danger" role="alert">
            {errorLabel}
          </p>
        )}
        {scenario.status === 'DRAFT' && (
          <button type="button" className={`mt-2 ${button}`} onClick={onPublish}>
            {t('initiatives.planCard.publishPlan', 'Publish plan')}
          </button>
        )}
        {publishedNotice}
      </div>
    ),
  };
  const sections: StandardSekcjaDef[] = PLAN_CARD_CONTRACT.flatMap((item) =>
    content[item.id]
      ? [{ ...item, component: content[item.id], aiContract: { none: true as const, reason: item.aiReason } }]
      : []
  );
  const rightPanel = {
    actions: {
      label: t('common.actions', 'Actions'),
      children: (
        <button
          className="rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={onBack}
        >
          {t('initiatives.planCard.backToList', 'Back to list')}
        </button>
      ),
      actionIds: ['back'],
    },
    properties: {
      label: t('initiatives.planCard.properties.title', 'Properties'),
      children: (
        <ArtifactPropertiesTable
          propertyLabel={t('initiatives.planCard.properties.propertyLabel', 'Property')}
          valueLabel={t('initiatives.planCard.properties.valueLabel', 'Value')}
          rows={[
            {
              id: 'status',
              label: t('initiatives.planCard.properties.status', 'Status'),
              value:
                scenario.status === 'DRAFT'
                  ? t('initiatives.planScenario.status.draft')
                  : scenario.status === 'PUBLISHED'
                    ? t('initiatives.planScenario.status.published')
                    : t('initiatives.planScenario.status.superseded'),
            },
            { id: 'version', label: t('initiatives.planCard.properties.version', 'Version'), value: scenario.scenarioVersion, mono: true },
            {
              id: 'portfolio',
              label: t('initiatives.planCard.properties.portfolioVersion', 'Source portfolio version'),
              value: scenario.portfolioScenarioVersion,
              mono: true,
            },
          ]}
        />
      ),
    },
    relations: { label: 'Powiązania', children: <p className="text-sm">{t('initiatives.planCard.sourcePortfolio', 'Source portfolio')}</p> },
    evidence: scenario.assumptions.length
      ? {
          label: 'Źródła i założenia',
          children: (
            <ul className="list-disc pl-4 text-sm">
              {scenario.assumptions.map((item) => (
                <li key={item}>{formatPlanSolverReason(item, t, nameOf)}</li>
              ))}
            </ul>
          ),
        }
      : { pominieta: true as const, reason: 'Brak zapisanych założeń.' },
    comments: { pominieta: true as const, reason: 'Plan nie ma osobnego wątku komentarzy.' },
    history: { label: 'Historia', children: <div className="text-sm">{t('initiatives.planCard.properties.version', 'Version')} {scenario.scenarioVersion}</div> },
  };
  return (
    <StandardArtifactShell
      karta="plan"
      klasa="L"
      header={{
        title,
        onTitleChange: () => undefined,
        titleReadOnly: true,
        artifactType: 'document' as never,
        artifactId: scenario.scenarioId,
        onSave: () => undefined,
        saveState: busy ? 'saving' : 'saved',
        lastSavedLabel: savedLabel ?? undefined,
        onClose: onBack,
        statusLabel:
          scenario.status === 'DRAFT'
            ? t('initiatives.planScenario.status.draft', 'Draft')
            : scenario.status === 'PUBLISHED'
              ? t('initiatives.planScenario.status.published', 'Published')
              : t('initiatives.planScenario.status.superseded', 'Superseded'),
        statusTone: scenario.status === 'PUBLISHED' ? 'approved' : 'draft',
      }}
      primaryAction={{
        intentionallyNone: true,
        reason: 'Publikacja jest decyzją w sekcji Decyzje.',
      }}
      sections={sections}
      rightPanel={rightPanel}
      activeSection={section}
      onSectionChange={setSection}
      densityMode="n"
      onDensityModeChange={() => undefined}
      toolbar={
        <DocumentCardMenu5
          sections={sections}
          activeSection={section}
          onSectionChange={setSection}
          readMode={readMode}
          onReadModeChange={scenario.status === 'DRAFT' ? setReadMode : undefined}
          ai={{
            onAnalizuj: () => onAnalyze('DEPENDENCIES'),
            analizaWToku: Boolean(busy),
            kontekstArtefaktu: { title, status: scenario.status, type: 'plan' },
            moznaEdytowac: editable,
            uzupelnijSekcje: {
              rodzaj: 'wlasnaPropozycja',
              // P15-K7 pkt 2: bez powiazanej analizy tryb mieszany dostalby 400
              // z regula CAPACITY_SCENARIO_REQUIRED — nie wysylamy zadania,
              // ktore z gory wiadomo, ze zostanie odrzucone.
              uruchom: () => onAnalyze(capacityModesBlockedReason ? 'DEPENDENCIES' : 'MIXED'),
              opis: 'Solver przygotuje propozycję dla aktywnej sekcji do przeglądu.',
            },
            uzupelnijDokument: {
              rodzaj: 'wlasnaPropozycja',
              uruchom: () => setGenerator(true),
              opis: 'Generator przygotuje propozycję całego planu; decyzję podejmiesz w oknie przeglądu.',
            },
          }}
        />
      }
      panelAriaLabel="Szczegóły planu"
      nakladki={
        <GeneratorPlanuModal
          open={generator}
          plannable={plannable ?? []}
          busy={busy}
          proposal={proposalRows ?? null}
          proposalConflicts={proposalConflicts}
          resolveName={nameOf}
          savedLabel={savedLabel}
          onClose={() => setGenerator(false)}
          onGenerate={(input) => (onGenerate ? onGenerate(input) : onAnalyze(input.mode))}
          onReview={onReview}
          capacityModesBlockedReason={capacityModesBlockedReason}
        />
      }
    />
  );
}
