/**
 * ThemeCard - Card for decomposing one Ambition Theme.
 *
 * Analog of CapabilityCard (Capability Mapper): lets users describe and
 * frame a single strategic theme derived from an ambition — its target
 * metric and value, time horizon, strategic importance, drivers, evidence,
 * and an implication — with full AI proposal governance.
 *
 * Like CapabilityCard, a ThemeCard targets one entry of a DYNAMIC themes[]
 * array by id.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  AmbitionDecomposerData,
  AmbitionTheme,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';

// ==================== TYPES ====================

interface ThemeCardProps {
  themeId: string;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== CONSTANTS ====================

const HORIZON_OPTIONS: { value: AmbitionTheme['horizon']; en: string; pl: string }[] = [
  { value: 'short', en: 'Short (0-12m)', pl: 'Krótki (0-12m)' },
  { value: 'medium', en: 'Medium (1-2y)', pl: 'Średni (1-2 lata)' },
  { value: 'long', en: 'Long (2y+)', pl: 'Długi (2 lata+)' },
];

const IMPORTANCE_OPTIONS: { value: AmbitionTheme['importance']; en: string; pl: string }[] = [
  { value: 'high', en: 'High', pl: 'Wysoka' },
  { value: 'medium', en: 'Medium', pl: 'Średnia' },
  { value: 'low', en: 'Low', pl: 'Niska' },
];

// ==================== COMPONENT ====================

export const ThemeCard: React.FC<ThemeCardProps> = ({
  themeId,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { updateInputData } = useToolStore();
  const [newDriver, setNewDriver] = useState('');

  const data = session.inputData as AmbitionDecomposerData;
  const theme = (data.themes || []).find((t) => t.id === themeId);

  if (!theme) return null;

  const updateTheme = (updates: Partial<AmbitionTheme>) => {
    updateInputData({
      themes: (data.themes || []).map((t) => (t.id === themeId ? { ...t, ...updates } : t)),
    } as Partial<AmbitionDecomposerData>);
  };

  const removeTheme = () => {
    updateInputData({
      themes: (data.themes || []).filter((t) => t.id !== themeId),
    } as Partial<AmbitionDecomposerData>);
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updateTheme({ drivers: [...(theme.drivers || []), newDriver.trim()] });
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updateTheme({ drivers: (theme.drivers || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={theme.title}
            onChange={(event) => updateTheme({ title: event.target.value })}
            placeholder={isPolish ? 'Nazwa tematu...' : 'Theme title...'}
            className="min-w-0 w-full border-0 border-b border-transparent bg-transparent p-0 font-semibold text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-0 dark:text-slate-100"
          />
          <textarea
            value={theme.description}
            onChange={(event) => updateTheme({ description: event.target.value })}
            rows={2}
            placeholder={isPolish ? 'Krótki opis tematu...' : 'Short description of the theme...'}
            className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-xs text-slate-500 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-slate-400"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {theme.proposalStatus === 'ai-proposed' ? (
            <CardActions
              cardType="item"
              cardId={theme.id}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ) : (
            <button
              type="button"
              onClick={removeTheme}
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
              title={isPolish ? 'Usuń temat' : 'Remove theme'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Target metric + value */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Miara docelowa' : 'Target metric'}
          <input
            value={theme.targetMetric}
            onChange={(event) => updateTheme({ targetMetric: event.target.value })}
            placeholder={isPolish ? 'Co mierzymy...' : 'What to measure...'}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wartość docelowa' : 'Target value'}
          <input
            value={theme.targetValue}
            onChange={(event) => updateTheme({ targetValue: event.target.value })}
            placeholder={isPolish ? 'Wartość celu...' : 'Goal value...'}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          />
        </label>
      </div>

      {/* Scoring grid */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Horyzont czasowy' : 'Time horizon'}
          <select
            value={theme.horizon}
            onChange={(event) =>
              updateTheme({ horizon: event.target.value as AmbitionTheme['horizon'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {HORIZON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Znaczenie strategiczne' : 'Strategic importance'}
          <select
            value={theme.importance}
            onChange={(event) =>
              updateTheme({ importance: event.target.value as AmbitionTheme['importance'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {IMPORTANCE_OPTIONS.map((opt) => (
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
          {(theme.drivers || []).length > 0 ? (
            (theme.drivers || []).map((driver, index) => (
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
      {(theme.evidence || []).length > 0 && (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isPolish ? 'Dowody' : 'Evidence'}
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {(theme.evidence || []).map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implication */}
      <textarea
        value={theme.implication || ''}
        onChange={(event) => updateTheme({ implication: event.target.value })}
        rows={2}
        placeholder={isPolish ? 'Implikacja tego tematu...' : 'Implication of this theme...'}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
      />

      <InlineAssist
        hint={
          isPolish
            ? 'Powiąż temat z konkretną miarą i wartością docelową oraz horyzontem, w którym ambicja staje się mierzalna.'
            : 'Tie the theme to a concrete metric and target value, and the horizon over which the ambition becomes measurable.'
        }
      />
    </div>
  );
};

export default ThemeCard;
