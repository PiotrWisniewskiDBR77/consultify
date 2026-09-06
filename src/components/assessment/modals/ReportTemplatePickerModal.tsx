import { ChevronDown, FileText, Grid3X3, List, Loader2, Plus, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReportEditor } from '@/components/ReportBuilder/ReportEditor';
import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

type ReportTemplate = {
  id: string;
  name: string;
  description?: string | null;
  reportType?: string | null;
  isSystem?: boolean;
  isDefault?: boolean;
};

type ViewMode = 'grid' | 'table';
type SourceFilter = 'all' | 'application' | 'organization';
type RecipientFilter = 'all' | 'board' | 'bank' | 'team';
type FrameworkFilter = 'all' | 'drd' | 'siri' | 'adma';

// Helper to detect recipient from template name/description
function detectRecipient(tpl: ReportTemplate): RecipientFilter {
  const text = `${tpl.name} ${tpl.description || ''}`.toLowerCase();
  if (text.includes('zarząd') || text.includes('board') || text.includes('executive'))
    return 'board';
  if (text.includes('bank') || text.includes('financial') || text.includes('instytucj'))
    return 'bank';
  return 'team';
}

// Helper to detect framework from reportType or name
function detectFramework(tpl: ReportTemplate): FrameworkFilter {
  const type = (tpl.reportType || '').toUpperCase();
  const name = tpl.name.toUpperCase();
  if (type.includes('DRD') || name.includes('DRD')) return 'drd';
  if (type.includes('SIRI') || name.includes('SIRI')) return 'siri';
  if (type.includes('ADMA') || name.includes('ADMA')) return 'adma';
  return 'drd'; // default
}

export function ReportTemplatePickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: ReportTemplate) => void | Promise<void>;
  onNewTemplate?: () => void | Promise<void>;
  sourceType?: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' | 'UPLOAD_BUNDLE';
  framework?: string | null; // e.g. DRD / SIRI / ADMA (case-insensitive)
  lockFramework?: boolean;
}) {
  const {
    isOpen,
    onClose,
    onSelect,
    onNewTemplate,
    sourceType = 'ASSESSMENT',
    framework,
    lockFramework = false,
  } = props;

  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isNewTemplateMetaOpen, setIsNewTemplateMetaOpen] = useState(false);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateRecipient, setNewTemplateRecipient] = useState<'' | 'board' | 'bank' | 'team'>(
    ''
  );
  const [newTemplateSourceType, setNewTemplateSourceType] = useState<
    'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' | 'UPLOAD_BUNDLE'
  >('ASSESSMENT');
  const [newTemplateFramework, setNewTemplateFramework] = useState<
    'DRD' | 'SIRI' | 'ADMA' | 'NONE'
  >('DRD');

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [frameworkFilter, setFrameworkFilter] = useState<FrameworkFilter>('all');

  // If called from a specific framework context (e.g. DRD assessment), default the framework filter
  // so users can't accidentally pick incompatible templates (ADMA template for DRD assessment etc).
  useEffect(() => {
    if (!isOpen) return;
    const fw = String(framework || '')
      .trim()
      .toLowerCase();
    if (fw.includes('adma')) setFrameworkFilter('adma');
    else if (fw.includes('siri')) setFrameworkFilter('siri');
    else if (fw.includes('drd')) setFrameworkFilter('drd');
    // else keep user-selected / default 'all'
  }, [framework, isOpen]);
  const closeTemplateBuilder = () => {
    setIsTemplateBuilderOpen(false);
    // refresh templates list after leaving template builder
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setSubmitting(false);

    Api.get(`/report-builder/templates?sourceType=${encodeURIComponent(sourceType)}`)
      .then((json: any) => {
        if (cancelled) return;
        setTemplates(Array.isArray(json?.templates) ? json.templates : []);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || t('assessment.templatePicker.loadError', 'Failed to load templates'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadKey, sourceType]);

  const filtered = useMemo(() => {
    let result = templates;

    // Source filter
    if (sourceFilter === 'application') {
      result = result.filter((tp) => tp.isSystem);
    } else if (sourceFilter === 'organization') {
      result = result.filter((tp) => !tp.isSystem);
    }

    // Recipient filter
    if (recipientFilter !== 'all') {
      result = result.filter((tp) => detectRecipient(tp) === recipientFilter);
    }

    // Framework filter
    if (frameworkFilter !== 'all') {
      result = result.filter((tp) => detectFramework(tp) === frameworkFilter);
    }

    return result;
  }, [templates, sourceFilter, recipientFilter, frameworkFilter]);

  // Check if any filters are active (for showing reset option)
  const hasActiveFilters = recipientFilter !== 'all' || frameworkFilter !== 'all';

  const clearFilters = () => {
    setRecipientFilter('all');
    if (!lockFramework) setFrameworkFilter('all');
  };

  const recipientLabel = (r: RecipientFilter): string => {
    switch (r) {
      case 'board':
        return t('assessment.templatePicker.filters.recipientBoard', 'Board');
      case 'bank':
        return t('assessment.templatePicker.filters.recipientBank', 'Bank');
      case 'team':
        return t('assessment.templatePicker.filters.recipientTeam', 'Team');
      default:
        return r;
    }
  };

  const selectedTemplate = selectedId ? templates.find((tp) => tp.id === selectedId) : null;

  const handleSelect = async (tpl: ReportTemplate) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSelect(tpl);
      onClose();
    } catch (e: any) {
      setError(e?.message || t('assessment.templatePicker.startError', 'Failed to start report'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
        aria-label={t('assessment.templatePicker.close', 'Close')}
      />

      <div
        className={cn(
          'relative w-full max-w-3xl h-[600px] overflow-hidden rounded-2xl',
          'bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700',
          'shadow-2xl flex flex-col'
        )}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-c-surface-raised text-c-text-secondary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('assessment.templatePicker.title', 'Select Report Template')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('assessment.templatePicker.availableTemplates', '{{count}} available templates', {
                  count: filtered.length,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-navy-800 flex flex-wrap items-center justify-between gap-3">
          {/* Source filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-navy-800">
            {[
              { id: 'all' as const, label: t('assessment.templatePicker.tabs.all', 'All') },
              {
                id: 'application' as const,
                label: t('assessment.templatePicker.tabs.application', 'Application'),
              },
              {
                id: 'organization' as const,
                label: t('assessment.templatePicker.tabs.organization', 'Organization'),
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  sourceFilter === tab.id
                    ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subtle filters + View toggle */}
          <div className="flex items-center gap-3">
            {/* Recipient filter */}
            <div className="relative">
              <select
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value as RecipientFilter)}
                className={cn(
                  'appearance-none text-xs pl-2 pr-6 py-1 rounded-md border cursor-pointer transition-colors',
                  'bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus',
                  recipientFilter !== 'all'
                    ? 'border-c-focus text-c-focus-solid'
                    : 'border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400'
                )}
              >
                <option value="all">{t('assessment.templatePicker.filters.recipient', 'Recipient')}</option>
                <option value="board">
                  {t('assessment.templatePicker.filters.recipientBoard', 'Board')}
                </option>
                <option value="bank">
                  {t('assessment.templatePicker.filters.recipientBank', 'Bank')}
                </option>
                <option value="team">
                  {t('assessment.templatePicker.filters.recipientTeam', 'Team')}
                </option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 dark:text-slate-400 pointer-events-none" />
            </div>

            {/* Framework filter */}
            <div className="relative">
              <select
                value={frameworkFilter}
                onChange={(e) => setFrameworkFilter(e.target.value as FrameworkFilter)}
                disabled={Boolean(lockFramework && framework)}
                className={cn(
                  'appearance-none text-xs pl-2 pr-6 py-1 rounded-md border cursor-pointer transition-colors',
                  'bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus',
                  frameworkFilter !== 'all'
                    ? 'border-c-focus text-c-focus-solid'
                    : 'border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400'
                )}
              >
                <option value="all">{t('assessment.templatePicker.filters.framework', 'Framework')}</option>
                <option value="drd">DRD</option>
                <option value="siri">SIRI</option>
                <option value="adma">ADMA</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 dark:text-slate-400 pointer-events-none" />
            </div>

            {/* Clear filters (only when active) */}
            {hasActiveFilters && !(lockFramework && framework) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {t('assessment.templatePicker.filters.clear', 'Clear')}
              </button>
            )}

            {/* Separator */}
            <div className="w-px h-4 bg-slate-200 dark:bg-navy-700" />

            {/* View toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-navy-800">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1 rounded transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-navy-700 text-c-focus-solid shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                )}
                title={t('assessment.templatePicker.gridView', 'Grid view')}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-1 rounded transition-colors',
                  viewMode === 'table'
                    ? 'bg-white dark:bg-navy-700 text-c-focus-solid shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                )}
                title={t('assessment.templatePicker.tableView', 'Table view')}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New Template button */}
            <button
              type="button"
              onClick={async () => {
                if (submitting) return;
                try {
                  if (onNewTemplate) {
                    await onNewTemplate();
                    // best-effort refresh (covers cases where caller creates template)
                    setReloadKey((k) => k + 1);
                    return;
                  }
                  // Default to assessment template when invoked from assessment flow
                  setNewTemplateName('');
                  setNewTemplateDescription('');
                  setNewTemplateRecipient('');
                  setNewTemplateSourceType('ASSESSMENT');
                  setNewTemplateFramework('DRD');
                  setIsNewTemplateMetaOpen(true);
                } catch (e: any) {
                  setError(
                    e?.message ||
                      t('assessment.templatePicker.newTemplateError', 'Failed to open template generator')
                  );
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 disabled:cursor-not-allowed text-white dark:text-navy-950 text-xs font-medium transition-colors"
              title={t('assessment.templatePicker.newTemplateTitle', 'Create new template')}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('assessment.templatePicker.newTemplate', 'New Template')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto p-5">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('assessment.templatePicker.loading', 'Loading templates…')}</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 text-sm">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              {t('assessment.templatePicker.empty', 'No templates in this category.')}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const isSelected = tpl.id === selectedId;
                const framework = detectFramework(tpl);
                const recipient = detectRecipient(tpl);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => setSelectedId(tpl.id)}
                    onDoubleClick={() => handleSelect(tpl)}
                    className={cn(
                      'text-left p-3.5 rounded-xl border transition-all',
                      'hover:shadow-md',
                      isSelected
                        ? 'border-c-focus bg-c-surface-raised'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-c-focus/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm text-slate-900 dark:text-white line-clamp-1">
                        {tpl.name}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {tpl.isSystem ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                            {t('assessment.templatePicker.chipApp', 'app')}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                            {t('assessment.templatePicker.chipOrg', 'org')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {tpl.description || t('assessment.templatePicker.noDescription', 'No description')}
                    </div>
                    {/* Subtle metadata row */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-800 flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[9px] px-1 py-0.5 rounded font-medium',
                          framework === 'drd' &&
                            'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400',
                          framework === 'siri' &&
                            'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400',
                          framework === 'adma' &&
                            'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400'
                        )}
                      >
                        {framework.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">
                        {recipientLabel(recipient)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <table
                /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm"
              >
                <thead>
                  <tr className="bg-slate-50 dark:bg-navy-800 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                      <span className="text-xs">{t('assessment.templatePicker.columns.name', 'Name')}</span>
                    </th>
                    <th className="px-4 py-2 font-medium hidden sm:table-cell">
                      <div className="relative inline-flex items-center gap-1">
                        <select
                          value={frameworkFilter}
                          onChange={(e) => setFrameworkFilter(e.target.value as FrameworkFilter)}
                          className={cn(
                            'appearance-none text-xs pl-1 pr-4 py-0.5 rounded cursor-pointer transition-colors',
                            'bg-transparent border-0 focus:outline-none focus:ring-0',
                            frameworkFilter !== 'all'
                              ? 'text-c-focus-solid font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          )}
                        >
                          <option value="all">
                            {t('assessment.templatePicker.filters.framework', 'Framework')}
                          </option>
                          <option value="drd">DRD</option>
                          <option value="siri">SIRI</option>
                          <option value="adma">ADMA</option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 dark:text-slate-400 pointer-events-none" />
                      </div>
                    </th>
                    <th className="px-4 py-2 font-medium hidden md:table-cell">
                      <div className="relative inline-flex items-center gap-1">
                        <select
                          value={recipientFilter}
                          onChange={(e) => setRecipientFilter(e.target.value as RecipientFilter)}
                          className={cn(
                            'appearance-none text-xs pl-1 pr-4 py-0.5 rounded cursor-pointer transition-colors',
                            'bg-transparent border-0 focus:outline-none focus:ring-0',
                            recipientFilter !== 'all'
                              ? 'text-c-focus-solid font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          )}
                        >
                          <option value="all">
                            {t('assessment.templatePicker.filters.recipient', 'Recipient')}
                          </option>
                          <option value="board">
                            {t('assessment.templatePicker.filters.recipientBoard', 'Board')}
                          </option>
                          <option value="bank">
                            {t('assessment.templatePicker.filters.recipientBank', 'Bank')}
                          </option>
                          <option value="team">
                            {t('assessment.templatePicker.filters.recipientTeam', 'Team')}
                          </option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 dark:text-slate-400 pointer-events-none" />
                      </div>
                    </th>
                    <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 w-20">
                      <span className="text-xs">{t('assessment.templatePicker.columns.source', 'Source')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-navy-800">
                  {filtered.map((tpl) => {
                    const isSelected = tpl.id === selectedId;
                    const framework = detectFramework(tpl);
                    const recipient = detectRecipient(tpl);
                    return (
                      <tr
                        key={tpl.id}
                        onClick={() => setSelectedId(tpl.id)}
                        onDoubleClick={() => handleSelect(tpl)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-c-surface-raised'
                            : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-sm text-slate-900 dark:text-white">
                            {tpl.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {tpl.description || t('assessment.templatePicker.noDescription', 'No description')}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              framework === 'drd' &&
                                'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                              framework === 'siri' &&
                                'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                              framework === 'adma' &&
                                'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {framework.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {recipientLabel(recipient)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {tpl.isSystem ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                              {t('assessment.templatePicker.chipApp', 'app')}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                              {t('assessment.templatePicker.chipOrg', 'org')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {selectedTemplate ? (
              <>
                {t('assessment.templatePicker.selectedPrefix', 'Selected: ')}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {selectedTemplate.name}
                </span>
              </>
            ) : (
              t('assessment.templatePicker.footerHint', 'Double-click or select and click "Generate"')
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {t('assessment.templatePicker.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={!selectedTemplate || submitting}
              onClick={() => selectedTemplate && handleSelect(selectedTemplate)}
              className={
                !selectedTemplate || submitting
                  ? 'px-5 py-2.5 rounded-lg bg-slate-300 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-sm font-medium cursor-not-allowed inline-flex items-center gap-2'
                  : 'px-5 py-2.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2'
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('assessment.templatePicker.generating', 'Generating…')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('assessment.templatePicker.generateReport', 'Generate Report')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Small meta modal: name + module + description (adds context for generator) */}
      {isNewTemplateMetaOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsNewTemplateMetaOpen(false)}
            aria-label={t('assessment.templatePicker.metaModal.closeAria', 'Close new template meta')}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('assessment.templatePicker.metaModal.title', 'New template')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'assessment.templatePicker.metaModal.subtitle',
                    'Name + module + short description (gives generator context)'
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTemplateMetaOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
                aria-label={t('assessment.templatePicker.close', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {t('assessment.templatePicker.metaModal.fields.name', 'Template name*')}
                </label>
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  placeholder={t(
                    'assessment.templatePicker.metaModal.fields.namePlaceholder',
                    'e.g. DRD Exec Summary v2'
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                    {t('assessment.templatePicker.metaModal.fields.module', 'Module')}
                  </label>
                  <select
                    value={newTemplateSourceType}
                    onChange={(e) =>
                      setNewTemplateSourceType(
                        e.target.value as
                          | 'ASSESSMENT'
                          | 'INTERVIEW'
                          | 'TOOL'
                          | 'INITIATIVE'
                          | 'UPLOAD_BUNDLE'
                      )
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="ASSESSMENT">
                      {t('assessment.templatePicker.metaModal.moduleOptions.assessment', 'Assessment')}
                    </option>
                    <option value="INTERVIEW">
                      {t('assessment.templatePicker.metaModal.moduleOptions.interview', 'Interview')}
                    </option>
                    <option value="TOOL">
                      {t('assessment.templatePicker.metaModal.moduleOptions.tool', 'Tool')}
                    </option>
                    <option value="INITIATIVE">
                      {t('assessment.templatePicker.metaModal.moduleOptions.initiative', 'Initiative')}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                    {t('assessment.templatePicker.metaModal.fields.frameworkOptional', 'Framework (optional)')}
                  </label>
                  <select
                    value={newTemplateFramework}
                    onChange={(e) =>
                      setNewTemplateFramework(e.target.value as 'DRD' | 'SIRI' | 'ADMA' | 'NONE')
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                    disabled={newTemplateSourceType !== 'ASSESSMENT'}
                  >
                    <option value="DRD">DRD</option>
                    <option value="SIRI">SIRI</option>
                    <option value="ADMA">ADMA</option>
                    <option value="NONE">
                      {t('assessment.templatePicker.metaModal.fields.frameworkNone', 'None')}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {t('assessment.templatePicker.metaModal.fields.recipientOptional', 'Recipient (optional)')}
                </label>
                <select
                  value={newTemplateRecipient}
                  onChange={(e) =>
                    setNewTemplateRecipient(e.target.value as '' | 'board' | 'bank' | 'team')
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">
                    {t('assessment.templatePicker.metaModal.fields.recipientNotSet', 'Not set')}
                  </option>
                  <option value="board">
                    {t('assessment.templatePicker.metaModal.fields.recipientBoard', 'Board / Executive')}
                  </option>
                  <option value="bank">
                    {t('assessment.templatePicker.metaModal.fields.recipientBank', 'Bank / Financial')}
                  </option>
                  <option value="team">
                    {t('assessment.templatePicker.metaModal.fields.recipientTeam', 'Team')}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {t('assessment.templatePicker.metaModal.fields.descriptionOptional', 'Description (optional)')}
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm text-slate-900 dark:text-white"
                  placeholder={t(
                    'assessment.templatePicker.metaModal.fields.descriptionPlaceholder',
                    'For whom, what to include, style, etc.'
                  )}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewTemplateMetaOpen(false)}
                className="h-10 px-4 rounded-lg border border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                {t('assessment.templatePicker.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewTemplateMetaOpen(false);
                  setIsTemplateBuilderOpen(true);
                }}
                className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-sm font-semibold"
              >
                {t('assessment.templatePicker.metaModal.openGenerator', 'Open generator')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template builder overlay (uses the full report generator UI, but saves as template) */}
      {isTemplateBuilderOpen && (
        <div className="fixed inset-0 z-[70]">
          <ReportEditor
            mode="template"
            templateMeta={{
              name: newTemplateName,
              description: newTemplateDescription,
              sourceType: newTemplateSourceType,
              reportType:
                newTemplateSourceType === 'ASSESSMENT' && newTemplateFramework !== 'NONE'
                  ? `ASSESSMENT_${newTemplateFramework}`
                  : undefined,
            }}
            onTemplateSaved={(tpl) => {
              // Close builder, refresh list, and pre-select the new template
              setIsTemplateBuilderOpen(false);
              setReloadKey((k) => k + 1);
              setSourceFilter('organization');
              setSelectedId(tpl.id);
            }}
            onClose={closeTemplateBuilder}
          />
        </div>
      )}
    </div>
  );
}
