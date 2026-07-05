/**
 * SmartSuggestionsBar — Ambient AI bar at the bottom of the table.
 *
 * Shows contextual suggestions: arrangement tips, completeness hints,
 * pattern detection, summary cards, layout suggestions.
 * Runs passively in the background and updates as the user works.
 */
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

export interface SmartSuggestion {
  id: string;
  type: 'completeness' | 'pattern' | 'arrangement' | 'summary' | 'layout' | 'action';
  title: string;
  detail: string;
  confidence: number;
  action?: { label: string; payload: any };
  icon?: 'lightbulb' | 'chart' | 'grid' | 'checklist' | 'trending' | 'zap';
}

interface SmartSuggestionsBarProps {
  nodes: TableNode[];
  columns: ColumnDef[];
  visible: boolean;
  onDismiss: () => void;
  onApplySuggestion?: (suggestion: SmartSuggestion) => void;
  ideaId?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  lightbulb: Lightbulb,
  chart: BarChart3,
  grid: Grid3X3,
  checklist: ListChecks,
  trending: TrendingUp,
  zap: Zap,
};

export const SmartSuggestionsBar: React.FC<SmartSuggestionsBarProps> = ({
  nodes,
  columns,
  visible,
  onDismiss,
  onApplySuggestion,
  ideaId,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const generateLocalSuggestions = useCallback((): SmartSuggestion[] => {
    const result: SmartSuggestion[] = [];

    const emptyCount = nodes.filter((n) => {
      const filled = columns.filter((c) => c.visible && n.data?.[c.key]).length;
      return filled < columns.filter((c) => c.visible).length * 0.3;
    }).length;
    if (emptyCount > 0) {
      result.push({
        id: 'completeness-1',
        type: 'completeness',
        title: isPl ? 'Niekompletne wiersze' : 'Incomplete rows',
        detail: isPl
          ? `${emptyCount} ${emptyCount === 1 ? 'wiersz ma' : 'wierszy ma'} mniej niż 30% wypełnionych pól. Rozważ uzupełnienie lub użyj AI do auto-fill.`
          : `${emptyCount} row${emptyCount === 1 ? ' has' : 's have'} less than 30% filled fields. Consider filling them or use AI auto-fill.`,
        confidence: 0.9,
        icon: 'checklist',
        action: {
          label: isPl ? 'AI Auto-fill' : 'AI Auto-fill',
          payload: { type: 'auto_fill_empty' },
        },
      });
    }

    const selectCols = columns.filter((c) => c.type === 'select' && c.visible);
    for (const col of selectCols) {
      const valueCounts: Record<string, number> = {};
      for (const n of nodes) {
        const v = String(n.data?.[col.key] || '');
        if (v) valueCounts[v] = (valueCounts[v] || 0) + 1;
      }
      const dominant = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominant && dominant[1] > nodes.length * 0.6 && nodes.length > 3) {
        result.push({
          id: `pattern-${col.key}`,
          type: 'pattern',
          title: isPl ? `Dominujący wzorzec: ${col.header}` : `Dominant pattern: ${col.header}`,
          detail: isPl
            ? `${Math.round((dominant[1] / nodes.length) * 100)}% wierszy ma wartość "${dominant[0]}". Rozważ dodanie większej różnorodności.`
            : `${Math.round((dominant[1] / nodes.length) * 100)}% of rows have value "${dominant[0]}". Consider adding more diversity.`,
          confidence: 0.75,
          icon: 'trending',
        });
      }
    }

    if (nodes.length > 5 && !columns.some((c) => c.type === 'rating' || c.type === 'number')) {
      result.push({
        id: 'layout-add-rating',
        type: 'layout',
        title: isPl ? 'Dodaj kolumnę oceny' : 'Add a rating column',
        detail: isPl
          ? 'Masz wiele pomysłów — dodanie kolumny oceny pozwoli priorytetyzować najlepsze.'
          : 'You have many ideas — adding a rating column will help prioritize the best ones.',
        confidence: 0.7,
        icon: 'lightbulb',
        action: {
          label: isPl ? 'Dodaj kolumnę' : 'Add column',
          payload: { type: 'add_column', columnType: 'rating' },
        },
      });
    }

    if (nodes.length >= 4) {
      result.push({
        id: 'summary-stats',
        type: 'summary',
        title: isPl ? 'Podsumowanie' : 'Summary',
        detail: isPl
          ? `${nodes.length} pomysłów w ${new Set(nodes.map((n) => n.data?.type || 'idea')).size} kategoriach. Średnia kompletność: ${Math.round((nodes.reduce((acc, n) => acc + columns.filter((c) => c.visible && n.data?.[c.key]).length, 0) / nodes.length / Math.max(columns.filter((c) => c.visible).length, 1)) * 100)}%.`
          : `${nodes.length} ideas across ${new Set(nodes.map((n) => n.data?.type || 'idea')).size} categories. Average completeness: ${Math.round((nodes.reduce((acc, n) => acc + columns.filter((c) => c.visible && n.data?.[c.key]).length, 0) / nodes.length / Math.max(columns.filter((c) => c.visible).length, 1)) * 100)}%.`,
        confidence: 1,
        icon: 'chart',
      });
    }

    if (nodes.length > 8) {
      result.push({
        id: 'arrangement-kanban',
        type: 'arrangement',
        title: isPl ? 'Spróbuj widoku Kanban' : 'Try Kanban view',
        detail: isPl
          ? 'Przy tej liczbie pomysłów widok Kanban może pomóc w organizacji.'
          : 'With this many ideas, Kanban view might help organize them better.',
        confidence: 0.65,
        icon: 'grid',
        action: { label: 'Kanban', payload: { type: 'switch_view', view: 'kanban' } },
      });
    }

    return result;
  }, [columns, isPl, nodes]);

  const fetchAISuggestions = useCallback(async (): Promise<SmartSuggestion[]> => {
    if (!ideaId || nodes.length < 2) return [];
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: 'Smart Suggestions',
          seedText: `Table with ${nodes.length} rows. Columns: ${columns.map((c) => c.header).join(', ')}`,
          currentNodes: nodes
            .slice(0, 20)
            .map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
          currentEdges: [],
          activeTool: 'table',
        },
        mode: 'passive',
        language: isPl ? 'pl' : 'en',
      });
      return (result?.suggestions || []).map((s: any, idx: number) => ({
        id: `ai-${idx}-${Date.now()}`,
        type: 'action' as const,
        title: s.title || (isPl ? 'Sugestia AI' : 'AI Suggestion'),
        detail: s.text || s.detail || '',
        confidence: s.confidence || 0.7,
        icon: 'zap' as const,
        action: s.action
          ? { label: s.action.label || 'Apply', payload: s.action.payload || {} }
          : undefined,
      }));
    } catch {
      return [];
    }
  }, [columns, ideaId, isPl, nodes]);

  useEffect(() => {
    if (!visible || nodes.length === 0) return;
    const local = generateLocalSuggestions();
    setSuggestions(local.filter((s) => !dismissed.has(s.id)));
    setCurrentIdx(0);

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const aiSuggestions = await fetchAISuggestions();
      if (!cancelled && aiSuggestions.length > 0) {
        setSuggestions((prev) => [...prev, ...aiSuggestions.filter((s) => !dismissed.has(s.id))]);
      }
      if (!cancelled) setLoading(false);
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dismissed, fetchAISuggestions, generateLocalSuggestions, nodes, visible]);

  const activeSuggestions = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.id)),
    [dismissed, suggestions]
  );

  const handleDismissSuggestion = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set([...prev, id]));
      if (currentIdx >= activeSuggestions.length - 1) setCurrentIdx(Math.max(0, currentIdx - 1));
    },
    [activeSuggestions.length, currentIdx]
  );

  if (!visible || activeSuggestions.length === 0) return null;

  const current = activeSuggestions[currentIdx % activeSuggestions.length];
  if (!current) return null;
  const IconComp = ICON_MAP[current.icon || 'lightbulb'] || Lightbulb;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-c-accent-soft border-t border-c-border-subtle">
      {/* Sparkle icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-c-accent-soft flex-shrink-0">
        {loading ? (
          <Loader2 size={13} className="text-c-accent animate-spin" />
        ) : (
          <Sparkles size={13} className="text-c-accent" />
        )}
      </div>

      {/* Suggestion content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <IconComp size={10} className="text-c-accent" />
          <span className="text-[10px] font-bold text-c-text">
            {current.title}
          </span>
          <span
            className="text-[8px] font-bold uppercase tracking-wider px-1 py-0 rounded"
            style={{
              backgroundColor:
                current.confidence > 0.8
                  ? 'color-mix(in srgb, var(--c-success) 15%, transparent)'
                  : current.confidence > 0.6
                    ? 'color-mix(in srgb, var(--c-warning) 15%, transparent)'
                    : 'color-mix(in srgb, var(--c-info) 15%, transparent)',
              color:
                current.confidence > 0.8
                  ? 'var(--c-success)'
                  : current.confidence > 0.6
                    ? 'var(--c-warning)'
                    : 'var(--c-info)',
            }}
          >
            {Math.round(current.confidence * 100)}%
          </span>
        </div>
        <p className="text-[10px] text-c-text-muted leading-relaxed truncate">
          {current.detail}
        </p>
      </div>

      {/* Action button */}
      {current.action && onApplySuggestion && (
        <button
          onClick={() => onApplySuggestion(current)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold text-c-accent bg-c-accent-soft hover:bg-c-accent-soft transition-colors whitespace-nowrap flex-shrink-0"
        >
          {current.action.label}
          <ArrowRight size={9} />
        </button>
      )}

      {/* Navigation */}
      {activeSuggestions.length > 1 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() =>
              setCurrentIdx((currentIdx - 1 + activeSuggestions.length) % activeSuggestions.length)
            }
            className="p-1 rounded hover:bg-c-surface-raised transition-colors"
          >
            <ChevronLeft size={12} className="text-c-text-secondary" />
          </button>
          <span className="text-[8px] text-c-text-secondary w-8 text-center">
            {currentIdx + 1}/{activeSuggestions.length}
          </span>
          <button
            onClick={() => setCurrentIdx((currentIdx + 1) % activeSuggestions.length)}
            className="p-1 rounded hover:bg-c-surface-raised transition-colors"
          >
            <ChevronRight size={12} className="text-c-text-secondary" />
          </button>
        </div>
      )}

      {/* Dismiss current */}
      <button
        onClick={() => handleDismissSuggestion(current.id)}
        className="p-1 rounded hover:bg-c-surface-raised transition-colors flex-shrink-0"
      >
        <X size={11} className="text-c-text-secondary" />
      </button>

      {/* Dismiss all */}
      <button
        onClick={onDismiss}
        className="p-1 rounded hover:bg-c-surface-raised transition-colors flex-shrink-0"
        title={isPl ? 'Zamknij pasek' : 'Close bar'}
      >
        <CheckCircle2 size={11} className="text-c-text-secondary" />
      </button>
    </div>
  );
};

export default SmartSuggestionsBar;
