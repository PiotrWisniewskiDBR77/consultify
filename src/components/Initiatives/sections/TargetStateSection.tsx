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
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';
import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import { CardBlockRenderer } from '../cards/CardBlockRenderer';
import { buildTargetStateCardSpec } from '../cards/cardSpecBuilders';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

// ── Resizable Panel ─────────────────────────────────────────────────────────

interface ResizablePanelProps {
  /** Area title shown top-left */
  title: string;
  /** Description below title in lighter font */
  description: string;
  /** AI control (dropdown) */
  aiControl: React.ReactNode;
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
  aiControl,
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

  const isOverflowing = contentRef.current ? contentRef.current.scrollHeight > height - 60 : false;

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
      className="relative rounded-xl border border-c-border bg-white/60 dark:bg-navy-900/40 overflow-hidden flex flex-col"
      style={{ height: effectiveHeight, minHeight: MIN_HEIGHT }}
    >
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-3 pb-0 shrink-0">
        {/* Left: title + description */}
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
            {title}
          </h4>
          <p className="text-[10px] text-c-text-secondary mt-0.5 leading-snug">
            {description}
          </p>
        </div>

        {/* Right: AI button + Add item */}
        <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
          {aiControl}
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            <Plus size={11} />
            {addLabel}
          </button>
        </div>
      </div>

      {/* ── Separator ──────────────────────────────────────────────── */}
      <div className="mx-4 mt-2 border-t border-c-border-subtle" />

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
            className="pointer-events-auto inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/90 dark:bg-navy-900/90 border border-c-border text-[10px] font-medium text-c-text-muted hover:text-c-text-secondary shadow-sm transition-colors backdrop-blur-sm"
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
        className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-ns-resize text-c-text-secondary hover:text-c-text-muted transition-colors"
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
  const bg =
    color === 'emerald'
      ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20'
      : 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200/50 dark:border-blue-500/20';
  const badgeBg =
    color === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
      : 'bg-blue-500/20 text-blue-600 dark:text-blue-400';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${bg}`}>
      <div
        className={`w-4 h-4 rounded-full ${badgeBg} flex items-center justify-center text-[9px] font-bold shrink-0`}
      >
        {badge}
      </div>
      <span className="flex-1 text-xs text-c-text-secondary leading-snug">
        {children}
      </span>
      <button
        onClick={onRemove}
        className="text-c-text-secondary hover:text-danger-500 transition-colors shrink-0"
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
    className="w-full px-2.5 py-1.5 rounded-lg bg-c-surface-raised border border-dashed border-c-border text-xs text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-c-border-strong transition-colors"
  />
);

// ── Main Section Component ───────────────────────────────────────────────────

export const TargetStateSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const {
    initiative,
    isPolish,
    targetDescriptionDraft,
    setTargetDescriptionDraft,
    successCriteriaItems,
    setSuccessCriteriaItems,
    deliverableItems,
    setDeliverableItems,
    targetStateAiRequest,
    clearTargetStateAiRequest,
    handleSave,
  } = useInitiativeContext();

  const artifactContext = {
    type: 'initiative',
    title: initiative?.name || '',
    status: initiative?.status || '',
    priority: initiative?.priority || '',
  };

  const successCriteria = useMemo(
    () => (successCriteriaItems || []).map((i) => String(i?.text || '').trim()).filter(Boolean),
    [successCriteriaItems]
  );
  const deliverables = useMemo(
    () => (deliverableItems || []).map((i) => String(i?.text || '').trim()).filter(Boolean),
    [deliverableItems]
  );

  const [newCriteria, setNewCriteria] = useState('');
  const [newDeliverable, setNewDeliverable] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);

  const filledCount = [
    targetDescriptionDraft,
    successCriteria.length > 0,
    deliverables.length > 0,
  ].filter(Boolean).length;

  // F3 (D11) display layer: generic CardBlockRenderer preview. ADDITIVE —
  // a read-only "as it reads" view built from the same live edit state, shown
  // at the bottom only once there is content. Does not replace the edit panels.
  const targetStateCardSpec = buildTargetStateCardSpec(
    {
      vision: targetDescriptionDraft,
      successCriteria,
      deliverables,
    },
    {
      title: t('initiatives.targetStateSection.successCriteria'),
      visionHeading: t('initiatives.targetStateSection.targetState'),
      successCriteriaHeading: t('initiatives.targetStateSection.successCriteria'),
      deliverablesHeading: t('initiatives.targetStateSection.deliverables'),
    }
  );

  type AIListProposal = {
    add: Array<{ text: string; rationale?: string }>;
    remove: Array<{ id: string; reason: string }>;
    reorder?: { order: string[]; note?: string };
  };
  type AITargetStateProposal = {
    successCriteria?: AIListProposal;
    deliverables?: AIListProposal;
    note?: string;
  };

  const [isAIProposing, setIsAIProposing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProposal, setAiProposal] = useState<AITargetStateProposal | null>(null);
  const [aiNoSuggestionsMessage, setAiNoSuggestionsMessage] = useState<string | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);

  const [selectedRemoveIdsSC, setSelectedRemoveIdsSC] = useState<Record<string, boolean>>({});
  const [selectedAddIdxSC, setSelectedAddIdxSC] = useState<Record<number, boolean>>({});
  const [applySuggestedOrderSC, setApplySuggestedOrderSC] = useState(false);

  const [selectedRemoveIdsDL, setSelectedRemoveIdsDL] = useState<Record<string, boolean>>({});
  const [selectedAddIdxDL, setSelectedAddIdxDL] = useState<Record<number, boolean>>({});
  const [applySuggestedOrderDL, setApplySuggestedOrderDL] = useState(false);

  const parseAIJson = useCallback((raw: string): any | null => {
    const text = String(raw || '').trim();
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setAiNoSuggestionsMessage(null);
    setSelectedRemoveIdsSC({});
    setSelectedAddIdxSC({});
    setApplySuggestedOrderSC(false);
    setSelectedRemoveIdsDL({});
    setSelectedAddIdxDL({});
    setApplySuggestedOrderDL(false);
  }, []);

  const proposeTargetStateWithAI = useCallback(async () => {
    if (readonly) {
      clearTargetStateAiRequest?.();
      return;
    }
    setIsAIProposing(true);
    setAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';

      const sc = (successCriteriaItems || []).map((i) => ({
        id: String(i.id),
        text: String(i.text || '').trim(),
      }));
      const dl = (deliverableItems || []).map((i) => ({
        id: String(i.id),
        text: String(i.text || '').trim(),
      }));

      const systemInstruction = [
        `You are a senior PMO consultant.`,
        `Your job is to review and improve the "Success Criteria" and "Deliverables" lists for an initiative.`,
        `Rules:`,
        `- Keep it lean and high-signal. Prefer fewer, better items over generic filler.`,
        `- Success criteria must be measurable conditions of success (not tasks).`,
        `- Deliverables must be concrete outputs (not benefits, not vague outcomes).`,
        `- It is OK to return zero additions/removals if the lists are already good.`,
        `- Remove suggestions should focus on duplicates, placeholders, non-measurable criteria, or items that are not deliverables/criteria.`,
        `- Do NOT invent new facts, numbers, dates, systems, KPIs, or vendors not present in context.`,
        `- If a number is unknown but needed for measurability, use a short "[confirm]" placeholder.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing ids only (from CURRENT LISTS). Never fabricate ids.`,
        `IMPORTANT: For "reorder.order", include only existing ids (from CURRENT LISTS). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "successCriteria": {`,
        `    "add": [ { "text": string, "rationale"?: string } ],`,
        `    "remove": [ { "id": string, "reason": string } ],`,
        `    "reorder"?: { "order": string[], "note"?: string }`,
        `  },`,
        `  "deliverables": {`,
        `    "add": [ { "text": string, "rationale"?: string } ],`,
        `    "remove": [ { "id": string, "reason": string } ],`,
        `    "reorder"?: { "order": string[], "note"?: string }`,
        `  },`,
        `  "note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        `Target state description (if available): ${String(targetDescriptionDraft || '').trim()}`,
        ``,
        `[CURRENT LISTS]`,
        `Success criteria:`,
        JSON.stringify(sc, null, 2),
        ``,
        `Deliverables:`,
        JSON.stringify(dl, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative success criteria review',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;

      const normalizeListProposal = (rawList: any, existingIds: Set<string>): AIListProposal => {
        const add = Array.isArray(rawList?.add) ? rawList.add : [];
        const remove = Array.isArray(rawList?.remove) ? rawList.remove : [];
        const reorder =
          rawList?.reorder && Array.isArray(rawList?.reorder?.order)
            ? { order: rawList.reorder.order, note: rawList.reorder.note }
            : undefined;

        const seenAdd = new Set<string>();
        const normAdd: Array<{ text: string; rationale: string }> = add
          .map((a: any) => ({
            text: String(a?.text || '').trim(),
            rationale: a?.rationale ? String(a.rationale).trim() : '',
          }))
          .filter((a: { text: string; rationale: string }) => a.text.length > 0)
          .filter((a: { text: string; rationale: string }) => {
            const key = a.text.toLowerCase();
            if (seenAdd.has(key)) return false;
            seenAdd.add(key);
            return true;
          })
          .slice(0, 12);

        const normRemove: Array<{ id: string; reason: string }> = remove
          .map((r: any) => ({
            id: String(r?.id || '').trim(),
            reason: String(r?.reason || '').trim(),
          }))
          .filter((r: { id: string; reason: string }) => r.id && r.reason && existingIds.has(r.id))
          .slice(0, 12);

        const reorderOrder = Array.isArray(reorder?.order) ? reorder!.order : [];
        const normalizedOrder = reorderOrder
          .map((id: any) => String(id).trim())
          .filter((id: string) => existingIds.has(id));
        const uniqueOrder: string[] = [];
        normalizedOrder.forEach((id: string) => {
          if (!uniqueOrder.includes(id)) uniqueOrder.push(id);
        });

        return {
          add: normAdd,
          remove: normRemove,
          reorder: uniqueOrder.length > 0 ? { order: uniqueOrder, note: reorder?.note } : undefined,
        };
      };

      const scIds = new Set((successCriteriaItems || []).map((i) => String(i.id)));
      const dlIds = new Set((deliverableItems || []).map((i) => String(i.id)));
      const proposal: AITargetStateProposal = {
        successCriteria: normalizeListProposal(parsed?.successCriteria, scIds),
        deliverables: normalizeListProposal(parsed?.deliverables, dlIds),
        note: parsed?.note ? String(parsed.note).trim() : '',
      };

      const hasAnySuggestions =
        (proposal.successCriteria?.add?.length || 0) > 0 ||
        (proposal.successCriteria?.remove?.length || 0) > 0 ||
        (proposal.successCriteria?.reorder?.order?.length || 0) > 0 ||
        (proposal.deliverables?.add?.length || 0) > 0 ||
        (proposal.deliverables?.remove?.length || 0) > 0 ||
        (proposal.deliverables?.reorder?.order?.length || 0) > 0;

      setAiProposal(proposal);
      setShowAIModal(true);

      // Defaults: add checked, remove unchecked
      setSelectedAddIdxSC(
        Object.fromEntries(
          (proposal.successCriteria?.add || []).map((_, idx) => [idx, true])
        ) as Record<number, boolean>
      );
      setSelectedAddIdxDL(
        Object.fromEntries(
          (proposal.deliverables?.add || []).map((_, idx) => [idx, true])
        ) as Record<number, boolean>
      );
      setSelectedRemoveIdsSC({});
      setSelectedRemoveIdsDL({});
      setApplySuggestedOrderSC(false);
      setApplySuggestedOrderDL(false);

      if (!hasAnySuggestions) {
        setAiNoSuggestionsMessage(
          proposal.note || t('initiatives.targetStateSection.aiNoMeaningfulChanges')
        );
      }
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.targetStateSection.aiAnalysisFailed'));
    } finally {
      setIsAIProposing(false);
      clearTargetStateAiRequest?.();
    }
  }, [
    clearTargetStateAiRequest,
    deliverableItems,
    initiative,
    isPolish,
    parseAIJson,
    readonly,
    successCriteriaItems,
    t,
    targetDescriptionDraft,
  ]);

  useEffect(() => {
    if (!targetStateAiRequest?.nonce) return;
    void proposeTargetStateWithAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStateAiRequest?.nonce]);

  useEffect(() => {
    if (!pendingAutoSave) return;
    let cancelled = false;
    const run = async () => {
      try {
        await handleSave();
      } finally {
        if (!cancelled) setPendingAutoSave(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [handleSave, pendingAutoSave]);

  const applyAIProposal = useCallback(async () => {
    if (readonly) return;
    if (!aiProposal) return;
    const scProposal = aiProposal.successCriteria || { add: [], remove: [] };
    const dlProposal = aiProposal.deliverables || { add: [], remove: [] };

    const removeScIds = new Set(
      (scProposal.remove || []).map((r) => r.id).filter((id) => !!selectedRemoveIdsSC[id])
    );
    const removeDlIds = new Set(
      (dlProposal.remove || []).map((r) => r.id).filter((id) => !!selectedRemoveIdsDL[id])
    );

    const selectedScAdds = (scProposal.add || [])
      .map((a: any, idx: number) => ({ ...a, idx }))
      .filter((a: { idx: number }) => !!selectedAddIdxSC[a.idx])
      .map((a: any) => a.text)
      .filter(Boolean);
    const selectedDlAdds = (dlProposal.add || [])
      .map((a: any, idx: number) => ({ ...a, idx }))
      .filter((a: { idx: number }) => !!selectedAddIdxDL[a.idx])
      .map((a: any) => a.text)
      .filter(Boolean);

    const mkId = (prefix: string, idx: number) => `${prefix}-ai-${Date.now()}-${idx}`;

    setSuccessCriteriaItems((prev) => {
      const kept = prev.filter((i) => !removeScIds.has(String(i.id)));
      const added = selectedScAdds.map((text, idx) => ({ id: mkId('sc', idx), text, done: false }));
      let next = [...kept, ...added];
      if (applySuggestedOrderSC && scProposal.reorder?.order?.length) {
        const byId = new Map(next.map((i) => [String(i.id), i]));
        const orderedExisting = scProposal.reorder.order
          .map((id) => byId.get(String(id)))
          .filter(Boolean) as any[];
        const orderedIds = new Set(orderedExisting.map((i) => String(i.id)));
        const rest = next.filter((i) => !orderedIds.has(String(i.id)));
        next = [...orderedExisting, ...rest];
      }
      return next;
    });

    setDeliverableItems((prev) => {
      const kept = prev.filter((i) => !removeDlIds.has(String(i.id)));
      const added = selectedDlAdds.map((text, idx) => ({ id: mkId('dl', idx), text, done: false }));
      let next = [...kept, ...added];
      if (applySuggestedOrderDL && dlProposal.reorder?.order?.length) {
        const byId = new Map(next.map((i) => [String(i.id), i]));
        const orderedExisting = dlProposal.reorder.order
          .map((id) => byId.get(String(id)))
          .filter(Boolean) as any[];
        const orderedIds = new Set(orderedExisting.map((i) => String(i.id)));
        const rest = next.filter((i) => !orderedIds.has(String(i.id)));
        next = [...orderedExisting, ...rest];
      }
      return next;
    });

    setPendingAutoSave(true);
    closeAIModal();
  }, [
    aiProposal,
    applySuggestedOrderDL,
    applySuggestedOrderSC,
    closeAIModal,
    readonly,
    selectedAddIdxDL,
    selectedAddIdxSC,
    selectedRemoveIdsDL,
    selectedRemoveIdsSC,
    setDeliverableItems,
    setSuccessCriteriaItems,
  ]);

  return (
    <CollapsibleSection
      id="targetState"
      title={t('initiatives.targetStateSection.successCriteria')}
      icon={<Target size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        filledCount > 0 ? (
          <span className="text-xs text-c-text-secondary">{filledCount}/3</span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-3">
        {aiNoSuggestionsMessage && !showAIModal && (
          <Callout variant="purple" compact title="AI">
            {aiNoSuggestionsMessage}
          </Callout>
        )}

        {/* AI proposal modal */}
        {showAIModal && aiProposal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
              <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle">
                <div>
                  <h3 className="text-sm font-semibold text-c-text">
                    {t('initiatives.targetStateSection.proposedSuccessCriteriaChanges')}
                  </h3>
                  <p className="text-[11px] text-c-text-muted mt-0.5">
                    {t('initiatives.targetStateSection.selectItemsThenApply')}
                  </p>
                </div>
                <button
                  onClick={closeAIModal}
                  disabled={isAIProposing}
                  className="p-2 rounded-lg text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                  title={t('initiatives.targetStateSection.close')}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
                {aiProposal.note || aiNoSuggestionsMessage ? (
                  <Callout
                    variant="purple"
                    compact
                    title={t('initiatives.targetStateSection.note')}
                  >
                    {aiProposal.note || aiNoSuggestionsMessage}
                  </Callout>
                ) : null}

                {/* Success criteria suggestions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-c-text-secondary">
                      {t('initiatives.targetStateSection.successCriteria')}
                    </h4>
                  </div>

                  {/* To remove */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.toRemove')} (
                        {aiProposal.successCriteria?.remove?.length || 0})
                      </span>
                      {(aiProposal.successCriteria?.remove?.length || 0) > 0 && (
                        <button
                          onClick={() =>
                            setSelectedRemoveIdsSC(
                              Object.fromEntries(
                                (aiProposal.successCriteria?.remove || []).map((r) => [r.id, true])
                              ) as Record<string, boolean>
                            )
                          }
                          className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                        >
                          {t('initiatives.targetStateSection.selectAll')}
                        </button>
                      )}
                    </div>
                    {(aiProposal.successCriteria?.remove?.length || 0) === 0 ? (
                      <EmptyStateInline
                        icon={Trash2}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noRemovalSuggestions')}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(aiProposal.successCriteria?.remove || []).map((r) => {
                          const existing = (successCriteriaItems || []).find(
                            (i) => String(i.id) === String(r.id)
                          );
                          return (
                            <label
                              key={r.id}
                              className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={!!selectedRemoveIdsSC[r.id]}
                                onChange={(e) =>
                                  setSelectedRemoveIdsSC((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.checked,
                                  }))
                                }
                                className="mt-1"
                              />
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-c-text">
                                  {existing?.text || r.id}
                                </span>
                                <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                                  {r.reason}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* To add */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.toAdd')} (
                        {aiProposal.successCriteria?.add?.length || 0})
                      </span>
                      {(aiProposal.successCriteria?.add?.length || 0) > 0 && (
                        <button
                          onClick={() =>
                            setSelectedAddIdxSC(
                              Object.fromEntries(
                                (aiProposal.successCriteria?.add || []).map((_, idx) => [idx, true])
                              ) as Record<number, boolean>
                            )
                          }
                          className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                        >
                          {t('initiatives.targetStateSection.selectAll')}
                        </button>
                      )}
                    </div>
                    {(aiProposal.successCriteria?.add?.length || 0) === 0 ? (
                      <EmptyStateInline
                        icon={Plus}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noAdditionsProposed')}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(aiProposal.successCriteria?.add || []).map((a, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={!!selectedAddIdxSC[idx]}
                              onChange={(e) =>
                                setSelectedAddIdxSC((prev) => ({
                                  ...prev,
                                  [idx]: e.target.checked,
                                }))
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-c-text">
                                {a.text}
                              </span>
                              {a.rationale ? (
                                <p className="text-[11px] text-c-text-muted mt-1">
                                  {a.rationale}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suggested order */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.suggestedOrder')} (
                        {aiProposal.successCriteria?.reorder?.order?.length || 0})
                      </span>
                      <label className="inline-flex items-center gap-2 text-[11px] text-c-text-muted select-none">
                        <input
                          type="checkbox"
                          checked={applySuggestedOrderSC}
                          onChange={(e) => setApplySuggestedOrderSC(e.target.checked)}
                          disabled={!aiProposal.successCriteria?.reorder?.order?.length}
                        />
                        {t('initiatives.targetStateSection.applyOrder')}
                      </label>
                    </div>
                    {!aiProposal.successCriteria?.reorder?.order?.length ? (
                      <EmptyStateInline
                        icon={Sparkles}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noOrderingSuggestion')}
                      />
                    ) : (
                      <>
                        {aiProposal.successCriteria?.reorder?.note ? (
                          <p className="text-[11px] text-c-text-muted">
                            {aiProposal.successCriteria.reorder.note}
                          </p>
                        ) : null}
                        <ol className="space-y-1.5 list-decimal pl-5">
                          {(aiProposal.successCriteria?.reorder?.order || []).map((id) => {
                            const existing = (successCriteriaItems || []).find(
                              (i) => String(i.id) === String(id)
                            );
                            return (
                              <li key={id} className="text-xs text-c-text-secondary">
                                {existing?.text || id}
                              </li>
                            );
                          })}
                        </ol>
                      </>
                    )}
                  </div>
                </div>

                {/* Deliverables suggestions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-c-text-secondary">
                      {t('initiatives.targetStateSection.deliverables')}
                    </h4>
                  </div>

                  {/* To remove */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.toRemove')} (
                        {aiProposal.deliverables?.remove?.length || 0})
                      </span>
                      {(aiProposal.deliverables?.remove?.length || 0) > 0 && (
                        <button
                          onClick={() =>
                            setSelectedRemoveIdsDL(
                              Object.fromEntries(
                                (aiProposal.deliverables?.remove || []).map((r) => [r.id, true])
                              ) as Record<string, boolean>
                            )
                          }
                          className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                        >
                          {t('initiatives.targetStateSection.selectAll')}
                        </button>
                      )}
                    </div>
                    {(aiProposal.deliverables?.remove?.length || 0) === 0 ? (
                      <EmptyStateInline
                        icon={Trash2}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noRemovalSuggestions')}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(aiProposal.deliverables?.remove || []).map((r) => {
                          const existing = (deliverableItems || []).find(
                            (i) => String(i.id) === String(r.id)
                          );
                          return (
                            <label
                              key={r.id}
                              className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={!!selectedRemoveIdsDL[r.id]}
                                onChange={(e) =>
                                  setSelectedRemoveIdsDL((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.checked,
                                  }))
                                }
                                className="mt-1"
                              />
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-c-text">
                                  {existing?.text || r.id}
                                </span>
                                <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                                  {r.reason}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* To add */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.toAdd')} (
                        {aiProposal.deliverables?.add?.length || 0})
                      </span>
                      {(aiProposal.deliverables?.add?.length || 0) > 0 && (
                        <button
                          onClick={() =>
                            setSelectedAddIdxDL(
                              Object.fromEntries(
                                (aiProposal.deliverables?.add || []).map((_, idx) => [idx, true])
                              ) as Record<number, boolean>
                            )
                          }
                          className="text-[11px] text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                        >
                          {t('initiatives.targetStateSection.selectAll')}
                        </button>
                      )}
                    </div>
                    {(aiProposal.deliverables?.add?.length || 0) === 0 ? (
                      <EmptyStateInline
                        icon={Plus}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noAdditionsProposed')}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(aiProposal.deliverables?.add || []).map((a, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={!!selectedAddIdxDL[idx]}
                              onChange={(e) =>
                                setSelectedAddIdxDL((prev) => ({
                                  ...prev,
                                  [idx]: e.target.checked,
                                }))
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-c-text">
                                {a.text}
                              </span>
                              {a.rationale ? (
                                <p className="text-[11px] text-c-text-muted mt-1">
                                  {a.rationale}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suggested order */}
                  <div className="rounded-xl bg-c-surface-raised p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-c-text-secondary">
                        {t('initiatives.targetStateSection.suggestedOrder')} (
                        {aiProposal.deliverables?.reorder?.order?.length || 0})
                      </span>
                      <label className="inline-flex items-center gap-2 text-[11px] text-c-text-muted select-none">
                        <input
                          type="checkbox"
                          checked={applySuggestedOrderDL}
                          onChange={(e) => setApplySuggestedOrderDL(e.target.checked)}
                          disabled={!aiProposal.deliverables?.reorder?.order?.length}
                        />
                        {t('initiatives.targetStateSection.applyOrder')}
                      </label>
                    </div>
                    {!aiProposal.deliverables?.reorder?.order?.length ? (
                      <EmptyStateInline
                        icon={Sparkles}
                        dashed={false}
                        className="p-5"
                        message={t('initiatives.targetStateSection.noOrderingSuggestion')}
                      />
                    ) : (
                      <>
                        {aiProposal.deliverables?.reorder?.note ? (
                          <p className="text-[11px] text-c-text-muted">
                            {aiProposal.deliverables.reorder.note}
                          </p>
                        ) : null}
                        <ol className="space-y-1.5 list-decimal pl-5">
                          {(aiProposal.deliverables?.reorder?.order || []).map((id) => {
                            const existing = (deliverableItems || []).find(
                              (i) => String(i.id) === String(id)
                            );
                            return (
                              <li key={id} className="text-xs text-c-text-secondary">
                                {existing?.text || id}
                              </li>
                            );
                          })}
                        </ol>
                      </>
                    )}
                  </div>
                </div>

                {/* Plan */}
                <Callout
                  variant="purple"
                  title={t('initiatives.targetStateSection.plan')}
                  compact
                  className="rounded-xl"
                >
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      {t('initiatives.targetStateSection.removeSelectedSuccessCriteria', {
                        count: Object.values(selectedRemoveIdsSC).filter(Boolean).length,
                      })}
                    </li>
                    <li>
                      {t('initiatives.targetStateSection.addSelectedSuccessCriteria', {
                        count: Object.values(selectedAddIdxSC).filter(Boolean).length,
                      })}
                    </li>
                    <li>
                      {t('initiatives.targetStateSection.removeSelectedDeliverables', {
                        count: Object.values(selectedRemoveIdsDL).filter(Boolean).length,
                      })}
                    </li>
                    <li>
                      {t('initiatives.targetStateSection.addSelectedDeliverables', {
                        count: Object.values(selectedAddIdxDL).filter(Boolean).length,
                      })}
                    </li>
                  </ul>
                </Callout>
              </div>

              <div className="px-5 py-4 border-t border-c-border-subtle flex items-center justify-end gap-2">
                <button
                  onClick={closeAIModal}
                  disabled={isAIProposing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  {t('initiatives.targetStateSection.cancel')}
                </button>
                <button
                  onClick={() => void applyAIProposal()}
                  disabled={isAIProposing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  {isAIProposing ? <Loader2 size={13} className="animate-spin" /> : null}
                  {t('initiatives.targetStateSection.apply')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 1. Target State ────────────────────────────────────────── */}
        <ResizablePanel
          title={t('initiatives.targetStateSection.targetState')}
          description={t('initiatives.targetStateSection.targetStateDescription')}
          aiControl={
            <AIFieldEnhancer
              fieldKey="targetState.description"
              sectionLabel={t('initiatives.targetStateSection.targetStateDescriptionLabel')}
              currentValue={targetDescriptionDraft}
              onApply={setTargetDescriptionDraft}
              artifactContext={artifactContext}
              outputFormat="paragraph"
              disabled={readonly}
            />
          }
          addLabel={t('initiatives.targetStateSection.edit')}
          onAdd={() => setShowTargetInput(true)}
          hasContent={!!targetDescriptionDraft}
        >
          {targetDescriptionDraft ? (
            <p className="text-xs text-c-text-secondary leading-relaxed whitespace-pre-wrap">
              {targetDescriptionDraft}
            </p>
          ) : showTargetInput ? (
            <textarea
              autoFocus
              value={targetDescriptionDraft}
              onChange={(e) => setTargetDescriptionDraft(e.target.value)}
              rows={3}
              className="w-full px-2.5 py-2 rounded-lg bg-c-surface-raised border border-c-border text-xs text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
              placeholder={t('initiatives.targetStateSection.describeEndStatePlaceholder')}
              onBlur={() => {
                if (!targetDescriptionDraft) setShowTargetInput(false);
              }}
              readOnly={readonly}
            />
          ) : (
            <p className="text-xs text-c-text-secondary italic">
              {t('initiatives.targetStateSection.noDescriptionHint')}
            </p>
          )}
        </ResizablePanel>

        {/* ── 2. Success Criteria ────────────────────────────────────── */}
        <ResizablePanel
          title={t('initiatives.targetStateSection.successCriteria')}
          description={t('initiatives.targetStateSection.successCriteriaDescription')}
          aiControl={
            <AIFieldEnhancer
              fieldKey="targetState.successCriteria"
              sectionLabel={t('initiatives.targetStateSection.successCriteriaListLabel')}
              currentValue={successCriteria.join('\n')}
              onApply={(v) => {
                const items = String(v || '')
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                setSuccessCriteriaItems(
                  items.map((text, idx) => ({
                    id: `sc-${Date.now()}-${idx}`,
                    text,
                    done: false,
                  }))
                );
              }}
              artifactContext={artifactContext}
              outputFormat="list"
              disabled={readonly}
            />
          }
          addLabel={t('initiatives.targetStateSection.addItem')}
          onAdd={() => {
            // Focus the inline input by scrolling to it
            const input = document.getElementById('add-criteria-input');
            if (input) input.focus();
          }}
          hasContent={successCriteria.length > 0}
        >
          <div className="space-y-1.5">
            {(successCriteriaItems || [])
              .map((c) => ({ id: String(c.id), text: String(c.text || '').trim() }))
              .filter((c) => c.text.length > 0)
              .map((c, i) => (
                <ItemRow
                  key={c.id}
                  color="emerald"
                  badge="✓"
                  onRemove={() => {
                    if (readonly) return;
                    setSuccessCriteriaItems((prev) => prev.filter((x) => String(x.id) !== c.id));
                  }}
                >
                  {c.text}
                </ItemRow>
              ))}
            <InlineAdd
              value={newCriteria}
              onChange={setNewCriteria}
              onSubmit={() => {
                if (readonly) return;
                if (newCriteria.trim()) {
                  setSuccessCriteriaItems((prev) => [
                    ...prev,
                    { id: `sc-${Date.now()}`, text: newCriteria.trim(), done: false },
                  ]);
                  setNewCriteria('');
                }
              }}
              placeholder={t('initiatives.targetStateSection.addSuccessCriteriaPlaceholder')}
            />
          </div>
        </ResizablePanel>

        {/* ── 3. Deliverables ────────────────────────────────────────── */}
        <ResizablePanel
          title={t('initiatives.targetStateSection.deliverables')}
          description={t('initiatives.targetStateSection.deliverablesDescription')}
          aiControl={
            <AIFieldEnhancer
              fieldKey="targetState.deliverables"
              sectionLabel={t('initiatives.targetStateSection.deliverablesListLabel')}
              currentValue={deliverables.join('\n')}
              onApply={(v) => {
                const items = String(v || '')
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                setDeliverableItems(
                  items.map((text, idx) => ({
                    id: `dl-${Date.now()}-${idx}`,
                    text,
                    done: false,
                  }))
                );
              }}
              artifactContext={artifactContext}
              outputFormat="list"
              disabled={readonly}
            />
          }
          addLabel={t('initiatives.targetStateSection.addItem')}
          onAdd={() => {
            const input = document.getElementById('add-deliverable-input');
            if (input) input.focus();
          }}
          hasContent={deliverables.length > 0}
        >
          <div className="space-y-1.5">
            {(deliverableItems || [])
              .map((d) => ({ id: String(d.id), text: String(d.text || '').trim() }))
              .filter((d) => d.text.length > 0)
              .map((d, i) => (
                <ItemRow
                  key={d.id}
                  color="blue"
                  badge={i + 1}
                  onRemove={() => {
                    if (readonly) return;
                    setDeliverableItems((prev) => prev.filter((x) => String(x.id) !== d.id));
                  }}
                >
                  {d.text}
                </ItemRow>
              ))}
            <InlineAdd
              value={newDeliverable}
              onChange={setNewDeliverable}
              onSubmit={() => {
                if (readonly) return;
                if (newDeliverable.trim()) {
                  setDeliverableItems((prev) => [
                    ...prev,
                    { id: `dl-${Date.now()}`, text: newDeliverable.trim(), done: false },
                  ]);
                  setNewDeliverable('');
                }
              }}
              placeholder={t('initiatives.targetStateSection.addDeliverablePlaceholder')}
            />
          </div>
        </ResizablePanel>

        {/* F3 (D11) display layer — generic CardBlockRenderer preview.
            ADDITIVE: a read-only "as it reads" view built from the same data,
            shown only once there is content. Does not replace the edit panels. */}
        {filledCount > 0 && (
          <div className="pt-3 border-t border-c-border">
            <div className="text-xs font-medium uppercase tracking-wide text-c-text-muted mb-2">
              {t('initiatives.targetStateSection.successCriteria')}
            </div>
            <CardBlockRenderer spec={targetStateCardSpec} showTitle={false} />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
