/**
 * ExportToPresentation — One-click export of table/matrix/kanban data
 * into a presentation slide deck via the Presentations module.
 *
 * Generates structured JSON that the DeckBuilder can consume,
 * or directly creates a new presentation with pre-filled slides.
 */
import {
  FileImage,
  Layers,
  Layout,
  Loader2,
  Presentation,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { ColumnDef, TableNode } from './tableTypes';

interface ExportToPresentationProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  columns: ColumnDef[];
  ideaTitle: string;
  viewLayout: 'table' | 'kanban' | 'matrix' | 'sticky' | 'timeline' | 'calendar' | 'grid';
  onExportComplete?: (deckId: string) => void;
}

type SlideType = 'title' | 'table' | 'kanban' | 'matrix' | 'summary' | 'ranking';

interface SlideConfig {
  type: SlideType;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export const ExportToPresentation: React.FC<ExportToPresentationProps> = ({
  open,
  onClose,
  nodes,
  columns,
  ideaTitle,
  viewLayout,
  onExportComplete,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [slides, setSlides] = useState<SlideConfig[]>([
    {
      type: 'title',
      label: t('myWorkTable.exportToPresentation.titleSlide'),
      icon: <Layout size={14} />,
      enabled: true,
    },
    {
      type: 'table',
      label: t('myWorkTable.exportToPresentation.ideasTable'),
      icon: <Table2 size={14} />,
      enabled: true,
    },
    {
      type: 'kanban',
      label: t('myWorkTable.exportToPresentation.kanbanView'),
      icon: <Layers size={14} />,
      enabled: viewLayout === 'kanban',
    },
    {
      type: 'matrix',
      label: t('myWorkTable.exportToPresentation.n22Matrix'),
      icon: <FileImage size={14} />,
      enabled: viewLayout === 'matrix',
    },
    {
      type: 'summary',
      label: t('myWorkTable.exportToPresentation.aiSummary'),
      icon: <Sparkles size={14} />,
      enabled: true,
    },
    {
      type: 'ranking',
      label: t('myWorkTable.exportToPresentation.ideaRanking'),
      icon: <Presentation size={14} />,
      enabled: nodes.some((n) => n.data?.score != null),
    },
  ]);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef });

  const toggleSlide = useCallback((type: SlideType) => {
    setSlides((prev) => prev.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s)));
  }, []);

  const buildDeckJson = useCallback(() => {
    const enabledSlides = slides.filter((s) => s.enabled);
    const visibleCols = columns.filter((c) => c.visible);
    const slideBlocks: any[] = [];

    for (const slide of enabledSlides) {
      switch (slide.type) {
        case 'title':
          slideBlocks.push({
            id: `slide-title-${Date.now()}`,
            layout: 'title',
            blocks: [
              {
                type: 'heading',
                content: ideaTitle || t('myWorkTable.exportToPresentation.ideas'),
              },
              {
                type: 'text',
                content: `${nodes.length} ${t('myWorkTable.exportToPresentation.ideas2')} • ${new Date().toLocaleDateString(isPl ? 'pl' : 'en')}`,
              },
            ],
          });
          break;

        case 'table':
          slideBlocks.push({
            id: `slide-table-${Date.now()}`,
            layout: 'content',
            blocks: [
              { type: 'heading', content: t('myWorkTable.exportToPresentation.ideasOverview') },
              {
                type: 'table',
                headers: visibleCols.slice(0, 5).map((c) => c.header),
                rows: nodes
                  .slice(0, 10)
                  .map((n) => visibleCols.slice(0, 5).map((c) => String(n.data?.[c.key] ?? ''))),
              },
            ],
          });
          break;

        case 'kanban': {
          const groupCol = columns.find((c) => c.type === 'select' && c.visible);
          if (groupCol) {
            const groups = new Map<string, TableNode[]>();
            for (const n of nodes) {
              const val = String(
                n.data?.[groupCol.key] || t('myWorkTable.exportToPresentation.other')
              );
              if (!groups.has(val)) groups.set(val, []);
              groups.get(val)!.push(n);
            }
            slideBlocks.push({
              id: `slide-kanban-${Date.now()}`,
              layout: 'content',
              blocks: [
                { type: 'heading', content: `Kanban: ${groupCol.header}` },
                ...Array.from(groups.entries())
                  .slice(0, 4)
                  .map(([group, items]) => ({
                    type: 'list',
                    title: group,
                    items: items.slice(0, 5).map((n) => n.data?.label || n.id),
                  })),
              ],
            });
          }
          break;
        }

        case 'matrix':
          slideBlocks.push({
            id: `slide-matrix-${Date.now()}`,
            layout: 'content',
            blocks: [
              { type: 'heading', content: t('myWorkTable.exportToPresentation.priorityMatrix') },
              {
                type: 'text',
                content: nodes
                  .slice(0, 8)
                  .map((n) => `• ${n.data?.label || n.id}`)
                  .join('\n'),
              },
            ],
          });
          break;

        case 'summary':
          slideBlocks.push({
            id: `slide-summary-${Date.now()}`,
            layout: 'content',
            blocks: [
              { type: 'heading', content: t('myWorkTable.exportToPresentation.summary') },
              {
                type: 'stats',
                items: [
                  {
                    label: t('myWorkTable.exportToPresentation.ideas3'),
                    value: String(nodes.length),
                  },
                  {
                    label: t('myWorkTable.exportToPresentation.categories'),
                    value: String(
                      new Set(nodes.map((n) => n.data?.category || n.data?.status || '')).size
                    ),
                  },
                ],
              },
            ],
          });
          break;

        case 'ranking': {
          const ranked = [...nodes]
            .filter((n) => n.data?.score != null)
            .sort((a, b) => (b.data?.score || 0) - (a.data?.score || 0));
          slideBlocks.push({
            id: `slide-ranking-${Date.now()}`,
            layout: 'content',
            blocks: [
              { type: 'heading', content: t('myWorkTable.exportToPresentation.topIdeas') },
              {
                type: 'list',
                items: ranked
                  .slice(0, 5)
                  .map((n, i) => `#${i + 1} ${n.data?.label || n.id} — Score: ${n.data?.score}`),
              },
            ],
          });
          break;
        }
      }
    }

    return {
      title: ideaTitle || t('myWorkTable.exportToPresentation.ideas'),
      theme: 'modern',
      slides: slideBlocks,
    };
  }, [columns, ideaTitle, isPl, nodes, slides]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const deckJson = buildDeckJson();
      const { Api } = await import('@/services/api');
      const result = await Api.createPresentationDeck({
        title: deckJson.title,
        theme: deckJson.theme,
        slides: deckJson.slides,
        source: 'idea_table',
      });
      const deckId = (result as any)?.id || (result as any)?.data?.id;
      if (deckId) {
        onExportComplete?.(deckId);
        setExportDone(true);
      } else {
        throw new Error(t('myWorkTable.exportToPresentation.createdDeckIdMissing'));
      }
    } catch (error) {
      console.error('[ExportToPresentation] export failed', error);
      setExportDone(false);
    } finally {
      setExporting(false);
    }
  }, [buildDeckJson, onExportComplete]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-to-presentation-title"
        tabIndex={-1}
        className="w-[440px] max-w-[90vw] rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-200/60 dark:border-navy-700/60">
          <Presentation size={16} className="text-c-info" />
          <span id="export-to-presentation-title" className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t('myWorkTable.exportToPresentation.exportToPresentation')}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={14} className="text-slate-600" />
          </button>
        </div>

        {/* Slide selection */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            {t('myWorkTable.exportToPresentation.selectSlides')}
          </p>
          <div className="space-y-2">
            {slides.map((slide) => (
              <label
                key={slide.type}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={slide.enabled}
                  onChange={() => toggleSlide(slide.type)}
                  className="w-4 h-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                />
                <span className="text-slate-500">{slide.icon}</span>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {slide.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview info */}
        <div className="px-5 py-3 border-t border-slate-200/30 dark:border-white/[0.04] bg-slate-50/50 dark:bg-navy-900/30">
          <div className="flex items-center gap-2">
            <FileImage size={12} className="text-slate-600" />
            <span className="text-[10px] text-slate-500">
              {slides.filter((s) => s.enabled).length}{' '}
              {t('myWorkTable.exportToPresentation.slides')} • {nodes.length}{' '}
              {t('myWorkTable.exportToPresentation.ideas2')}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('myWorkTable.exportToPresentation.cancel')}
          </button>
          <div className="flex-1" />
          {exportDone ? (
            <span className="text-xs font-bold text-emerald-500">
              {t('myWorkTable.exportToPresentation.exported')}
            </span>
          ) : (
            <button
              onClick={handleExport}
              disabled={exporting || slides.filter((s) => s.enabled).length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Presentation size={12} />
              )}
              {t('myWorkTable.exportToPresentation.export')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportToPresentation;
