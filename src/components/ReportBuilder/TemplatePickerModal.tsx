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
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '../../services/api';

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
  sections?: Array<{
    key: string;
    type: string;
    title: string;
  }>;
}

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string, templateName: string) => void;
  onCreateClean: () => void;
  sourceType: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE';
  framework?: string;
}

// ============================================
// Template Card Component
// ============================================

const TemplateCard: FC<{
  template: ReportTemplate;
  isSelected: boolean;
  onClick: () => void;
}> = ({ template, isSelected, onClick }) => {
  const sectionsCount = template.sections?.length || 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative w-full text-left p-4 rounded-xl border-2 transition-all
        ${
          isSelected
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-purple-300 dark:hover:border-purple-700'
        }
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-5 h-5 text-purple-500" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className={`
          p-2 rounded-lg
          ${
            template.isSystem
              ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
              : 'bg-gradient-to-br from-purple-500 to-pink-600'
          }
        `}
        >
          {template.isSystem ? (
            <Package className="w-4 h-4 text-white" />
          ) : (
            <Building2 className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
            {template.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            {template.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                <Sparkles size={10} />
                Default
              </span>
            )}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {template.isSystem ? 'System' : 'Organization'}
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
      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <FileText size={12} />
          <span>{sectionsCount} sections</span>
        </div>
        {template.reportType && (
          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 rounded text-[10px] font-medium">
            {template.reportType.replace('ASSESSMENT_', '')}
          </span>
        )}
      </div>
    </motion.button>
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
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  // Group templates
  const { systemTemplates, orgTemplates } = useMemo(() => {
    const system = templates.filter((t) => t.isSystem);
    const org = templates.filter((t) => !t.isSystem);
    return { systemTemplates: system, orgTemplates: org };
  }, [templates]);

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
    onCreateClean();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
                  Select Report Template
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose a template to create your report
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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* System Templates */}
                {systemTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package size={16} className="text-blue-500" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Application Templates
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
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
                      <Building2 size={16} className="text-purple-500" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Organization Templates
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({orgTemplates.length})
                      </span>
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
                    <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 inline-block mb-3">
                      <FileText size={32} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      No templates available
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Create a custom template using "Add Clean" option
                    </p>
                  </div>
                )}

                {/* "Dodaj czysty" option */}
                <div className="border-t border-slate-200 dark:border-navy-700 pt-6">
                  <button
                    onClick={handleCreateClean}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-navy-700 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                        <Plus className="w-5 h-5 text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-purple-700 dark:group-hover:text-purple-400">
                          Add Clean
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          Create a new custom template for your organization
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplateId || creating}
              className={`
                flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors
                ${
                  selectedTemplateId && !creating
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Create Report
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TemplatePickerModal;
