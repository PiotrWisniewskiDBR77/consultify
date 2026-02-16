/**
 * KpisSection - API-backed KPI table for initiative benefits tracking
 */

import { motion } from 'framer-motion';
import {
  Copy,
  Edit3,
  Loader2,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';
import { Callout, EmptyStateInline, InlineTable } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface KPI extends Record<string, unknown> {
  id: string;
  name: string;
  category?: string;
  unit: string;
  baseline: string;
  target: string;
  current: string;
  status?: string;
  isOnTarget?: boolean;
}

type AIKpiProposal = {
  add: Array<{
    name: string;
    unit: string;
    baselineValue?: number | string;
    targetValue?: number | string;
    rationale?: string;
  }>;
  remove: Array<{
    kpiId: string;
    reason: string;
  }>;
  note?: string;
};

const parseNumber = (value: string): number => {
  const normalized = String(value || '')
    .replace(',', '.')
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMetric = (value?: string, unit?: string): string => {
  const base = value && value.trim() ? value.trim() : '—';
  return unit && base !== '—' ? `${base} ${unit}` : base;
};

const KPI_NAME_EN_MAP: Record<string, string> = {
  'Skrócenie czasu changeover': 'Changeover time reduction',
  'Redukcja odpadów rozruchowych': 'Startup scrap reduction',
  'OEE po changeover': 'Post-changeover OEE',
};

const toEnglishKpiName = (name: string, isPolish: boolean): string => {
  if (isPolish) return name;
  return KPI_NAME_EN_MAP[name] || name;
};

export const KpisSection: React.FC<InitiativeSectionProps> = ({ expanded, onToggle, readonly }) => {
  const { initiative, initiativeId, isPolish, kpisAiRequest, clearKpisAiRequest } =
    useInitiativeContext();
  const artifactContext = {
    type: 'initiative',
    title: initiative?.name || '',
    status: initiative?.status || '',
    priority: initiative?.priority || '',
  };

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAIProposing, setIsAIProposing] = useState(false);
  const [isAIApplying, setIsAIApplying] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIKpiProposal | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newBaseline, setNewBaseline] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [kpiMenuId, setKpiMenuId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editBaseline, setEditBaseline] = useState('');
  const [editCurrent, setEditCurrent] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const aiNoSuggestionsTimerRef = useRef<number | null>(null);

  const loadKpis = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    try {
      const res = await Api.get(`/initiatives/${initiativeId}/kpis`);
      const rows = Array.isArray(res?.kpis) ? res.kpis : [];
      setKpis(
        rows.map((k: any, idx: number) => ({
          id: String(k.id || `kpi-${idx}`),
          name: String(k.name || ''),
          category: String(k.category || 'benefits'),
          unit: String(k.unit || ''),
          baseline: String(k.baselineValue ?? k.baseline ?? ''),
          target: String(k.targetValue ?? k.target ?? ''),
          current: String(k.currentValue ?? k.latestValue ?? k.baselineValue ?? ''),
          status: String(k.status || ''),
          isOnTarget: Boolean(k.isOnTarget),
        }))
      );
    } catch {
      setKpis([]);
      toast.error(isPolish ? 'Nie udało się pobrać KPI' : 'Failed to load KPIs');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId, isPolish]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    if (!kpiMenuId) return;
    const onDocClick = () => setKpiMenuId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [kpiMenuId]);

  useEffect(() => {
    return () => {
      if (aiNoSuggestionsTimerRef.current) window.clearTimeout(aiNoSuggestionsTimerRef.current);
    };
  }, []);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setAiNote(null);
    setSelectedAddIdx({});
    setSelectedRemoveIds({});
  }, []);

  const parseAIJson = (raw: string): any | null => {
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
  };

  const proposeKpisWithAI = useCallback(async () => {
    if (readonly) return;
    if (!initiativeId) return;
    setIsAIProposing(true);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const existingKpisCompact = kpis.slice(0, 80).map((k) => ({
        id: String(k.id),
        name: String(k.name || ''),
        unit: String(k.unit || ''),
        baselineValue: parseNumber(String(k.baseline || '0')),
        currentValue: parseNumber(String(k.current || '0')),
        targetValue: parseNumber(String(k.target || '0')),
        isOnTarget: Boolean(k.isOnTarget),
      }));

      const systemInstruction = [
        `You are a senior PMO benefits tracking lead.`,
        `Your goal is to improve the KPI set for an initiative in our delivery application.`,
        `Rules:`,
        `- KPIs must be measurable and tied to the initiative context; avoid generic vanity metrics.`,
        `- Prefer a lean set: add 0–5 KPIs max.`,
        `- You may propose removals (0–3) ONLY if clearly redundant, duplicate, placeholder, or not tied to benefits.`,
        `- For "remove", you MUST use existing kpiId values from the provided list. Never fabricate ids.`,
        `- Provide baselineValue and targetValue as numbers when possible. baselineValue and targetValue MUST be different.`,
        `- Do NOT invent domain facts (machines, systems, numbers) that are not in the context. If unsure, propose the KPI but leave baseline/target empty.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `Schema:`,
        `{`,
        `  "add": [`,
        `    { "name": string, "unit": string, "baselineValue"?: number, "targetValue"?: number, "rationale"?: string }`,
        `  ],`,
        `  "remove": [`,
        `    { "kpiId": string, "reason": string }`,
        `  ],`,
        `  "note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        `Target date: ${initiative?.plannedEndDate || initiative?.targetDate || ''}`,
        ``,
        `[EXISTING KPI LIST]`,
        JSON.stringify(existingKpisCompact, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative KPI review',
        artifactContext,
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const proposal: AIKpiProposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        note: parsed?.note ? String(parsed.note).trim() : '',
      };

      proposal.add = proposal.add
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          unit: String(x?.unit || '').trim(),
          baselineValue: x?.baselineValue,
          targetValue: x?.targetValue,
          rationale: x?.rationale ? String(x.rationale).trim() : '',
        }))
        .filter((x) => x.name.length > 0 && x.unit.length > 0)
        .slice(0, 10);

      proposal.remove = proposal.remove
        .map((x: any) => ({
          kpiId: String(x?.kpiId || '').trim(),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.kpiId.length > 0 && x.reason.length > 0)
        .slice(0, 10);

      const existingKpiIds = new Set(kpis.map((k) => String(k.id)));
      proposal.remove = proposal.remove.filter((r) => existingKpiIds.has(String(r.kpiId)));

      const hasAny = proposal.add.length > 0 || proposal.remove.length > 0;
      const note =
        proposal.note ||
        (hasAny
          ? ''
          : isPolish
            ? 'AI nie znalazło sugestii zmian — zestaw KPI wygląda OK.'
            : 'AI found no change suggestions — the KPI set looks good.');

      setAiProposal(proposal);
      setAiNote(note || null);
      setShowAIModal(true);
      setSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
      );
      setSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r) => [r.kpiId, false])) as Record<string, boolean>
      );

      if (!hasAny) {
        if (aiNoSuggestionsTimerRef.current) window.clearTimeout(aiNoSuggestionsTimerRef.current);
        aiNoSuggestionsTimerRef.current = window.setTimeout(() => {
          setAiNote(null);
          aiNoSuggestionsTimerRef.current = null;
        }, 8000);
      }
    } catch (e: any) {
      toast.error(
        e?.message || (isPolish ? 'Nie udało się wygenerować propozycji AI' : 'AI proposal failed')
      );
    } finally {
      setIsAIProposing(false);
    }
  }, [artifactContext, initiative, initiativeId, isPolish, kpis, readonly]);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal || readonly) return;
    if (!initiativeId) return;
    const toAdd = aiProposal.add.filter((_, idx) => selectedAddIdx[idx]);
    const toRemove = aiProposal.remove.filter((r) => selectedRemoveIds[r.kpiId]);

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(isPolish ? 'Brak wybranych zmian' : 'No selected changes');
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${toRemove.length} KPI? To działanie może być nieodwracalne.`
          : `Delete ${toRemove.length} KPI(s)? This action may be irreversible.`
      );
      if (!ok) return;
    }

    setIsAIApplying(true);
    try {
      // Add KPIs (API-backed)
      for (const k of toAdd) {
        const name = String(k.name || '').trim();
        const unit = String(k.unit || '').trim();
        const baselineValue = Number.isFinite(Number(k.baselineValue))
          ? Number(k.baselineValue)
          : parseNumber(String(k.baselineValue ?? ''));
        const targetValue = Number.isFinite(Number(k.targetValue))
          ? Number(k.targetValue)
          : parseNumber(String(k.targetValue ?? ''));

        if (!name || !unit) continue;
        if (baselineValue === targetValue) continue;

        const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
          name,
          description: null,
          category: 'benefits',
          unit,
          baselineValue,
          targetValue,
          measurementFrequency: 'monthly',
        });

        const created = res?.kpi || {};
        setKpis((prev) => [
          {
            id: String(created.id || `kpi-${Date.now()}`),
            name: String(created.name || name),
            category: String(created.category || 'benefits'),
            unit: String(created.unit || unit),
            baseline: String(created.baselineValue ?? baselineValue),
            target: String(created.targetValue ?? targetValue),
            current: String(created.currentValue ?? baselineValue),
            status: String(created.status || 'on_track'),
            isOnTarget:
              created.isOnTarget !== undefined
                ? Boolean(created.isOnTarget)
                : Number(created.currentValue ?? baselineValue) >=
                  Number(created.targetValue ?? targetValue),
          },
          ...prev,
        ]);
      }

      // Remove KPIs (currently UI-only; backend has no delete endpoint)
      if (toRemove.length > 0) {
        const removeIds = new Set(toRemove.map((r) => String(r.kpiId)));
        setKpis((prev) => prev.filter((k) => !removeIds.has(String(k.id))));
        if (editingKpiId && removeIds.has(String(editingKpiId))) {
          setEditingKpiId(null);
          setEditName('');
          setEditUnit('');
          setEditBaseline('');
          setEditCurrent('');
          setEditTarget('');
        }
      }

      toast.success(
        isPolish
          ? `Zastosowano propozycje AI (${toAdd.length} dodano${toRemove.length ? `, ${toRemove.length} usunięto` : ''})`
          : `Applied AI proposals (${toAdd.length} added${toRemove.length ? `, ${toRemove.length} removed` : ''})`
      );
      closeAIModal();
    } catch (e: any) {
      toast.error(
        e?.message ||
          (isPolish ? 'Nie udało się zastosować propozycji' : 'Failed to apply proposals')
      );
    } finally {
      setIsAIApplying(false);
    }
  }, [
    aiProposal,
    closeAIModal,
    editingKpiId,
    initiativeId,
    isPolish,
    readonly,
    selectedAddIdx,
    selectedRemoveIds,
  ]);

  // Triggered from CTA bar (InitiativeDocumentView)
  useEffect(() => {
    if (!kpisAiRequest) return;
    const run = async () => {
      try {
        await proposeKpisWithAI();
      } finally {
        // Keep CTA-bar spinner visible until AI finishes.
        clearKpisAiRequest?.();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpisAiRequest?.nonce]);

  const selectedAddCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.add.reduce((sum, _k, idx) => sum + (selectedAddIdx[idx] ? 1 : 0), 0);
  }, [aiProposal, selectedAddIdx]);

  const selectedRemoveCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.remove.reduce(
      (sum, r) => sum + (selectedRemoveIds[String(r.kpiId)] ? 1 : 0),
      0
    );
  }, [aiProposal, selectedRemoveIds]);

  const resetCreateForm = useCallback(() => {
    setNewName('');
    setNewUnit('');
    setNewBaseline('');
    setNewTarget('');
    setShowAdd(false);
  }, []);

  const addKpi = useCallback(async () => {
    const name = newName.trim();
    const unit = newUnit.trim();
    if (!name || !unit || !initiativeId) return;

    const baselineValue = parseNumber(newBaseline);
    const targetValue = parseNumber(newTarget);
    if (baselineValue === targetValue) {
      toast.error(
        isPolish ? 'Target musi być różny od baseline' : 'Target must be different from baseline'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
        name,
        description: null,
        category: 'benefits',
        unit,
        baselineValue,
        targetValue,
        measurementFrequency: 'monthly',
      });

      const created = res?.kpi || {};
      setKpis((prev) => [
        {
          id: String(created.id || `kpi-${Date.now()}`),
          name: String(created.name || name),
          category: String(created.category || 'benefits'),
          unit: String(created.unit || unit),
          baseline: String(created.baselineValue ?? baselineValue),
          target: String(created.targetValue ?? targetValue),
          current: String(created.currentValue ?? baselineValue),
          status: String(created.status || 'on_track'),
          isOnTarget:
            created.isOnTarget !== undefined
              ? Boolean(created.isOnTarget)
              : Number(created.currentValue ?? baselineValue) >=
                Number(created.targetValue ?? targetValue),
        },
        ...prev,
      ]);
      resetCreateForm();
      toast.success(isPolish ? 'KPI dodane' : 'KPI created');
    } catch (e: any) {
      toast.error(e?.message || (isPolish ? 'Nie udało się dodać KPI' : 'Failed to create KPI'));
    } finally {
      setIsSubmitting(false);
    }
  }, [initiativeId, isPolish, newBaseline, newName, newTarget, newUnit, resetCreateForm]);

  const startEditKpi = useCallback((kpi: KPI) => {
    setEditingKpiId(kpi.id);
    setEditName(kpi.name || '');
    setEditUnit(kpi.unit || '');
    setEditBaseline(kpi.baseline || '');
    setEditCurrent(kpi.current || '');
    setEditTarget(kpi.target || '');
  }, []);

  const cancelEditKpi = useCallback(() => {
    setEditingKpiId(null);
    setEditName('');
    setEditUnit('');
    setEditBaseline('');
    setEditCurrent('');
    setEditTarget('');
  }, []);

  const saveEditedKpi = useCallback(() => {
    if (!editingKpiId || !editName.trim() || !editUnit.trim()) return;
    setKpis((prev) =>
      prev.map((k) =>
        k.id === editingKpiId
          ? {
              ...k,
              name: editName.trim(),
              unit: editUnit.trim(),
              baseline: editBaseline.trim(),
              current: editCurrent.trim(),
              target: editTarget.trim(),
            }
          : k
      )
    );
    toast.success(isPolish ? 'KPI zaktualizowane' : 'KPI updated');
    cancelEditKpi();
  }, [
    cancelEditKpi,
    editBaseline,
    editCurrent,
    editName,
    editTarget,
    editUnit,
    editingKpiId,
    isPolish,
  ]);

  const duplicateKpi = useCallback(
    async (kpi: KPI) => {
      if (!initiativeId) return;
      setIsSubmitting(true);
      try {
        const baselineValue = parseNumber(kpi.baseline);
        const targetValue = parseNumber(kpi.target);
        const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
          name: `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`,
          description: null,
          category: kpi.category || 'benefits',
          unit: kpi.unit || '%',
          baselineValue,
          targetValue,
          measurementFrequency: 'monthly',
        });

        const created = res?.kpi || {};
        setKpis((prev) => [
          {
            id: String(created.id || `kpi-${Date.now()}`),
            name: String(created.name || `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`),
            category: String(created.category || 'benefits'),
            unit: String(created.unit || kpi.unit || '%'),
            baseline: String(created.baselineValue ?? baselineValue),
            target: String(created.targetValue ?? targetValue),
            current: String(created.currentValue ?? baselineValue),
            status: String(created.status || 'on_track'),
            isOnTarget:
              created.isOnTarget !== undefined
                ? Boolean(created.isOnTarget)
                : Number(created.currentValue ?? baselineValue) >=
                  Number(created.targetValue ?? targetValue),
          },
          ...prev,
        ]);
        toast.success(isPolish ? 'KPI zduplikowane' : 'KPI duplicated');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się zduplikować KPI' : 'Failed to duplicate KPI')
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [initiativeId, isPolish]
  );

  const removeKpi = useCallback(
    (id: string) => {
      setKpis((prev) => prev.filter((k) => k.id !== id));
      if (editingKpiId === id) cancelEditKpi();
      toast.success(isPolish ? 'KPI usunięte' : 'KPI deleted');
    },
    [cancelEditKpi, editingKpiId, isPolish]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: isPolish ? 'KPI' : 'KPI',
        render: (row: KPI) => (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {toEnglishKpiName(row.name || '—', isPolish)}
          </span>
        ),
      },
      {
        key: 'unit',
        header: isPolish ? 'Jednostka' : 'Unit',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">{row.unit || '—'}</span>
        ),
      },
      {
        key: 'baseline',
        header: 'Baseline',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.baseline, row.unit)}
          </span>
        ),
      },
      {
        key: 'current',
        header: isPolish ? 'Obecnie' : 'Current',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.current, row.unit)}
          </span>
        ),
      },
      {
        key: 'target',
        header: 'Target',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.target, row.unit)}
          </span>
        ),
      },
      {
        key: 'tracking',
        header: isPolish ? 'Tracking' : 'Tracking',
        align: 'right' as const,
        render: (row: KPI) => (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
              row.isOnTarget
                ? 'border-emerald-300/50 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-300/50 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
          >
            {row.isOnTarget
              ? isPolish
                ? 'On track'
                : 'On track'
              : isPolish
                ? 'Do poprawy'
                : 'Needs attention'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right' as const,
        render: (row: KPI) =>
          readonly ? null : (
            <div className="relative inline-flex">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setKpiMenuId((prev) => (prev === row.id ? null : row.id));
                }}
                className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-navy-700/60 transition-colors"
                title={isPolish ? 'Akcje KPI' : 'KPI actions'}
              >
                <MoreVertical size={14} />
              </button>
              {kpiMenuId === row.id && (
                <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      startEditKpi(row);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Edit3 size={13} />
                    {isPolish ? 'Edytuj' : 'Edit'}
                  </button>
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      void duplicateKpi(row);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Copy size={13} />
                    {isPolish ? 'Duplikuj' : 'Duplicate'}
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-navy-700/50" />
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      const ok = window.confirm(isPolish ? 'Usunąć to KPI?' : 'Delete this KPI?');
                      if (ok) removeKpi(row.id);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                    {isPolish ? 'Usuń' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ),
      },
    ],
    [duplicateKpi, isPolish, kpiMenuId, readonly, removeKpi, startEditKpi]
  );

  return (
    <>
      {/* AI proposal modal (triggered from top CTA bar) */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Propozycje zmian w KPI (AI)' : 'Proposed KPI changes (AI)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPolish
                    ? 'Zaznacz elementy do dodania/usunięcia, a następnie kliknij „Zastosuj”.'
                    : 'Select items to add/remove, then click “Apply”.'}
                </p>
              </div>
              <button
                onClick={closeAIModal}
                disabled={isAIApplying}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {aiNote ? (
                <Callout
                  variant="purple"
                  compact
                  title={isPolish ? 'AI' : 'AI'}
                  className="rounded-xl"
                >
                  {aiNote}
                </Callout>
              ) : null}

              {/* To remove */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do wywalenia' : 'To remove'} ({aiProposal.remove.length})
                  </span>
                  {aiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedRemoveIds(
                          Object.fromEntries(
                            aiProposal.remove.map((r) => [r.kpiId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>

                {aiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={
                      isPolish ? 'AI nie zasugerowało usunięć.' : 'No removal suggestions from AI.'
                    }
                    hint={
                      isPolish
                        ? 'Jeśli KPI są OK, AI może zaproponować tylko dodania.'
                        : 'If your KPIs are already good, AI may propose only additions.'
                    }
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.remove.map((r) => {
                      const existing = kpis.find((k) => String(k.id) === String(r.kpiId));
                      return (
                        <label
                          key={r.kpiId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedRemoveIds[r.kpiId]}
                            onChange={(e) =>
                              setSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.kpiId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                            disabled={isAIApplying}
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {existing?.name || r.kpiId}
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
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do dodania' : 'To add'} ({aiProposal.add.length})
                  </span>
                  {aiProposal.add.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedAddIdx(
                          Object.fromEntries(aiProposal.add.map((_, idx) => [idx, true])) as Record<
                            number,
                            boolean
                          >
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>

                {aiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={isPolish ? 'Brak propozycji do dodania.' : 'No additions proposed.'}
                    hint={
                      isPolish
                        ? 'Jeśli zestaw KPI jest kompletny, AI może nie dodać nic.'
                        : 'If the KPI set is complete, AI may propose nothing.'
                    }
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.add.map((k, idx) => {
                      const baseline =
                        k.baselineValue !== undefined && String(k.baselineValue).trim()
                          ? String(k.baselineValue).trim()
                          : '—';
                      const target =
                        k.targetValue !== undefined && String(k.targetValue).trim()
                          ? String(k.targetValue).trim()
                          : '—';
                      return (
                        <label
                          key={idx}
                          className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedAddIdx[idx]}
                            onChange={(e) =>
                              setSelectedAddIdx((prev) => ({ ...prev, [idx]: e.target.checked }))
                            }
                            className="mt-1"
                            disabled={isAIApplying}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800 dark:text-white">
                                {k.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-navy-700/60 text-slate-600 dark:text-slate-300">
                                {k.unit}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Baseline: {formatMetric(baseline, k.unit)} · Target:{' '}
                                {formatMetric(target, k.unit)}
                              </span>
                            </div>
                            {k.rationale ? (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                                {k.rationale}
                              </p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Plan */}
              <Callout
                variant="purple"
                title={isPolish ? 'Plan' : 'Plan'}
                compact
                className="rounded-xl"
              >
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {isPolish
                      ? `Usuń zaznaczone KPI: ${selectedRemoveCount}.`
                      : `Remove selected KPIs: ${selectedRemoveCount}.`}
                  </li>
                  <li>
                    {isPolish
                      ? `Dodaj zaznaczone KPI: ${selectedAddCount} (source: AI).`
                      : `Add selected KPIs: ${selectedAddCount} (source: AI).`}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                disabled={isAIApplying}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                disabled={isAIApplying}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              >
                {isAIApplying ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CollapsibleSection
        id="kpis"
        title={isPolish ? 'KPI i korzyści' : 'KPIs & Benefits'}
        icon={<TrendingUp size={18} className="text-cyan-500 dark:text-cyan-400" />}
        iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
        expanded={expanded}
        onToggle={onToggle}
        badge={
          kpis.length > 0 || isAIProposing ? (
            <div className="flex items-center gap-2">
              {kpis.length > 0 ? (
                <span className="text-xs text-slate-400">{kpis.length}</span>
              ) : null}
              {isAIProposing ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-navy-800/50 px-2 py-0.5 rounded-full">
                  <Loader2 size={12} className="animate-spin" />
                  {isPolish ? 'AI pracuje...' : 'AI working...'}
                </span>
              ) : null}
            </div>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {!readonly && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdd(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 text-xs font-medium transition-colors"
              >
                <Plus size={14} />
                <span>{isPolish ? 'Nowy' : 'New'}</span>
              </motion.button>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {showAdd && !readonly && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-cyan-300/70 dark:border-cyan-500/50 bg-cyan-50/30 dark:bg-cyan-500/5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={isPolish ? 'Nazwa KPI...' : 'KPI name...'}
                  className="flex-1 w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                  autoFocus
                />
                <AIFieldEnhancer
                  fieldKey="kpis.create.name"
                  sectionLabel={isPolish ? 'KPI — nazwa' : 'KPI — name'}
                  currentValue={newName}
                  onApply={setNewName}
                  artifactContext={artifactContext}
                  iconOnly
                  outputFormat="short"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder={isPolish ? 'Jednostka' : 'Unit'}
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                  />
                  <AIFieldEnhancer
                    fieldKey="kpis.create.unit"
                    sectionLabel={isPolish ? 'KPI — jednostka' : 'KPI — unit'}
                    currentValue={newUnit}
                    onApply={setNewUnit}
                    artifactContext={artifactContext}
                    iconOnly
                    outputFormat="short"
                  />
                </div>
                <input
                  type="text"
                  value={newBaseline}
                  onChange={(e) => setNewBaseline(e.target.value)}
                  placeholder="Baseline"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="Target"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={resetCreateForm}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={() => void addKpi()}
                  disabled={!newName.trim() || !newUnit.trim() || isSubmitting}
                  className="px-3 py-1.5 text-xs bg-cyan-500 text-white rounded-lg disabled:opacity-50 hover:bg-cyan-600 transition-colors"
                >
                  {isSubmitting
                    ? isPolish
                      ? 'Dodawanie...'
                      : 'Adding...'
                    : isPolish
                      ? 'Dodaj KPI'
                      : 'Add KPI'}
                </button>
              </div>
            </motion.div>
          )}

          {editingKpiId && !readonly && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-indigo-300/70 dark:border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={isPolish ? 'Nazwa KPI...' : 'KPI name...'}
                  className="flex-1 w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
                <AIFieldEnhancer
                  fieldKey="kpis.edit.name"
                  sectionLabel={isPolish ? 'KPI — nazwa' : 'KPI — name'}
                  currentValue={editName}
                  onApply={setEditName}
                  artifactContext={artifactContext}
                  iconOnly
                  outputFormat="short"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder={isPolish ? 'Jednostka' : 'Unit'}
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                  />
                  <AIFieldEnhancer
                    fieldKey="kpis.edit.unit"
                    sectionLabel={isPolish ? 'KPI — jednostka' : 'KPI — unit'}
                    currentValue={editUnit}
                    onApply={setEditUnit}
                    artifactContext={artifactContext}
                    iconOnly
                    outputFormat="short"
                  />
                </div>
                <input
                  type="text"
                  value={editBaseline}
                  onChange={(e) => setEditBaseline(e.target.value)}
                  placeholder="Baseline"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
                <input
                  type="text"
                  value={editCurrent}
                  onChange={(e) => setEditCurrent(e.target.value)}
                  placeholder={isPolish ? 'Obecnie' : 'Current'}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
                <input
                  type="text"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder="Target"
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelEditKpi}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={saveEditedKpi}
                  disabled={!editName.trim() || !editUnit.trim()}
                  className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                >
                  {isPolish ? 'Zapisz' : 'Save'}
                </button>
              </div>
            </motion.div>
          )}

          {!isLoading && kpis.length === 0 ? (
            <EmptyStateInline
              icon={TrendingUp}
              message={isPolish ? 'Brak zdefiniowanych KPI' : 'No KPIs defined yet'}
              hint={
                isPolish
                  ? 'Dodaj pierwszy KPI dla tej inicjatywy.'
                  : 'Add your first KPI for this initiative.'
              }
              action={
                readonly
                  ? undefined
                  : {
                      label: isPolish ? 'Nowy KPI' : 'New KPI',
                      onClick: () => setShowAdd(true),
                    }
              }
            />
          ) : (
            <InlineTable<KPI>
              columns={columns}
              data={kpis}
              rowKey={(row) => row.id}
              compact
              striped
              emptyMessage={isPolish ? 'Brak KPI' : 'No KPIs'}
            />
          )}
        </div>
      </CollapsibleSection>
    </>
  );
};
