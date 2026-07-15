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
}

export interface IdeaAINudgeStripProps {
  ideaId: string;
  activeTool: CanvasToolType;
  title: string;
  seedText: string;
  isAccepted: boolean;
  graphNodes: any[];
  graphEdges: any[];
  onActionExpand: () => void;
  onActionConvert: () => void;
  onSendToChat?: (prompt: string) => void;
}

export const IdeaAINudgeStrip: React.FC<IdeaAINudgeStripProps> = ({
  ideaId,
  activeTool,
  title,
  seedText,
  isAccepted,
  graphNodes,
  graphEdges,
  onActionExpand,
  onActionConvert,
  onSendToChat,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [serverNudges, setServerNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(false);

  const localNudges = useMemo<Nudge[]>(() => {
    if (!isAccepted) return [];
    const nudges: Nudge[] = [];
    const nodeCount = graphNodes.length;
    const edgeCount = graphEdges.length;

    if (nodeCount < 5 && nodeCount > 0) {
      nudges.push({
        id: 'few_nodes',
        icon: GitBranch,
        textPl: `Mapa ma tylko ${nodeCount} elementów — AI zaproponuje nowe gałęzie na bazie danych firmy`,
        textEn: `Map has only ${nodeCount} elements — AI will propose new branches from company data`,
        action: 'expand',
        priority: 90,
      });
    }

    if (nodeCount === 0 && seedText.trim().length > 10) {
      nudges.push({
        id: 'empty_map',
        icon: Sparkles,
        textPl: 'Mapa jest pusta — pozwól AI wygenerować pierwszy szkic',
        textEn: 'Map is empty — let AI generate the first draft',
        action: 'expand',
        priority: 100,
      });
    }

    const connectedIds = new Set<string>();
    for (const e of graphEdges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }
    const isolatedCount = graphNodes.filter((n) => !connectedIds.has(n.id)).length;
    if (isolatedCount > 1 && nodeCount > 3) {
      nudges.push({
        id: 'isolated_nodes',
        icon: Link2,
        textPl: `${isolatedCount} niepowiązanych elementów — AI może zasugerować połączenia`,
        textEn: `${isolatedCount} unconnected elements — AI can suggest connections`,
        action: 'connect',
        priority: 70,
      });
    }

    if (nodeCount >= 10 && edgeCount >= 8) {
      nudges.push({
        id: 'ready_convert',
        icon: Rocket,
        textPl: 'Mapa wygląda kompletnie — gotowa do konwersji na inicjatywę?',
        textEn: 'Map looks complete — ready to convert to initiative?',
        action: 'convert',
        priority: 50,
      });
    }

    return nudges;
  }, [graphEdges, graphNodes, isAccepted, seedText]);

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

  const handleAction = useCallback(
    (nudge: Nudge) => {
      switch (nudge.action) {
        case 'expand':
          onActionExpand();
          break;
        case 'convert':
          onActionConvert();
          break;
        case 'connect':
        case 'fill':
        case 'custom':
          if (onSendToChat && nudge.customPrompt) onSendToChat(nudge.customPrompt);
          else onActionExpand();
          break;
      }
      setDismissed((prev) => new Set(prev).add(nudge.id));
    },
    [onActionConvert, onActionExpand, onSendToChat]
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
            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 max-w-[300px] leading-relaxed">
              {isPl ? nudge.textPl : nudge.textEn}
            </div>
            <button
              type="button"
              onClick={() => handleAction(nudge)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors shrink-0"
            >
              <ArrowRight size={10} />
              {t('myWorkIdeas.aiNudgeStrip.go')}
            </button>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(nudge.id))}
              aria-label={t('myWorkIdeas.aiNudgeStrip.dismissNudge')}
              className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
            >
              <X size={12} />
            </button>
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
