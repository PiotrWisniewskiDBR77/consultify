/**
 * LinkedRecordDisplay — Enhanced inline cell display for linked records.
 *
 * Features:
 * - Colored chips with primary field value
 * - Hover preview card with key fields
 * - Click to expand (opens RecordExpandModal)
 * - Count badge for overflow (+N more)
 * - Empty state with link icon
 */
import { ExternalLink, Link2, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedRecordData {
  id: string;
  displayValue: string;
  previewFields?: Record<string, string>;
}

interface LinkedRecordDisplayProps {
  recordId: string;
  fieldId: string;
  linkedTableId: string;
  maxDisplay?: number;
  onOpenRecord?: (recordId: string, tableId: string) => void;
  onOpenPicker?: () => void;
  locked?: boolean;
}

// ── Chip colors (cycle through for visual variety) ────────────────────────────

const CHIP_COLORS = [
  {
    bg: 'bg-blue-50 dark:bg-blue-900/25',
    text: 'text-blue-700 dark:text-blue-300',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/40',
  },
  {
    bg: 'bg-c-accent-soft',
    text: 'text-c-accent',
    hover: 'hover:bg-c-accent-soft',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-900/25',
    text: 'text-emerald-700 dark:text-emerald-300',
    hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-900/25',
    text: 'text-amber-700 dark:text-amber-300',
    hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/40',
  },
  {
    bg: 'bg-danger-50 dark:bg-danger-900/25',
    text: 'text-danger-700 dark:text-danger-300',
    hover: 'hover:bg-danger-100 dark:hover:bg-danger-900/40',
  },
];

// ── HoverPreviewCard ──────────────────────────────────────────────────────────

const HoverPreviewCard: React.FC<{
  recordId: string;
  linkedTableId: string;
  fieldsMeta: Array<{ id: string; name: string }>;
}> = React.memo(({ recordId, linkedTableId, fieldsMeta }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rec = await TablePlatformApi.getRecord(recordId);
        if (!cancelled) {
          setData(((rec as Record<string, unknown>)?.data as Record<string, unknown>) ?? rec);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3">
        <Loader2 className="h-4 w-4 animate-spin text-c-text-secondary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-1.5 p-3">
      {fieldsMeta.slice(0, 5).map((fm) => {
        const val = data[fm.id];
        if (val == null || val === '') return null;
        return (
          <div key={fm.id} className="flex items-start gap-2">
            <span className="w-20 flex-shrink-0 truncate text-[10px] font-medium text-c-text-secondary">
              {fm.name}
            </span>
            <span className="text-[10px] text-c-text-secondary truncate">
              {Array.isArray(val) ? val.join(', ') : String(val)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

HoverPreviewCard.displayName = 'HoverPreviewCard';

// ── Main Component ────────────────────────────────────────────────────────────

export const LinkedRecordDisplay: React.FC<LinkedRecordDisplayProps> = React.memo(
  ({
    recordId,
    fieldId,
    linkedTableId,
    maxDisplay = 3,
    onOpenRecord,
    onOpenPicker,
    locked = false,
  }) => {
    const { i18n } = useTranslation();
    const isPl = i18n.language?.startsWith('pl');

    const [links, setLinks] = useState<LinkedRecordData[]>([]);
    const [loading, setLoading] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [fieldsMeta, setFieldsMeta] = useState<Array<{ id: string; name: string }>>([]);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
      if (!recordId || !fieldId) return;
      let cancelled = false;
      setLoading(true);

      (async () => {
        try {
          const [res, tableData] = await Promise.all([
            TablePlatformApi.getLinkedRecords(recordId, fieldId),
            TablePlatformApi.getTable(linkedTableId),
          ]);

          if (cancelled) return;

          const records = ((res as Record<string, unknown>)?.records ?? []) as Array<
            Record<string, unknown>
          >;
          const fields = ((tableData as Record<string, unknown>)?.fields ?? []) as Array<
            Record<string, unknown>
          >;

          const sortedFields = [...fields].sort(
            (a, b) =>
              Number(a.field_order ?? a.order ?? 999) - Number(b.field_order ?? b.order ?? 999)
          );
          const primaryField = sortedFields[0];
          const pfId = primaryField ? String(primaryField.id ?? '') : '';

          const meta = sortedFields.map((f) => ({
            id: String(f.id ?? ''),
            name: String(f.name ?? ''),
          }));
          setFieldsMeta(meta);

          const mapped: LinkedRecordData[] = records.map((r) => {
            const data = (r.data as Record<string, unknown>) ?? {};
            const preview: Record<string, string> = {};
            sortedFields.slice(1, 4).forEach((f) => {
              const fId = String(f.id ?? '');
              if (data[fId] != null) {
                preview[String(f.name ?? '')] = String(data[fId]);
              }
            });
            return {
              id: String(r.id ?? ''),
              displayValue: String(data[pfId] ?? r.id ?? ''),
              previewFields: preview,
            };
          });

          if (!cancelled) setLinks(mapped);
        } catch {
          if (!cancelled) setLinks([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [recordId, fieldId, linkedTableId]);

    const handleHoverEnter = useCallback((id: string) => {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => setHoveredId(id), 400);
    }, []);

    const handleHoverLeave = useCallback(() => {
      clearTimeout(hoverTimerRef.current);
      setHoveredId(null);
    }, []);

    if (loading) {
      return <span className="text-xs text-c-text-secondary">...</span>;
    }

    if (links.length === 0) {
      return (
        <button
          onClick={onOpenPicker}
          disabled={locked}
          className="flex items-center gap-1.5 text-xs text-c-text-secondary transition-colors hover:text-blue-500 disabled:cursor-default disabled:hover:text-c-text-muted"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>{isPl ? 'Brak powiązań' : 'No linked records'}</span>
        </button>
      );
    }

    const visible = links.slice(0, maxDisplay);
    const overflow = links.length - maxDisplay;

    return (
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((link, idx) => {
          const colorSet = CHIP_COLORS[idx % CHIP_COLORS.length];
          return (
            <div
              key={link.id}
              className="relative"
              onMouseEnter={() => handleHoverEnter(link.id)}
              onMouseLeave={handleHoverLeave}
            >
              <button
                onClick={() => onOpenRecord?.(link.id, linkedTableId)}
                className={`inline-flex max-w-[140px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${colorSet.bg} ${colorSet.text} ${colorSet.hover}`}
              >
                <span className="truncate">{link.displayValue}</span>
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-40" />
              </button>
              {/* Hover preview */}
              {hoveredId === link.id && (
                <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-c-border-subtle bg-c-surface shadow-xl">
                  <HoverPreviewCard
                    recordId={link.id}
                    linkedTableId={linkedTableId}
                    fieldsMeta={fieldsMeta}
                  />
                </div>
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <button
            onClick={onOpenPicker}
            className="rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] font-bold text-c-text-muted transition-colors hover:bg-c-border-subtle hover:text-blue-600"
          >
            +{overflow} {isPl ? 'więcej' : 'more'}
          </button>
        )}
        {!locked && (
          <button
            onClick={onOpenPicker}
            className="rounded-full p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-blue-500"
          >
            <Link2 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
);

LinkedRecordDisplay.displayName = 'LinkedRecordDisplay';
