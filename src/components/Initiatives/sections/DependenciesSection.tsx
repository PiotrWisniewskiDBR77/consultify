/**
 * DependenciesSection wrapper for Initiatives
 *
 * Bridges initiative-level dependencies (from InitiativeContext)
 * into the shared DependenciesSection component using the
 * externalDependencies prop to bypass the task-level API fetch.
 */

import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { V8PlanningApi } from '@/services/api/v8/planning';

import { DependenciesSection as SharedDependenciesSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

type AIDependencyProposal = {
  add: Array<{
    fromTaskId: string;
    toTaskId: string;
    dependencyType: DependencyType;
    lagDays: number;
    notes?: string;
    rationale?: string;
  }>;
  remove: Array<{
    dependencyId: string;
    reason: string;
  }>;
  note?: string;
};

export const DependenciesSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const { t } = useTranslation();
  const {
    initiativeId,
    dependencies,
    setDependencies,
    onOpenTask,
    tasks,
    initiative,
    isPolish,
    dependenciesAiRequest,
    clearDependenciesAiRequest,
  } = useInitiativeContext();

  const [isAIProposing, setIsAIProposing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIDependencyProposal | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});

  const refresh = React.useCallback(async () => {
    if (!initiativeId) return;
    try {
      const dependencies = await V8PlanningApi.getTaskDependencies(initiativeId).catch(async () => {
        const res = await Api.get(`/initiatives/${initiativeId}/task-dependencies`);
        return Array.isArray(res?.dependencies) ? res.dependencies : [];
      });
      setDependencies(Array.isArray(dependencies) ? dependencies : []);
    } catch {
      // best-effort
    }
  }, [initiativeId, setDependencies]);

  const initiativeTasks = useMemo(
    () =>
      (tasks || []).map((t) => ({
        id: String(t.id),
        title: String(t.title || '').trim(),
        status: String((t as any)?.status || 'todo'),
        priority: String((t as any)?.priority || 'medium'),
      })),
    [tasks]
  );

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of initiativeTasks) map.set(String(t.id), t.title || String(t.id));
    return map;
  }, [initiativeTasks]);

  const edgeById = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        fromTaskId: string;
        toTaskId: string;
        dependencyType: DependencyType;
        lagDays: number;
        notes?: string;
      }
    >();

    for (const d of dependencies || []) {
      const depId = String((d as any)?.id || '').trim();
      if (!depId) continue;
      const direction = String((d as any)?.direction || '');
      const sourceTaskId = String((d as any)?.sourceTaskId || '').trim();
      const taskId = String((d as any)?.taskId || '').trim();
      if (!sourceTaskId || !taskId) continue;

      // Reconstruct edge direction:
      // - predecessor row: taskId is predecessor, sourceTaskId is successor
      // - successor row: sourceTaskId is predecessor, taskId is successor
      const fromTaskId = direction === 'predecessor' ? taskId : sourceTaskId;
      const toTaskId = direction === 'predecessor' ? sourceTaskId : taskId;
      if (!fromTaskId || !toTaskId) continue;

      const typeRaw = String((d as any)?.dependencyType || 'FS').toUpperCase();
      const dependencyType: DependencyType =
        typeRaw === 'FS' || typeRaw === 'SS' || typeRaw === 'FF' || typeRaw === 'SF'
          ? (typeRaw as DependencyType)
          : 'FS';
      const lagDays = Number((d as any)?.lagDays || 0) || 0;
      const notes = (d as any)?.notes ? String((d as any)?.notes) : undefined;

      if (!map.has(depId)) {
        map.set(depId, { id: depId, fromTaskId, toTaskId, dependencyType, lagDays, notes });
      }
    }

    return map;
  }, [dependencies]);

  const existingEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of edgeById.values()) set.add(`${e.fromTaskId}→${e.toTaskId}`);
    return set;
  }, [edgeById]);

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

  const proposeDependenciesWithAI = useCallback(async () => {
    if (!initiativeId) return;
    if (readonly) return;
    setIsAIProposing(true);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.dependenciesSection.english');
      const allowedTypes = ['FS', 'SS', 'FF', 'SF'].join(', ');

      const existingDepsCompact = Array.from(edgeById.values())
        .map((e) => ({
          id: e.id,
          fromTaskId: e.fromTaskId,
          fromTitle: taskTitleById.get(e.fromTaskId) || '',
          toTaskId: e.toTaskId,
          toTitle: taskTitleById.get(e.toTaskId) || '',
          dependencyType: e.dependencyType,
          lagDays: e.lagDays,
        }))
        .slice(0, 200);

      const systemInstruction = [
        `You are a senior PMO delivery lead.`,
        `Your goal is to improve the initiative's task dependency graph so the execution plan is clear and realistic.`,
        `Rules:`,
        `- Use ONLY existing task ids (from INITIATIVE TASKS). Never fabricate ids.`,
        `- Do NOT propose self-dependencies.`,
        `- Avoid duplicates: do not add a dependency that already exists (same fromTaskId → toTaskId).`,
        `- Prefer a lean set of dependencies. Only add links that truly clarify critical sequencing/blockers.`,
        `- For removals, use ONLY existing dependencyId values (from EXISTING DEPENDENCIES). Never fabricate ids.`,
        `- Dependency types must be one of: ${allowedTypes}. Default to FS if unsure.`,
        `- Do NOT invent dates, vendors, systems, or project facts that are not in context.`,
        `- Output language MUST be ${targetLanguageName}.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `Schema:`,
        `{`,
        `  "add": [`,
        `    { "fromTaskId": string, "toTaskId": string, "dependencyType": "FS"|"SS"|"FF"|"SF", "lagDays"?: number, "notes"?: string, "rationale"?: string }`,
        `  ],`,
        `  "remove": [`,
        `    { "dependencyId": string, "reason": string }`,
        `  ],`,
        `  "note"?: string`,
        `}`,
        ``,
        `Mode: review. Return 0–8 additions and 0–6 removals. It's OK to return zero changes if the dependencies are already good.`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[INITIATIVE TASKS]`,
        JSON.stringify(initiativeTasks.slice(0, 140), null, 2),
        ``,
        `[EXISTING DEPENDENCIES]`,
        JSON.stringify(existingDepsCompact, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative dependencies review',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const taskIds = new Set(initiativeTasks.map((t) => String(t.id)));

      const normalizeType = (value: any): DependencyType => {
        const t = String(value || '')
          .trim()
          .toUpperCase();
        if (t === 'FS' || t === 'SS' || t === 'FF' || t === 'SF') return t;
        return 'FS';
      };

      const proposal: AIDependencyProposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        note: typeof parsed?.note === 'string' ? parsed.note.trim() : '',
      };

      // Normalize add
      const seenAddKeys = new Set<string>();
      proposal.add = proposal.add
        .map((a: any) => {
          const fromTaskId = String(a?.fromTaskId || '').trim();
          const toTaskId = String(a?.toTaskId || '').trim();
          const dependencyType = normalizeType(a?.dependencyType);
          const lagDays = Number(a?.lagDays || 0) || 0;
          const notes = a?.notes ? String(a.notes).trim() : '';
          const rationale = a?.rationale ? String(a.rationale).trim() : '';
          return { fromTaskId, toTaskId, dependencyType, lagDays, notes, rationale };
        })
        .filter((a) => a.fromTaskId && a.toTaskId)
        .filter((a) => a.fromTaskId !== a.toTaskId)
        .filter((a) => taskIds.has(a.fromTaskId) && taskIds.has(a.toTaskId))
        .filter((a) => {
          const key = `${a.fromTaskId}→${a.toTaskId}`;
          if (existingEdgeKeys.has(key)) return false;
          if (seenAddKeys.has(key)) return false;
          seenAddKeys.add(key);
          return true;
        })
        .slice(0, 12);

      // Normalize remove
      proposal.remove = proposal.remove
        .map((r: any) => ({
          dependencyId: String(r?.dependencyId || '').trim(),
          reason: String(r?.reason || '').trim(),
        }))
        .filter((r) => r.dependencyId && r.reason)
        .filter((r) => edgeById.has(r.dependencyId))
        .slice(0, 10);

      const fallbackNote =
        proposal.add.length === 0 && proposal.remove.length === 0
          ? t('initiatives.dependenciesSection.noChangeSuggestions')
          : '';

      setAiProposal({
        ...proposal,
        note: (proposal.note || fallbackNote || '').trim(),
      });
      setShowAIModal(true);
      setSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
      );
      setSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r) => [r.dependencyId, false])) as Record<
          string,
          boolean
        >
      );
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.dependenciesSection.aiAnalysisFailed'));
    } finally {
      setIsAIProposing(false);
    }
  }, [
    edgeById,
    existingEdgeKeys,
    initiative,
    initiativeId,
    initiativeTasks,
    isPolish,
    parseAIJson,
    t,
    taskTitleById,
  ]);

  useEffect(() => {
    if (!dependenciesAiRequest) return;
    const run = async () => {
      try {
        if (readonly) return;
        await proposeDependenciesWithAI();
      } finally {
        clearDependenciesAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependenciesAiRequest?.nonce]);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setSelectedRemoveIds({});
  }, []);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal || isApplying) return;
    if (readonly) return;
    const toAdd = aiProposal.add.filter((_, idx) => !!selectedAddIdx[idx]);
    const toRemove = aiProposal.remove.filter((r) => !!selectedRemoveIds[r.dependencyId]);

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(t('initiatives.dependenciesSection.noSelectedChanges'));
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        t('initiatives.dependenciesSection.deleteDependenciesConfirm', { count: toRemove.length })
      );
      if (!ok) return;
    }

    setIsApplying(true);
    try {
      // Remove selected dependencies
      for (const r of toRemove) {
        const edge = edgeById.get(r.dependencyId);
        if (!edge) continue;
        // Use successor task id as the base id (matches initiative aggregation semantics)
        await Api.delete(`/tasks/${edge.toTaskId}/dependencies/${edge.id}`);
      }

      // Add new dependencies
      for (const a of toAdd) {
        await Api.post(`/tasks/${a.toTaskId}/dependencies`, {
          targetTaskId: a.fromTaskId,
          direction: 'predecessor',
          dependencyType: a.dependencyType,
          lagDays: a.lagDays,
          notes: a.notes || undefined,
        });
      }

      await refresh();
      toast.success(
        t('initiatives.dependenciesSection.appliedAiProposals', {
          added: toAdd.length,
          removed: toRemove.length
            ? t('initiatives.dependenciesSection.removedSuffix', { count: toRemove.length })
            : '',
        })
      );
      closeAIModal();
    } catch {
      toast.error(t('initiatives.dependenciesSection.failedToApplyProposals'));
    } finally {
      setIsApplying(false);
    }
  }, [
    aiProposal,
    closeAIModal,
    edgeById,
    isApplying,
    isPolish,
    refresh,
    selectedAddIdx,
    selectedRemoveIds,
    t,
  ]);

  return (
    <>
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-4xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t('initiatives.dependenciesSection.proposedDependencyChanges')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('initiatives.dependenciesSection.selectItemsThenApply')}
                </p>
                {aiProposal.note ? (
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50/60 dark:bg-navy-950/20 border border-slate-200/60 dark:border-navy-700/60 rounded-lg px-3 py-2">
                    {aiProposal.note}
                  </div>
                ) : null}
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={t('initiatives.dependenciesSection.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {/* Remove */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.dependenciesSection.toRemove')} ({aiProposal.remove.length})
                  </span>
                  {aiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedRemoveIds(
                          Object.fromEntries(
                            aiProposal.remove.map((r) => [r.dependencyId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {t('initiatives.dependenciesSection.selectAll')}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/30">
                  <table /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */  className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200/60 dark:border-navy-700/60">
                        <th className="w-10 py-2.5 pl-3 pr-2"></th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.from')}
                        </th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.to')}
                        </th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.type')}
                        </th>
                        <th className="text-left py-2.5 pr-2">Lag</th>
                        <th className="text-left py-2.5 pr-3">
                          {t('initiatives.dependenciesSection.reason')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                      {aiProposal.remove.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            {t('initiatives.dependenciesSection.noRemovalSuggestions')}
                          </td>
                        </tr>
                      ) : (
                        aiProposal.remove.map((r) => {
                          const edge = edgeById.get(r.dependencyId);
                          const fromTitle = edge
                            ? taskTitleById.get(edge.fromTaskId) || edge.fromTaskId
                            : r.dependencyId;
                          const toTitle = edge
                            ? taskTitleById.get(edge.toTaskId) || edge.toTaskId
                            : '—';
                          return (
                            <tr
                              key={r.dependencyId}
                              className="hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                            >
                              <td className="py-2.5 pl-3 pr-2 align-top">
                                <input
                                  type="checkbox"
                                  checked={!!selectedRemoveIds[r.dependencyId]}
                                  onChange={(e) =>
                                    setSelectedRemoveIds((prev) => ({
                                      ...prev,
                                      [r.dependencyId]: e.target.checked,
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                              </td>
                              <td className="py-2.5 pr-2 text-xs text-slate-700 dark:text-slate-200">
                                {fromTitle}
                              </td>
                              <td className="py-2.5 pr-2 text-xs text-slate-700 dark:text-slate-200">
                                {toTitle}
                              </td>
                              <td className="py-2.5 pr-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {edge?.dependencyType || '—'}
                              </td>
                              <td className="py-2.5 pr-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {edge ? String(edge.lagDays ?? 0) : '—'}
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-amber-800/90 dark:text-amber-200">
                                {r.reason}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.dependenciesSection.toAdd')} ({aiProposal.add.length})
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
                      {t('initiatives.dependenciesSection.selectAll')}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/30">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200/60 dark:border-navy-700/60">
                        <th className="w-10 py-2.5 pl-3 pr-2"></th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.from')}
                        </th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.to')}
                        </th>
                        <th className="text-left py-2.5 pr-2">
                          {t('initiatives.dependenciesSection.type')}
                        </th>
                        <th className="text-left py-2.5 pr-2">Lag</th>
                        <th className="text-left py-2.5 pr-3">
                          {t('initiatives.dependenciesSection.notesRationale')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                      {aiProposal.add.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            {t('initiatives.dependenciesSection.noAdditionsProposed')}
                          </td>
                        </tr>
                      ) : (
                        aiProposal.add.map((a, idx) => {
                          const fromTitle = taskTitleById.get(a.fromTaskId) || a.fromTaskId;
                          const toTitle = taskTitleById.get(a.toTaskId) || a.toTaskId;
                          const notes = String(a.notes || '').trim();
                          const rationale = String(a.rationale || '').trim();
                          return (
                            <tr
                              key={`${a.fromTaskId}-${a.toTaskId}-${idx}`}
                              className="hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                            >
                              <td className="py-2.5 pl-3 pr-2 align-top">
                                <input
                                  type="checkbox"
                                  checked={!!selectedAddIdx[idx]}
                                  onChange={(e) =>
                                    setSelectedAddIdx((prev) => ({
                                      ...prev,
                                      [idx]: e.target.checked,
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                              </td>
                              <td className="py-2.5 pr-2 text-xs text-slate-700 dark:text-slate-200">
                                {fromTitle}
                              </td>
                              <td className="py-2.5 pr-2 text-xs text-slate-700 dark:text-slate-200">
                                {toTitle}
                              </td>
                              <td className="py-2.5 pr-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {a.dependencyType}
                              </td>
                              <td className="py-2.5 pr-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {String(a.lagDays ?? 0)}
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                {notes || rationale ? (
                                  <>
                                    {notes ? <div>{notes}</div> : null}
                                    {rationale ? (
                                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        {rationale}
                                      </div>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-primary-200/60 dark:border-primary-500/20 bg-primary-50/40 dark:bg-primary-500/5 px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  {isAIProposing ? (
                    <Loader2 size={14} className="animate-spin text-primary-500" />
                  ) : (
                    <Sparkles size={14} className="text-primary-500" />
                  )}
                  <span>{t('initiatives.dependenciesSection.applyApiNote')}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                disabled={isApplying}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {t('initiatives.dependenciesSection.cancel')}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
              >
                {isApplying ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>{t('initiatives.dependenciesSection.apply')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <SharedDependenciesSection
        externalDependencies={dependencies}
        onOpenTask={onOpenTask}
        readOnly={!!readonly}
        onRefreshExternalDependencies={refresh}
        showSampleDataWhenEmpty={false}
        initiativeId={initiativeId}
        initiativeTasks={initiativeTasks.map((t) => ({ id: t.id, title: t.title }))}
      />
    </>
  );
};
