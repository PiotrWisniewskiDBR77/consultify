/**
 * AIBlindSpotsDetector — Floating notification panel that detects missing areas
 * in the mind map and suggests additions.
 */
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface BlindSpot {
  id: string;
  area: string;
  description: string;
  branchKey: string;
  severity: 'low' | 'medium' | 'high';
}

interface AIBlindSpotsDetectorProps {
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  edges: Array<{ id: string; source: string; target: string }>;
  persistence: string;
  locked: boolean;
  onAddBlindSpot: (spot: BlindSpot) => void;
}

export const AIBlindSpotsDetector: React.FC<AIBlindSpotsDetectorProps> = ({
  ideaId,
  ideaTitle,
  nodes,
  edges,
  persistence,
  locked,
  onAddBlindSpot,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [spots, setSpots] = useState<BlindSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [lastCheck, setLastCheck] = useState<number>(0);

  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      const bk = n.data?.branchKey;
      if (bk && n.id !== 'root' && !n.id.startsWith('branch-')) {
        counts[bk] = (counts[bk] || 0) + 1;
      }
    }
    return counts;
  }, [nodes]);

  const ideaNodeCount = useMemo(() => {
    return nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-')).length;
  }, [nodes]);

  const detectBlindSpots = useCallback(async () => {
    if (persistence !== 'online' || locked) return;
    if (ideaNodeCount < 3) return;

    setLoading(true);
    try {
      const existingLabels = nodes
        .filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'))
        .map((n) => n.data?.label)
        .filter(Boolean);

      const res = await Api.getMyIdeaGapAnalysis(ideaId, {
        seedText: ideaTitle,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        branchKeys: Object.keys(branchCounts),
        language: i18n.language,
      });

      if (res?.gaps && Array.isArray(res.gaps)) {
        setSpots(
          res.gaps.slice(0, 5).map((g: any, idx: number) => ({
            id: g.id || `bs-${idx}`,
            area: g.area || g.text || 'Missing area',
            description: g.description || g.detail || '',
            branchKey: g.branchKey || 'options',
            severity:
              g.severity ||
              (g.confidence && g.confidence > 0.7 ? 'high' : g.confidence > 0.4 ? 'medium' : 'low'),
          }))
        );
        setExpanded(true);
      }
      setLastCheck(Date.now());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [branchCounts, i18n.language, ideaId, ideaNodeCount, ideaTitle, locked, nodes, persistence]);

  // Auto-detect after map has enough nodes and 60s since last check
  useEffect(() => {
    if (ideaNodeCount < 5) return;
    if (Date.now() - lastCheck < 60_000) return;
    if (persistence !== 'online') return;

    const timer = setTimeout(() => {
      detectBlindSpots();
    }, 3000);
    return () => clearTimeout(timer);
  }, [ideaNodeCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSpots = useMemo(() => {
    return spots.filter((s) => !dismissed.has(s.id));
  }, [dismissed, spots]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const handleAdd = useCallback(
    (spot: BlindSpot) => {
      onAddBlindSpot(spot);
      handleDismiss(spot.id);
      toast.success(isPl ? 'Dodano do mapy' : 'Added to map', { duration: 800 });
    },
    [handleDismiss, isPl, onAddBlindSpot]
  );

  if (visibleSpots.length === 0 && !loading) return null;

  const severityColor = {
    high: 'text-c-danger',
    medium: 'text-c-warning',
    low: 'text-c-info',
  };

  return (
    <div className="absolute bottom-16 right-3 z-[88] w-[320px] max-w-[90vw]">
      <div className="rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-warning dark:border-c-warning shadow-2xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-c-warning transition-colors"
        >
          <Eye size={14} className="text-c-warning shrink-0" />
          <span className="text-[11px] font-bold text-c-warning dark:text-c-warning flex-1 text-left">
            {isPl ? 'Blind Spots AI' : 'AI Blind Spots'}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-c-warning" />}
          <span className="text-[10px] text-c-text-secondary font-medium">{visibleSpots.length}</span>
          {expanded ? (
            <ChevronDown size={12} className="text-c-text-secondary" />
          ) : (
            <ChevronUp size={12} className="text-c-text-secondary" />
          )}
        </button>

        {/* Content */}
        {expanded && (
          <div className="px-3 pb-3 space-y-1.5 max-h-[240px] overflow-y-auto">
            {visibleSpots.map((spot) => (
              <div
                key={spot.id}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border"
              >
                <AlertTriangle
                  size={12}
                  className={`mt-0.5 shrink-0 ${severityColor[spot.severity]}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-c-text-secondary dark:text-c-text">
                    {spot.area}
                  </div>
                  {spot.description && (
                    <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-0.5 leading-relaxed">
                      {spot.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => handleAdd(spot)}
                      disabled={locked}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-c-warning text-c-warning dark:text-c-warning hover:bg-c-warning transition-colors disabled:opacity-40"
                    >
                      <Plus size={9} />
                      {isPl ? 'Dodaj' : 'Add'}
                    </button>
                    <button
                      onClick={() => handleDismiss(spot.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-medium text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                    >
                      <X size={9} />
                      {isPl ? 'Odrzuć' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={detectBlindSpots}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-medium text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-40"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              {isPl ? 'Sprawdź ponownie' : 'Re-check'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIBlindSpotsDetector;
