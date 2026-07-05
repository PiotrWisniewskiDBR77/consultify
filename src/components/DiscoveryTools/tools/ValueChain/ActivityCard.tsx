/**
 * ActivityCard - Card for analyzing one Value Chain activity (Porter).
 *
 * Analog of ForceStep: lets users score and describe a single value
 * activity on cost contribution, value contribution, and margin role,
 * with drivers, evidence, an implication, and AI proposal governance.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  ProposalCardType,
  ToolSession,
  ValueActivity,
  ValueActivityId,
  ValueChainData,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';

// ==================== TYPES ====================

interface ActivityCardProps {
  activityId: ValueActivityId;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== CONSTANTS ====================

const ACTIVITY_LABELS: Record<ValueActivityId, { en: string; pl: string; hint: string }> = {
  inboundLogistics: {
    en: 'Inbound Logistics',
    pl: 'Logistyka wewnętrzna',
    hint: 'Receiving, warehousing, and inventory of inputs',
  },
  operations: {
    en: 'Operations',
    pl: 'Operacje',
    hint: 'Transforming inputs into the final product or service',
  },
  outboundLogistics: {
    en: 'Outbound Logistics',
    pl: 'Logistyka zewnętrzna',
    hint: 'Storing and distributing the product to customers',
  },
  marketingSales: {
    en: 'Marketing & Sales',
    pl: 'Marketing i sprzedaż',
    hint: 'Getting buyers to purchase — pricing, promotion, channels',
  },
  service: {
    en: 'Service',
    pl: 'Serwis',
    hint: 'Maintaining and enhancing product value after the sale',
  },
  infrastructure: {
    en: 'Firm Infrastructure',
    pl: 'Infrastruktura firmy',
    hint: 'Management, finance, legal, quality, planning',
  },
  hrManagement: {
    en: 'HR Management',
    pl: 'Zarządzanie HR',
    hint: 'Recruiting, training, developing, and retaining people',
  },
  technology: {
    en: 'Technology Development',
    pl: 'Rozwój technologii',
    hint: 'R&D, process and product technology, know-how',
  },
  procurement: {
    en: 'Procurement',
    pl: 'Zaopatrzenie',
    hint: 'Purchasing inputs, supplier relationships, contracts',
  },
};

const LEVEL_OPTIONS: { value: 'high' | 'medium' | 'low'; en: string; pl: string }[] = [
  { value: 'high', en: 'High', pl: 'Wysoki' },
  { value: 'medium', en: 'Medium', pl: 'Średni' },
  { value: 'low', en: 'Low', pl: 'Niski' },
];

const MARGIN_OPTIONS: { value: 'creator' | 'neutral' | 'drain'; en: string; pl: string }[] = [
  { value: 'creator', en: 'Margin creator', pl: 'Tworzy marżę' },
  { value: 'neutral', en: 'Neutral', pl: 'Neutralny' },
  { value: 'drain', en: 'Margin drain', pl: 'Drenuje marżę' },
];

const MATURITY_OPTIONS: { value: 'strong' | 'adequate' | 'weak'; en: string; pl: string }[] = [
  { value: 'strong', en: 'Strong', pl: 'Silna' },
  { value: 'adequate', en: 'Adequate', pl: 'Wystarczająca' },
  { value: 'weak', en: 'Weak', pl: 'Słaba' },
];

const kindBadge = (kind: ValueActivity['kind'], isPolish: boolean) =>
  kind === 'primary' ? (isPolish ? 'Podstawowa' : 'Primary') : isPolish ? 'Wspierająca' : 'Support';

// ==================== COMPONENT ====================

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activityId,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { updateInputData } = useToolStore();
  const [newDriver, setNewDriver] = useState('');

  const data = session.inputData as ValueChainData;
  const activity = data.activities[activityId];
  const labels = ACTIVITY_LABELS[activityId];

  const updateActivity = (updates: Partial<ValueActivity>) => {
    updateInputData({
      activities: {
        ...data.activities,
        [activityId]: { ...activity, ...updates },
      },
    } as Partial<ValueChainData>);
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updateActivity({ drivers: [...(activity.drivers || []), newDriver.trim()] });
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updateActivity({ drivers: (activity.drivers || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {isPolish ? labels.pl : labels.en}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-300">
              {kindBadge(activity.kind, isPolish)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{labels.hint}</p>
        </div>
        {activity.proposalStatus === 'ai-proposed' && (
          <CardActions
            cardType="item"
            cardId={activity.id}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        )}
      </div>

      {/* Scoring grid */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Udział w kosztach' : 'Cost contribution'}
          <select
            value={activity.costContribution}
            onChange={(event) =>
              updateActivity({
                costContribution: event.target.value as ValueActivity['costContribution'],
              })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wkład w wartość' : 'Value contribution'}
          <select
            value={activity.valueContribution}
            onChange={(event) =>
              updateActivity({
                valueContribution: event.target.value as ValueActivity['valueContribution'],
              })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Rola w marży' : 'Margin role'}
          <select
            value={activity.marginRole}
            onChange={(event) =>
              updateActivity({ marginRole: event.target.value as ValueActivity['marginRole'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {MARGIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Dojrzałość' : 'Maturity'}
          <select
            value={activity.maturity || 'adequate'}
            onChange={(event) =>
              updateActivity({ maturity: event.target.value as ValueActivity['maturity'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {MATURITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Drivers */}
      <div className="mb-2">
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            placeholder={isPolish ? 'Dodaj czynnik...' : 'Add a driver...'}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDriver()}
          />
          <button
            type="button"
            onClick={handleAddDriver}
            disabled={!newDriver.trim()}
            className="rounded-lg bg-c-text px-3 py-2 text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {(activity.drivers || []).length > 0 ? (
            (activity.drivers || []).map((driver, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-navy-900"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">{driver}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDriver(index)}
                  className="rounded p-1 text-slate-600 transition-colors hover:bg-danger-100 hover:text-danger-500 dark:hover:bg-danger-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm italic text-slate-600">
              {isPolish ? 'Brak dodanych czynników' : 'No drivers added'}
            </p>
          )}
        </div>
      </div>

      {/* Evidence (read-only list from AI / context) */}
      {(activity.evidence || []).length > 0 && (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isPolish ? 'Dowody' : 'Evidence'}
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {(activity.evidence || []).map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implication */}
      <textarea
        value={activity.implication || ''}
        onChange={(event) => updateActivity({ implication: event.target.value })}
        rows={2}
        placeholder={isPolish ? 'Implikacja dla marży...' : 'Implication for margin...'}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
      />

      <InlineAssist
        hint={
          isPolish
            ? 'Oceń, czy ta aktywność tworzy czy drenuje marżę i dlaczego.'
            : 'Judge whether this activity creates or drains margin, and why.'
        }
      />
    </div>
  );
};

export default ActivityCard;
