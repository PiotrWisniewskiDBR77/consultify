/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — „Propozycje zmian" doradcy mocy.
 *
 * POMIAR 07.09: panel istnial w `CapacityScenarioSurface.tsx` POD wczesniejszym
 * `return`, wiec karta analizy pokazywala w tej sekcji jedno stale zdanie
 * („Uruchom Pracuj z AI…") mimo HTTP 200 z `POST /capacity-options/:id/propose`.
 * Wydzielony do wlasnego pliku, zeby KARTA i powierzchnia rejestru rysowaly
 * DOKLADNIE ten sam komponent — jeden wyglad, jedno miejsce zmiany.
 */
import React from 'react';

import { memberNameOrUnknown, type MemberNameResolver } from '@/hooks/useOrganizationMemberNames';
import i18n from '@/i18n';

import { formatPlanSolverReason } from './planSolverReason';

export type CapacityKnowledgeState = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
export type OptionRange = {
  low: number | null;
  base: number | null;
  high: number | null;
  unit: string;
  knowledgeState: CapacityKnowledgeState;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  sourceRefs: Array<{ ref: string; version: number }>;
};
export type CapacityOption = {
  optionId: string;
  kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY';
  assumptions: Array<{
    assumption: string;
    ownerId: string;
    sourceRef: { ref: string; version: number };
    knowledgeState: CapacityKnowledgeState;
  }>;
  affectedMemberships: Array<{ initiativeId: string; membershipVersion: number }>;
  affectedPeriods: string[];
  affectedResources: Array<{ resourceRef: string; version: number }>;
  impact: { date: OptionRange; scope: OptionRange; cost: OptionRange; risk: OptionRange };
  rationale: string;
};
export type CapacityComparison = {
  version: number;
  comparisonId: string;
  planRef: { scenarioId: string; version: number };
  capacityRef: { scenarioId: string; version: number };
  status: 'DRAFT' | 'SELECTED';
  options: CapacityOption[];
  selectedOptionId: string | null;
  nextGovernedInput: {
    kind: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';
    optionId: string;
    comparisonId: string;
    comparisonVersion: number;
  } | null;
  /** P15-K6 (DEC-421): ślad decyzji — kto wybrał wariant, kiedy i z jakim skutkiem. */
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  resultingPlanRef?: {
    scenarioId: string;
    scenarioVersion: number;
    proposalId: string | null;
  } | null;
};

const knowledgeLabel = (value: CapacityKnowledgeState): string =>
  ({
    KNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.known'),
    ESTIMATED: i18n.t('initiatives.capacityAdvisor.knowledge.estimated'),
    UNKNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.unknown'),
    UNCONFIRMED: i18n.t('initiatives.capacityAdvisor.knowledge.unconfirmed'),
  })[value];

const optionLabels: Record<CapacityOption['kind'], string> = {
  RESEQUENCE: i18n.t('initiatives.capacityOptions.kind.resequence', 'Change order'),
  SCOPE_SPLIT: i18n.t('initiatives.capacityOptions.kind.scopeSplit', 'Split scope'),
  ADD_CAPACITY: i18n.t('initiatives.capacityOptions.kind.addCapacity', 'Increase availability'),
};

const OptionImpact = ({ label, value }: { label: string; value: OptionRange }) => (
  <div className="rounded border border-c-border p-2">
    <dt className="text-xs font-medium">{label}</dt>
    <dd className="text-sm">
      {value.knowledgeState === 'UNKNOWN' || value.knowledgeState === 'UNCONFIRMED'
        ? `${value.knowledgeState} — ${i18n.t('initiatives.capacityOptions.noConfirmedValue', 'no confirmed value')}`
        : `${value.low} / ${value.base} / ${value.high} ${value.unit}`}
    </dd>
    <dd className="text-xs text-c-text-muted">
      {value.confidence} ·{' '}
      {value.sourceRefs.length
        ? value.sourceRefs.map((source) => `${source.ref} v${source.version}`).join(', ')
        : 'EVIDENCE_MISSING'}
    </dd>
  </div>
);

export type NextGovernedInputKind = 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';

/**
 * `nextInputKind` bywa sterowane z zewnatrz (powierzchnia rejestru trzyma je
 * w swoim stanie), a w karcie analizy nie ma go kto trzymac — stad wariant
 * niesterowany z wlasnym stanem. Bez tego karta musialaby duplikowac stan
 * powierzchni, czyli dokladnie to, czego kanon zabrania.
 */
export const CapacityOptionsPanel = ({
  comparisons,
  nextInputKind: controlledKind,
  onNextInputKind,
  onSelect,
  saving,
  resolveMemberName,
}: {
  comparisons: CapacityComparison[];
  nextInputKind?: NextGovernedInputKind;
  onNextInputKind?: (value: NextGovernedInputKind) => void;
  onSelect: (comparison: CapacityComparison, optionId: string) => void;
  saving: boolean;
  resolveMemberName?: MemberNameResolver;
}) => {
  const [ownKind, setOwnKind] = React.useState<NextGovernedInputKind>('MATERIAL_CHANGE');
  const nextInputKind = controlledKind ?? ownKind;
  const setKind = (value: NextGovernedInputKind) =>
    onNextInputKind ? onNextInputKind(value) : setOwnKind(value);
  return (
  <section aria-label={i18n.t('initiatives.capacityOptions.sectionAria', 'Capacity options comparison')} className="border-t border-c-border pt-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h4 className="font-medium">{i18n.t('initiatives.capacityOptions.title', 'Constraint resolution options')}</h4>
        <p className="text-xs text-c-text-muted">
          {i18n.t('initiatives.capacityOptions.subtitle', 'This is a comparison only. Selecting an option creates a controlled request for the next decision and does not change the plan, baseline version or assignment by itself.')}
        </p>
      </div>
      <label className="text-xs">
        {i18n.t('initiatives.capacityOptions.nextInputLabel', 'Next controlled decision')}
        <select
          aria-label="Capacity governed next input"
          className="ml-2 rounded border border-c-border bg-c-background p-2"
          value={nextInputKind}
          onChange={(event) => setKind(event.target.value as NextGovernedInputKind)}
        >
          <option value="MATERIAL_CHANGE">{i18n.t('initiatives.capacityOptions.nextInput.materialChange', 'Plan change')}</option>
          <option value="SCHEDULE_DECISION">{i18n.t('initiatives.capacityOptions.nextInput.scheduleDecision', 'Schedule decision')}</option>
        </select>
      </label>
    </div>
    {comparisons.length === 0 ? (
      <p className="mt-3 text-sm text-c-text-muted">
        {i18n.t('initiatives.capacityOptions.noSavedComparison', 'No saved comparison for this scenario.')}
      </p>
    ) : (
      comparisons.map((comparison) => (
        <article key={comparison.comparisonId} className="mt-3 rounded border border-c-border p-3">
          <div className="flex justify-between text-xs">
            <span>
              {comparison.comparisonId} · v{comparison.version} · {comparison.status}
            </span>
            <span>
              Plan {comparison.planRef.scenarioId} v{comparison.planRef.version} · Capacity v
              {comparison.capacityRef.version}
            </span>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {comparison.options.map((option) => (
              <section
                key={option.optionId}
                aria-label={`${i18n.t('initiatives.capacityOptions.optionAriaPrefix', 'Load option:')} ${optionLabels[option.kind]}`}
                className={`rounded border p-3 ${comparison.selectedOptionId === option.optionId ? 'border-c-focus-solid' : 'border-c-border'}`}
              >
                <h5 className="font-semibold">{optionLabels[option.kind]}</h5>
                <p className="text-xs text-c-text-muted">{option.rationale}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <OptionImpact label={i18n.t('initiatives.capacityOptions.impact.date', 'Date')} value={option.impact.date} />
                  <OptionImpact label={i18n.t('initiatives.capacityOptions.impact.scope', 'Scope')} value={option.impact.scope} />
                  <OptionImpact label={i18n.t('initiatives.capacityOptions.impact.cost', 'Cost')} value={option.impact.cost} />
                  <OptionImpact label={i18n.t('initiatives.capacityOptions.impact.risk', 'Risk')} value={option.impact.risk} />
                </dl>
                <div className="mt-2 text-xs">
                  <strong>{i18n.t('initiatives.capacityOptions.assumptions', 'Assumptions')}</strong>
                  {option.assumptions.map((assumption) => (
                    <p key={`${option.optionId}:${assumption.assumption}`}>
                      {assumption.knowledgeState} ·{' '}
                      {/* Konflikt solvera przychodzi jako KOD (P15-K3) — tu dostaje język.
                          Panel wyjety z powierzchni do wlasnego pliku (P15-K5), wiec
                          tlumaczenie mieszka razem z jedynym miejscem, ktore je rysuje. */}
                      {formatPlanSolverReason(assumption.assumption, (klucz, opcje) =>
                        String(i18n.t(klucz, opcje))
                      )}{' '}
                      · {i18n.t('initiatives.capacityAdvisor.workbench.owner', 'owner')}{' '}
                      {memberNameOrUnknown(resolveMemberName, assumption.ownerId, true)} ·{' '}
                      {assumption.sourceRef.ref} v
                      {assumption.sourceRef.version}
                    </p>
                  ))}
                  <p>
                    {i18n.t('initiatives.capacityOptions.initiatives', 'Initiatives:')}{' '}
                    {option.affectedMemberships
                      .map((item) => `${item.initiativeId} v${item.membershipVersion}`)
                      .join(', ') || i18n.t('common.none', 'none')}
                  </p>
                  <p>{i18n.t('initiatives.capacityOptions.periods', 'Periods:')} {option.affectedPeriods.join(', ') || i18n.t('common.none', 'none')}</p>
                  <p>
                    {i18n.t('initiatives.capacityOptions.resources', 'Resources:')}{' '}
                    {option.affectedResources
                      .map((item) => `${item.resourceRef} v${item.version}`)
                      .join(', ') || i18n.t('common.none', 'none')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  disabled={comparison.status !== 'DRAFT' || saving}
                  onClick={() => onSelect(comparison, option.optionId)}
                >
                  {comparison.selectedOptionId === option.optionId
                    ? i18n.t('initiatives.capacityOptions.selected', 'Selected for the next decision')
                    : i18n.t('initiatives.capacityOptions.select', 'Select for the next decision')}
                </button>
              </section>
            ))}
          </div>
          {comparison.nextGovernedInput && (
            <p role="status" className="mt-3 text-xs">
              {i18n.t('initiatives.capacityOptions.governedRequest', 'Controlled request:')} {comparison.nextGovernedInput.kind} · {i18n.t('initiatives.capacityOptions.option', 'option')}{' '}
              {comparison.nextGovernedInput.optionId} · {i18n.t('initiatives.capacityOptions.comparisonVersion', 'comparison v')}
              {comparison.nextGovernedInput.comparisonVersion}
            </p>
          )}
        </article>
      ))
    )}
  </section>
  );
};
