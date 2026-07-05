/**
 * PriorityCard - Card for analyzing one competing Focus Priority.
 *
 * Analog of CapabilityCard (Capability Mapper): lets users describe and score a
 * single priority on strategic value (1-5), effort/cost (1-5), and strategic
 * fit (1-5), pick a recommendation (pursue/defer/drop), and add drivers,
 * evidence, an implication, with AI proposal governance.
 *
 * Like CapabilityCard, a PriorityCard targets one entry of a DYNAMIC
 * priorities[] array by id.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  FocusPriority,
  FocusTradeoffData,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';

// ==================== TYPES ====================

interface PriorityCardProps {
  priorityId: string;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== CONSTANTS ====================

const SCORE_OPTIONS: { value: number; en: string; pl: string }[] = [
  { value: 1, en: '1 · Very low', pl: '1 · Bardzo niski' },
  { value: 2, en: '2 · Low', pl: '2 · Niski' },
  { value: 3, en: '3 · Medium', pl: '3 · Średni' },
  { value: 4, en: '4 · High', pl: '4 · Wysoki' },
  { value: 5, en: '5 · Very high', pl: '5 · Bardzo wysoki' },
];

const RECOMMENDATION_OPTIONS: {
  value: FocusPriority['recommendation'];
  en: string;
  pl: string;
}[] = [
  { value: 'pursue', en: 'Pursue', pl: 'Realizuj' },
  { value: 'defer', en: 'Defer', pl: 'Odłóż' },
  { value: 'drop', en: 'Drop', pl: 'Porzuć' },
];

// ==================== COMPONENT ====================

export const PriorityCard: React.FC<PriorityCardProps> = ({
  priorityId,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { updateInputData } = useToolStore();
  const [newDriver, setNewDriver] = useState('');

  const data = session.inputData as FocusTradeoffData;
  const priority = (data.priorities || []).find((p) => p.id === priorityId);

  if (!priority) return null;

  const updatePriority = (updates: Partial<FocusPriority>) => {
    updateInputData({
      priorities: (data.priorities || []).map((p) =>
        p.id === priorityId ? { ...p, ...updates } : p
      ),
    } as Partial<FocusTradeoffData>);
  };

  const removePriority = () => {
    updateInputData({
      priorities: (data.priorities || []).filter((p) => p.id !== priorityId),
    } as Partial<FocusTradeoffData>);
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updatePriority({ drivers: [...(priority.drivers || []), newDriver.trim()] });
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updatePriority({ drivers: (priority.drivers || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={priority.title}
            onChange={(event) => updatePriority({ title: event.target.value })}
            placeholder={isPolish ? 'Nazwa priorytetu...' : 'Priority title...'}
            className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent p-0 font-semibold text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-0 dark:text-slate-100"
          />
          <textarea
            value={priority.description}
            onChange={(event) => updatePriority({ description: event.target.value })}
            rows={2}
            placeholder={isPolish ? 'Opis priorytetu...' : 'Priority description...'}
            className="mt-2 w-full border-0 bg-transparent p-0 text-xs text-slate-500 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-slate-400"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {priority.proposalStatus === 'ai-proposed' ? (
            <CardActions
              cardType="item"
              cardId={priority.id}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ) : (
            <button
              type="button"
              onClick={removePriority}
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
              title={isPolish ? 'Usuń priorytet' : 'Remove priority'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scoring grid */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wartość strategiczna' : 'Strategic value'}
          <select
            value={priority.valueScore}
            onChange={(event) => updatePriority({ valueScore: Number(event.target.value) })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {SCORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wysiłek / koszt' : 'Effort / cost'}
          <select
            value={priority.effortScore}
            onChange={(event) => updatePriority({ effortScore: Number(event.target.value) })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {SCORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Dopasowanie strategiczne' : 'Strategic fit'}
          <select
            value={priority.strategicFit}
            onChange={(event) => updatePriority({ strategicFit: Number(event.target.value) })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {SCORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Rekomendacja' : 'Recommendation'}
          <select
            value={priority.recommendation}
            onChange={(event) =>
              updatePriority({
                recommendation: event.target.value as FocusPriority['recommendation'],
              })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {RECOMMENDATION_OPTIONS.map((opt) => (
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
          {(priority.drivers || []).length > 0 ? (
            (priority.drivers || []).map((driver, index) => (
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
      {(priority.evidence || []).length > 0 && (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isPolish ? 'Dowody' : 'Evidence'}
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {(priority.evidence || []).map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implication */}
      <textarea
        value={priority.implication || ''}
        onChange={(event) => updatePriority({ implication: event.target.value })}
        rows={2}
        placeholder={isPolish ? 'Implikacja tego priorytetu...' : 'Implication of this priority...'}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
      />

      <InlineAssist
        hint={
          isPolish
            ? 'Oceń wartość vs wysiłek i dopasowanie, a następnie zdecyduj: realizuj, odłóż czy porzuć.'
            : 'Weigh value vs effort and fit, then decide whether to pursue, defer, or drop.'
        }
      />
    </div>
  );
};

export default PriorityCard;
