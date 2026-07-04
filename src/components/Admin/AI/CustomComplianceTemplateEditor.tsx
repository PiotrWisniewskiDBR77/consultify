/**
 * CustomComplianceTemplateEditor - Custom Compliance Template Builder
 *
 * Allows organizations to create custom compliance frameworks
 * with their own sections, checkpoints, and validation rules.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Download,
  Edit3,
  FileText,
  Plus,
  Save,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface ComplianceCheckpoint {
  id: string;
  name: string;
  description: string;
  required: boolean;
  weight: number;
  validationType: 'manual' | 'automatic' | 'hybrid';
  automationRule?: string;
}

interface ComplianceSection {
  id: string;
  name: string;
  description: string;
  checkpoints: ComplianceCheckpoint[];
  expanded?: boolean;
}

interface ComplianceTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  basedOn: string | null;
  sections: ComplianceSection[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags: string[];
  };
}

interface CustomComplianceTemplateEditorProps {
  organizationId: string;
  existingTemplate?: ComplianceTemplate;
  onSave?: (template: ComplianceTemplate) => void;
  onClose?: () => void;
}

// Built-in base templates
const BASE_TEMPLATES = [
  { id: 'ISO21500', name: 'ISO 21500:2021', description: 'Project Management guidance' },
  {
    id: 'PMBOK7',
    name: 'PMI PMBOK® 7th Edition',
    description: 'Project Management Body of Knowledge',
  },
  { id: 'PRINCE2', name: 'PRINCE2®', description: 'Projects IN Controlled Environments' },
  { id: 'GDPR', name: 'GDPR', description: 'General Data Protection Regulation' },
  { id: 'SOC2', name: 'SOC 2 Type II', description: 'Service Organization Control' },
  { id: 'CUSTOM', name: 'Blank Template', description: 'Start from scratch' },
];

export const CustomComplianceTemplateEditor: React.FC<CustomComplianceTemplateEditorProps> = ({
  organizationId,
  existingTemplate,
  onSave,
  onClose,
}) => {
  const [template, setTemplate] = useState<ComplianceTemplate>(
    () =>
      existingTemplate || {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        version: '1.0.0',
        basedOn: null,
        sections: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'admin',
          tags: [],
        },
      }
  );

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showBaseTemplateSelector, setShowBaseTemplateSelector] = useState(!existingTemplate);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate unique ID
  const generateId = () => crypto.randomUUID().substring(0, 8);

  // Select base template
  const selectBaseTemplate = (baseId: string) => {
    if (baseId === 'CUSTOM') {
      setTemplate((prev) => ({
        ...prev,
        basedOn: null,
        sections: [],
      }));
    } else {
      // Load predefined sections based on template
      const baseSections = getBaseSections(baseId);
      setTemplate((prev) => ({
        ...prev,
        basedOn: baseId,
        name: `Custom ${baseId} Framework`,
        sections: baseSections,
      }));
    }
    setShowBaseTemplateSelector(false);
  };

  // Get base sections for a template
  const getBaseSections = (baseId: string): ComplianceSection[] => {
    const sections: Record<string, ComplianceSection[]> = {
      ISO21500: [
        {
          id: generateId(),
          name: 'Project Governance',
          description: 'Governance and decision-making processes',
          expanded: true,
          checkpoints: [
            {
              id: generateId(),
              name: 'Audit Trail Enabled',
              description: 'All AI actions are logged',
              required: true,
              weight: 3,
              validationType: 'automatic',
              automationRule: 'settings.auditPolicyChanges === true',
            },
            {
              id: generateId(),
              name: 'Policy Defined',
              description: 'AI policy level is configured',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Roles Configured',
              description: 'AI roles are assigned',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
          ],
        },
        {
          id: generateId(),
          name: 'Resource Management',
          description: 'AI resource allocation and limits',
          checkpoints: [
            {
              id: generateId(),
              name: 'Usage Limits Set',
              description: 'Token and API limits configured',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Budget Control Active',
              description: 'Monthly budget is defined',
              required: false,
              weight: 1,
              validationType: 'automatic',
            },
          ],
        },
      ],
      GDPR: [
        {
          id: generateId(),
          name: 'Data Protection',
          description: 'Personal data protection measures',
          expanded: true,
          checkpoints: [
            {
              id: generateId(),
              name: 'PII Detection',
              description: 'PII detection is enabled',
              required: true,
              weight: 3,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Data Retention Policy',
              description: 'Retention periods are defined',
              required: true,
              weight: 3,
              validationType: 'manual',
            },
            {
              id: generateId(),
              name: 'Consent Management',
              description: 'User consent is obtained',
              required: true,
              weight: 3,
              validationType: 'manual',
            },
          ],
        },
        {
          id: generateId(),
          name: 'Rights Management',
          description: 'Data subject rights',
          checkpoints: [
            {
              id: generateId(),
              name: 'Right to Erasure',
              description: 'Data can be deleted on request',
              required: true,
              weight: 2,
              validationType: 'manual',
            },
            {
              id: generateId(),
              name: 'Data Portability',
              description: 'Data export is available',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
          ],
        },
      ],
      SOC2: [
        {
          id: generateId(),
          name: 'Security',
          description: 'Security controls and measures',
          expanded: true,
          checkpoints: [
            {
              id: generateId(),
              name: 'Access Control',
              description: 'Role-based access is enforced',
              required: true,
              weight: 3,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Encryption',
              description: 'Data encryption is enabled',
              required: true,
              weight: 3,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Audit Logging',
              description: 'Security events are logged',
              required: true,
              weight: 3,
              validationType: 'automatic',
            },
          ],
        },
      ],
      PMBOK7: [
        {
          id: generateId(),
          name: 'Performance Monitoring',
          description: 'AI performance measurement',
          expanded: true,
          checkpoints: [
            {
              id: generateId(),
              name: 'Metrics Tracking',
              description: 'Performance metrics are collected',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Quality Validation',
              description: 'AI output quality is checked',
              required: true,
              weight: 3,
              validationType: 'automatic',
            },
          ],
        },
      ],
      PRINCE2: [
        {
          id: generateId(),
          name: 'Business Case',
          description: 'AI value and justification',
          expanded: true,
          checkpoints: [
            {
              id: generateId(),
              name: 'ROI Tracking',
              description: 'AI ROI is measured',
              required: false,
              weight: 2,
              validationType: 'manual',
            },
          ],
        },
        {
          id: generateId(),
          name: 'Change Theme',
          description: 'Configuration and change management',
          checkpoints: [
            {
              id: generateId(),
              name: 'Version Control',
              description: 'Prompt versions are tracked',
              required: true,
              weight: 2,
              validationType: 'automatic',
            },
            {
              id: generateId(),
              name: 'Change Approval',
              description: 'Changes require approval',
              required: false,
              weight: 1,
              validationType: 'manual',
            },
          ],
        },
      ],
    };
    return sections[baseId] || [];
  };

  // Add new section
  const addSection = () => {
    const newSection: ComplianceSection = {
      id: generateId(),
      name: 'New Section',
      description: '',
      checkpoints: [],
      expanded: true,
    };
    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setActiveSection(newSection.id);
  };

  // Remove section
  const removeSection = (sectionId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    if (activeSection === sectionId) setActiveSection(null);
  };

  // Update section
  const updateSection = (sectionId: string, updates: Partial<ComplianceSection>) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    }));
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, expanded: !s.expanded } : s
      ),
    }));
  };

  // Add checkpoint to section
  const addCheckpoint = (sectionId: string) => {
    const newCheckpoint: ComplianceCheckpoint = {
      id: generateId(),
      name: 'New Checkpoint',
      description: '',
      required: false,
      weight: 1,
      validationType: 'manual',
    };
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, checkpoints: [...s.checkpoints, newCheckpoint] } : s
      ),
    }));
  };

  // Remove checkpoint
  const removeCheckpoint = (sectionId: string, checkpointId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, checkpoints: s.checkpoints.filter((c) => c.id !== checkpointId) }
          : s
      ),
    }));
  };

  // Update checkpoint
  const updateCheckpoint = (
    sectionId: string,
    checkpointId: string,
    updates: Partial<ComplianceCheckpoint>
  ) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              checkpoints: s.checkpoints.map((c) =>
                c.id === checkpointId ? { ...c, ...updates } : c
              ),
            }
          : s
      ),
    }));
  };

  // Add tag
  const addTag = () => {
    if (newTag.trim() && !template.metadata.tags.includes(newTag.trim())) {
      setTemplate((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          tags: [...prev.metadata.tags, newTag.trim()],
        },
      }));
      setNewTag('');
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setTemplate((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: prev.metadata.tags.filter((t) => t !== tag),
      },
    }));
  };

  // Export template
  const exportTemplate = () => {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template exported');
  };

  // Import template
  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTemplate({
          ...imported,
          id: crypto.randomUUID(),
          metadata: {
            ...imported.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
        setShowBaseTemplateSelector(false);
        toast.success('Template imported');
      } catch (err) {
        toast.error('Invalid template file');
      }
    };
    reader.readAsText(file);
  };

  // Save template
  const saveTemplate = async () => {
    if (!template.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (template.sections.length === 0) {
      toast.error('Please add at least one section');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/ai-settings/compliance/templates`, {
        method: existingTemplate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...template,
          organizationId,
          metadata: {
            ...template.metadata,
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      if (res.ok) {
        toast.success('Template saved');
        onSave?.(template);
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      toast.error('Failed to save template');
    }
    setSaving(false);
  };

  // Calculate total checkpoints
  const totalCheckpoints = template.sections.reduce((sum, s) => sum + s.checkpoints.length, 0);
  const requiredCheckpoints = template.sections.reduce(
    (sum, s) => sum + s.checkpoints.filter((c) => c.required).length,
    0
  );

  if (showBaseTemplateSelector) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-c-text flex items-center gap-2">
            <FileText size={24} className="text-primary-400" />
            Create Custom Compliance Template
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-600 dark:text-slate-500 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <p className="text-slate-600 dark:text-slate-500">
          Choose a base template to start from, or create a blank template:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BASE_TEMPLATES.map((base) => (
            <button
              key={base.id}
              onClick={() => selectBaseTemplate(base.id)}
              className="p-6 bg-c-surface/50 border border-c-border-subtle rounded-xl text-left hover:border-c-accent/50 hover:bg-c-accent/5 transition-all"
            >
              <h3 className="font-semibold text-c-text mb-2">{base.name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-500">{base.description}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-c-border-subtle pt-6">
          <p className="text-sm text-slate-600 dark:text-slate-500 mb-3">
            Or import an existing template:
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised text-c-text rounded-lg cursor-pointer transition-colors">
            <Upload size={16} />
            Import JSON
            <input type="file" accept=".json" onChange={importTemplate} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-c-text flex items-center gap-2">
            <FileText size={24} className="text-primary-400" />
            {existingTemplate ? 'Edit' : 'Create'} Compliance Template
          </h2>
          {template.basedOn && (
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
              Based on: {template.basedOn}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised text-slate-600 rounded-lg transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="flex items-center gap-2 p-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-600 dark:text-slate-500 hover:text-white p-2"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Template Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
            Template Name *
          </label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Custom AI Governance Framework"
            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-3 text-c-text focus:border-c-focus-solid outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">Version</label>
          <input
            type="text"
            value={template.version}
            onChange={(e) => setTemplate((prev) => ({ ...prev, version: e.target.value }))}
            placeholder="1.0.0"
            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-3 text-c-text focus:border-c-focus-solid outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
            Description
          </label>
          <textarea
            value={template.description}
            onChange={(e) => setTemplate((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the purpose and scope of this compliance framework..."
            rows={2}
            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-3 text-c-text focus:border-c-focus-solid outline-none resize-none"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {template.metadata.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-white">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag..."
            className="flex-1 bg-c-surface-raised/50 border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:border-c-focus-solid outline-none"
          />
          <button
            onClick={addTag}
            className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised text-slate-600 rounded-lg text-sm transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-c-surface/50 border border-c-border-subtle rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Sections</p>
          <p className="text-2xl font-bold text-c-text">{template.sections.length}</p>
        </div>
        <div className="bg-c-surface/50 border border-c-border-subtle rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
            Total Checkpoints
          </p>
          <p className="text-2xl font-bold text-c-text">{totalCheckpoints}</p>
        </div>
        <div className="bg-c-surface/50 border border-c-border-subtle rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Required</p>
          <p className="text-2xl font-bold text-amber-400">{requiredCheckpoints}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-c-text">Sections</h3>
          <button
            onClick={addSection}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Section
          </button>
        </div>

        <AnimatePresence>
          {template.sections.map((section, sectionIndex) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-c-surface/50 border border-c-border-subtle rounded-xl overflow-hidden"
            >
              {/* Section Header */}
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/20"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 dark:text-slate-400 font-mono text-sm">
                    {sectionIndex + 1}
                  </span>
                  <div>
                    <input
                      type="text"
                      value={section.name}
                      onChange={(e) => updateSection(section.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-c-text font-semibold focus:outline-none focus:border-b focus:border-c-focus-solid"
                    />
                    <input
                      type="text"
                      value={section.description}
                      onChange={(e) => updateSection(section.id, { description: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Section description..."
                      className="block bg-transparent text-sm text-slate-600 dark:text-slate-500 mt-1 focus:outline-none focus:border-b focus:border-c-focus-solid w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {section.checkpoints.length} checkpoints
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(section.id);
                    }}
                    className="text-slate-500 dark:text-slate-400 hover:text-danger-400 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                  {section.expanded ? (
                    <ChevronUp size={18} className="text-slate-500 dark:text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  )}
                </div>
              </div>

              {/* Checkpoints */}
              {section.expanded && (
                <div className="px-6 pb-4 space-y-3">
                  {section.checkpoints.map((checkpoint, cpIndex) => (
                    <div
                      key={checkpoint.id}
                      className="flex items-center gap-4 p-3 bg-black/20 rounded-lg"
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono w-6">
                        {cpIndex + 1}
                      </span>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          value={checkpoint.name}
                          onChange={(e) =>
                            updateCheckpoint(section.id, checkpoint.id, {
                              name: e.target.value,
                            })
                          }
                          placeholder="Checkpoint name"
                          className="bg-c-surface-raised/50 border border-c-border rounded px-2 py-1 text-c-text text-sm"
                        />
                        <input
                          type="text"
                          value={checkpoint.description}
                          onChange={(e) =>
                            updateCheckpoint(section.id, checkpoint.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                          className="bg-c-surface-raised/50 border border-c-border rounded px-2 py-1 text-c-text text-sm"
                        />
                        <select
                          value={checkpoint.validationType}
                          onChange={(e) =>
                            updateCheckpoint(section.id, checkpoint.id, {
                              validationType: e.target.value as any,
                            })
                          }
                          className="bg-c-surface-raised/50 border border-c-border rounded px-2 py-1 text-c-text text-sm"
                        >
                          <option value="manual">Manual</option>
                          <option value="automatic">Automatic</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-500">
                            <input
                              type="checkbox"
                              checked={checkpoint.required}
                              onChange={(e) =>
                                updateCheckpoint(section.id, checkpoint.id, {
                                  required: e.target.checked,
                                })
                              }
                              className="rounded bg-c-surface-raised border-slate-600"
                            />
                            Required
                          </label>
                          <input
                            type="number"
                            value={checkpoint.weight}
                            onChange={(e) =>
                              updateCheckpoint(section.id, checkpoint.id, {
                                weight: parseInt(e.target.value) || 1,
                              })
                            }
                            min={1}
                            max={5}
                            className="w-14 bg-c-surface-raised/50 border border-c-border rounded px-2 py-1 text-c-text text-sm"
                            title="Weight (1-5)"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => removeCheckpoint(section.id, checkpoint.id)}
                        className="text-slate-500 dark:text-slate-400 hover:text-danger-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => addCheckpoint(section.id)}
                    className="w-full py-2 border border-dashed border-c-border rounded-lg text-slate-500 dark:text-slate-400 hover:text-primary-400 hover:border-primary-500 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Add Checkpoint
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {template.sections.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Clipboard size={48} className="mx-auto mb-4 opacity-30" />
            <p>No sections yet. Click "Add Section" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomComplianceTemplateEditor;
