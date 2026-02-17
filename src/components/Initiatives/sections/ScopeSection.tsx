/**
 * ScopeSection - In scope, out of scope, kill criteria
 *
 * Two-column layout: In Scope (left, green) | Out of Scope (right, red)
 * Kill Criteria at the bottom with add area.
 * Items use small colored dots (green/red) instead of large checkboxes.
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, Plus, Scale, Sparkles, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // Sometimes legacy fields are persisted as JSON strings.
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
      } catch {
        // ignore
      }
    }
    // Heuristic: treat multi-line as multiple items
    if (trimmed.includes('\n')) {
      return trimmed
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export const ScopeSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();
  const artifactContext = {
    type: 'initiative',
    title: initiative?.name || '',
    status: initiative?.status || '',
    priority: initiative?.priority || '',
  };

  const scopeData = initiative?.scope || {};
  const [inScope, setInScope] = useState<string[]>(
    typeof scopeData === 'object' ? toStringArray((scopeData as any).inScope) : []
  );
  const [outScope, setOutScope] = useState<string[]>(
    typeof scopeData === 'object' ? toStringArray((scopeData as any).outScope) : []
  );
  const [killCriteria, setKillCriteria] = useState<string[]>(
    toStringArray(
      (initiative as any)?.killCriteria ??
        (initiative as any)?.kill_criteria ??
        (typeof scopeData === 'object' ? (scopeData as any).killCriteria : [])
    )
  );

  // Defensive updates: these lists may come from legacy/AI data and must always behave like arrays.
  const addInScope = () => setInScope((prev) => [...toStringArray(prev), '']);
  const addOutScope = () => setOutScope((prev) => [...toStringArray(prev), '']);
  const addKill = () => setKillCriteria((prev) => [...toStringArray(prev), '']);
  const updateInScope = (idx: number, val: string) =>
    setInScope((prev) => toStringArray(prev).map((v, i) => (i === idx ? val : v)));
  const updateOutScope = (idx: number, val: string) =>
    setOutScope((prev) => toStringArray(prev).map((v, i) => (i === idx ? val : v)));
  const updateKill = (idx: number, val: string) =>
    setKillCriteria((prev) => toStringArray(prev).map((v, i) => (i === idx ? val : v)));
  const removeInScope = (idx: number) =>
    setInScope((prev) => toStringArray(prev).filter((_, i) => i !== idx));
  const removeOutScope = (idx: number) =>
    setOutScope((prev) => toStringArray(prev).filter((_, i) => i !== idx));
  const removeKill = (idx: number) =>
    setKillCriteria((prev) => toStringArray(prev).filter((_, i) => i !== idx));

  const renderScopeItem = (
    item: string,
    idx: number,
    onUpdate: (idx: number, val: string) => void,
    onRemove: (idx: number) => void,
    dotColor: 'emerald' | 'red',
    placeholder: string,
    aiLabel: string
  ) => (
    <div key={idx} className="group flex items-center gap-2 py-1">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          dotColor === 'emerald' ? 'bg-emerald-500' : 'bg-red-400'
        }`}
      />
      <input
        type="text"
        value={item}
        onChange={(e) => onUpdate(idx, e.target.value)}
        placeholder={placeholder}
        autoFocus={!item}
        className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
      />
      <AIFieldEnhancer
        fieldKey={`scope.${dotColor}.${idx}`}
        sectionLabel={aiLabel}
        currentValue={item}
        onApply={(v) => onUpdate(idx, v)}
        artifactContext={artifactContext}
        iconOnly
        outputFormat="short"
      />
      <button
        onClick={() => onRemove(idx)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );

  return (
    <CollapsibleSection
      id="scope"
      title={isPolish ? 'Zakres i kryteria rezygnacji' : 'Scope & Kill Criteria'}
      icon={<Scale size={18} className="text-violet-500 dark:text-violet-400" />}
      iconBg="bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        inScope.length + outScope.length > 0 ? (
          <span className="text-xs text-slate-400">{inScope.length + outScope.length}</span>
        ) : undefined
      }
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={async (e) => {
            e.stopPropagation();
            const result = await handleGenerateAI('scope');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              // Normalize AI output (can be string/array/missing).
              setInScope(toStringArray(data.inScope));
              setOutScope(toStringArray(data.outOfScope));
              setKillCriteria(toStringArray(data.killCriteria));
            }
          }}
          disabled={isGeneratingAI === 'scope'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
        >
          {isGeneratingAI === 'scope' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      <div className="space-y-5">
        {/* ── Two-column layout: In Scope | Out of Scope with vertical divider ── */}
        <div className="flex gap-0">
          {/* ── In Scope (left) ── */}
          <div className="flex-1 space-y-2 pr-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {isPolish ? 'W zakresie' : 'In Scope'}
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {isPolish
                      ? 'Elementy, procesy i obszary objęte inicjatywą'
                      : 'Elements, processes and areas included in this initiative'}
                  </p>
                </div>
              </div>
              <button
                onClick={addInScope}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <Plus size={14} />
                {isPolish ? 'Dodaj' : 'Add item'}
              </button>
            </div>
            <div className="min-h-[40px]">
              {inScope.map((item, i) =>
                renderScopeItem(
                  item,
                  i,
                  updateInScope,
                  removeInScope,
                  'emerald',
                  isPolish ? 'Element zakresu...' : 'Scope item...',
                  isPolish ? 'W zakresie — element listy' : 'In Scope — list item'
                )
              )}
              {inScope.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                  {isPolish ? 'Brak elementów' : 'No items yet'}
                </p>
              )}
            </div>
          </div>

          {/* ── Vertical divider ── */}
          <div className="w-px bg-slate-200 dark:bg-navy-700/50 shrink-0" />

          {/* ── Out of Scope (right) ── */}
          <div className="flex-1 space-y-2 pl-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {isPolish ? 'Poza zakresem' : 'Out of Scope'}
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {isPolish
                      ? 'Wykluczenia i ograniczenia poza zakresem'
                      : 'Exclusions and boundaries not covered'}
                  </p>
                </div>
              </div>
              <button
                onClick={addOutScope}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Plus size={14} />
                {isPolish ? 'Dodaj' : 'Add item'}
              </button>
            </div>
            <div className="min-h-[40px]">
              {outScope.map((item, i) =>
                renderScopeItem(
                  item,
                  i,
                  updateOutScope,
                  removeOutScope,
                  'red',
                  isPolish ? 'Wykluczenie...' : 'Exclusion...',
                  isPolish ? 'Poza zakresem — element listy' : 'Out of Scope — list item'
                )
              )}
              {outScope.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                  {isPolish ? 'Brak elementów' : 'No items yet'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Horizontal separator ── */}
        <div className="border-t border-slate-200 dark:border-navy-700 mt-2" />

        {/* ── Kill Criteria (full width, below) ── */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {isPolish ? 'Kryteria rezygnacji (Kill Criteria)' : 'Kill Criteria'}
                </label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {isPolish
                    ? 'Warunki, których spełnienie oznacza natychmiastowe zatrzymanie inicjatywy'
                    : 'Conditions that trigger immediate initiative termination'}
                </p>
              </div>
            </div>
            <button
              onClick={addKill}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Plus size={14} />
              {isPolish ? 'Dodaj' : 'Add item'}
            </button>
          </div>
          <div className="min-h-[40px]">
            {killCriteria.map((item, i) => (
              <div key={i} className="group flex items-center gap-2 py-1">
                <AlertTriangle size={12} className="text-red-500 shrink-0" />
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateKill(i, e.target.value)}
                  placeholder={isPolish ? 'Kryterium rezygnacji...' : 'Kill criteria...'}
                  autoFocus={!item}
                  className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
                />
                <AIFieldEnhancer
                  fieldKey={`scope.killCriteria.${i}`}
                  sectionLabel={
                    isPolish ? 'Kryteria rezygnacji — element listy' : 'Kill Criteria — list item'
                  }
                  currentValue={item}
                  onApply={(v) => updateKill(i, v)}
                  artifactContext={artifactContext}
                  iconOnly
                  outputFormat="short"
                />
                <button
                  onClick={() => removeKill(i)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {killCriteria.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                {isPolish ? 'Brak kryteriów' : 'No criteria yet'}
              </p>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
