/**
 * TemplatesManager
 *
 * Full CRUD management for Report Builder templates:
 * - List system (read-only) and organization templates
 * - Create new organization templates
 * - Edit organization templates
 * - Delete organization templates
 * - Duplicate system templates to organization
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  GripVertical,
  Loader2,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ==========================================
// TYPES
// ==========================================

interface TemplateSection {
  key: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  defaultLength?: string;
  defaultLanguage?: string;
  repeatFor?: string;
  repeatKey?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  isSystem: boolean;
  isDefault: boolean;
  isPublic: boolean;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
}

interface TemplatesManagerProps {
  embedded?: boolean;
  /** When true, opens the "New Template" editor immediately on mount. */
  autoOpenNewTemplate?: boolean;
  /** Called when user clicks on a template card to create a new report from it. */
  onUseTemplate?: (templateId: string) => void;
}

// ==========================================
// TEMPLATE EDITOR MODAL
// ==========================================

interface TemplateEditorModalProps {
  template?: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  template,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const isNew = !template?.id;
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [sourceType, setSourceType] = useState(template?.sourceType || 'ASSESSMENT');
  const [reportType, setReportType] = useState(template?.reportType || '');
  const [sections, setSections] = useState<TemplateSection[]>(template?.sections || []);
  const [saving, setSaving] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setSourceType(template.sourceType);
      setReportType(template.reportType || '');
      setSections(template.sections || []);
    } else {
      setName('');
      setDescription('');
      setSourceType('ASSESSMENT');
      setReportType('');
      setSections([]);
    }
  }, [template]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(isPl ? 'Nazwa jest wymagana' : 'Name is required');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await Api.post('/report-builder/templates', {
          name,
          description,
          sourceType,
          reportType: reportType || undefined,
          sections,
          isPublic: false,
        });
        toast.success(isPl ? 'Szablon utworzony' : 'Template created');
      } else {
        await Api.put(`/report-builder/templates/${template!.id}`, {
          name,
          description,
          reportType: reportType || undefined,
          sections,
        });
        toast.success(isPl ? 'Szablon zaktualizowany' : 'Template updated');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.error || (isPl ? 'Błąd zapisywania' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    const newSection: TemplateSection = {
      key: `custom_${Date.now()}`,
      type: 'custom',
      title: isPl ? 'Nowa sekcja' : 'New Section',
      required: false,
      order: sections.length,
      defaultLength: 'medium',
      defaultLanguage: 'business',
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, updates: Partial<TemplateSection>) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...updates };
    setSections(updated);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isNew
                  ? isPl
                    ? 'Nowy szablon'
                    : 'New Template'
                  : isPl
                    ? 'Edytuj szablon'
                    : 'Edit Template'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPl ? 'Organizacyjny szablon raportu' : 'Organization report template'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isPl ? 'Nazwa szablonu' : 'Template Name'}*
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isPl ? 'np. Raport Executive' : 'e.g. Executive Report'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isPl ? 'Typ źródła' : 'Source Type'}
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                disabled={!isNew}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white disabled:opacity-50"
              >
                <option value="ASSESSMENT">Assessment</option>
                <option value="INTERVIEW">Interview</option>
                <option value="TOOL">Tool</option>
                <option value="INITIATIVE">Initiative</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Opis' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={isPl ? 'Krótki opis szablonu...' : 'Brief template description...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPl ? 'Sekcje szablonu' : 'Template Sections'}
              </label>
              <button
                onClick={addSection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              >
                <Plus size={16} />
                {isPl ? 'Dodaj sekcję' : 'Add Section'}
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sections.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                  {isPl
                    ? 'Brak sekcji. Dodaj sekcje aby zdefiniować strukturę raportu.'
                    : 'No sections. Add sections to define report structure.'}
                </div>
              ) : (
                sections.map((section, index) => (
                  <div
                    key={section.key}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg"
                  >
                    <GripVertical size={16} className="text-slate-400 cursor-grab" />
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(index, { title: e.target.value })}
                        placeholder={isPl ? 'Tytuł' : 'Title'}
                        className="px-2 py-1.5 rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm"
                      />
                      <select
                        value={section.type}
                        onChange={(e) => updateSection(index, { type: e.target.value })}
                        className="px-2 py-1.5 rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm"
                      >
                        <option value="cover">Cover</option>
                        <option value="summary">Summary</option>
                        <option value="methodology">Methodology</option>
                        <option value="matrix">Matrix</option>
                        <option value="axis_analysis">Axis Analysis</option>
                        <option value="list">List</option>
                        <option value="recommendations">Recommendations</option>
                        <option value="action_plan">Action Plan</option>
                        <option value="appendix">Appendix</option>
                        <option value="custom">Custom</option>
                      </select>
                      <select
                        value={section.defaultLength || 'medium'}
                        onChange={(e) => updateSection(index, { defaultLength: e.target.value })}
                        className="px-2 py-1.5 rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm"
                      >
                        <option value="short">{isPl ? 'Krótka' : 'Short'}</option>
                        <option value="medium">{isPl ? 'Średnia' : 'Medium'}</option>
                        <option value="long">{isPl ? 'Długa' : 'Long'}</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={section.required}
                            onChange={(e) => updateSection(index, { required: e.target.checked })}
                            className="rounded"
                          />
                          {isPl ? 'Wymagana' : 'Required'}
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSection(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isPl ? 'Zapisywanie...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save size={16} />
                {isPl ? 'Zapisz szablon' : 'Save Template'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ==========================================
// TEMPLATE CARD
// ==========================================

interface TemplateCardProps {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUseTemplate?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onUseTemplate,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [showActions, setShowActions] = useState(false);

  const sectionsCount = template.sections?.length || 0;

  return (
    <div
      className="relative p-5 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors group cursor-pointer"
      onClick={onUseTemplate}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${template.isSystem ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-purple-500 to-pink-600'}
        `}
        >
          {template.isSystem ? (
            <Package className="w-5 h-5 text-white" />
          ) : (
            <Building2 className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{template.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {template.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                <Sparkles size={10} />
                Default
              </span>
            )}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {template.isSystem
                ? isPl
                  ? 'Systemowy'
                  : 'System'
                : isPl
                  ? 'Organizacyjny'
                  : 'Organization'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
          {template.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <FileText size={12} />
            <span>
              {sectionsCount} {isPl ? 'sekcji' : 'sections'}
            </span>
          </div>
          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 rounded text-[10px] font-medium">
            {template.sourceType}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onUseTemplate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUseTemplate();
              }}
              className="px-2.5 py-1 text-xs font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors"
              title={isPl ? 'Użyj szablonu' : 'Use template'}
            >
              <Sparkles size={12} className="inline mr-1" />
              {isPl ? 'Użyj' : 'Use'}
            </button>
          )}
          {template.isSystem ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
              title={isPl ? 'Duplikuj do organizacji' : 'Duplicate to organization'}
            >
              <Copy size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title={isPl ? 'Edytuj' : 'Edit'}
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                title={isPl ? 'Duplikuj' : 'Duplicate'}
              >
                <Copy size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title={isPl ? 'Usuń' : 'Delete'}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const TemplatesManager: React.FC<TemplatesManagerProps> = ({
  embedded,
  autoOpenNewTemplate,
  onUseTemplate,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [filter, setFilter] = useState<'all' | 'system' | 'org'>('all');

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await Api.get('/report-builder/templates');
      const allTemplates = response?.templates || [];

      // Parse sections from sections_json if needed
      const parsed = allTemplates.map((t: any) => {
        const rawSections = Array.isArray(t.sections)
          ? t.sections
          : typeof t.sections === 'string'
            ? t.sections
            : typeof t.sectionsJson === 'string'
              ? t.sectionsJson
              : typeof t.sections_json === 'string'
                ? t.sections_json
                : typeof t.sectionsJson === 'string'
                  ? t.sectionsJson
                  : null;

        let sections: any[] = [];
        if (Array.isArray(rawSections)) {
          sections = rawSections;
        } else if (typeof rawSections === 'string' && rawSections.trim()) {
          try {
            sections = JSON.parse(rawSections);
          } catch {
            sections = [];
          }
        }

        return {
          ...t,
          sections,
        };
      });

      setTemplates(parsed);
    } catch (err) {
      console.error('[TemplatesManager] Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (filter === 'system') return t.isSystem;
    if (filter === 'org') return !t.isSystem;
    return true;
  });

  const systemTemplates = filteredTemplates.filter((t) => t.isSystem);
  const orgTemplates = filteredTemplates.filter((t) => !t.isSystem);

  // Handle delete
  const handleDelete = async (templateId: string) => {
    if (
      !confirm(
        isPl
          ? 'Czy na pewno chcesz usunąć ten szablon?'
          : 'Are you sure you want to delete this template?'
      )
    ) {
      return;
    }

    try {
      await Api.delete(`/report-builder/templates/${templateId}`);
      toast.success(isPl ? 'Szablon usunięty' : 'Template deleted');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || (isPl ? 'Błąd usuwania' : 'Failed to delete'));
    }
  };

  // Handle duplicate
  const handleDuplicate = async (template: Template) => {
    try {
      await Api.post(`/report-builder/templates/${template.id}/duplicate`, {
        name: `${template.name} (${isPl ? 'Kopia' : 'Copy'})`,
      });
      toast.success(isPl ? 'Szablon zduplikowany' : 'Template duplicated');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.error || (isPl ? 'Błąd duplikowania' : 'Failed to duplicate'));
    }
  };

  // Open editor
  const openEditor = (template?: Template) => {
    setEditingTemplate(template || null);
    setShowEditor(true);
  };

  // Auto-open create flow (used by embedded generator contexts, e.g. assessment picker)
  useEffect(() => {
    if (autoOpenNewTemplate) {
      setEditingTemplate(null);
      setShowEditor(true);
    }
  }, [autoOpenNewTemplate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Szablony Raportów' : 'Report Templates'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Zarządzaj szablonami raportów dla twojej organizacji'
              : 'Manage report templates for your organization'}
          </p>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus size={18} />
          {isPl ? 'Nowy szablon' : 'New Template'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          {isPl ? 'Wszystkie' : 'All'} ({templates.length})
        </button>
        <button
          onClick={() => setFilter('system')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            filter === 'system'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Package size={14} />
            {isPl ? 'Systemowe' : 'System'} ({templates.filter((t) => t.isSystem).length})
          </span>
        </button>
        <button
          onClick={() => setFilter('org')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            filter === 'org'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building2 size={14} />
            {isPl ? 'Organizacyjne' : 'Organization'} ({templates.filter((t) => !t.isSystem).length}
            )
          </span>
        </button>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-3">
            <FileText size={32} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {filter === 'org'
              ? isPl
                ? 'Brak szablonów organizacyjnych'
                : 'No organization templates'
              : isPl
                ? 'Brak szablonów'
                : 'No templates found'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Utwórz nowy szablon lub zduplikuj systemowy'
              : 'Create a new template or duplicate a system one'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Templates */}
          {systemTemplates.length > 0 && (filter === 'all' || filter === 'system') && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPl ? 'Szablony systemowe' : 'System Templates'}
                </h3>
                <span className="text-xs text-slate-500">({systemTemplates.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => {}} // System templates can't be edited
                    onDelete={() => {}} // System templates can't be deleted
                    onDuplicate={() => handleDuplicate(template)}
                    onUseTemplate={onUseTemplate ? () => onUseTemplate(template.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Organization Templates */}
          {orgTemplates.length > 0 && (filter === 'all' || filter === 'org') && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-purple-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPl ? 'Szablony organizacyjne' : 'Organization Templates'}
                </h3>
                <span className="text-xs text-slate-500">({orgTemplates.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orgTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => openEditor(template)}
                    onDelete={() => handleDelete(template.id)}
                    onDuplicate={() => handleDuplicate(template)}
                    onUseTemplate={onUseTemplate ? () => onUseTemplate(template.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info box for system templates */}
      {filter === 'system' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">{isPl ? 'Szablony systemowe' : 'System Templates'}</p>
              <p className="mt-1 text-blue-600 dark:text-blue-400">
                {isPl
                  ? 'Szablony systemowe są tylko do odczytu. Możesz je zduplikować do szablonów organizacyjnych, aby dostosować do swoich potrzeb.'
                  : 'System templates are read-only. You can duplicate them to organization templates to customize for your needs.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <TemplateEditorModal
            template={editingTemplate}
            isOpen={showEditor}
            onClose={() => {
              setShowEditor(false);
              setEditingTemplate(null);
            }}
            onSaved={fetchTemplates}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplatesManager;
