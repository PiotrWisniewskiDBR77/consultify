/**
 * TargetStateSection - Success Criteria
 *
 * Three identical resizable panels: Target State, Success Criteria, Deliverables.
 * Each panel has:
 *  - Top-left: area title
 *  - Below title: description in lighter font
 *  - Top-right: AI button, below it "+ Add item"
 *  - Light separator line
 *  - Content area with items
 *  - Bottom-right: resize handle
 *  - More/Less toggle when content overflows
 */

import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

// ── Resizable Panel ─────────────────────────────────────────────────────────

interface ResizablePanelProps {
  /** Area title shown top-left */
  title: string;
  /** Description below title in lighter font */
  description: string;
  /** AI generation key */
  aiKey: string;
  /** Whether AI is currently generating for this panel */
  isGenerating: boolean;
  /** AI click handler */
  onAIClick: () => void;
  /** Add item label */
  addLabel: string;
  /** Add item handler */
  onAdd: () => void;
  /** Panel content */
  children: React.ReactNode;
  /** Whether content is empty (hides more/less) */
  hasContent: boolean;
  /** Min height in px */
  minHeight?: number;
}

const DEFAULT_HEIGHT = 160;
const MIN_HEIGHT = 100;
const COLLAPSED_HEIGHT = 120;

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  title,
  description,
  isGenerating,
  onAIClick,
  addLabel,
  onAdd,
  children,
  hasContent,
  minHeight = DEFAULT_HEIGHT,
}) => {
  const [height, setHeight] = useState(minHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const isOverflowing = contentRef.current
    ? contentRef.current.scrollHeight > height - 60
    : false;

  const effectiveHeight = isExpanded ? 'auto' : height;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startY: e.clientY, startH: height };

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientY - dragRef.current.startY;
        setHeight(Math.max(MIN_HEIGHT, dragRef.current.startH + delta));
        setIsExpanded(false);
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [height]
  );

  return (
    <div
      className="relative rounded-xl border border-slate-200/70 dark:border-navy-700/50 bg-white/60 dark:bg-navy-900/40 overflow-hidden flex flex-col"
      style={{ height: effectiveHeight, minHeight: MIN_HEIGHT }}
    >
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-3 pb-0 shrink-0">
        {/* Left: title + description */}
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </h4>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
            {description}
          </p>
        </div>

        {/* Right: AI button + Add item */}
        <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
          <button
            onClick={onAIClick}
            disabled={isGenerating}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-[10px] font-medium transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Sparkles size={11} />
            )}
            AI
          </button>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <Plus size={11} />
            {addLabel}
          </button>
        </div>
      </div>

      {/* ── Separator ──────────────────────────────────────────────── */}
      <div className="mx-4 mt-2 border-t border-slate-200/60 dark:border-navy-700/40" />

      {/* ── Content area ───────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className={`flex-1 px-4 pt-2 pb-6 ${isExpanded ? '' : 'overflow-hidden'}`}
      >
        {children}
      </div>

      {/* ── More/Less toggle (only when content overflows) ─────────── */}
      {hasContent && (isOverflowing || isExpanded) && (
        <div className="absolute bottom-5 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/90 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-700 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 shadow-sm transition-colors backdrop-blur-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={10} /> Less
              </>
            ) : (
              <>
                <ChevronDown size={10} /> More
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Resize handle (bottom-right) ───────────────────────────── */}
      <div
        onPointerDown={onPointerDown}
        className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-ns-resize text-slate-300 dark:text-navy-600 hover:text-slate-400 dark:hover:text-navy-500 transition-colors"
        title="Drag to resize"
      >
        <GripVertical size={12} className="rotate-90" />
      </div>
    </div>
  );
};

// ── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  children: React.ReactNode;
  onRemove: () => void;
  color: 'emerald' | 'blue';
  badge: React.ReactNode;
}

const ItemRow: React.FC<ItemRowProps> = ({ children, onRemove, color, badge }) => {
  const bg = color === 'emerald'
    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20'
    : 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200/50 dark:border-blue-500/20';
  const badgeBg = color === 'emerald'
    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
    : 'bg-blue-500/20 text-blue-600 dark:text-blue-400';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${bg}`}>
      <div className={`w-4 h-4 rounded-full ${badgeBg} flex items-center justify-center text-[9px] font-bold shrink-0`}>
        {badge}
      </div>
      <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 leading-snug">{children}</span>
      <button
        onClick={onRemove}
        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ── Inline add input ─────────────────────────────────────────────────────────

interface InlineAddProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}

const InlineAdd: React.FC<InlineAddProps> = ({ value, onChange, onSubmit, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && value.trim()) onSubmit();
    }}
    placeholder={placeholder}
    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50/60 dark:bg-navy-800/40 border border-dashed border-slate-200/80 dark:border-navy-700/50 text-xs text-slate-600 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-slate-300 dark:focus:border-navy-600 transition-colors"
  />
);

// ── Main Section Component ───────────────────────────────────────────────────

export const TargetStateSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const targetData = initiative?.targetState || initiative?.target_state || {};
  const [targetDescription, setTargetDescription] = useState(
    typeof targetData === 'object'
      ? targetData.description || ''
      : typeof targetData === 'string'
        ? targetData
        : ''
  );
  const [successCriteria, setSuccessCriteria] = useState<string[]>(
    typeof targetData === 'object' ? targetData.successCriteria || [] : []
  );
  const [deliverables, setDeliverables] = useState<string[]>(
    typeof targetData === 'object' ? targetData.deliverables || [] : []
  );
  const [newCriteria, setNewCriteria] = useState('');
  const [newDeliverable, setNewDeliverable] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);

  const filledCount = [
    targetDescription,
    successCriteria.length > 0,
    deliverables.length > 0,
  ].filter(Boolean).length;

  return (
    <CollapsibleSection
      id="targetState"
      title={isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
      icon={<Target size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        filledCount > 0 ? (
          <span className="text-xs text-slate-400">{filledCount}/3</span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-3">
        {/* ── 1. Target State ────────────────────────────────────────── */}
        <ResizablePanel
          title={isPolish ? 'Stan docelowy' : 'Target State'}
          description={
            isPolish
              ? 'Opisz pożądany stan końcowy po wdrożeniu inicjatywy'
              : 'Describe the desired end state after initiative completion'
          }
          aiKey="target_description"
          isGenerating={isGeneratingAI === 'targetState'}
          onAIClick={async () => {
            const result = await handleGenerateAI('target_state');
            if (result?.parsedContent?.targetDescription) {
              setTargetDescription(result.parsedContent.targetDescription);
            }
          }}
          addLabel={isPolish ? 'Edytuj' : 'Edit'}
          onAdd={() => setShowTargetInput(true)}
          hasContent={!!targetDescription}
        >
          {targetDescription ? (
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {targetDescription}
            </p>
          ) : showTargetInput ? (
            <textarea
              autoFocus
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
              rows={3}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/80 dark:border-navy-700/50 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
              placeholder={
                isPolish
                  ? 'Opisz pożądany stan końcowy...'
                  : 'Describe the desired end state...'
              }
              onBlur={() => {
                if (!targetDescription) setShowTargetInput(false);
              }}
            />
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              {isPolish ? 'Brak opisu. Kliknij „Edytuj" lub „AI" aby dodać.' : 'No description. Click "Edit" or "AI" to add.'}
            </p>
          )}
        </ResizablePanel>

        {/* ── 2. Success Criteria ────────────────────────────────────── */}
        <ResizablePanel
          title={isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
          description={
            isPolish
              ? 'Mierzalne warunki uznania inicjatywy za zakończoną sukcesem'
              : 'Measurable conditions for considering the initiative successful'
          }
          aiKey="success_criteria"
          isGenerating={isGeneratingAI === 'targetState'}
          onAIClick={async () => {
            const result = await handleGenerateAI('target_state');
            if (result?.parsedContent?.successCriteria?.length) {
              setSuccessCriteria(result.parsedContent.successCriteria);
            }
          }}
          addLabel={isPolish ? 'Dodaj' : 'Add item'}
          onAdd={() => {
            // Focus the inline input by scrolling to it
            const input = document.getElementById('add-criteria-input');
            if (input) input.focus();
          }}
          hasContent={successCriteria.length > 0}
        >
          <div className="space-y-1.5">
            {successCriteria.map((c, i) => (
              <ItemRow
                key={i}
                color="emerald"
                badge="✓"
                onRemove={() => setSuccessCriteria(successCriteria.filter((_, j) => j !== i))}
              >
                {c}
              </ItemRow>
            ))}
            <InlineAdd
              value={newCriteria}
              onChange={setNewCriteria}
              onSubmit={() => {
                if (newCriteria.trim()) {
                  setSuccessCriteria([...successCriteria, newCriteria.trim()]);
                  setNewCriteria('');
                }
              }}
              placeholder={isPolish ? 'Dodaj kryterium sukcesu...' : 'Add success criteria...'}
            />
          </div>
        </ResizablePanel>

        {/* ── 3. Deliverables ────────────────────────────────────────── */}
        <ResizablePanel
          title={isPolish ? 'Produkty' : 'Deliverables'}
          description={
            isPolish
              ? 'Konkretne produkty i rezultaty do dostarczenia'
              : 'Specific outputs and results to be delivered'
          }
          aiKey="deliverables"
          isGenerating={isGeneratingAI === 'targetState'}
          onAIClick={async () => {
            const result = await handleGenerateAI('target_state');
            if (result?.parsedContent?.deliverables?.length) {
              setDeliverables(result.parsedContent.deliverables);
            }
          }}
          addLabel={isPolish ? 'Dodaj' : 'Add item'}
          onAdd={() => {
            const input = document.getElementById('add-deliverable-input');
            if (input) input.focus();
          }}
          hasContent={deliverables.length > 0}
        >
          <div className="space-y-1.5">
            {deliverables.map((d, i) => (
              <ItemRow
                key={i}
                color="blue"
                badge={i + 1}
                onRemove={() => setDeliverables(deliverables.filter((_, j) => j !== i))}
              >
                {d}
              </ItemRow>
            ))}
            <InlineAdd
              value={newDeliverable}
              onChange={setNewDeliverable}
              onSubmit={() => {
                if (newDeliverable.trim()) {
                  setDeliverables([...deliverables, newDeliverable.trim()]);
                  setNewDeliverable('');
                }
              }}
              placeholder={isPolish ? 'Dodaj produkt...' : 'Add deliverable...'}
            />
          </div>
        </ResizablePanel>
      </div>
    </CollapsibleSection>
  );
};
