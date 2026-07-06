/**
 * KPICreateModal
 *
 * Modal for creating KPIs for initiatives in the Benefits module.
 */

import { DollarSign, Loader2, Target, TrendingUp, Users, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

export type KPICategory = 'FINANCIAL' | 'OPERATIONAL' | 'STRATEGIC' | 'CUSTOMER' | 'EMPLOYEE';
export type MeasurementFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface KPIFormData {
  name: string;
  description: string;
  category: KPICategory;
  unit: string;
  baselineValue: number;
  targetValue: number;
  measurementFrequency: MeasurementFrequency;
  dataSource: string;
  ownerId: string;
}

interface KPICreateModalProps {
  initiativeId: string;
  initiativeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================
// CATEGORY CONFIG
// ============================================

const CATEGORY_CONFIG: Record<
  KPICategory,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  FINANCIAL: {
    label: 'Financial',
    icon: <DollarSign size={20} />,
    color: 'emerald',
    description: 'Cost savings, revenue, margins',
  },
  OPERATIONAL: {
    label: 'Operational',
    icon: <Zap size={20} />,
    color: 'cyan',
    description: 'Efficiency, quality, speed',
  },
  STRATEGIC: {
    label: 'Strategic',
    icon: <Target size={20} />,
    color: 'purple',
    description: 'Market position, capabilities',
  },
  CUSTOMER: {
    label: 'Customer',
    icon: <Users size={20} />,
    color: 'blue',
    description: 'Satisfaction, retention, NPS',
  },
  EMPLOYEE: {
    label: 'Employee',
    icon: <TrendingUp size={20} />,
    color: 'amber',
    description: 'Engagement, productivity',
  },
};

const FREQUENCY_OPTIONS: { value: MeasurementFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const COMMON_UNITS = ['%', 'PLN', 'USD', 'hours', 'days', 'count', 'score', 'NPS'];

// ============================================
// MAIN COMPONENT
// ============================================

export const KPICreateModal: React.FC<KPICreateModalProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<KPIFormData>({
    name: '',
    description: '',
    category: 'OPERATIONAL',
    unit: '%',
    baselineValue: 0,
    targetValue: 0,
    measurementFrequency: 'MONTHLY',
    dataSource: '',
    ownerId: '',
  });

  const updateField = <K extends keyof KPIFormData>(field: K, value: KPIFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('KPI name is required');
      return;
    }
    if (formData.baselineValue === formData.targetValue) {
      toast.error('Target must be different from baseline');
      return;
    }

    setIsSubmitting(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/kpis`, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        baselineValue: formData.baselineValue,
        targetValue: formData.targetValue,
        latestValue: formData.baselineValue,
        measurementFrequency: formData.measurementFrequency,
        dataSource: formData.dataSource,
        ownerId: formData.ownerId || undefined,
      });

      toast.success('KPI created successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[KPICreateModal] Submit error:', error);
      toast.error(error.message || 'Failed to create KPI');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.category !== null;
    if (step === 2) return formData.name.trim().length > 0;
    return true;
  };

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <h2 className="text-lg font-semibold text-c-text dark:text-white">Add KPI</h2>
            <p className="text-sm text-c-text-muted dark:text-c-text-muted">{initiativeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-c-text-muted dark:text-c-text-muted hover:text-c-text dark:hover:text-white hover:bg-c-surface-raised dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s
                      ? 'bg-blue-500 text-white'
                      : 'bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 ${step > s ? 'bg-blue-500' : 'bg-c-surface-raised dark:bg-c-surface-raised'}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-c-text-muted">
            <span>Category</span>
            <span>Details</span>
            <span>Values</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-c-text-muted dark:text-c-text-muted mb-4">
                Select the category for this KPI
              </p>
              {(
                Object.entries(CATEGORY_CONFIG) as [
                  KPICategory,
                  (typeof CATEGORY_CONFIG)[KPICategory],
                ][]
              ).map(([key, config]) => {
                const colorClasses: Record<string, string> = {
                  emerald: 'border-emerald-500 bg-emerald-500/10',
                  cyan: 'border-blue-500 bg-blue-500/10',
                  purple: 'border-violet-500 bg-violet-500/10',
                  blue: 'border-blue-500 bg-blue-500/10',
                  amber: 'border-amber-500 bg-amber-500/10',
                };

                return (
                  <button
                    key={key}
                    onClick={() => updateField('category', key)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      formData.category === key
                        ? colorClasses[config.color]
                        : 'border-c-border-subtle dark:border-c-border-subtle hover:border-c-border-strong dark:hover:border-c-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          formData.category === key
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-c-surface-raised text-c-text-secondary'
                        }`}
                      >
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-medium text-c-text dark:text-white">{config.label}</p>
                        <p className="text-xs text-c-text-muted dark:text-c-text-muted">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                  KPI Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Process Cycle Time Reduction"
                  className="w-full px-4 py-3 bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-lg text-c-text dark:text-white text-sm placeholder:text-c-text-muted focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Describe what this KPI measures..."
                  rows={3}
                  className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle rounded-lg text-white text-sm placeholder:text-c-text-muted focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                  Unit of Measurement
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_UNITS.map((unit) => (
                    <button
                      key={unit}
                      onClick={() => updateField('unit', unit)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.unit === unit
                          ? 'bg-blue-500 text-white'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                  Measurement Frequency
                </label>
                <div className="flex gap-2">
                  {FREQUENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateField('measurementFrequency', option.value)}
                      className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                        formData.measurementFrequency === option.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Values */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                    Baseline Value
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.baselineValue}
                      onChange={(e) =>
                        updateField('baselineValue', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-c-text-muted">
                      {formData.unit}
                    </span>
                  </div>
                  <p className="text-xs text-c-text-muted mt-1">Current/starting value</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                    Target Value
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.targetValue}
                      onChange={(e) => updateField('targetValue', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-c-text-muted">
                      {formData.unit}
                    </span>
                  </div>
                  <p className="text-xs text-c-text-muted mt-1">Goal to achieve</p>
                </div>
              </div>

              {formData.targetValue !== formData.baselineValue && (
                <div className="p-4 bg-c-surface-raised rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-c-text-muted dark:text-c-text-muted">
                      Expected improvement
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        formData.targetValue > formData.baselineValue
                          ? 'text-green-400'
                          : 'text-danger-400'
                      }`}
                    >
                      {formData.targetValue > formData.baselineValue ? '+' : ''}
                      {formData.baselineValue !== 0
                        ? (
                            ((formData.targetValue - formData.baselineValue) /
                              formData.baselineValue) *
                            100
                          ).toFixed(0)
                        : formData.targetValue}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised dark:bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-c-surface-raised to-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.abs((formData.targetValue / Math.max(formData.baselineValue, formData.targetValue)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-c-text-muted dark:text-c-text-muted mb-2">
                  Data Source (optional)
                </label>
                <input
                  type="text"
                  value={formData.dataSource}
                  onChange={(e) => updateField('dataSource', e.target.value)}
                  placeholder="e.g., ERP System, Manual Entry, API..."
                  className="w-full px-4 py-3 bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-lg text-c-text dark:text-white text-sm placeholder:text-c-text-muted focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-c-border-subtle dark:border-c-border-subtle">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-sm text-c-text-muted dark:text-c-text-muted hover:text-c-text dark:hover:text-white transition-colors"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised dark:disabled:bg-c-surface-raised disabled:text-c-text-muted text-white text-sm font-medium rounded-lg transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised dark:disabled:bg-c-surface-raised disabled:text-c-text-muted text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Create KPI
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPICreateModal;
