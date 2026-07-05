/**
 * TemplatesManagementPanel - Project & Task Templates Management
 *
 * Features:
 * - Project templates list
 * - Task templates
 * - Create/Edit/Delete templates
 * - Import/Export templates
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  FolderOpen,
  Layout,
  ListTodo,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { InfoButton } from '../shared/InfoButton';

// Template types
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault: boolean;
  taskCount: number;
  milestoneCount: number;
  estimatedDuration: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  tags: string[];
  structure: {
    phases: PhaseTemplate[];
  };
}

interface PhaseTemplate {
  id: string;
  name: string;
  order: number;
  tasks: TaskTemplate[];
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedHours: number;
  tags: string[];
  subtasks: string[];
  dependencies: string[];
}

// Template categories
const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All Templates', icon: Layout },
  { id: 'project', label: 'Project Templates', icon: FolderOpen },
  { id: 'task', label: 'Task Templates', icon: ListTodo },
  { id: 'milestone', label: 'Milestone Templates', icon: Calendar },
];

// Sample templates
const SAMPLE_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'waterfall-classic',
    name: 'Classic Waterfall',
    description: 'Traditional waterfall methodology with sequential phases',
    category: 'project',
    isDefault: true,
    taskCount: 25,
    milestoneCount: 5,
    estimatedDuration: '6 months',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 45,
    tags: ['waterfall', 'traditional', 'sequential'],
    structure: {
      phases: [
        { id: 'init', name: 'Initiation', order: 1, tasks: [] },
        { id: 'plan', name: 'Planning', order: 2, tasks: [] },
        { id: 'exec', name: 'Execution', order: 3, tasks: [] },
        { id: 'monitor', name: 'Monitoring', order: 4, tasks: [] },
        { id: 'close', name: 'Closing', order: 5, tasks: [] },
      ],
    },
  },
  {
    id: 'agile-sprint',
    name: 'Agile Sprint',
    description: 'Two-week sprint cycle with daily standups and retrospectives',
    category: 'project',
    isDefault: true,
    taskCount: 15,
    milestoneCount: 3,
    estimatedDuration: '2 weeks',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 128,
    tags: ['agile', 'scrum', 'sprint'],
    structure: {
      phases: [
        { id: 'planning', name: 'Sprint Planning', order: 1, tasks: [] },
        { id: 'dev', name: 'Development', order: 2, tasks: [] },
        { id: 'review', name: 'Sprint Review', order: 3, tasks: [] },
      ],
    },
  },
  {
    id: 'prince2-standard',
    name: 'PRINCE2 Standard',
    description: 'Full PRINCE2 methodology with stage gates and governance',
    category: 'project',
    isDefault: true,
    taskCount: 40,
    milestoneCount: 7,
    estimatedDuration: '12 months',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 32,
    tags: ['prince2', 'governance', 'enterprise'],
    structure: {
      phases: [
        { id: 'startup', name: 'Starting Up', order: 1, tasks: [] },
        { id: 'direction', name: 'Directing', order: 2, tasks: [] },
        { id: 'initiation', name: 'Initiating', order: 3, tasks: [] },
        { id: 'controlling', name: 'Controlling a Stage', order: 4, tasks: [] },
        { id: 'managing', name: 'Managing Delivery', order: 5, tasks: [] },
        { id: 'boundary', name: 'Managing Stage Boundaries', order: 6, tasks: [] },
        { id: 'closing', name: 'Closing', order: 7, tasks: [] },
      ],
    },
  },
  {
    id: 'kanban-flow',
    name: 'Kanban Flow',
    description: 'Continuous flow with WIP limits and visual management',
    category: 'project',
    isDefault: false,
    taskCount: 10,
    milestoneCount: 0,
    estimatedDuration: 'Continuous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 67,
    tags: ['kanban', 'lean', 'continuous'],
    structure: {
      phases: [
        { id: 'backlog', name: 'Backlog', order: 1, tasks: [] },
        { id: 'todo', name: 'To Do', order: 2, tasks: [] },
        { id: 'progress', name: 'In Progress', order: 3, tasks: [] },
        { id: 'review', name: 'Review', order: 4, tasks: [] },
        { id: 'done', name: 'Done', order: 5, tasks: [] },
      ],
    },
  },
];

interface TemplatesManagementPanelProps {
  className?: string;
}

export const TemplatesManagementPanel: React.FC<TemplatesManagementPanelProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ProjectTemplate[]>(SAMPLE_TEMPLATES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'project',
    estimatedDuration: '',
    tags: [] as string[],
    structure: {
      phases: [] as PhaseTemplate[],
    },
  });

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, fetch from API
      // const data = await Api.getTemplates(currentOrganization?.id);
      // setTemplates(data);

      // Using sample data for now
      setTemplates(SAMPLE_TEMPLATES);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error(t('admin.templates.loadError', 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Start creating
  const startCreating = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'project',
      estimatedDuration: '',
      tags: [],
      structure: {
        phases: [{ id: `phase_${Date.now()}`, name: 'Phase 1', order: 1, tasks: [] }],
      },
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  // Start editing
  const startEditing = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      estimatedDuration: template.estimatedDuration,
      tags: template.tags,
      structure: template.structure,
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  // Duplicate template
  const duplicateTemplate = (template: ProjectTemplate) => {
    const newTemplate: ProjectTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, newTemplate]);
    toast.success(t('admin.templates.duplicated', 'Template duplicated'));
  };

  // Delete template
  const deleteTemplate = (template: ProjectTemplate) => {
    if (template.isDefault) {
      toast.error(t('admin.templates.cannotDeleteDefault', 'Cannot delete default templates'));
      return;
    }

    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    toast.success(t('admin.templates.deleted', 'Template deleted'));
  };

  // Save template
  const saveTemplate = () => {
    if (!formData.name.trim()) {
      toast.error(t('admin.templates.nameRequired', 'Template name is required'));
      return;
    }

    if (isCreating) {
      const newTemplate: ProjectTemplate = {
        id: `template_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        isDefault: false,
        taskCount: formData.structure.phases.reduce((acc, p) => acc + p.tasks.length, 0),
        milestoneCount: formData.structure.phases.length,
        estimatedDuration: formData.estimatedDuration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        tags: formData.tags,
        structure: formData.structure,
      };
      setTemplates((prev) => [...prev, newTemplate]);
      toast.success(t('admin.templates.created', 'Template created'));
    } else if (selectedTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selectedTemplate.id
            ? {
                ...t,
                name: formData.name,
                description: formData.description,
                estimatedDuration: formData.estimatedDuration,
                tags: formData.tags,
                structure: formData.structure,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
      toast.success(t('admin.templates.updated', 'Template updated'));
    }

    setIsCreating(false);
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  // Add phase
  const addPhase = () => {
    const newPhase: PhaseTemplate = {
      id: `phase_${Date.now()}`,
      name: `Phase ${formData.structure.phases.length + 1}`,
      order: formData.structure.phases.length + 1,
      tasks: [],
    };
    setFormData((prev) => ({
      ...prev,
      structure: {
        ...prev.structure,
        phases: [...prev.structure.phases, newPhase],
      },
    }));
  };

  // Remove phase
  const removePhase = (phaseId: string) => {
    setFormData((prev) => ({
      ...prev,
      structure: {
        ...prev.structure,
        phases: prev.structure.phases.filter((p) => p.id !== phaseId),
      },
    }));
  };

  // Update phase name
  const updatePhaseName = (phaseId: string, name: string) => {
    setFormData((prev) => ({
      ...prev,
      structure: {
        ...prev.structure,
        phases: prev.structure.phases.map((p) => (p.id === phaseId ? { ...p, name } : p)),
      },
    }));
  };

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]
    );
  };

  // Export template
  const exportTemplate = (template: ProjectTemplate) => {
    const data = JSON.stringify(template, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.templates.exported', 'Template exported'));
  };

  // Import template
  const importTemplate = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const importedTemplate: ProjectTemplate = {
            ...data,
            id: `template_${Date.now()}`,
            isDefault: false,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setTemplates((prev) => [...prev, importedTemplate]);
          toast.success(t('admin.templates.imported', 'Template imported'));
        } catch {
          toast.error(t('admin.templates.importError', 'Invalid template file'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Render template card
  const renderTemplateCard = (template: ProjectTemplate) => {
    return (
      <motion.div
        key={template.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:shadow-md transition-all group"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <FolderOpen className="text-primary-500" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                {template.isDefault && (
                  <Star className="text-amber-400" size={14} fill="currentColor" />
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {template.description}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <ListTodo size={12} />
                  {template.taskCount} tasks
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Calendar size={12} />
                  {template.milestoneCount} milestones
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Eye size={12} />
                  {template.usageCount} uses
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => startEditing(template)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title={t('common.edit', 'Edit')}
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => duplicateTemplate(template)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title={t('common.duplicate', 'Duplicate')}
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => exportTemplate(template)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              title={t('common.export', 'Export')}
            >
              <Download size={16} />
            </button>
            {!template.isDefault && (
              <button
                onClick={() => deleteTemplate(template)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                title={t('common.delete', 'Delete')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Render editor
  const renderEditor = () => {
    return (
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.templates.name', 'Template Name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              placeholder={t('admin.templates.namePlaceholder', 'Enter template name')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.templates.duration', 'Estimated Duration')}
            </label>
            <input
              type="text"
              value={formData.estimatedDuration}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, estimatedDuration: e.target.value }))
              }
              className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
              placeholder={t('admin.templates.durationPlaceholder', 'e.g., 3 months')}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.templates.description', 'Description')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white resize-none"
            rows={3}
            placeholder={t('admin.templates.descriptionPlaceholder', 'Describe this template')}
          />
        </div>

        {/* Phases */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('admin.templates.phases', 'Phases / Stages')}
            </label>
            <button
              onClick={addPhase}
              className="px-3 py-1 text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg flex items-center gap-1"
            >
              <Plus size={14} />
              {t('admin.templates.addPhase', 'Add Phase')}
            </button>
          </div>
          <div className="space-y-2">
            {formData.structure.phases.map((phase, index) => (
              <div
                key={phase.id}
                className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-navy-800">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    {expandedPhases.includes(phase.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent border-0 text-slate-900 dark:text-white focus:ring-0"
                    placeholder={t('admin.templates.phaseName', 'Phase name')}
                  />
                  <button
                    onClick={() => removePhase(phase.id)}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-danger-500"
                  >
                    <X size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {expandedPhases.includes(phase.id) && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-white dark:bg-navy-800 border-t border-slate-200 dark:border-navy-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                          {t(
                            'admin.templates.noTasks',
                            'No tasks in this phase yet. Tasks can be added when creating a project from this template.'
                          )}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('admin.templates.title', 'Templates')}
            </h2>
            <InfoButton cardId="admin-templates" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.templates.subtitle', 'Manage project and task templates')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={importTemplate}
            className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Upload size={16} />
            {t('common.import', 'Import')}
          </button>
          <button
            onClick={loadTemplates}
            disabled={loading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={startCreating}
            className="px-4 py-2 bg-c-text text-c-bg hover:bg-c-text-secondary rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            {t('admin.templates.create', 'Create Template')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.templates.searchPlaceholder', 'Search templates...')}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="animate-spin mx-auto text-primary-500 mb-2" size={24} />
                <p className="text-slate-500 dark:text-slate-400">
                  {t('common.loading', 'Loading...')}
                </p>
              </div>
            ) : filteredTemplates.length > 0 ? (
              filteredTemplates.map(renderTemplateCard)
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Layout className="mx-auto mb-2 opacity-50" size={32} />
                {t('admin.templates.noResults', 'No templates found')}
              </div>
            )}
          </div>
        </div>

        {/* Editor Panel */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {isEditing || isCreating ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isCreating
                    ? t('admin.templates.createNew', 'Create Template')
                    : t('admin.templates.editTemplate', 'Edit Template')}
                </h3>
                <button
                  onClick={cancelEditing}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
                >
                  <X size={18} />
                </button>
              </div>

              {renderEditor()}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
                <button
                  onClick={saveTemplate}
                  className="px-4 py-2 bg-c-text text-c-bg hover:bg-c-text-secondary rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Check size={16} />
                  {t('common.save', 'Save')}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Layout className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('admin.templates.selectToEdit', 'Select a Template')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t(
                  'admin.templates.selectToEditDesc',
                  'Select a template from the list to edit or create a new one'
                )}
              </p>
              <button
                onClick={startCreating}
                className="px-4 py-2 border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg flex items-center gap-2 mx-auto transition-colors"
              >
                <Plus size={16} />
                {t('admin.templates.create', 'Create Template')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesManagementPanel;
