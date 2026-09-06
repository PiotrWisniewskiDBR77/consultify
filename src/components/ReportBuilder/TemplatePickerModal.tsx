/**
 * TemplatePickerModal - Modal for selecting report template
 *
 * Shows available templates grouped by:
 * - System templates (provided by application)
 * - Organization templates (created by the organization)
 * - "Dodaj czysty" option (create new template first)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { ReportEditor } from './ReportEditor';

// ============================================
// Types
// ============================================

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  isSystem: boolean;
  isDefault: boolean;
  audience?: string;
  expectedLength?: string;
  useCase?: string;
  category?: string;
  sections?: Array<{
    key: string;
    type: string;
    title: string;
    required?: boolean;
  }>;
}

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string, templateName: string) => void;
  /**
   * Legacy callback (older flow). If provided, it will be called when user clicks "Add clean".
   * The modal now supports creating templates directly using the main Report Editor (template mode).
   */
  onCreateClean?: () => void;
  sourceType: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' | 'UPLOAD_BUNDLE';
  framework?: string;
}

// ============================================
// Template Card Component
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
  strategic: 'from-blue-500 to-indigo-600',
  portfolio: 'from-emerald-500 to-blue-600',
  finance: 'from-amber-500 to-amber-600',
  steering: 'from-violet-500 to-violet-600',
  workshop: 'from-blue-500 to-blue-600',
  assessment: 'from-pink-500 to-danger-600',
  general: 'bg-c-surface-raised',
};

// Znalezisko 1.1-Z2 (dyżur — bliźniak modalu szablonów): etykiety kategorii
// pochodzą z danych API (`template.category`), ale ich nazwy są ze stałego,
// znanego zbioru (te same klucze co CATEGORY_COLORS) — tłumaczymy znane,
// nieznane/nowe kategorie z backendu spadają na kapitalizowaną wartość
// surową (bez wywalania się), tak jak przed tą zmianą.
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  strategic: 'strategic',
  portfolio: 'portfolio',
  finance: 'finance',
  steering: 'steering',
  workshop: 'workshop',
  assessment: 'assessment',
  general: 'general',
};

const TemplateCard: FC<{
  template: ReportTemplate;
  isSelected: boolean;
  onClick: () => void;
}> = ({ template, isSelected, onClick }) => {
  const { t } = useTranslation();
  const sectionsCount = template.sections?.length || 0;
  const [showOutline, setShowOutline] = useState(false);

  const gradient = CATEGORY_COLORS[template.category || 'general'] || CATEGORY_COLORS.general;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`
        relative w-full text-left rounded-xl border-2 transition-all overflow-hidden
        ${
          isSelected
            ? 'border-c-focus bg-c-surface-raised'
            : 'border-c-border-subtle bg-c-surface hover:border-c-focus/50'
        }
      `}
    >
      <button onClick={onClick} className="w-full text-left p-4">
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-3 right-3">
            <CheckCircle2 className="w-5 h-5 text-c-focus-solid" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 mb-2">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
            {template.isSystem ? (
              <Package className="w-4 h-4 text-c-text" />
            ) : (
              <Building2 className="w-4 h-4 text-c-text" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="font-semibold text-sm text-c-text truncate">{template.name}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {template.isDefault && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                  <Sparkles size={10} />
                  {t('reportBuilder.templatePicker.card.default', 'Default')}
                </span>
              )}
              {template.audience && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded">
                  <Users size={9} />
                  {template.audience}
                </span>
              )}
              {template.expectedLength && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-c-surface-raised text-c-text-secondary rounded">
                  <BookOpen size={9} />
                  {template.expectedLength}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-xs text-c-text-secondary line-clamp-2 mb-2">{template.description}</p>
        )}

        {/* Use case tag */}
        {template.useCase && (
          <p className="text-[11px] text-c-text-secondary italic mb-2">{template.useCase}</p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 text-[11px] text-c-text-secondary">
          <div className="flex items-center gap-1">
            <FileText size={12} />
            <span>
              {t('reportBuilder.templatePicker.card.sectionsCount', '{{count}} sections', {
                count: sectionsCount,
              })}
            </span>
          </div>
          {template.reportType && (
            <span className="px-1.5 py-0.5 bg-c-surface-raised rounded text-[10px] font-medium">
              {template.reportType.replace('ASSESSMENT_', '')}
            </span>
          )}
          <span className="text-[10px] text-c-text-secondary">
            {template.isSystem
              ? t('reportBuilder.templatePicker.card.system', 'System')
              : t('reportBuilder.templatePicker.card.organization', 'Organization')}
          </span>
        </div>
      </button>

      {/* Expandable outline preview */}
      {template.sections && template.sections.length > 0 && (
        <div className="border-t border-c-border-subtle">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOutline(!showOutline);
            }}
            className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[10px] text-c-text-secondary hover:text-c-focus-solid transition-colors"
          >
            {showOutline ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {t('reportBuilder.templatePicker.card.previewOutline', 'Preview outline')}
          </button>
          {showOutline && (
            <div className="px-4 pb-3 space-y-0.5">
              {template.sections.map((s, i) => (
                <div key={s.key || i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-c-text-secondary w-4 text-right">{i + 1}.</span>
                  <span
                    className={`${s.required ? 'text-c-text font-medium' : 'text-c-text-secondary'}`}
                  >
                    {s.title}
                  </span>
                  {s.required && (
                    <span className="text-[8px] text-c-focus-solid font-semibold">
                      {t('reportBuilder.templatePicker.card.required', 'REQ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// Main Component
// ============================================

export const TemplatePickerModal: FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateClean,
  sourceType,
  framework,
}) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isNewTemplateMetaOpen, setIsNewTemplateMetaOpen] = useState(false);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateRecipient, setNewTemplateRecipient] = useState<'' | 'board' | 'bank' | 'team'>(
    ''
  );

  const categoryLabel = useCallback(
    (cat: string): string => {
      if (cat === 'all') return t('reportBuilder.templatePicker.categories.all', 'All');
      const key = CATEGORY_LABEL_KEYS[cat];
      if (key) {
        return t(
          `reportBuilder.templatePicker.categories.${key}`,
          cat.charAt(0).toUpperCase() + cat.slice(1)
        );
      }
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    },
    [t]
  );

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await Api.get(`/report-builder/templates?sourceType=${sourceType}`);
      const allTemplates = response?.templates || [];

      // Filter by framework if specified (for DRD vs SIRI)
      const filtered = framework
        ? allTemplates.filter(
            (t: ReportTemplate) => !t.reportType || t.reportType.includes(framework.toUpperCase())
          )
        : allTemplates;

      setTemplates(filtered);

      // Pre-select default template if available
      const defaultTemplate = filtered.find((t: ReportTemplate) => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    } catch (err) {
      console.error('[TemplatePickerModal] Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [sourceType, framework]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  // Available categories
  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category || 'general'));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  // Group templates with filter
  const { systemTemplates, orgTemplates } = useMemo(() => {
    const filtered =
      categoryFilter === 'all'
        ? templates
        : templates.filter((t) => (t.category || 'general') === categoryFilter);
    const system = filtered.filter((t) => t.isSystem);
    const org = filtered.filter((t) => !t.isSystem);
    return { systemTemplates: system, orgTemplates: org };
  }, [templates, categoryFilter]);

  // Handle confirm
  const handleConfirm = () => {
    if (!selectedTemplateId) return;
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      setCreating(true);
      onSelectTemplate(template.id, template.name);
    }
  };

  // Handle "Dodaj czysty"
  const handleCreateClean = () => {
    if (onCreateClean) {
      onCreateClean();
      return;
    }
    setNewTemplateName('');
    setNewTemplateDescription('');
    setNewTemplateRecipient('');
    setIsNewTemplateMetaOpen(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-overlay flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[90vh] bg-c-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-c-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 text-c-text rounded-lg">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-c-text">
                  {t('reportBuilder.templatePicker.title', 'Select Report Template')}
                </h2>
                <p className="text-sm text-c-text-secondary">
                  {t(
                    'reportBuilder.templatePicker.subtitle',
                    'Choose a template to create your report'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t('reportBuilder.templatePicker.close', 'Close')}
              className="p-2 rounded-lg hover:opacity-90 text-c-text-secondary transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-c-text-secondary animate-spin" />
              </div>
            ) : (
              <>
                {/* Category filter */}
                {categories.length > 2 && (
                  <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                          categoryFilter === cat
                            ? 'border-c-focus bg-c-surface-raised text-c-focus-solid'
                            : 'border-c-border-subtle text-c-text-secondary hover:border-c-focus/50'
                        }`}
                      >
                        {categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                )}

                {/* System Templates */}
                {systemTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package size={16} className="text-blue-500" />
                      <h3 className="text-sm font-semibold text-c-text">
                        {t('reportBuilder.templatePicker.systemTemplates', 'Application Templates')}
                      </h3>
                      <span className="text-xs text-c-text-secondary">
                        ({systemTemplates.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {systemTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isSelected={selectedTemplateId === template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Organization Templates */}
                {orgTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={16} className="text-c-text-secondary" />
                      <h3 className="text-sm font-semibold text-c-text">
                        {t('reportBuilder.templatePicker.orgTemplates', 'Organization Templates')}
                      </h3>
                      <span className="text-xs text-c-text-secondary">({orgTemplates.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {orgTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isSelected={selectedTemplateId === template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {systemTemplates.length === 0 && orgTemplates.length === 0 && (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-full bg-c-surface-raised inline-block mb-3">
                      <FileText size={32} className="text-c-text-secondary" />
                    </div>
                    <p className="text-sm font-medium text-c-text">
                      {t('reportBuilder.templatePicker.empty.title', 'No templates available')}
                    </p>
                    <p className="text-xs text-c-text-secondary mt-1">
                      {t(
                        'reportBuilder.templatePicker.empty.hint',
                        'Create a custom template using "Add Clean" option'
                      )}
                    </p>
                  </div>
                )}

                {/* "Dodaj czysty" option */}
                <div className="border-t border-c-border-subtle pt-6">
                  <button
                    onClick={handleCreateClean}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-c-border-subtle hover:border-c-focus/50 hover:bg-c-surface-raised transition-all group"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-c-surface-raised rounded-lg group-hover:bg-c-surface transition-colors">
                        <Plus className="w-5 h-5 text-c-text-secondary group-hover:text-c-focus-solid" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-semibold text-c-text group-hover:text-c-focus-solid">
                          {t('reportBuilder.templatePicker.addClean.title', 'Add Clean')}
                        </span>
                        <span className="block text-xs text-c-text-secondary">
                          {t(
                            'reportBuilder.templatePicker.addClean.hint',
                            'Create a new custom template for your organization'
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-c-text hover:opacity-90 rounded-lg transition-colors"
            >
              {t('reportBuilder.templatePicker.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplateId || creating}
              className={`
                flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors
                ${
                  selectedTemplateId && !creating
                    ? 'bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950'
                    : 'bg-c-border-subtle text-c-text-secondary cursor-not-allowed'
                }
              `}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('reportBuilder.templatePicker.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <FileText size={16} />
                  {t('reportBuilder.templatePicker.createReport', 'Create Report')}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Small meta modal: name + description + recipient */}
      {isNewTemplateMetaOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsNewTemplateMetaOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-c-surface rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-c-border-subtle flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-c-text">
                  {t('reportBuilder.templatePicker.metaModal.title', 'New template')}
                </h3>
                <p className="text-sm text-c-text-secondary">
                  {t(
                    'reportBuilder.templatePicker.metaModal.subtitle',
                    'Provide basic metadata, then open the generator.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTemplateMetaOpen(false)}
                aria-label={t('reportBuilder.templatePicker.close', 'Close')}
                className="p-2 rounded-lg hover:opacity-90 text-c-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t('reportBuilder.templatePicker.metaModal.fields.name', 'Name')}
                </label>
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-text text-c-bg"
                  placeholder={t(
                    'reportBuilder.templatePicker.metaModal.fields.namePlaceholder',
                    'e.g. DRD Board Summary'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t(
                    'reportBuilder.templatePicker.metaModal.fields.descriptionOptional',
                    'Description (optional)'
                  )}
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-text text-c-bg resize-none"
                  placeholder={t(
                    'reportBuilder.templatePicker.metaModal.fields.descriptionPlaceholder',
                    'What is this template used for?'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t(
                    'reportBuilder.templatePicker.metaModal.fields.recipientOptional',
                    'Recipient (optional)'
                  )}
                </label>
                <select
                  value={newTemplateRecipient}
                  onChange={(e) =>
                    setNewTemplateRecipient(e.target.value as '' | 'board' | 'bank' | 'team')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-text text-c-bg"
                >
                  <option value="">—</option>
                  <option value="board">
                    {t('reportBuilder.templatePicker.metaModal.fields.recipientBoard', 'Board')}
                  </option>
                  <option value="bank">
                    {t('reportBuilder.templatePicker.metaModal.fields.recipientBank', 'Bank')}
                  </option>
                  <option value="team">
                    {t('reportBuilder.templatePicker.metaModal.fields.recipientTeam', 'Team')}
                  </option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewTemplateMetaOpen(false)}
                className="px-4 py-2 rounded-lg border border-c-border-subtle bg-c-text text-c-bg hover:opacity-90 transition-colors"
              >
                {t('reportBuilder.templatePicker.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewTemplateMetaOpen(false);
                  setIsTemplateBuilderOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-c-surface hover:opacity-90 disabled:opacity-50 text-c-text font-medium transition-colors"
              >
                {t('reportBuilder.templatePicker.metaModal.openGenerator', 'Open generator')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Template builder overlay (full ReportEditor in template mode) */}
      {isTemplateBuilderOpen && (
        <div className="fixed inset-0 z-modal">
          <ReportEditor
            mode="template"
            templateMeta={{
              name: newTemplateName,
              description: newTemplateDescription,
              sourceType: sourceType as any,
              reportType:
                sourceType === 'ASSESSMENT' && framework
                  ? `ASSESSMENT_${String(framework).toUpperCase()}`
                  : undefined,
            }}
            onTemplateSaved={(tpl) => {
              setIsTemplateBuilderOpen(false);
              // Refresh list + preselect created template
              void fetchTemplates().then(() => {
                setSelectedTemplateId(tpl.id);
              });
            }}
            onClose={() => {
              setIsTemplateBuilderOpen(false);
              void fetchTemplates();
            }}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

export default TemplatePickerModal;
