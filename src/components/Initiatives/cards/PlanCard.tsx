import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { DocumentCardMenu5 } from '@/components/standard/DocumentCardMenu5';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import { PLAN_CARD_CONTRACT } from '@/components/standard/documentCardContracts';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';

import { formatPlanSolverReason } from '../planSolverReason';
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

const formatPolishDate = (value: string | null) => {
  if (!value) return 'Nieznane';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nieznane' : new Intl.DateTimeFormat('pl-PL').format(date);
};
/** „Nieznane" zamiast zera — brak liczby nie jest twierdzeniem o zerze. */
const fteText = (value: number | null) =>
  value === null
    ? 'Nieznane'
    : new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
const windowUnitLabel = (value: string) =>
  ({ WEEK: 'Tydzień', MONTH: 'Miesiąc', QUARTER: 'Kwartał' })[value] ?? value;
/** ISO → wartość `<input type="date">`; pusty napis dla braku daty. */
const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '');
const toDateIso = (value: string) => (value ? `${value}T00:00:00.000Z` : null);

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
  proposal?: { conflicts: string[]; changes: unknown[]; status: string } | null;
  proposalRows?: GeneratorProposalRow[] | null;
  proposalConflicts?: string[];
  savedLabel?: string | null;
  /** Komunikat błędu zapisu (np. konflikt wersji) — karta musi go POKAZAĆ. */
  errorLabel?: string | null;
  busy?: boolean;
  onBack: () => void;
  onAnalyze: (mode: PlanGenerationMode) => void;
  onGenerate?: (input: GeneratorPlanInput) => void;
  onReview: (outcome: 'ACCEPT' | 'REJECT') => void;
  onPublish: () => void;
  onAddInitiative?: (initiativeId: string) => void;
  onRemoveInitiative?: (initiativeId: string) => void;
  onWindowChange?: (initiativeId: string, patch: PlanCardWindowPatch) => void;
  onDependenciesChange?: (initiativeId: string, dependsOn: string[]) => void;
  /** P15-K5 po scaleniu: zapis popytu per rola idzie tą samą drogą CAS, co reszta karty. */
  onRoleDemandChange?: (initiativeId: string, roleDemand: RoleDemandLine[]) => Promise<boolean>;
  onNewDraftVersion?: () => void;
  /** P15-K7 pkt 1 (DEC-421): arkusz okres x rola z POWIAZANEJ opublikowanej analizy. */
  capacityAnalysis?: PlanCardCapacityAnalysis | null;
  onOpenCapacityAnalysis?: () => void;
  onNewCapacityAnalysis?: () => void;
}) {
  const { t } = useTranslation();
  const [section, setSection] = useState('horizon');
  const [generator, setGenerator] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [candidate, setCandidate] = useState('');
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

  const changeWindow = (initiativeId: string, patch: PlanCardWindowPatch) => {
    const current = scenario.windows.find((window) => window.initiativeId === initiativeId);
    if (!current || !onWindowChange) return;
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
    if (problem) return;
    onWindowChange(initiativeId, patch);
  };

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
                {nameOf(window.initiativeId)} · {formatPolishDate(window.target)}
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
                  ? ` · ${t('initiatives.planGenerator.statusPending', 'Do zatwierdzenia')}`
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
                  {formatPolishDate(window.earliest)} → {formatPolishDate(window.target)} →{' '}
                  {formatPolishDate(window.latest)}
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
                        from: formatPolishDate(horizon?.start ?? null),
                        to: formatPolishDate(horizon?.end ?? null),
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
                      : t('common.none', 'Brak')}
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
      {proposalRows && proposalRows.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <h4 className="mb-1 font-medium">
            {t('initiatives.planCard.proposalTitle', {
              defaultValue: 'Propozycja solvera (do decyzji człowieka)',
            })}
          </h4>
          <table /* §27-exempt: read-only podglad propozycji w karcie (4 kolumny, bez sortowania/filtrow/kebaba) — nie jest przegladana lista encji */
            className="w-full text-sm"
            aria-label={t('initiatives.planGenerator.proposalAria', 'Proponowana kolejność')}
          >
            <thead>
              <tr className="text-left text-c-text-muted">
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnInitiative', 'Inicjatywa')}
                </th>
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnWindow', 'Okno od–do')}
                </th>
                <th className="py-1 pr-3">
                  {t('initiatives.planGenerator.columnRationale', 'Uzasadnienie')}
                </th>
                <th className="py-1">
                  {t('initiatives.planGenerator.columnConflict', 'Konflikt')}
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
                      : t('common.none', 'Brak')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editable && proposal?.status === 'PENDING_REVIEW' && (
            <div className="mt-2 flex gap-2">
              <button type="button" className={button} disabled={busy} onClick={() => onReview('ACCEPT')}>
                {t('initiatives.planGenerator.accept', 'Zatwierdź')}
              </button>
              <button type="button" className={button} disabled={busy} onClick={() => onReview('REJECT')}>
                {t('initiatives.planGenerator.reject', 'Odrzuć')}
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
    </div>
  );

  const content: Record<string, React.ReactNode> = {
    horizon: (
      <div className={box}>
        <p>
          {windowUnitLabel(scenario.windowUnit)} · {scenario.timezone}
        </p>
        <ul>
          {scenario.periods.map((period) => (
            <li key={period.periodId}>
              {formatPolishDate(period.start)} – {formatPolishDate(period.end)}
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
                    t('initiatives.capacityAnalysis.unnamed', 'Analiza bez nazwy'),
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
                    {t('initiatives.capacityAnalysis.columns.period', 'Okres')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.role', 'Rola')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.demand', 'Popyt (FTE)')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.supply', 'Podaż (FTE)')}
                  </th>
                  <th className="px-3 py-2">
                    {t('initiatives.capacityAnalysis.columns.gap', 'Luka')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {capacitySheetRows.map((row) => (
                  <tr key={row.key} className="border-b border-c-border-subtle">
                    <td className="px-3 py-2">{row.periodId}</td>
                    <td className="px-3 py-2">{row.roleLabel}</td>
                    <td className="px-3 py-2">{fteText(row.demand)}</td>
                    <td className="px-3 py-2">{fteText(row.supply)}</td>
                    <td className="px-3 py-2">
                      {row.gap !== null && row.gap < 0 ? (
                        <span className="font-medium text-c-danger">{fteText(row.gap)}</span>
                      ) : (
                        fteText(row.gap)
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
            ? `Opublikowano ${formatPolishDate(scenario.publishedAt)}`
            : 'Plan pozostaje szkicem.'}
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
            Opublikuj plan
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
      label: 'Akcje',
      children: (
        <button
          className="rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={onBack}
        >
          Wróć do listy
        </button>
      ),
      actionIds: ['back'],
    },
    properties: {
      label: 'Właściwości',
      children: (
        <ArtifactPropertiesTable
          propertyLabel="Właściwość"
          valueLabel="Wartość"
          rows={[
            {
              id: 'status',
              label: 'Status',
              value:
                scenario.status === 'DRAFT'
                  ? 'Szkic'
                  : scenario.status === 'PUBLISHED'
                    ? 'Opublikowany'
                    : 'Zastąpiony',
            },
            { id: 'version', label: 'Wersja', value: scenario.scenarioVersion, mono: true },
            {
              id: 'portfolio',
              label: 'Wersja portfela źródłowego',
              value: scenario.portfolioScenarioVersion,
              mono: true,
            },
          ]}
        />
      ),
    },
    relations: { label: 'Powiązania', children: <p className="text-sm">Portfel źródłowy</p> },
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
    history: { label: 'Historia', children: <div className="text-sm">Wersja {scenario.scenarioVersion}</div> },
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
            ? 'Szkic'
            : scenario.status === 'PUBLISHED'
              ? 'Opublikowany'
              : 'Zastąpiony',
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
