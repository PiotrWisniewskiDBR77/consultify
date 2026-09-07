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
};

const knowledgeLabel = (value: CapacityKnowledgeState): string =>
  ({
    KNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.known'),
    ESTIMATED: i18n.t('initiatives.capacityAdvisor.knowledge.estimated'),
    UNKNOWN: i18n.t('initiatives.capacityAdvisor.knowledge.unknown'),
    UNCONFIRMED: i18n.t('initiatives.capacityAdvisor.knowledge.unconfirmed'),
  })[value];

const optionLabels: Record<CapacityOption['kind'], string> = {
  RESEQUENCE: 'Zmień kolejność',
  SCOPE_SPLIT: 'Podziel zakres',
  ADD_CAPACITY: 'Zwiększ dostępność',
};

const OptionImpact = ({ label, value }: { label: string; value: OptionRange }) => (
  <div className="rounded border border-c-border p-2">
    <dt className="text-xs font-medium">{label}</dt>
    <dd className="text-sm">
      {value.knowledgeState === 'UNKNOWN' || value.knowledgeState === 'UNCONFIRMED'
        ? `${value.knowledgeState} — brak potwierdzonej wartości`
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
  <section aria-label="Capacity options comparison" className="border-t border-c-border pt-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h4 className="font-medium">Opcje rozwiązania ograniczeń</h4>
        <p className="text-xs text-c-text-muted">
          To jest wyłącznie porównanie. Wybór tworzy kontrolowany wniosek do kolejnej decyzji i nie
          zmienia samodzielnie planu, bazowej wersji ani przydziału.
        </p>
      </div>
      <label className="text-xs">
        Kolejna kontrolowana decyzja
        <select
          aria-label="Capacity governed next input"
          className="ml-2 rounded border border-c-border bg-c-background p-2"
          value={nextInputKind}
          onChange={(event) => setKind(event.target.value as NextGovernedInputKind)}
        >
          <option value="MATERIAL_CHANGE">Zmiana planu</option>
          <option value="SCHEDULE_DECISION">Decyzja harmonogramowa</option>
        </select>
      </label>
    </div>
    {comparisons.length === 0 ? (
      <p className="mt-3 text-sm text-c-text-muted">
        Brak zapisanego porównania dla tego wariantu.
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
                aria-label={`Opcja obciążenia: ${optionLabels[option.kind]}`}
                className={`rounded border p-3 ${comparison.selectedOptionId === option.optionId ? 'border-c-focus-solid' : 'border-c-border'}`}
              >
                <h5 className="font-semibold">{optionLabels[option.kind]}</h5>
                <p className="text-xs text-c-text-muted">{option.rationale}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <OptionImpact label="Termin" value={option.impact.date} />
                  <OptionImpact label="Zakres" value={option.impact.scope} />
                  <OptionImpact label="Koszt" value={option.impact.cost} />
                  <OptionImpact label="Ryzyko" value={option.impact.risk} />
                </dl>
                <div className="mt-2 text-xs">
                  <strong>Założenia</strong>
                  {option.assumptions.map((assumption) => (
                    <p key={`${option.optionId}:${assumption.assumption}`}>
                      {assumption.knowledgeState} ·{' '}
                      {/* Konflikt solvera przychodzi jako KOD (P15-K3) — tu dostaje język.
                          Panel wyjety z powierzchni do wlasnego pliku (P15-K5), wiec
                          tlumaczenie mieszka razem z jedynym miejscem, ktore je rysuje. */}
                      {formatPlanSolverReason(assumption.assumption, (klucz, opcje) =>
                        String(i18n.t(klucz, opcje))
                      )}{' '}
                      · właściciel{' '}
                      {memberNameOrUnknown(resolveMemberName, assumption.ownerId, true)} ·{' '}
                      {assumption.sourceRef.ref} v
                      {assumption.sourceRef.version}
                    </p>
                  ))}
                  <p>
                    Inicjatywy:{' '}
                    {option.affectedMemberships
                      .map((item) => `${item.initiativeId} v${item.membershipVersion}`)
                      .join(', ') || 'brak'}
                  </p>
                  <p>Okresy: {option.affectedPeriods.join(', ') || 'brak'}</p>
                  <p>
                    Zasoby:{' '}
                    {option.affectedResources
                      .map((item) => `${item.resourceRef} v${item.version}`)
                      .join(', ') || 'brak'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  disabled={comparison.status !== 'DRAFT' || saving}
                  onClick={() => onSelect(comparison, option.optionId)}
                >
                  {comparison.selectedOptionId === option.optionId
                    ? 'Wybrano do dalszej decyzji'
                    : 'Wybierz do dalszej decyzji'}
                </button>
              </section>
            ))}
          </div>
          {comparison.nextGovernedInput && (
            <p role="status" className="mt-3 text-xs">
              Kontrolowany wniosek: {comparison.nextGovernedInput.kind} · opcja{' '}
              {comparison.nextGovernedInput.optionId} · porównanie v
              {comparison.nextGovernedInput.comparisonVersion}
            </p>
          )}
        </article>
      ))
    )}
  </section>
  );
};
