/**
 * CharterBuilder
 *
 * Comprehensive initiative charter editing component.
 * Includes all charter fields: problem statement, deliverables,
 * success criteria, scope, risks, and budget.
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  Save,
  Target,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../../services/api';
import { InitiativeCompletenessChecker } from './InitiativeCompletenessChecker';

interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string;
}

interface CharterData {
  name: string;
  summary?: string;
  problemStatement?: string;
  hypothesis?: string;
  businessValue?: number | string;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  ownerBusinessId?: string;
  ownerBusiness?: Owner;
  ownerExecutionId?: string;
  ownerExecution?: Owner;
  deliverables?: string[];
  successCriteria?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  keyRisks?: string[];
}

interface CharterBuilderProps {
  initiativeId: string;
  initialData: CharterData;
  users?: { id: string; firstName: string; lastName: string }[];
  onSave?: (data: CharterData) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const CharterBuilder: React.FC<CharterBuilderProps> = ({
  initiativeId,
  initialData,
  users = [],
  onSave,
  onCancel,
  readOnly = false,
}) => {
  const [formData, setFormData] = useState<CharterData>({
    ...initialData,
    deliverables: initialData.deliverables || [],
    successCriteria: initialData.successCriteria || [],
    scopeIn: initialData.scopeIn || [],
    scopeOut: initialData.scopeOut || [],
    keyRisks: initialData.keyRisks || [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');

  // Update field
  const updateField = <K extends keyof CharterData>(field: K, value: CharterData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Add item to array field
  const addToArray = (
    field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut' | 'keyRisks'
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }));
  };

  // Update array item
  const updateArrayItem = (
    field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut' | 'keyRisks',
    index: number,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).map((item, i) => (i === index ? value : item)),
    }));
  };

  // Remove array item
  const removeArrayItem = (
    field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut' | 'keyRisks',
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  // Save charter
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Clean up empty array items
      const cleanedData = {
        ...formData,
        deliverables: (formData.deliverables || []).filter((d) => d.trim()),
        successCriteria: (formData.successCriteria || []).filter((s) => s.trim()),
        scopeIn: (formData.scopeIn || []).filter((s) => s.trim()),
        scopeOut: (formData.scopeOut || []).filter((s) => s.trim()),
        keyRisks: (formData.keyRisks || []).filter((r) => r.trim()),
      };

      await Api.put(`/initiatives/${initiativeId}`, cleanedData);
      toast.success('Charter saved');
      onSave?.(cleanedData);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: <FileText size={16} /> },
    { id: 'deliverables', label: 'Deliverables', icon: <ListChecks size={16} /> },
    { id: 'success', label: 'Success Criteria', icon: <Target size={16} /> },
    { id: 'scope', label: 'Scope', icon: <CheckCircle2 size={16} /> },
    { id: 'risks', label: 'Risks', icon: <AlertTriangle size={16} /> },
    { id: 'budget', label: 'Budget & Timeline', icon: <DollarSign size={16} /> },
    { id: 'owners', label: 'Owners', icon: <User size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header with completeness */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-navy-900 dark:text-white">Initiative Charter</h2>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          )}
        </div>
        <InitiativeCompletenessChecker initiative={formData} />
      </div>

      {/* Section Navigation */}
      <div className="shrink-0 px-6 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 overflow-x-auto">
        <div className="flex items-center gap-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeSection === section.id
                  ? 'bg-navy-900 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Initiative Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Summary / Description *
              </label>
              <textarea
                value={formData.summary || ''}
                onChange={(e) => updateField('summary', e.target.value)}
                rows={3}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Problem Statement *
              </label>
              <textarea
                value={formData.problemStatement || ''}
                onChange={(e) => updateField('problemStatement', e.target.value)}
                rows={4}
                disabled={readOnly}
                placeholder="What problem does this initiative solve?"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hypothesis / Solution *
              </label>
              <textarea
                value={formData.hypothesis || ''}
                onChange={(e) => updateField('hypothesis', e.target.value)}
                rows={3}
                disabled={readOnly}
                placeholder="How will this initiative solve the problem?"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {/* Deliverables Section */}
        {activeSection === 'deliverables' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-navy-900 dark:text-white">Deliverables</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  What tangible outputs will this initiative produce?
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => addToArray('deliverables')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                >
                  <Plus size={14} />
                  Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(formData.deliverables || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateArrayItem('deliverables', index, e.target.value)}
                    disabled={readOnly}
                    placeholder={`Deliverable ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => removeArrayItem('deliverables', index)}
                      className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>
              ))}
              {(formData.deliverables || []).length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-500 py-4 text-center">
                  No deliverables defined
                </p>
              )}
            </div>
          </div>
        )}

        {/* Success Criteria Section */}
        {activeSection === 'success' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-navy-900 dark:text-white">Success Criteria</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  How will success be measured?
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => addToArray('successCriteria')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                >
                  <Plus size={14} />
                  Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(formData.successCriteria || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateArrayItem('successCriteria', index, e.target.value)}
                    disabled={readOnly}
                    placeholder={`Criterion ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => removeArrayItem('successCriteria', index)}
                      className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>
              ))}
              {(formData.successCriteria || []).length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-500 py-4 text-center">
                  No success criteria defined
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scope Section */}
        {activeSection === 'scope' && (
          <div className="max-w-2xl space-y-6">
            {/* Scope In */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-navy-900 dark:text-white text-green-700 dark:text-green-400">
                    In Scope
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    What is included in this initiative?
                  </p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => addToArray('scopeIn')}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(formData.scopeIn || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateArrayItem('scopeIn', index, e.target.value)}
                      disabled={readOnly}
                      className="flex-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                    />
                    {!readOnly && (
                      <button
                        onClick={() => removeArrayItem('scopeIn', index)}
                        className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scope Out */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-danger-700 dark:text-danger-400">Out of Scope</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    What is explicitly excluded?
                  </p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => addToArray('scopeOut')}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(formData.scopeOut || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <X size={16} className="text-danger-500 shrink-0" />
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateArrayItem('scopeOut', index, e.target.value)}
                      disabled={readOnly}
                      className="flex-1 px-3 py-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/20 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                    />
                    {!readOnly && (
                      <button
                        onClick={() => removeArrayItem('scopeOut', index)}
                        className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Risks Section */}
        {activeSection === 'risks' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-navy-900 dark:text-white">Key Risks</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">What could go wrong?</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => addToArray('keyRisks')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"
                >
                  <Plus size={14} />
                  Add Risk
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(formData.keyRisks || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateArrayItem('keyRisks', index, e.target.value)}
                    disabled={readOnly}
                    placeholder={`Risk ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/20 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => removeArrayItem('keyRisks', index)}
                      className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>
              ))}
              {(formData.keyRisks || []).length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-500 py-4 text-center">
                  No risks identified
                </p>
              )}
            </div>
          </div>
        )}

        {/* Budget & Timeline Section */}
        {activeSection === 'budget' && (
          <div className="max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Business Value (PLN) *
                </label>
                <input
                  type="number"
                  value={formData.businessValue || ''}
                  onChange={(e) =>
                    updateField(
                      'businessValue',
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected ROI (%)
                </label>
                <input
                  type="number"
                  value={formData.expectedRoi || ''}
                  onChange={(e) =>
                    updateField(
                      'expectedRoi',
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CAPEX (PLN)
                </label>
                <input
                  type="number"
                  value={formData.costCapex || ''}
                  onChange={(e) =>
                    updateField(
                      'costCapex',
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  OPEX Annual (PLN)
                </label>
                <input
                  type="number"
                  value={formData.costOpex || ''}
                  onChange={(e) =>
                    updateField('costOpex', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Planned Start Date
                </label>
                <input
                  type="date"
                  value={formData.plannedStartDate?.split('T')[0] || ''}
                  onChange={(e) => updateField('plannedStartDate', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Planned End Date
                </label>
                <input
                  type="date"
                  value={formData.plannedEndDate?.split('T')[0] || ''}
                  onChange={(e) => updateField('plannedEndDate', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )}

        {/* Owners Section */}
        {activeSection === 'owners' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Business Owner *
              </label>
              <select
                value={formData.ownerBusinessId || ''}
                onChange={(e) => updateField('ownerBusinessId', e.target.value || undefined)}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              >
                <option value="">Select Business Owner</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Person accountable for business outcomes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Execution Owner
              </label>
              <select
                value={formData.ownerExecutionId || ''}
                onChange={(e) => updateField('ownerExecutionId', e.target.value || undefined)}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white disabled:opacity-60"
              >
                <option value="">Select Execution Owner</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Person responsible for delivery
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharterBuilder;
