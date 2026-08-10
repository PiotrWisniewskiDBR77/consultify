/**
 * FinancialDriverTable — the principal structured editing surface for
 * drivers and periods (doc 09 §7.3). This is the Matryca (D archetype)
 * driver-editing grid: NOT `StandardTable` (that's the LISTA/SPEC-L canon for
 * fixed-schema record lists — see `docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md`
 * §1 vs §3). Rows = drivers (dynamic, user-authored), columns = driver
 * attributes; an expandable row reveals the monthly period cells for that
 * driver — the second half of "drivers and periods".
 *
 * Any edit here calls `onUpdateDriver`/`onAddDriver`/`onRemoveDriver`, which
 * `useFinancialCase` immediately routes through `markDirty` → status becomes
 * `stale`. This component never computes anything itself.
 */
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { periodKeysForCase } from './financialDefaults';
import { formatPeriodLabel } from './financialFormat';
import type {
  FinancialBenefitType,
  FinancialCaseInput,
  FinancialConfidence,
  FinancialCostType,
  FinancialDriver,
  FinancialScenarioId,
} from './financialTypes';

export interface FinancialDriverTableProps {
  caseMeta: Omit<FinancialCaseInput, 'drivers'>;
  drivers: FinancialDriver[];
  onAddDriver: (kind: 'cost' | 'benefit') => void;
  onUpdateDriver: (id: string, patch: Partial<FinancialDriver>) => void;
  onRemoveDriver: (id: string) => void;
  readOnly?: boolean;
}

const COST_TYPES: FinancialCostType[] = ['investment', 'recurring'];
const BENEFIT_TYPES: FinancialBenefitType[] = ['cash', 'non_cash', 'risk_avoidance'];
const CONFIDENCE_LEVELS: FinancialConfidence[] = ['low', 'medium', 'high'];
const SCENARIO_EDIT_ORDER: Exclude<FinancialScenarioId, 'base'>[] = ['upside', 'downside'];

function driverTotal(driver: FinancialDriver): number {
  return Object.values(driver.monthlyValues).reduce(
    (sum, v) => sum + (Number.isFinite(v) ? v : 0),
    0
  );
}

const cellCls =
  'w-full bg-transparent border-0 border-b border-transparent text-xs text-c-text ' +
  'focus:outline-none focus:border-c-focus focus:ring-1 focus:ring-c-focus rounded-sm px-1 py-0.5';

const selectCls =
  'bg-c-surface border border-c-border rounded-md text-xs text-c-text px-1.5 py-0.5 ' +
  'focus:outline-none focus:ring-2 focus:ring-c-focus';

export const FinancialDriverTable: React.FC<FinancialDriverTableProps> = ({ caseMeta, drivers, onAddDriver, onUpdateDriver, onRemoveDriver, readOnly = false }) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const periods = useMemo(
    () => periodKeysForCase(caseMeta.startPeriod, caseMeta.horizonMonths),
    [caseMeta.startPeriod, caseMeta.horizonMonths]
  );

  const costDrivers = drivers.filter((d) => d.kind === 'cost');
  const benefitDrivers = drivers.filter((d) => d.kind === 'benefit');

  const setPeriodValue = useCallback(
    (driver: FinancialDriver, period: string, raw: string) => {
      const num = raw.trim() === '' ? undefined : Number(raw);
      const nextMonthly = { ...driver.monthlyValues };
      if (num === undefined || !Number.isFinite(num)) {
        delete nextMonthly[period];
      } else {
        nextMonthly[period] = num;
      }
      onUpdateDriver(driver.id, { monthlyValues: nextMonthly });
    },
    [onUpdateDriver]
  );

  const renderGroup = (kind: 'cost' | 'benefit', list: FinancialDriver[]) => (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between px-1 mb-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
          {kind === 'cost'
            ? t('ideas.financial.costDrivers', 'Cost drivers')
            : t('ideas.financial.benefitDrivers', 'Benefit drivers')}
          <span className="ml-1.5 text-c-text-muted font-normal normal-case">({list.length})</span>
        </h4>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onAddDriver(kind)}
            className="inline-flex items-center gap-1 text-xs text-c-text-secondary hover:text-c-text hover:bg-state-hover rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <Plus size={12} />
            {kind === 'cost'
              ? t('ideas.financial.addCost', 'Add cost driver')
              : t('ideas.financial.addBenefit', 'Add benefit driver')}
          </button>
        )}
      </div>
      <div className="border border-c-border rounded-lg overflow-hidden">
        {/* §27-exempt: archetyp Platforma-tabel/Matryca (SPEC-A), nie kanoniczna lista encji.
            Siatka sterowników finansowych z edycją inline per okres — wiersz nie jest rekordem
            encji otwieranym w preview, tylko sterownikiem modelu obliczeniowego.
            Podstawa: docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md (decyzja 07-13: IdeaTableTool/
            GridView = platforma-tabel, NIE migrowane na StandardTable) + rejestr kanonu tego
            programu (01_CANON_AND_DECISION_REGISTER.md, wiersz „Table"). */}
        <table /* §27-exempt */ className="w-full border-collapse">
          <thead>
            <tr className="bg-c-surface-raised text-[11px] text-c-text-muted uppercase tracking-wide">
              <th className="w-6" />
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.label', 'Driver')}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.type', 'Type')}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.category', 'Category')}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.unit', 'Unit')}
              </th>
              <th className="text-right font-medium px-2 py-1.5">
                {t('ideas.financial.col.total', 'Total')}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.confidence', 'Confidence')}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t('ideas.financial.col.evidence', 'Evidence')}
              </th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-xs text-c-text-muted text-center italic">
                  {t('ideas.financial.noDriversYet', 'No drivers yet.')}
                </td>
              </tr>
            ) : (
              list.map((driver) => {
                const expanded = expandedId === driver.id;
                const evidenceCount = driver.evidence.length;
                return (
                  <React.Fragment key={driver.id}>
                    <tr className="border-t border-c-border-subtle hover:bg-state-hover/50">
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          aria-label={
                            expanded
                              ? t('ideas.financial.collapsePeriods', 'Collapse monthly periods')
                              : t('ideas.financial.expandPeriods', 'Edit monthly periods')
                          }
                          onClick={() => setExpandedId(expanded ? null : driver.id)}
                          className="text-c-text-muted hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus rounded-sm"
                        >
                          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={driver.label}
                          placeholder={t('ideas.financial.labelPlaceholder', 'Untitled driver')}
                          readOnly={readOnly}
                          onChange={(e) => onUpdateDriver(driver.id, { label: e.target.value })}
                          className={cellCls}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {kind === 'cost' ? (
                          <select
                            value={driver.costType ?? 'investment'}
                            disabled={readOnly}
                            onChange={(e) =>
                              onUpdateDriver(driver.id, {
                                costType: e.target.value as FinancialCostType,
                              })
                            }
                            className={selectCls}
                          >
                            {COST_TYPES.map((ct) => (
                              <option key={ct} value={ct}>
                                {t(`ideas.financial.costType.${ct}`, ct)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={driver.benefitType ?? 'cash'}
                            disabled={readOnly}
                            onChange={(e) =>
                              onUpdateDriver(driver.id, {
                                benefitType: e.target.value as FinancialBenefitType,
                              })
                            }
                            className={selectCls}
                          >
                            {BENEFIT_TYPES.map((bt) => (
                              <option key={bt} value={bt}>
                                {t(`ideas.financial.benefitType.${bt}`, bt.replace('_', ' '))}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={driver.category}
                          placeholder={t('ideas.financial.categoryPlaceholder', 'Category')}
                          readOnly={readOnly}
                          onChange={(e) => onUpdateDriver(driver.id, { category: e.target.value })}
                          className={cellCls}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={driver.unit}
                          readOnly={readOnly}
                          onChange={(e) => onUpdateDriver(driver.id, { unit: e.target.value })}
                          className={`${cellCls} w-16`}
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-xs tabular-nums text-c-text">
                        {driverTotal(driver).toLocaleString('pl-PL', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={driver.confidence}
                          disabled={readOnly}
                          onChange={(e) =>
                            onUpdateDriver(driver.id, {
                              confidence: e.target.value as FinancialConfidence,
                            })
                          }
                          className={selectCls}
                        >
                          {CONFIDENCE_LEVELS.map((c) => (
                            <option key={c} value={c}>
                              {t(`ideas.financial.confidence.${c}`, c)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={
                            evidenceCount > 0
                              ? 'text-xs text-c-success'
                              : 'text-xs text-c-warning font-medium'
                          }
                        >
                          {evidenceCount > 0
                            ? t('ideas.financial.evidenceCount', '{{count}} source(s)', {
                                count: evidenceCount,
                              })
                            : t('ideas.financial.evidenceNeeded', 'Evidence needed')}
                        </span>
                      </td>
                      {!readOnly && (
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            aria-label={t('ideas.financial.removeDriver', 'Remove driver')}
                            onClick={() => onRemoveDriver(driver.id)}
                            className="text-c-text-muted hover:text-c-danger focus:outline-none focus:ring-2 focus:ring-c-focus rounded-sm"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="border-t border-c-border-subtle bg-c-surface-raised/60">
                        <td />
                        <td colSpan={readOnly ? 7 : 8} className="px-2 py-2">
                          <div className="flex flex-wrap gap-3">
                            <div className="flex-1 min-w-[240px]">
                              <div className="text-[10px] uppercase tracking-wide text-c-text-muted mb-1">
                                {t('ideas.financial.monthlyValues', 'Monthly values')} ·{' '}
                                {caseMeta.currency}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {periods.map((p) => (
                                  <label key={p} className="flex flex-col items-start">
                                    <span className="text-[10px] text-c-text-muted">
                                      {formatPeriodLabel(p)}
                                    </span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      readOnly={readOnly}
                                      value={driver.monthlyValues[p] ?? ''}
                                      placeholder="0"
                                      onChange={(e) => setPeriodValue(driver, p, e.target.value)}
                                      className="w-20 bg-c-surface border border-c-border rounded-md text-xs text-c-text px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-c-focus tabular-nums"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="min-w-[180px]">
                              <div className="text-[10px] uppercase tracking-wide text-c-text-muted mb-1">
                                {t(
                                  'ideas.financial.scenarioMultipliers',
                                  'Scenario multiplier (vs Base)'
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {SCENARIO_EDIT_ORDER.map((sc) => (
                                  <label key={sc} className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-c-text-muted w-14 capitalize">
                                      {t(`ideas.financial.scenario.${sc}`, sc)}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.05"
                                      readOnly={readOnly}
                                      value={driver.scenarioMultipliers[sc] ?? ''}
                                      placeholder="1.00"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const num = raw.trim() === '' ? undefined : Number(raw);
                                        onUpdateDriver(driver.id, {
                                          scenarioMultipliers: {
                                            ...driver.scenarioMultipliers,
                                            [sc]:
                                              num === undefined || !Number.isFinite(num)
                                                ? undefined
                                                : num,
                                          },
                                        });
                                      }}
                                      className="w-16 bg-c-surface border border-c-border rounded-md text-xs text-c-text px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-c-focus tabular-nums"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-2">
      {renderGroup('cost', costDrivers)}
      {renderGroup('benefit', benefitDrivers)}
    </div>
  );
};
