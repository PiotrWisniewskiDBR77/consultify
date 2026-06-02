/**
 * ChangeRequestModal Component
 *
 * PMO Scope Change Control
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Change Control (Clause 4.4.2)
 * - PMI PMBOK 7th Edition - Change Request / Change Control Board
 * - PRINCE2 - Issue and Change Control
 *
 * PMO Domain: SCOPE_CHANGE_CONTROL
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

export type ChangeCategory = 'SCOPE' | 'SCHEDULE' | 'BUDGET' | 'QUALITY' | 'RESOURCE' | 'RISK';
export type ChangePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ChangeImpact = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface ChangeRequest {
  id?: string;
  title: string;
  description: string;
  category: ChangeCategory;
  priority: ChangePriority;
  impact: ChangeImpact;
  justification: string;
  alternatives?: string;
  impactOnSchedule?: string;
  impactOnBudget?: string;
  impactOnScope?: string;
  impactOnQuality?: string;
  linkedInitiativeId?: string;
  requestedBy?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}

interface ChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: ChangeRequest) => void;
  initiatives?: Array<{ id: string; name: string }>;
  editingRequest?: ChangeRequest | null;
}

const CATEGORY_CONFIG: Record<
  ChangeCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  SCOPE: { label: 'Scope Change', icon: FileText, color: 'text-blue-500' },
  SCHEDULE: { label: 'Schedule Change', icon: Clock, color: 'text-amber-500' },
  BUDGET: { label: 'Budget Change', icon: DollarSign, color: 'text-green-500' },
  QUALITY: { label: 'Quality Change', icon: CheckCircle2, color: 'text-primary-500' },
  RESOURCE: { label: 'Resource Change', icon: Users, color: 'text-blue-500' },
  RISK: { label: 'Risk Response', icon: AlertTriangle, color: 'text-rose-500' },
};

export const ChangeRequestModal: React.FC<ChangeRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initiatives = [],
  editingRequest,
}) => {
  const [formData, setFormData] = useState<ChangeRequest>({
    title: editingRequest?.title || '',
    description: editingRequest?.description || '',
    category: editingRequest?.category || 'SCOPE',
    priority: editingRequest?.priority || 'MEDIUM',
    impact: editingRequest?.impact || 'MODERATE',
    justification: editingRequest?.justification || '',
    alternatives: editingRequest?.alternatives || '',
    impactOnSchedule: editingRequest?.impactOnSchedule || '',
    impactOnBudget: editingRequest?.impactOnBudget || '',
    impactOnScope: editingRequest?.impactOnScope || '',
    linkedInitiativeId: editingRequest?.linkedInitiativeId || '',
  });

  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      status: 'SUBMITTED',
    });
    onClose();
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
          Change Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Brief title for this change request"
          className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
          Category *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            Object.entries(CATEGORY_CONFIG) as [ChangeCategory, typeof CATEGORY_CONFIG.SCOPE][]
          ).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFormData({ ...formData, category: key })}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  formData.category === key
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                    : 'border-slate-200 dark:border-navy-700 hover:border-primary-300'
                }`}
              >
                <Icon size={20} className={config.color} />
                <span className="text-xs font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            Priority *
          </label>
          <select
            value={formData.priority}
            onChange={(e) =>
              setFormData({ ...formData, priority: e.target.value as ChangePriority })
            }
            className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="CRITICAL">Critical - Immediate Action</option>
            <option value="HIGH">High - This Week</option>
            <option value="MEDIUM">Medium - This Sprint</option>
            <option value="LOW">Low - When Convenient</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            Impact Level *
          </label>
          <select
            value={formData.impact}
            onChange={(e) => setFormData({ ...formData, impact: e.target.value as ChangeImpact })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="MAJOR">Major - Significant Impact</option>
            <option value="MODERATE">Moderate - Some Impact</option>
            <option value="MINOR">Minor - Minimal Impact</option>
          </select>
        </div>
      </div>

      {initiatives.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            Linked Initiative
          </label>
          <select
            value={formData.linkedInitiativeId}
            onChange={(e) => setFormData({ ...formData, linkedInitiativeId: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select an initiative...</option>
            {initiatives.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
          Description *
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed description of the proposed change..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
          Business Justification *
        </label>
        <textarea
          value={formData.justification}
          onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
          placeholder="Why is this change necessary? What problem does it solve?"
          rows={3}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
          Alternatives Considered
        </label>
        <textarea
          value={formData.alternatives}
          onChange={(e) => setFormData({ ...formData, alternatives: e.target.value })}
          placeholder="What alternatives were considered and why were they rejected?"
          rows={2}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl">
        <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
          <AlertTriangle size={16} />
          Impact Analysis
        </h4>
        <p className="text-sm text-amber-700 dark:text-amber-400/80">
          Describe how this change will impact different aspects of the project.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2 flex items-center gap-2">
            <Clock size={14} className="text-amber-500" />
            Schedule Impact
          </label>
          <textarea
            value={formData.impactOnSchedule}
            onChange={(e) => setFormData({ ...formData, impactOnSchedule: e.target.value })}
            placeholder="e.g., +2 weeks to Phase 2"
            rows={2}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2 flex items-center gap-2">
            <DollarSign size={14} className="text-green-500" />
            Budget Impact
          </label>
          <textarea
            value={formData.impactOnBudget}
            onChange={(e) => setFormData({ ...formData, impactOnBudget: e.target.value })}
            placeholder="e.g., +50,000 PLN"
            rows={2}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2 flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          Scope Impact
        </label>
        <textarea
          value={formData.impactOnScope}
          onChange={(e) => setFormData({ ...formData, impactOnScope: e.target.value })}
          placeholder="What deliverables or features are added/removed?"
          rows={2}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
              {editingRequest ? 'Edit Change Request' : 'New Change Request'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Step {step} of 3:{' '}
              {step === 1 ? 'Basic Info' : step === 2 ? 'Details' : 'Impact Analysis'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-navy-950">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  s <= step ? 'bg-primary-500' : 'bg-slate-200 dark:bg-navy-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex justify-between">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg text-sm font-medium transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }
            }}
            disabled={
              !formData.title || (step === 2 && (!formData.description || !formData.justification))
            }
            className="px-6 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {step === 3 ? 'Submit Request' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
