/**
 * AIBlindSpotsDetector — panel wykrywający braki w mapie myśli i proponujący
 * uzupełnienia.
 *
 * DWA ADRESY (2026-07-28, flaga `ff_ideaPanel6Sections`):
 *   • OFF — pływający overlay `absolute bottom-16 right-3` nad płótnem (jak dziś).
 *   • ON  — `embedded`: zwykła karta w sekcji „AI" prawego panelu, portalowana
 *     tam z `IdeaRecommendationMap` do `IDEA_PANEL_AI_SLOT_ID`.
 * Zgłoszenie właściciela: „nie mogę go przesunąć (…) nie wiem czy nie warto
 * byłoby to rzucić po prostu do prawego menu".
 *
 * Zero okrojenia funkcji: te same dane, te same handlery „Dodaj"/„Odrzuć",
 * to samo „Sprawdź ponownie", to samo zwijanie nagłówkiem. `embedded` zmienia
 * WYŁĄCZNIE klasy opakowania (brak `absolute`/`z-*`/stałej szerokości).
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** `true` = karta w prawym panelu (sekcja „AI") zamiast overlaya nad płótnem. */
  embedded?: boolean;
}

export const AIBlindSpotsDetector: React.FC<AIBlindSpotsDetectorProps> = ({
  ideaId,
  ideaTitle,
  nodes,
  edges,
  persistence,
  locked,
  onAddBlindSpot,
  embedded,
}) => {
  const { t, i18n } = useTranslation();

  const [spots, setSpots] = useState<BlindSpot[]>([]);
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  /** True once a detection run completed (even with zero results) — honest empty state, no retry loop. */
  const [checked, setChecked] = useState(false);
  const [emptyDismissed, setEmptyDismissed] = useState(false);

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

      // Backend contract (my-work.routes.ts /map/gap-analysis):
      // { proposal: { add: { nodes: [{ id, data: { label, branchKey, ... } }], edges }, rationale } }
      const proposalNodes: any[] = Array.isArray(res?.proposal?.add?.nodes)
        ? res.proposal.add.nodes
        : [];
      const mapped: BlindSpot[] = proposalNodes
        .map((n: any, idx: number) => ({
          id: String(n?.id || `bs-${idx}`),
          area: String(n?.data?.label || '').trim(),
          description: '',
          branchKey: String(n?.data?.branchKey || 'options'),
          severity: 'medium' as const,
        }))
        .filter((s) => s.area)
        .slice(0, 5);

      setSpots(mapped);
      setRationale(String(res?.proposal?.rationale || ''));
      setDismissed(new Set());
      if (mapped.length > 0) setExpanded(true);
      setChecked(true);
      setEmptyDismissed(false);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [branchCounts, i18n.language, ideaId, ideaNodeCount, ideaTitle, locked, nodes, persistence]);

  // Auto-detect ONCE per map open (when the map first has enough nodes).
  // No recurring background re-checks — re-runs are user-triggered via "Re-check".
  const detectRef = useRef(detectBlindSpots);
  detectRef.current = detectBlindSpots;
  const autoRanRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (autoRanRef.current) return;
    if (ideaNodeCount < 5) return;
    if (persistence !== 'online' || locked) return;

    autoRanRef.current = true;
    autoTimerRef.current = setTimeout(() => {
      void detectRef.current();
    }, 3000);
  }, [ideaNodeCount, persistence, locked]);

  useEffect(() => () => clearTimeout(autoTimerRef.current), []);

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
      toast.success(t('ideas.mindmap.addedMap', 'Added to map'), { duration: 800 });
    },
    [handleDismiss, onAddBlindSpot]
  );

  // All suggestions handled (added/dismissed) by the user → nothing left to show.
  const allHandled = spots.length > 0 && visibleSpots.length === 0;

  /** Opakowanie: overlay nad płótnem (OFF) albo karta w prawym panelu (ON). */
  const wrapperCls = embedded
    ? 'w-full'
    : 'absolute bottom-16 right-3 z-dropdown w-[320px] max-w-[90vw]';

  /** Czy „Sprawdź" ma wykonawcę. Bez tego nie rysujemy przycisku (Z3). */
  const canDetect = persistence === 'online' && !locked && ideaNodeCount >= 3;

  if (visibleSpots.length === 0 && !loading) {
    // Honest empty state: a completed run found no gaps — say so once, no retry loop.
    if (!checked || allHandled || emptyDismissed) {
      // W panelu (embedded) sekcja „AI" nie może być pustym miejscem — mówimy
      // wprost, co jest grane, i dajemy uruchomienie analizy, gdy ma wykonawcę.
      if (!embedded) return null;
      return (
        <div className={wrapperCls} data-testid="ai-blind-spots-embedded-idle">
          <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Eye size={13} className="text-c-warning shrink-0" />
              <span className="text-[11px] font-bold text-c-text-secondary flex-1">
                {t('ideas.mindmap.aiBlindSpots', 'AI Blind Spots')}
              </span>
            </div>
            <div className="mt-1 text-[10px] leading-snug text-c-text-muted">
              {allHandled || emptyDismissed
                ? t('ideas.mindmap.noBlindSpotsFound', 'No blind spots found')
                : canDetect
                  ? t(
                      'ideas.mindmap.blindSpotsIdleHint',
                      'Run the check to find areas the map is missing.'
                    )
                  : t(
                      'ideas.mindmap.blindSpotsUnavailable',
                      'Add a few more elements to the map — there is nothing to analyse yet.'
                    )}
            </div>
            {canDetect && (
              <button
                type="button"
                onClick={detectBlindSpots}
                disabled={loading}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1 text-[10px] font-semibold text-c-text-secondary transition-colors hover:border-c-focus hover:text-c-text disabled:opacity-40"
              >
                <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                {t('ideas.mindmap.reCheck', 'Re-check')}
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className={wrapperCls}>
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-c-surface/90 backdrop-blur-xl border border-amber-400/30 dark:border-amber-500/20 shadow-2xl">
          <Eye size={14} className="text-amber-500 shrink-0" />
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex-1">
            {t('ideas.mindmap.noBlindSpotsFound', 'No blind spots found')}
          </span>
          <button
            onClick={() => setEmptyDismissed(true)}
            aria-label={t('ideas.mindmap.close', 'Close')}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  const severityColor = {
    high: 'text-c-danger',
    medium: 'text-c-warning',
    low: 'text-c-info',
  };

  return (
    <div className={wrapperCls} data-testid="ai-blind-spots">
      <div
        className={
          embedded
            ? 'rounded-[11px] bg-c-surface-raised border border-c-warning overflow-hidden'
            : 'rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-warning dark:border-c-warning shadow-2xl overflow-hidden'
        }
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-c-warning transition-colors"
        >
          <Eye size={14} className="text-c-warning shrink-0" />
          <span className="text-[11px] font-bold text-c-warning dark:text-c-warning flex-1 text-left">
            {t('ideas.mindmap.aiBlindSpots', 'AI Blind Spots')}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-c-warning" />}
          <span className="text-[10px] text-c-text-secondary font-medium">
            {visibleSpots.length}
          </span>
          {expanded ? (
            <ChevronDown size={12} className="text-c-text-secondary" />
          ) : (
            <ChevronUp size={12} className="text-c-text-secondary" />
          )}
        </button>

        {/* Content */}
        {expanded && (
          <div className="px-3 pb-3 space-y-1.5 max-h-[240px] overflow-y-auto">
            {rationale && (
              <div className="px-2.5 py-2 rounded-xl bg-amber-500/5 text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {rationale}
              </div>
            )}
            {visibleSpots.map((spot) => (
              <div
                key={spot.id}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle"
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
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-c-surface-raised text-c-warning dark:text-c-warning hover:bg-c-surface-raised transition-colors disabled:opacity-40"
                    >
                      <Plus size={9} />
                      {t('ideas.mindmap.add', 'Add')}
                    </button>
                    <button
                      onClick={() => handleDismiss(spot.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-medium text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                    >
                      <X size={9} />
                      {t('ideas.mindmap.dismiss', 'Dismiss')}
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
              {t('ideas.mindmap.reCheck', 'Re-check')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIBlindSpotsDetector;
