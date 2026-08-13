/**
 * TemplateGallery — Browse and use pre-built table templates.
 *
 * Grid of template cards with category filter, search, and "Use Template" action.
 * Calls the Table Platform Templates API.
 */
import {
  BarChart3,
  Briefcase,
  Calendar,
  Code2,
  FileText,
  LayoutTemplate,
  Loader2,
  Rocket,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { listTemplates, useTemplate as applyTableTemplate } from '@/services/api/tablePlatform.api';

interface TemplateGalleryProps {
  workspaceId: string;
  onClose: () => void;
  onTemplateUsed?: (base: any) => void;
}

const CATEGORIES = [
  { id: 'all', labelEn: 'All', labelPl: 'Wszystkie' },
  { id: 'sales', labelEn: 'Sales', labelPl: 'Sprzedaż' },
  { id: 'project-management', labelEn: 'Projects', labelPl: 'Projekty' },
  { id: 'hr', labelEn: 'HR', labelPl: 'HR' },
  { id: 'product', labelEn: 'Product', labelPl: 'Produkt' },
  { id: 'marketing', labelEn: 'Marketing', labelPl: 'Marketing' },
  { id: 'engineering', labelEn: 'Engineering', labelPl: 'Inżynieria' },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sales: BarChart3,
  'project-management': Rocket,
  hr: Users,
  product: Briefcase,
  marketing: Calendar,
  engineering: Code2,
};

export function TemplateGallery({ workspaceId, onClose, onTemplateUsed }: TemplateGalleryProps) {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listTemplates(activeCategory !== 'all' ? activeCategory : undefined);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(
        t('ideas.table.recordTemplates.failedToLoadTemplates', 'Failed to load templates')
      );
    } finally {
      setLoading(false);
    }
  }, [activeCategory, t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const handleUseTemplate = useCallback(
    async (templateId: string, templateName: string) => {
      try {
        setUsingId(templateId);
        const base = await applyTableTemplate(templateId, workspaceId, templateName);
        toast.success(
          t('ideas.table.templateGallery.templateApplied', 'Template "{{name}}" applied!', {
            name: templateName,
          })
        );
        onTemplateUsed?.(base);
        onClose();
      } catch (err) {
        toast.error(
          t('ideas.table.templateGallery.failedToApplyTemplate', 'Failed to apply template')
        );
      } finally {
        setUsingId(null);
      }
    },
    [workspaceId, t, onTemplateUsed, onClose]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-heading"
        tabIndex={-1}
        className="bg-c-surface rounded-2xl shadow-2xl border border-slate-200/60 dark:border-white/[0.03] w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={18} className="text-c-text-secondary" />
            <h2 id="template-gallery-heading" className="text-base font-semibold text-c-text">
              {t('ideas.table.templateGallery.templateGalleryTitle', 'Template Gallery')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + Category tabs */}
        <div className="px-6 py-3 border-b border-c-border-subtle space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'ideas.table.templateGallery.searchTemplatesPlaceholder',
                'Search templates…'
              )}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-c-surface-raised text-c-text ring-1 ring-c-focus'
                    : 'text-c-text-muted hover:bg-c-surface-raised'
                }`}
              >
                {isPl ? cat.labelPl : cat.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState
              variant="progress"
              label={t('ideas.table.templateGallery.loadingTemplates', 'Loading templates…')}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="filter"
              icon={FileText}
              compact
              title={t('ideas.table.templateGallery.noTemplatesFound', 'No templates found')}
              description={t(
                'ideas.table.templateGallery.adjustFilterOrSearch',
                'Adjust the filter or search to see available templates.'
              )}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((tpl) => {
                const CatIcon = CATEGORY_ICONS[tpl.category] || LayoutTemplate;
                return (
                  <div
                    key={tpl.id}
                    className="group relative rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 hover:border-c-border hover:shadow-md transition-all"
                  >
                    {tpl.is_featured && (
                      <div className="absolute top-3 right-3">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-c-surface-raised flex items-center justify-center flex-shrink-0">
                        <CatIcon size={18} className="text-c-text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-c-text truncate">{tpl.name}</h3>
                        <span className="text-[10px] font-medium text-c-text-secondary uppercase tracking-wide">
                          {tpl.category?.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-c-text-muted mb-3 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-c-text-secondary">
                        {tpl.usage_count > 0
                          ? t('ideas.table.templateGallery.usesCount', '{{count}} uses', {
                              count: tpl.usage_count,
                            })
                          : t('ideas.table.templateGallery.newBadge', 'New')}
                      </span>
                      <button
                        onClick={() => handleUseTemplate(tpl.id, tpl.name)}
                        disabled={usingId === tpl.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-surface hover:opacity-90 disabled:opacity-50 transition-colors"
                      >
                        {usingId === tpl.id ? <Loader2 size={12} className="animate-spin" /> : null}
                        {t('ideas.table.templateGallery.use', 'Use')}
                      </button>
                    </div>
                    {tpl.schema_snapshot?.tables && (
                      <div className="mt-3 pt-3 border-t border-c-border-subtle">
                        <div className="flex flex-wrap gap-1">
                          {(tpl.schema_snapshot.tables as any[]).map((table: any, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md text-[10px] bg-c-surface-raised text-c-text-muted"
                            >
                              {table.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
