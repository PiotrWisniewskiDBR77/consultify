/**
 * IdeaAINudgeStrip — Proactive AI nudge bar at the bottom of the workspace.
 *
 * Analyzes the current state of the canvas and shows contextual suggestions:
 * - Map has < 5 nodes → suggest expanding
 * - Isolated nodes → suggest connecting
 * - Empty branches → suggest filling from company data
 * - Map looks complete → suggest converting
 */
import { ArrowRight, GitBranch, Link2, Loader2, Rocket, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type { CanvasToolType } from './ideaSelectionTypes';

interface Nudge {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  textPl: string;
  textEn: string;
  action: 'expand' | 'connect' | 'fill' | 'convert' | 'custom';
  priority: number;
  customPrompt?: string;
  source: 'canvas' | 'teresa';
  /** For `connect` nudges: ids of the currently-unconnected nodes (so "Go" can select them). */
  nodeIds?: string[];
}

type NudgeActionResult =
  | false
  | void
  | { status: 'applied'; receiptId: string; targetId: string; version?: string }
  | { status: 'handed_off'; message?: string };

export interface IdeaAINudgeStripProps {
  ideaId: string;
  userId?: string | null;
  organizationId?: string | null;
  activeTool: CanvasToolType;
  title: string;
  seedText: string;
  isAccepted: boolean;
  graphNodes: any[];
  graphEdges: any[];
  onActionExpand: () => NudgeActionResult | Promise<NudgeActionResult>;
  onActionConvert: () => NudgeActionResult | Promise<NudgeActionResult>;
  onSendToChat?: (prompt: string) => NudgeActionResult | Promise<NudgeActionResult>;
  /** For `connect` nudges: select the unconnected nodes and fit the view to them. */
  onActionConnect?: (nodeIds: string[]) => NudgeActionResult | Promise<NudgeActionResult>;
}

export const IdeaAINudgeStrip: React.FC<IdeaAINudgeStripProps> = ({
  ideaId,
  userId,
  organizationId,
  activeTool,
  title,
  seedText,
  isAccepted,
  graphNodes,
  graphEdges,
  onActionExpand,
  onActionConvert,
  onSendToChat,
  onActionConnect,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const hasDismissalScope = Boolean(userId && organizationId);
  const dismissalKey = hasDismissalScope
    ? `consultify:idea-nudges:dismissed:${organizationId}:${userId}:${ideaId}`
    : null;
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      if (!dismissalKey) return new Set();
      const stored = JSON.parse(window.localStorage.getItem(dismissalKey) || '[]');
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      return new Set();
    }
  });
  const [serverNudges, setServerNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<{ id: string; message: string } | null>(null);

  /**
   * 2026-08-10 (E13 visual audit, doc 11 §3.7 "labels use business language" +
   * §11.5 tool-specific semantics): dawniej WSZYSTKIE podpowiedzi tego paska
   * były na sztywno po polsku „Mapa"/„gałęzie" — poprawne dla Mind Map, ale
   * pasek jest montowany też w Whiteboard (`IdeaWhiteboardTool.tsx`), gdzie
   * pokazywał „Mapa ma tylko N elementów" na płótnie, które w tym narzędziu
   * nazywa się „Tablica". `activeTool` był już przyjmowany jako prop, ale
   * nigdy nie sterował treścią — klasyczny „parametr jest, podłączenia nie
   * ma". Pełne frazy per narzędzie (nie sklejanie fragmentów) — polski ma
   * rodzaj gramatyczny („Mapa jest pusta" fem. vs „Diagram jest pusty" masc.),
   * więc jedna sklejana końcówka byłaby niegramatyczna dla części narzędzi.
   */
  const toolCopy = useMemo(() => {
    switch (activeTool) {
      case 'whiteboard':
        return {
          fewNodesPl: (n: number) =>
            `Tablica ma tylko ${n} elementów — AI zaproponuje nowe elementy na bazie danych firmy`,
          fewNodesEn: (n: number) =>
            `Board has only ${n} elements — AI will propose new elements from company data`,
          emptyPl: 'Tablica jest pusta — pozwól AI wygenerować pierwszy szkic',
          emptyEn: 'Board is empty — let AI generate the first draft',
          readyPl: 'Tablica wygląda kompletnie — gotowa do konwersji na inicjatywę?',
          readyEn: 'Board looks complete — ready to convert to initiative?',
        };
      case 'process_flow':
        return {
          fewNodesPl: (n: number) =>
            `Diagram ma tylko ${n} kroków — AI zaproponuje nowe kroki na bazie danych firmy`,
          fewNodesEn: (n: number) =>
            `Flow has only ${n} steps — AI will propose new steps from company data`,
          emptyPl: 'Diagram jest pusty — pozwól AI wygenerować pierwszy szkic',
          emptyEn: 'Flow is empty — let AI generate the first draft',
          readyPl: 'Diagram wygląda kompletnie — gotowy do konwersji na inicjatywę?',
          readyEn: 'Flow looks complete — ready to convert to initiative?',
        };
      case 'table':
        return {
          fewNodesPl: (n: number) =>
            `Tabela ma tylko ${n} wierszy — AI zaproponuje nowe wiersze na bazie danych firmy`,
          fewNodesEn: (n: number) =>
            `Table has only ${n} rows — AI will propose new rows from company data`,
          emptyPl: 'Tabela jest pusta — pozwól AI wygenerować pierwszy szkic',
          emptyEn: 'Table is empty — let AI generate the first draft',
          readyPl: 'Tabela wygląda kompletnie — gotowa do konwersji na inicjatywę?',
          readyEn: 'Table looks complete — ready to convert to initiative?',
        };
      case 'mindmap':
      default:
        return {
          fewNodesPl: (n: number) =>
            `Mapa ma tylko ${n} elementów — AI zaproponuje nowe gałęzie na bazie danych firmy`,
          fewNodesEn: (n: number) =>
            `Map has only ${n} elements — AI will propose new branches from company data`,
          emptyPl: 'Mapa jest pusta — pozwól AI wygenerować pierwszy szkic',
          emptyEn: 'Map is empty — let AI generate the first draft',
          readyPl: 'Mapa wygląda kompletnie — gotowa do konwersji na inicjatywę?',
          readyEn: 'Map looks complete — ready to convert to initiative?',
        };
    }
  }, [activeTool]);

  const localNudges = useMemo<Nudge[]>(() => {
    if (!isAccepted) return [];
    const nudges: Nudge[] = [];
    const nodeCount = graphNodes.length;
    const edgeCount = graphEdges.length;

    if (nodeCount < 5 && nodeCount > 0) {
      nudges.push({
        id: 'few_nodes',
        icon: GitBranch,
        textPl: toolCopy.fewNodesPl(nodeCount),
        textEn: toolCopy.fewNodesEn(nodeCount),
        action: 'expand',
        priority: 90,
        source: 'canvas',
      });
    }

    if (nodeCount === 0 && seedText.trim().length > 10) {
      nudges.push({
        id: 'empty_map',
        icon: Sparkles,
        textPl: toolCopy.emptyPl,
        textEn: toolCopy.emptyEn,
        action: 'expand',
        priority: 100,
        source: 'canvas',
      });
    }

    const connectedIds = new Set<string>();
    for (const e of graphEdges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }
    const isolatedIds = graphNodes.filter((n) => !connectedIds.has(n.id)).map((n) => n.id);
    if (isolatedIds.length > 1 && nodeCount > 3) {
      nudges.push({
        id: 'isolated_nodes',
        icon: Link2,
        textPl: `${isolatedIds.length} niepowiązanych elementów — kliknij, by je zaznaczyć na płótnie`,
        textEn: `${isolatedIds.length} unconnected elements — click to select them on the canvas`,
        action: 'connect',
        priority: 70,
        nodeIds: isolatedIds,
        source: 'canvas',
      });
    }

    if (nodeCount >= 10 && edgeCount >= 8) {
      nudges.push({
        id: 'ready_convert',
        icon: Rocket,
        textPl: toolCopy.readyPl,
        textEn: toolCopy.readyEn,
        action: 'convert',
        priority: 50,
        source: 'canvas',
      });
    }

    return nudges;
  }, [graphEdges, graphNodes, isAccepted, seedText, toolCopy]);

  useEffect(() => {
    if (!isAccepted || !ideaId || graphNodes.length < 3) return;
    let cancelled = false;
    const fetchNudges = async () => {
      setLoading(true);
      try {
        const result = await Api.getIdeaAISuggestions(ideaId, {
          context: {
            title,
            seedText,
            currentNodes: graphNodes.map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
            currentEdges: graphEdges,
            activeTool: activeTool || 'mindmap',
          },
          mode: 'passive',
          language: i18n.language,
        });
        if (cancelled) return;
        if (result?.suggestions?.length) {
          const mapped: Nudge[] = result.suggestions.slice(0, 2).map((s: any, i: number) => ({
            id: `server-${i}`,
            icon: Sparkles,
            textPl: s.text,
            textEn: s.text,
            action: 'custom' as const,
            priority: 60 - i,
            customPrompt: s.text,
            source: 'teresa',
          }));
          setServerNudges(mapped);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchNudges();
    return () => {
      cancelled = true;
    };
  }, [activeTool, graphEdges, graphNodes, i18n.language, ideaId, isAccepted, seedText, title]);

  const allNudges = useMemo(() => {
    const combined = [...localNudges, ...serverNudges]
      .filter((n) => !dismissed.has(n.id))
      .sort((a, b) => b.priority - a.priority);
    return combined.slice(0, 2);
  }, [dismissed, localNudges, serverNudges]);

  const dismissNudge = useCallback(
    (nudgeId: string) => {
      setDismissed((current) => {
        const next = new Set(current).add(nudgeId);
        try {
          if (dismissalKey) window.localStorage.setItem(dismissalKey, JSON.stringify([...next]));
        } catch {
          // Dismissal still applies for this mounted workspace when storage is unavailable.
        }
        return next;
      });
    },
    [dismissalKey]
  );

  const handleAction = useCallback(
    async (nudge: Nudge) => {
      if (applyingId) return;
      setApplyingId(nudge.id);
      setActionError(null);
      setActionNotice(null);
      try {
        let result: NudgeActionResult;
        switch (nudge.action) {
          case 'expand':
            result = await onActionExpand();
            break;
          case 'convert':
            result = await onActionConvert();
            break;
          case 'connect':
            if (onActionConnect && nudge.nodeIds?.length) {
              result = await onActionConnect(nudge.nodeIds);
            } else if (onSendToChat && nudge.customPrompt) {
              result = await onSendToChat(nudge.customPrompt);
            } else {
              throw new Error('No supported action is available for this suggestion.');
            }
            break;
          case 'fill':
          case 'custom':
            if (!onSendToChat || !nudge.customPrompt) {
              throw new Error('Teresa is unavailable for this suggestion.');
            }
            result = await onSendToChat(nudge.customPrompt);
            break;
        }
        if (result === false) throw new Error('NOT_APPLIED');
        const confirmedApplied =
          typeof result === 'object' &&
          result !== null &&
          result.status === 'applied' &&
          Boolean(result.receiptId && result.targetId);
        if (confirmedApplied) {
          dismissNudge(nudge.id);
        } else {
          const handedOffMessage =
            typeof result === 'object' && result !== null && result.status === 'handed_off'
              ? result.message
              : undefined;
          setActionNotice({
            id: nudge.id,
            message:
              handedOffMessage ||
              t(
                'myWorkIdeas.aiNudgeStrip.handedOff',
                'Opened the next step. Keep this suggestion until the result is confirmed.'
              ),
          });
        }
      } catch {
        setActionError({
          id: nudge.id,
          message: t(
            'myWorkIdeas.aiNudgeStrip.applyFailed',
            'Could not apply this suggestion. Your canvas was not marked as changed.'
          ),
        });
      } finally {
        setApplyingId(null);
      }
    },
    [applyingId, dismissNudge, onActionConnect, onActionConvert, onActionExpand, onSendToChat, t]
  );

  if (!isAccepted || allNudges.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-[90%]">
      {allNudges.map((nudge) => {
        const Icon = nudge.icon;
        return (
          <div
            key={nudge.id}
            className="flex items-center gap-2 bg-white/95 dark:bg-navy-800/95 backdrop-blur-sm border border-c-info/20 rounded-2xl shadow-lg px-4 py-2.5 animate-in slide-in-from-bottom-4 duration-300"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-c-info/20 to-c-info/15 flex items-center justify-center shrink-0">
              <Icon size={14} className="text-c-info" />
            </div>
            <div className="max-w-[300px] leading-relaxed">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-c-info">
                {nudge.source === 'teresa'
                  ? isPl
                    ? 'Analiza Teresy'
                    : 'Teresa analysis'
                  : isPl
                    ? 'Analiza płótna'
                    : 'Canvas analysis'}
              </div>
              <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {isPl ? nudge.textPl : nudge.textEn}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleAction(nudge)}
              disabled={Boolean(applyingId)}
              aria-describedby={
                actionError?.id === nudge.id
                  ? `idea-nudge-error-${nudge.id}`
                  : actionNotice?.id === nudge.id
                    ? `idea-nudge-notice-${nudge.id}`
                    : undefined
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors shrink-0"
            >
              {applyingId === nudge.id ? (
                <Loader2 size={10} className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight size={10} aria-hidden="true" />
              )}
              {applyingId === nudge.id
                ? t('myWorkIdeas.aiNudgeStrip.applying', 'Applying…')
                : actionError?.id === nudge.id
                  ? t('myWorkIdeas.aiNudgeStrip.retry', 'Retry')
                  : t('myWorkIdeas.aiNudgeStrip.apply', 'Apply')}
            </button>
            <button
              type="button"
              onClick={() => dismissNudge(nudge.id)}
              aria-label={t('myWorkIdeas.aiNudgeStrip.dismissNudge')}
              className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
            >
              <X size={12} />
            </button>
            {actionError?.id === nudge.id ? (
              <p
                id={`idea-nudge-error-${nudge.id}`}
                role="alert"
                className="max-w-[220px] text-[10px] text-danger-600 dark:text-danger-300"
              >
                {actionError.message}
              </p>
            ) : null}
            {actionNotice?.id === nudge.id ? (
              <p
                id={`idea-nudge-notice-${nudge.id}`}
                role="status"
                className="max-w-[220px] text-[10px] text-c-text-muted"
              >
                {actionNotice.message}
              </p>
            ) : null}
          </div>
        );
      })}
      {loading && (
        <div className="flex items-center gap-1 text-[10px] text-c-info">
          <Loader2 size={10} className="animate-spin" />
        </div>
      )}
    </div>
  );
};

export default IdeaAINudgeStrip;
