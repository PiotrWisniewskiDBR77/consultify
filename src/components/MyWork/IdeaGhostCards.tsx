/**
 * IdeaGhostCards — Semi-transparent AI suggestion cards on the canvas.
 *
 * Analyzes canvas state and shows ghost cards where AI detects gaps.
 * Clicking a ghost card materializes it as a real node.
 */
import { Loader2, Plus, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type { CanvasToolType } from './ideaSelectionTypes';

interface GhostCard {
  id: string;
  text: string;
  suggestedPosition: { x: number; y: number };
  branchKey?: string;
  confidence: number;
  source?: string;
}

export interface IdeaGhostCardsProps {
  ideaId: string;
  activeTool: CanvasToolType;
  title: string;
  seedText: string;
  isAccepted: boolean;
  graphNodes: any[];
  graphEdges: any[];
  onMaterialize: (card: {
    text: string;
    position: { x: number; y: number };
    branchKey?: string;
  }) => void;
}

const GHOST_COLORS: Record<string, string> = {
  problem: 'border-danger-300/50 bg-danger-50/30 dark:bg-danger-900/10',
  goal: 'border-emerald-300/50 bg-emerald-50/30 dark:bg-emerald-900/10',
  options: 'border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10',
  evidence: 'border-sky-300/50 bg-sky-50/30 dark:bg-sky-900/10',
  risks: 'border-violet-300/50 bg-violet-50/30 dark:bg-violet-900/10',
  experiments: 'border-blue-300/50 bg-blue-50/30 dark:bg-blue-900/10',
  default: 'border-violet-300/50 bg-violet-50/30 dark:bg-violet-900/10',
};

export const IdeaGhostCards: React.FC<IdeaGhostCardsProps> = ({
  ideaId,
  activeTool,
  title,
  seedText,
  isAccepted,
  graphNodes,
  graphEdges,
  onMaterialize,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [ghosts, setGhosts] = useState<GhostCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const shouldFetch = useMemo(() => {
    return isAccepted && graphNodes.length >= 2 && graphNodes.length < 30;
  }, [graphNodes.length, isAccepted]);

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;

    const fetchGhosts = async () => {
      setLoading(true);
      try {
        const result = await Api.getIdeaAISuggestions(ideaId, {
          context: {
            title,
            seedText,
            currentNodes: graphNodes.map((n) => ({
              id: n.id,
              type: n.type,
              label: n.data?.label,
              branchKey: n.data?.branchKey,
              position: n.position,
            })),
            currentEdges: graphEdges,
            activeTool: activeTool || 'mindmap',
          },
          mode: 'passive' as any,
          language: i18n.language,
        });
        if (cancelled) return;

        const suggestions = result?.suggestions || [];
        const cards: GhostCard[] = suggestions
          .filter((s: any) => s.actionType === 'add_node' || s.category === 'branch_suggestions')
          .slice(0, 5)
          .map((s: any, i: number) => {
            const nearNode = graphNodes[Math.min(i, graphNodes.length - 1)];
            const baseX = nearNode?.position?.x ?? 200;
            const baseY = nearNode?.position?.y ?? 200;
            return {
              id: `ghost-${i}-${Date.now()}`,
              text: s.text,
              suggestedPosition: {
                x: baseX + 220 + (i % 3) * 60,
                y: baseY + Math.floor(i / 3) * 140,
              },
              branchKey: s.actionPayload?.branchKey || undefined,
              confidence: s.confidence || 0.6,
              source: s.source,
            };
          });
        setGhosts(cards);
      } catch {
        setGhosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(fetchGhosts, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTool, graphEdges, graphNodes, i18n.language, ideaId, seedText, shouldFetch, title]);

  const handleMaterialize = useCallback(
    (ghost: GhostCard) => {
      onMaterialize({
        text: ghost.text,
        position: ghost.suggestedPosition,
        branchKey: ghost.branchKey,
      });
      setDismissed((prev) => new Set(prev).add(ghost.id));
    },
    [onMaterialize]
  );

  const visibleGhosts = useMemo(
    () => ghosts.filter((g) => !dismissed.has(g.id)),
    [dismissed, ghosts]
  );

  if (!isAccepted || visibleGhosts.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[20]">
      {visibleGhosts.map((ghost) => {
        const colorClass = GHOST_COLORS[ghost.branchKey || 'default'] || GHOST_COLORS.default;
        return (
          <div
            key={ghost.id}
            className={`absolute pointer-events-auto group cursor-pointer transition-all duration-300 hover:opacity-90 opacity-50 hover:scale-105`}
            style={{
              left: ghost.suggestedPosition.x,
              top: ghost.suggestedPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => handleMaterialize(ghost)}
          >
            <div
              className={`relative w-[170px] min-h-[80px] p-3 rounded-xl border-2 border-dashed ${colorClass} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-1.5">
                <Sparkles size={10} className="text-c-info mt-0.5 shrink-0" />
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {ghost.text}
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center dark:bg-white dark:text-navy-950 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <Plus size={10} />
              </div>
              <div className="mt-1.5 text-[8px] text-c-info flex items-center gap-1">
                <span>{Math.round(ghost.confidence * 100)}%</span>
                {ghost.source && <span>· {ghost.source}</span>}
              </div>
            </div>
          </div>
        );
      })}
      {loading && (
        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] text-c-info shadow-sm">
            <Loader2 size={10} className="animate-spin" />
            {isPl ? 'AI szuka luk...' : 'AI finding gaps...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaGhostCards;
