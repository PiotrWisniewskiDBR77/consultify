/**
 * Pakiet G (Prediction) — widok „Budowa założeń", trzy tryby (A/B/C) przełączane zakładkami.
 * Warstwa wizualna ZA FLAGĄ (CLAUDE.md #7) — montowana wyłącznie przez `PredictionWorkspace`, który
 * jest gated przez `useFinancePredictionWorkspaceFlag`.
 *
 * Tryb A (standard): Base/Upside/Downside — Base MUSI być semantycznie = Baseline
 * (`isBaseModeStructurallyPassthrough`, dowód w testach `predictionScenarioModel.test.ts`).
 * Tryb B (wskaźnikowy): edycja wartości KPI/driverów -> nadpisanie w siatce.
 * Tryb C (fundamentalny): initiative -> assumption -> driver/KPI -> statement line -> forecast, z
 * pełnym łańcuchem przyczynowym (timing/ramp/delay/decay/koszt/confidence/owner/jednostka/znak/
 * okres/źródło) i wykrywaniem double counting (`detectClientSideOverlaps`).
 */
import React, { useId, useState } from 'react';

import {
  createEmptyScenarioDraft,
  detectClientSideOverlaps,
  isBaseModeStructurallyPassthrough,
  scenarioModeToTrack,
  type DraftDriverOverride,
  type DraftImpact,
  type DraftInitiative,
  type PredictionScheduleType,
  type ScenarioDraft,
  type ScenarioMode,
} from './predictionScenarioModel';

const CONTROL_CLASS =
  'min-h-11 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
const BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface px-3 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';

export interface ScenarioAssumptionsViewProps {
  draft: ScenarioDraft;
  onChange: (next: ScenarioDraft) => void;
}

const MODE_TABS: Array<{ track: 'STANDARD' | 'DRIVER_OVERRIDE' | 'FUNDAMENTAL_INITIATIVE'; label: string }> = [
  { track: 'STANDARD', label: 'A · Standardowy (Base/Bull/Bear)' },
  { track: 'DRIVER_OVERRIDE', label: 'B · Wskaźnikowy (drivery/KPI)' },
  { track: 'FUNDAMENTAL_INITIATIVE', label: 'C · Fundamentalny (inicjatywy)' },
];

export function ScenarioAssumptionsView({ draft, onChange }: ScenarioAssumptionsViewProps): React.ReactElement {
  const activeTrack = scenarioModeToTrack(draft.scenarioMode);

  function setMode(mode: ScenarioMode): void {
    onChange({ ...draft, scenarioMode: mode, lastAssumptionChangeAt: new Date().toISOString() });
  }

  function selectTrack(track: (typeof MODE_TABS)[number]['track']): void {
    if (track === 'STANDARD') setMode('STANDARD_BASE');
    else if (track === 'DRIVER_OVERRIDE') setMode('DRIVER_OVERRIDE');
    else setMode('FUNDAMENTAL_INITIATIVE');
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4" data-testid="prediction-assumptions-view">
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-c-surface-raised p-1" role="tablist" aria-label="Tryb budowy scenariusza">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.track}
            type="button"
            role="tab"
            aria-selected={activeTrack === tab.track}
            onClick={() => selectTrack(tab.track)}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              activeTrack === tab.track ? 'bg-c-surface text-c-text shadow-sm' : 'text-c-text-secondary hover:bg-c-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTrack === 'STANDARD' && <StandardScenarioPanel draft={draft} onChange={onChange} />}
      {activeTrack === 'DRIVER_OVERRIDE' && <DriverOverridePanel draft={draft} onChange={onChange} />}
      {activeTrack === 'FUNDAMENTAL_INITIATIVE' && <FundamentalInitiativePanel draft={draft} onChange={onChange} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A — standardowy: Base / Upside / Downside
// ---------------------------------------------------------------------------

function StandardScenarioPanel({ draft, onChange }: ScenarioAssumptionsViewProps): React.ReactElement {
  const isBase = draft.scenarioMode === 'STANDARD_BASE';
  const passthrough = isBaseModeStructurallyPassthrough(draft);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-c-border-subtle bg-c-surface p-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Wariant standardowy">
        {(
          [
            { mode: 'STANDARD_BASE' as const, label: 'Base' },
            { mode: 'STANDARD_UPSIDE' as const, label: 'Upside (Bull)' },
            { mode: 'STANDARD_DOWNSIDE' as const, label: 'Downside (Bear)' },
          ]
        ).map((opt) => (
          <button
            key={opt.mode}
            type="button"
            role="radio"
            aria-checked={draft.scenarioMode === opt.mode}
            onClick={() => onChange({ ...draft, scenarioMode: opt.mode, lastAssumptionChangeAt: new Date().toISOString() })}
            className={`${BUTTON_CLASS} ${draft.scenarioMode === opt.mode ? 'border-c-text bg-c-surface-raised' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isBase ? (
        <p className="text-sm text-c-text-secondary" data-testid="base-equals-baseline-note">
          {passthrough
            ? 'Base = Baseline, bit-for-bit: brak jakichkolwiek nadpisań, inicjatyw lub finansowania. Compute dla tego scenariusza czyta wynik Baseline wprost (passthrough), nigdy nie liczy niezależnie.'
            : 'UWAGA: ten scenariusz ma tryb Base, ale zawiera nadpisania/inicjatywy/finansowanie — to łamie kanon "Base = Baseline". Usuń wszystkie zmiany albo zmień tryb.'}
        </p>
      ) : (
        <p className="text-sm text-c-text-secondary">
          Presety standardowe ({draft.scenarioMode === 'STANDARD_UPSIDE' ? 'Upside' : 'Downside'}) nakładają zestaw predefiniowanych nadpisań na baseline —
          edytuj je w trybie B (Wskaźnikowy) po przełączeniu, źródło nadpisania zostaje oznaczone jako preset, nie ręczne.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B — wskaźnikowy: edycja driverów/KPI
// ---------------------------------------------------------------------------

const SCHEDULE_TYPE_OPTIONS: PredictionScheduleType[] = ['revenue_pvm', 'cogs_opex', 'wc_dso_dio_dpo', 'capex_depreciation', 'debt_maturity', 'tax_nol'];

function DriverOverridePanel({ draft, onChange }: ScenarioAssumptionsViewProps): React.ReactElement {
  const formId = useId();
  const [scheduleType, setScheduleType] = useState<PredictionScheduleType>('cogs_opex');
  const [driverCode, setDriverCode] = useState('COGS_PCT_OF_REVENUE');
  const [canonicalLineCode, setCanonicalLineCode] = useState('COGS');
  const [entityId, setEntityId] = useState('entity-1');
  const [periodId, setPeriodId] = useState('p-2026-03');
  const [value, setValue] = useState('');

  function addOverride(): void {
    const v = value.trim() === '' ? null : Number(value);
    const row: DraftDriverOverride = {
      id: `ovr-${crypto.randomUUID()}`,
      scheduleType,
      driverCode,
      entityId,
      periodId,
      overrideSource: 'MANUAL',
      valueStatus: v === null || Number.isNaN(v) ? 'MISSING' : v === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
      valueDecimal: v === null || Number.isNaN(v) ? null : v,
      unit: 'RATIO',
      baselineValueDecimal: null,
      rationale: null,
      canonicalLineCode,
    };
    onChange({ ...draft, driverOverrides: [...draft.driverOverrides, row], lastAssumptionChangeAt: new Date().toISOString() });
    setValue('');
  }

  function removeOverride(id: string): void {
    onChange({ ...draft, driverOverrides: draft.driverOverrides.filter((o) => o.id !== id), lastAssumptionChangeAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-c-border-subtle bg-c-surface p-4 sm:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-schedule`}>
          Schedule
          <select id={`${formId}-schedule`} className={CONTROL_CLASS} value={scheduleType} onChange={(e) => setScheduleType(e.target.value as PredictionScheduleType)}>
            {SCHEDULE_TYPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-driver`}>
          Driver
          <input id={`${formId}-driver`} className={CONTROL_CLASS} value={driverCode} onChange={(e) => setDriverCode(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-line`}>
          Linia kanoniczna
          <input id={`${formId}-line`} className={CONTROL_CLASS} value={canonicalLineCode} onChange={(e) => setCanonicalLineCode(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-entity`}>
          Podmiot
          <input id={`${formId}-entity`} className={CONTROL_CLASS} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-period`}>
          Okres
          <input id={`${formId}-period`} className={CONTROL_CLASS} value={periodId} onChange={(e) => setPeriodId(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary" htmlFor={`${formId}-value`}>
          Wartość
          <input id={`${formId}-value`} className={CONTROL_CLASS} value={value} onChange={(e) => setValue(e.target.value)} placeholder="np. 0.58" />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-6">
          <button type="button" className={BUTTON_CLASS} onClick={addOverride} data-testid="add-driver-override">
            + Dodaj nadpisanie
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-c-border-subtle">
        <table className="w-full text-left text-sm">{/* §27-exempt — driver-override grid (Excel/Platforma-tabel archetyp, DOKTRYNA_TABELA_NIE_EXCEL.md Decyzja 07-13), nie lista rekordów: zero pstryczka/kebab/preview, kolumny to pola jednej edycji, nie wiersze encji. */}
          <thead className="bg-c-surface-raised text-xs uppercase tracking-wide text-c-text-muted">
            <tr>
              <th className="px-3 py-2">Schedule</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Linia</th>
              <th className="px-3 py-2">Podmiot</th>
              <th className="px-3 py-2">Okres</th>
              <th className="px-3 py-2">Wartość</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {draft.driverOverrides.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-c-text-muted">
                  Brak nadpisań — dodaj pierwsze powyżej.
                </td>
              </tr>
            )}
            {draft.driverOverrides.map((o) => (
              <tr key={o.id} className="border-t border-c-border-subtle">
                <td className="px-3 py-2">{o.scheduleType}</td>
                <td className="px-3 py-2">{o.driverCode}</td>
                <td className="px-3 py-2">{o.canonicalLineCode}</td>
                <td className="px-3 py-2">{o.entityId}</td>
                <td className="px-3 py-2">{o.periodId}</td>
                <td className="px-3 py-2 tabular-nums">{o.valueDecimal === null ? '—' : o.valueDecimal}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className={`${BUTTON_CLASS} min-h-9 px-2 text-xs`} onClick={() => removeOverride(o.id)}>
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C — fundamentalny: initiative -> assumption -> driver/KPI -> statement line -> forecast
// ---------------------------------------------------------------------------

function FundamentalInitiativePanel({ draft, onChange }: ScenarioAssumptionsViewProps): React.ReactElement {
  const overlaps = detectClientSideOverlaps(draft);

  function addInitiative(): void {
    const id = `init-${crypto.randomUUID()}`;
    const initiative: DraftInitiative = {
      id,
      initiativeCode: `INIT-${draft.initiatives.length + 1}`,
      name: 'Nowa inicjatywa',
      description: null,
      source: 'MANAGEMENT_PLAN',
      owner: null,
      confidencePct: null,
      defaultStartPeriodId: null,
      defaultRampMonths: null,
      defaultDurationMonths: null,
      implementationCostDecimal: null,
      status: 'DRAFT',
    };
    onChange({ ...draft, initiatives: [...draft.initiatives, initiative], lastAssumptionChangeAt: new Date().toISOString() });
  }

  function updateInitiative(id: string, patch: Partial<DraftInitiative>): void {
    onChange({
      ...draft,
      initiatives: draft.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      lastAssumptionChangeAt: new Date().toISOString(),
    });
  }

  function addImpact(initiativeId: string): void {
    const impact: DraftImpact = {
      id: `impact-${crypto.randomUUID()}`,
      initiativeId,
      assumptionLabel: 'Nowe założenie',
      driverScheduleType: 'cogs_opex',
      driverCode: 'COGS_PCT_OF_REVENUE',
      kpiCatalogId: null,
      statementLineCode: 'COGS',
      entityId: 'entity-1',
      amountKind: 'PERCENT_OF_BASE',
      amountDecimal: -0.05,
      amountUnit: 'RATIO',
      sign: 'NEGATIVE',
      startPeriodId: null,
      rampMonths: 3,
      durationMonths: null,
      decayPctPerPeriod: null,
      implementationCostDecimal: null,
      confidencePct: 70,
      probabilityPct: 80,
      cannibalizesImpactId: null,
    };
    onChange({ ...draft, impacts: [...draft.impacts, impact], lastAssumptionChangeAt: new Date().toISOString() });
  }

  function updateImpact(id: string, patch: Partial<DraftImpact>): void {
    onChange({ ...draft, impacts: draft.impacts.map((i) => (i.id === id ? { ...i, ...patch } : i)), lastAssumptionChangeAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-c-text-secondary">Łańcuch: inicjatywa → założenie → driver/KPI → linia sprawozdania → prognoza.</p>
        <button type="button" className={BUTTON_CLASS} onClick={addInitiative} data-testid="add-initiative">
          + Dodaj inicjatywę
        </button>
      </div>

      {overlaps.length > 0 && (
        <div className="rounded-xl border border-c-warning/40 bg-c-warning/10 p-3" role="alert" data-testid="overlap-warnings">
          <p className="text-sm font-semibold text-c-text">Wykryto możliwe nakładanie się wpływów ({overlaps.length})</p>
          <p className="mb-2 text-xs text-c-text-muted">
            Podgląd kliencki, nieautorytatywny — uruchom „Uruchom preflight" w pasku, żeby dostać realną (Layer 2, waluta) analizę serwera.
          </p>
          <ul className="space-y-1 text-sm text-c-text-secondary">
            {overlaps.map((f) => (
              <li key={`${f.entityId}-${f.canonicalLineCode}-${f.periodId}`}>
                {f.canonicalLineCode} · {f.periodId} · {f.entityId} — {f.sourceCount} źródła nakładają się (suma naiwna {f.naiveCombinedDelta.toFixed(4)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.initiatives.length === 0 && <p className="rounded-xl border border-dashed border-c-border-subtle p-6 text-center text-sm text-c-text-muted">Brak inicjatyw — dodaj pierwszą powyżej.</p>}

      {draft.initiatives.map((initiative) => {
        const impacts = draft.impacts.filter((i) => i.initiativeId === initiative.id);
        return (
          <div key={initiative.id} className="rounded-xl border border-c-border-subtle bg-c-surface p-4" data-testid={`initiative-card-${initiative.id}`}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className={CONTROL_CLASS}
                value={initiative.name}
                onChange={(e) => updateInitiative(initiative.id, { name: e.target.value })}
                aria-label="Nazwa inicjatywy"
              />
              <input
                className={CONTROL_CLASS}
                value={initiative.owner ?? ''}
                placeholder="Właściciel"
                onChange={(e) => updateInitiative(initiative.id, { owner: e.target.value || null })}
                aria-label="Właściciel inicjatywy"
              />
              <input
                className={CONTROL_CLASS}
                type="number"
                min={0}
                max={100}
                value={initiative.confidencePct ?? ''}
                placeholder="Confidence %"
                onChange={(e) => updateInitiative(initiative.id, { confidencePct: e.target.value === '' ? null : Number(e.target.value) })}
                aria-label="Confidence procent"
              />
              <input
                className={CONTROL_CLASS}
                value={initiative.defaultStartPeriodId ?? ''}
                placeholder="Domyślny okres startu"
                onChange={(e) => updateInitiative(initiative.id, { defaultStartPeriodId: e.target.value || null })}
                aria-label="Domyślny okres startu"
              />
              <input
                className={CONTROL_CLASS}
                type="number"
                min={0}
                value={initiative.defaultRampMonths ?? ''}
                placeholder="Ramp-up (miesiące)"
                onChange={(e) => updateInitiative(initiative.id, { defaultRampMonths: e.target.value === '' ? null : Number(e.target.value) })}
                aria-label="Ramp-up w miesiącach"
              />
              <input
                className={CONTROL_CLASS}
                type="number"
                value={initiative.implementationCostDecimal ?? ''}
                placeholder="Koszt wdrożenia"
                onChange={(e) => updateInitiative(initiative.id, { implementationCostDecimal: e.target.value === '' ? null : Number(e.target.value) })}
                aria-label="Koszt wdrożenia"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">Wpływy ({impacts.length})</p>
              <button type="button" className={`${BUTTON_CLASS} min-h-9 px-2 text-xs`} onClick={() => addImpact(initiative.id)}>
                + Dodaj wpływ
              </button>
            </div>

            {impacts.map((impact) => (
              <div key={impact.id} className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-c-border-subtle p-3 sm:grid-cols-4" data-testid={`impact-row-${impact.id}`}>
                <input className={CONTROL_CLASS} value={impact.statementLineCode} onChange={(e) => updateImpact(impact.id, { statementLineCode: e.target.value })} aria-label="Linia sprawozdania" />
                <select
                  className={CONTROL_CLASS}
                  value={impact.sign}
                  onChange={(e) => updateImpact(impact.id, { sign: e.target.value as DraftImpact['sign'] })}
                  aria-label="Znak"
                >
                  <option value="NEGATIVE">Redukcja (−)</option>
                  <option value="POSITIVE">Wzrost (+)</option>
                </select>
                <input
                  className={CONTROL_CLASS}
                  type="number"
                  value={impact.amountDecimal}
                  onChange={(e) => updateImpact(impact.id, { amountDecimal: Number(e.target.value) })}
                  aria-label="Wielkość wpływu"
                />
                <input className={CONTROL_CLASS} value={impact.startPeriodId ?? ''} placeholder="Start (dziedziczy z inicjatywy)" onChange={(e) => updateImpact(impact.id, { startPeriodId: e.target.value || null })} aria-label="Okres startu wpływu" />
                <input
                  className={CONTROL_CLASS}
                  type="number"
                  min={0}
                  max={100}
                  value={impact.confidencePct ?? ''}
                  placeholder="Confidence %"
                  onChange={(e) => updateImpact(impact.id, { confidencePct: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Confidence wpływu"
                />
                <input
                  className={CONTROL_CLASS}
                  type="number"
                  min={0}
                  max={100}
                  value={impact.probabilityPct ?? ''}
                  placeholder="Probability %"
                  onChange={(e) => updateImpact(impact.id, { probabilityPct: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Prawdopodobieństwo wpływu"
                />
                <input className={CONTROL_CLASS} value={impact.amountUnit} onChange={(e) => updateImpact(impact.id, { amountUnit: e.target.value })} aria-label="Jednostka" />
                <input
                  className={CONTROL_CLASS}
                  type="number"
                  value={impact.implementationCostDecimal ?? ''}
                  placeholder="Koszt wdrożenia (per-impact)"
                  onChange={(e) => updateImpact(impact.id, { implementationCostDecimal: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Koszt wdrożenia wpływu"
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function createDemoFundamentalDraft(): ScenarioDraft {
  return createEmptyScenarioDraft({ name: 'Demo scenariusz', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
}
