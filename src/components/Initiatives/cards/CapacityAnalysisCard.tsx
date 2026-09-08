import React, { useMemo, useState } from 'react';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { DocumentCardMenu5 } from '@/components/standard/DocumentCardMenu5';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import { CAPACITY_ANALYSIS_CARD_CONTRACT } from '@/components/standard/documentCardContracts';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';
import i18n from '@/i18n';
import {
  CapacityOptionsPanel,
  type CapacityComparison,
} from '@/components/Initiatives/CapacityOptionsPanel';

type Range = { knowledgeState: string; base: number | null };
/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — linia ARKUSZA: okres x rola.
 * `null` = „Nieznane", nigdy zero (zero jest twierdzeniem, ktorego nie mamy).
 */
export interface CapacityRoleLine {
  roleId: string;
  roleLabel: string;
  demand: number | null;
  supply: number | null;
  supplySource: 'RESOURCE_PLAN' | 'MANUAL' | 'UNKNOWN';
  demandSource: 'PLAN' | 'MANUAL' | 'UNKNOWN';
}
export interface CapacityCardScenario {
  scenarioId: string;
  name?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scenarioVersion: number;
  planScenarioId: string;
  planScenarioVersion: number;
  periods: Array<{
    periodId: string;
    demand: Range;
    supply: Range;
    roles?: CapacityRoleLine[];
  }>;
  proposedAssignments: Array<{ resourceOrRoleId: string; periodIds: string[]; rationale: string }>;
  constraints: Array<{ detail: string; state: string }>;
  publishedAt: string | null;
}

export interface CapacityRoleGap {
  periodId: string;
  roleId: string;
  roleLabel: string;
  demand: number;
  supply: number;
  gap: number;
}
/** Luka liczona PER ROLA — suma po rolach chowa brak jednej roli za nadmiarem innej. */
export const capacityRoleGaps = (scenario: CapacityCardScenario): CapacityRoleGap[] =>
  scenario.periods.flatMap((period) =>
    (period.roles ?? []).flatMap((role) =>
      role.demand !== null && role.supply !== null && role.demand > role.supply
        ? [
            {
              periodId: period.periodId,
              roleId: role.roleId,
              roleLabel: role.roleLabel,
              demand: role.demand,
              supply: role.supply,
              gap: Math.round((role.supply - role.demand) * 100) / 100,
            },
          ]
        : []
    )
  );
export const countCapacityGaps = (scenario: CapacityCardScenario) =>
  scenario.periods.some((period) => (period.roles ?? []).length)
    ? capacityRoleGaps(scenario).length
    : scenario.periods.filter(
        (p) => p.demand.base !== null && p.supply.base !== null && p.demand.base > p.supply.base
      ).length;

const unknownText = () => i18n.t('initiatives.capacityAnalysis.unknownValue', 'Unknown');
const num = (value: number | null) =>
  value === null ? unknownText() : new Intl.NumberFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', { maximumFractionDigits: 2 }).format(value);
const supplySourceLabel = (value: CapacityRoleLine['supplySource']) =>
  ({
    RESOURCE_PLAN: i18n.t('initiatives.capacityAnalysis.supplySource.resourcePlan', 'From Resources'),
    MANUAL: i18n.t('initiatives.capacityAnalysis.supplySource.manual', 'Manual'),
    UNKNOWN: i18n.t('initiatives.capacityAnalysis.supplySource.unknown', 'Unknown'),
  })[value];
const demandSourceLabel = (value: CapacityRoleLine['demandSource']) =>
  ({
    PLAN: i18n.t('initiatives.capacityAnalysis.demandSource.plan', 'Z planu'),
    MANUAL: i18n.t('initiatives.capacityAnalysis.demandSource.manual', 'Manual'),
    UNKNOWN: i18n.t(
      'initiatives.capacityAnalysis.demandSource.unknown',
      'Unknown (no role breakdown)'
    ),
  })[value];

export function CapacityAnalysisCard({
  scenario,
  noPressure = false,
  needsPublish = false,
  comparisons = [],
  planName,
  advisorBusy = false,
  supplyBusy = false,
  onBack,
  onAnalyze,
  onPublish,
  onSupplyOverride,
  onSelectOption,
  onOpenPlan,
  variantOutcome = null,
}: {
  scenario: CapacityCardScenario;
  noPressure?: boolean;
  /** Doradca dziala tylko na OPUBLIKOWANEJ analizie — mowimy to wprost, nie milczymy. */
  needsPublish?: boolean;
  comparisons?: CapacityComparison[];
  planName?: string | null;
  advisorBusy?: boolean;
  supplyBusy?: boolean;
  onBack: () => void;
  onAnalyze: () => void;
  onPublish: () => void;
  onSupplyOverride?: (periodId: string, roleId: string, supply: number) => void;
  onSelectOption?: (comparison: CapacityComparison, optionId: string) => void;
  /** P15-K6: „→ plan vN (szkic)" prowadzi do karty planu w zakładce Plan. */
  onOpenPlan?: (planScenarioId: string) => void;
  /** P15-K6: wynik ostatniego wyboru wariantu (propozycja poszła / brak przesunięcia). */
  variantOutcome?: 'APPLIED' | 'NO_SHIFT' | null;
}) {
  const [section, setSection] = useState('source');
  const [readMode, setReadMode] = useState(false);
  const [draftSupply, setDraftSupply] = useState<Record<string, string>>({});
  const title = resolveBusinessDisplayLabel({
    displayName: scenario.name,
    rawId: scenario.scenarioId,
    fallback: i18n.t('initiatives.capacityAnalysis.unnamed', 'Analiza bez nazwy'),
  });
  const roleGaps = useMemo(() => capacityRoleGaps(scenario), [scenario]);
  const gaps = useMemo(() => countCapacityGaps(scenario), [scenario]);
  const hasSheet = scenario.periods.some((period) => (period.roles ?? []).length > 0);
  const decidedComparisons = useMemo(
    () => comparisons.filter((comparison) => comparison.selectedOptionId !== null),
    [comparisons]
  );
  const roles = useMemo(
    () =>
      hasSheet
        ? [
            ...new Set(
              scenario.periods.flatMap((period) =>
                (period.roles ?? []).filter((role) => (role.demand ?? 0) > 0).map((r) => r.roleId)
              )
            ),
          ]
        : [...new Set(scenario.proposedAssignments.map((a) => a.resourceOrRoleId))],
    [scenario, hasSheet]
  );
  const box = 'rounded-xl border border-c-border-subtle bg-c-surface p-4';
  const cell = 'px-3 py-2 text-sm';
  const head = 'px-3 py-2 text-left text-xs font-medium text-c-text-muted';

  const worksheet = hasSheet ? (
    <div className={`${box} overflow-x-auto`}>
      <p className="mb-3 text-sm text-c-text-muted">
        {i18n.t(
          'initiatives.capacityAnalysis.worksheetHint',
          'Popyt pochodzi z „Obciążenia ról" opublikowanego planu, podaż ze stanowisk osób w organizacji (1 FTE = 40 h/tydzień). Podaż możesz poprawić ręcznie.'
        )}
      </p>
      <table /* §27-exempt: ARKUSZ okres x rola w karcie artefaktu (siatka wartosci
               do wpisania), nie lista encji do przegladania — StandardTable nie ma
               modelu komorki edytowalnej per (wiersz, kolumna) */ className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-c-border-subtle">
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.period', 'Okres')}</th>
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.role', 'Rola')}</th>
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.demand', 'Popyt (FTE)')}</th>
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.supply', 'Supply (FTE)')}</th>
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.gap', 'Luka')}</th>
            <th className={head}>{i18n.t('initiatives.capacityAnalysis.columns.supplySourceShort', 'Supply source')}</th>
          </tr>
        </thead>
        <tbody>
          {scenario.periods.flatMap((period) =>
            (period.roles ?? []).map((role) => {
              const key = `${period.periodId}|${role.roleId}`;
              const gap =
                role.demand === null || role.supply === null
                  ? null
                  : Math.round((role.supply - role.demand) * 100) / 100;
              return (
                <tr key={key} className="border-b border-c-border-subtle">
                  <td className={cell}>{period.periodId}</td>
                  <td className={cell}>{role.roleLabel}</td>
                  <td className={cell} title={demandSourceLabel(role.demandSource)}>
                    {num(role.demand)}
                  </td>
                  <td className={cell}>
                    {onSupplyOverride && scenario.status === 'DRAFT' && !readMode ? (
                      <input
                        aria-label={`${i18n.t('initiatives.capacityAnalysis.columns.supply', 'Supply (FTE)')} ${period.periodId} ${role.roleLabel}`}
                        className="w-20 rounded border border-c-border bg-c-surface px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        inputMode="decimal"
                        disabled={supplyBusy}
                        value={draftSupply[key] ?? (role.supply === null ? '' : String(role.supply))}
                        onChange={(event) =>
                          setDraftSupply((current) => ({ ...current, [key]: event.target.value }))
                        }
                        onBlur={(event) => {
                          const next = Number(event.target.value.replace(',', '.'));
                          if (!Number.isFinite(next) || next < 0 || next === role.supply) return;
                          onSupplyOverride(period.periodId, role.roleId, next);
                        }}
                      />
                    ) : (
                      num(role.supply)
                    )}
                  </td>
                  <td className={cell}>
                    {gap === null ? (
                      unknownText()
                    ) : gap < 0 ? (
                      <span className="font-medium text-c-danger">{num(gap)}</span>
                    ) : (
                      num(gap)
                    )}
                  </td>
                  <td className={`${cell} text-c-text-muted`}>
                    {supplySourceLabel(role.supplySource)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  ) : scenario.periods.length ? (
    <div className={box}>
      <p className="mb-3 text-sm text-c-text-muted">
        {i18n.t(
          'initiatives.capacityAnalysis.noRoleSheet',
          'This analysis predates the role dimension. Create a new analysis from a published plan to see the period × role worksheet.'
        )}
      </p>
      {scenario.periods.map((p) => (
        <div key={p.periodId} className="grid grid-cols-3 border-b border-c-border-subtle py-2">
          <b>{p.periodId}</b>
          <span>
            {i18n.t('initiatives.capacityAnalysis.columns.demand', 'Popyt (FTE)')}: {num(p.demand.base)}
          </span>
          <span>
            {i18n.t('initiatives.capacityAnalysis.columns.supply', 'Supply (FTE)')}: {num(p.supply.base)}
          </span>
        </div>
      ))}
    </div>
  ) : null;

  const content: Record<string, React.ReactNode> = {
    source: (
      <div className={box}>
        {planName ?? i18n.t('initiatives.capacityAnalysis.sourcePlanFallback', 'Source plan')} · v
        {scenario.planScenarioVersion}
      </div>
    ),
    worksheet,
    pressure: (
      <div className={box}>
        {roleGaps.length ? (
          <ul className="space-y-1 text-sm">
            {roleGaps.map((gap) => (
              <li key={`${gap.periodId}|${gap.roleId}`}>
                <b>{gap.roleLabel}</b> · {gap.periodId} ·{' '}
                {i18n.t('initiatives.capacityAnalysis.gapLine', {
                  defaultValue: 'popyt {{demand}} FTE wobec podaży {{supply}} FTE (brakuje {{gap}})',
                  demand: num(gap.demand),
                  supply: num(gap.supply),
                  gap: num(Math.abs(gap.gap)),
                })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-c-text-muted">
            {hasSheet
              ? i18n.t('initiatives.capacityAnalysis.noGaps', 'No role is overloaded.')
              : i18n.t(
                  'initiatives.capacityAnalysis.noGapsLegacy',
                  'No gaps detected (analysis without the role dimension).'
                )}
          </p>
        )}
        <p className="mt-3 text-xs text-c-text-muted">
          {i18n.t('initiatives.capacityAnalysis.columns.roles', 'Role')}: {roles.length || unknownText()}
        </p>
      </div>
    ),
    proposals: (
      <div className={box}>
        {needsPublish && (
          <div role="status" className="mb-3">
            <p className="text-sm text-c-text-muted">
              {i18n.t(
                'initiatives.capacityAnalysis.needsPublish',
                'Doradca liczy warianty dla opublikowanej analizy. Opublikuj analizę w sekcji „Decyzje", potem uruchom „Pracuj z AI".'
              )}
            </p>
            {/* P15-K7 pkt 3: K5 dał komunikat po polsku, ale odsyłał do innej
                sekcji — przycisk jest tutaj, żeby nie szukać. */}
            {scenario.status === 'DRAFT' && (
              <button
                type="button"
                className="mt-2 rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                onClick={onPublish}
              >
                {i18n.t('initiatives.capacityAnalysis.publish', 'Publish analysis')}
              </button>
            )}
          </div>
        )}
        {noPressure && (
          <p role="status" className="mb-3 text-sm text-c-text-muted">
            {i18n.t(
              'initiatives.capacityAdvisor.noPressure',
              'No overload — there is nothing to resolve'
            )}
          </p>
        )}
        {variantOutcome && (
          <p role="status" className="mb-3 text-sm text-c-text-muted">
            {variantOutcome === 'APPLIED'
              ? i18n.t(
                  'initiatives.capacityAnalysis.variantApplied',
                  'Wybór zapisany. Szczegóły i link do planu znajdziesz w sekcji „Decyzje".'
                )
              : i18n.t(
                  'initiatives.capacityAnalysis.variantNoShift',
                  'The advisor found no feasible shift — the decision is recorded, the plan is unchanged.'
                )}
          </p>
        )}
        <CapacityOptionsPanel
          comparisons={comparisons}
          saving={advisorBusy}
          onSelect={(comparison, optionId) => onSelectOption?.(comparison, optionId)}
        />
      </div>
    ),
    decisions: (
      <div className={box}>
        {/* P15-K6 (DEC-421): ŚLAD WYBORU WARIANTU. Do K5 wybór żył wyłącznie w
            `nextGovernedInput` panelu porównania — po odświeżeniu karta nie
            mówiła, co zdecydowano ani gdzie tego szukać w Planie. */}
        {decidedComparisons.length > 0 && (
          <ul className="mb-3 space-y-2 text-sm">
            {decidedComparisons.map((comparison) => (
              <li key={comparison.comparisonId}>
                <b>
                  {i18n.t('initiatives.capacityAnalysis.decision.selected', 'Wybrano wariant')}:
                </b>{' '}
                {comparison.decisionNote ??
                  i18n.t(
                    'initiatives.capacityAnalysis.decision.noteMissing',
                    'wariant bez zapisanego opisu'
                  )}
                {comparison.resultingPlanRef && (
                  <>
                    {' → '}
                    <button
                      type="button"
                      className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      onClick={() =>
                        onOpenPlan?.(comparison.resultingPlanRef?.scenarioId ?? '')
                      }
                    >
                      {i18n.t('initiatives.capacityAnalysis.decision.planDraft', {
                        defaultValue: 'plan v{{version}} (szkic)',
                        version: comparison.resultingPlanRef.scenarioVersion,
                      })}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {scenario.status === 'DRAFT' ? (
          <button
            className="rounded-lg border border-c-border px-3 py-2 focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={onPublish}
          >
            {i18n.t('initiatives.capacityAnalysis.publish', 'Publish analysis')}
          </button>
        ) : (
          `${i18n.t('initiatives.capacityAnalysis.publishedAt', 'Opublikowano')} ${scenario.publishedAt ? new Intl.DateTimeFormat('pl-PL').format(new Date(scenario.publishedAt)) : '—'}`
        )}
      </div>
    ),
  };
  const sections: StandardSekcjaDef[] = CAPACITY_ANALYSIS_CARD_CONTRACT.flatMap((item) =>
    content[item.id]
      ? [{ ...item, component: content[item.id], aiContract: { none: true as const, reason: item.aiReason } }]
      : []
  );
  const statusLabel =
    scenario.status === 'DRAFT'
      ? i18n.t('initiatives.planScenario.status.draft', 'Draft')
      : scenario.status === 'PUBLISHED'
        ? i18n.t('initiatives.planScenario.status.published', 'Opublikowany')
        : i18n.t('initiatives.planScenario.status.superseded', 'Superseded');
  const right = {
    actions: {
      label: i18n.t('initiatives.capacityAnalysis.panel.actions', 'Akcje'),
      children: (
        <button
          className="rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={onBack}
        >
          {i18n.t('initiatives.capacityAnalysis.backToList', 'Back to list')}
        </button>
      ),
      actionIds: ['back'],
    },
    properties: {
      label: i18n.t('initiatives.capacityAnalysis.panel.properties', 'Properties'),
      children: (
        <ArtifactPropertiesTable
          propertyLabel={i18n.t('initiatives.capacityAnalysis.panel.property', 'Property')}
          valueLabel={i18n.t('initiatives.capacityAnalysis.panel.value', 'Value')}
          rows={[
            { id: 'status', label: i18n.t('initiatives.capacityAnalysis.panel.status', 'Status'), value: statusLabel },
            {
              id: 'periods',
              label: i18n.t('initiatives.capacityAnalysis.columns.periods', 'Okresy'),
              value: scenario.periods.length,
              mono: true,
            },
            {
              id: 'roles',
              label: i18n.t('initiatives.capacityAnalysis.columns.roles', 'Role'),
              value: roles.length,
              mono: true,
            },
            {
              id: 'gaps',
              label: i18n.t('initiatives.capacityAnalysis.columns.gaps', 'Luki'),
              value: gaps,
              mono: true,
            },
          ]}
        />
      ),
    },
    relations: {
      label: i18n.t('initiatives.capacityAnalysis.panel.relations', 'Relations'),
      children: (
        <p className="text-sm">
          {planName ?? i18n.t('initiatives.capacityAnalysis.sourcePlanFallback', 'Source plan')} ·{' '}
          {i18n.t('initiatives.capacityAnalysis.version', 'wersja')} {scenario.planScenarioVersion}
        </p>
      ),
    },
    evidence: scenario.constraints.length
      ? {
          label: i18n.t('initiatives.capacityAnalysis.panel.evidence', 'Sources and assumptions'),
          children: (
            <ul className="list-disc pl-4 text-sm">
              {scenario.constraints.map((item) => (
                <li key={item.detail}>{item.detail}</li>
              ))}
            </ul>
          ),
        }
      : {
          pominieta: true as const,
          reason: i18n.t('initiatives.capacityAnalysis.noConstraints', 'No recorded constraints.'),
        },
    comments: {
      pominieta: true as const,
      reason: i18n.t(
        'initiatives.capacityAnalysis.noComments',
        'No comment thread for this analysis.'
      ),
    },
    history: {
      label: i18n.t('initiatives.capacityAnalysis.panel.history', 'Historia'),
      children: (
        <div>
          {i18n.t('initiatives.capacityAnalysis.version', 'wersja')} {scenario.scenarioVersion}
        </div>
      ),
    },
  };
  return (
    <StandardArtifactShell
      karta="capacity_analysis"
      klasa="L"
      header={{
        title,
        onTitleChange: () => undefined,
        titleReadOnly: true,
        artifactType: 'document' as any,
        artifactId: scenario.scenarioId,
        onSave: () => undefined,
        saveState: supplyBusy ? 'saving' : 'saved',
        onClose: onBack,
        statusLabel,
        statusTone: scenario.status === 'PUBLISHED' ? 'approved' : 'draft',
      }}
      primaryAction={{
        intentionallyNone: true,
        reason: i18n.t(
          'initiatives.capacityAnalysis.primaryNone',
          'Publishing is a decision in the Decisions section.'
        ),
      }}
      sections={sections}
      rightPanel={right}
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
            onAnalizuj: onAnalyze,
            analizaWToku: advisorBusy,
            kontekstArtefaktu: { title, status: scenario.status, type: 'capacity_analysis' },
            moznaEdytowac: scenario.status === 'DRAFT' && !readMode,
            uzupelnijSekcje: {
              rodzaj: 'wlasnaPropozycja',
              uruchom: onAnalyze,
              opis: i18n.t(
                'initiatives.capacityAnalysis.aiSection',
                'Doradca przygotuje propozycje zmian do oceny.'
              ),
            },
            uzupelnijDokument: {
              rodzaj: 'wlasnaPropozycja',
              uruchom: onAnalyze,
              opis: i18n.t(
                'initiatives.capacityAnalysis.aiDocument',
                'The advisor will prepare a whole-analysis variant for review.'
              ),
            },
          }}
        />
      }
      panelAriaLabel={i18n.t('initiatives.capacityAnalysis.panelAria', 'Load analysis details')}
    />
  );
}
