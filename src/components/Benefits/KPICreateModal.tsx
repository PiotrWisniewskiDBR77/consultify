/**
 * KPICreateModal
 * 
 * Full form for KPI definition with category selection,
 * target/baseline input, and measurement frequency.
 * 
 * Features:
 * - Category selection with icons
 * - Target vs baseline input with validation
 * - Measurement frequency selector
 * - Owner assignment
 * - Data source configuration
 */

import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  DollarSign,
  Loader2,
  Target,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

interface KPICreateModalProps {
  initiativeId: string;
  initiativeName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface KPIFormData {
  name: string;
  description: string;
  category: KPICategory;
  unit: string;
  baselineValue: string;
  targetValue: string;
  measurementFrequency: MeasurementFrequency;
  dataSource: string;
  ownerId: string;
}

type KPICategory = 'FINANCIAL' | 'OPERATIONAL' | 'STRATEGIC' | 'CUSTOMER' | 'EMPLOYEE';
type MeasurementFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

// ============================================
// CONSTANTS
// ============================================

const CATEGORIES: { id: KPICategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'FINANCIAL', label: 'Financial', icon: <DollarSign size={18} />, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { id: 'OPERATIONAL', label: 'Operational', icon: <Activity size={18} />, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { id: 'STRATEGIC', label: 'Strategic', icon: <Target size={18} />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'CUSTOMER', label: 'Customer', icon: <Users size={18} />, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'EMPLOYEE', label: 'Employee', icon: <User size={18} />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
];

const FREQUENCIES: { id: MeasurementFrequency; label: string }[] = [
  { id: 'DAILY', label: 'Daily' },
  { id: 'WEEKLY', label: 'Weekly' },
  { id: 'MONTHLY', label: 'Monthly' },
  { id: 'QUARTERLY', label: 'Quarterly' },
];

const COMMON_UNITS = ['%', 'PLN', 'USD', 'EUR', 'hours', 'days', 'count', 'score', 'NPS'];

// ============================================
// MAIN COMPONENT
// ============================================

export const KPICreateModal: React.FC<KPICreateModalProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState<KPIFormData>({
    name: '',
    description: '',
    category: 'FINANCIAL',
    unit: '%',
    baselineValue: '',
    targetValue: '',
    measurementFrequency: 'MONTHLY',
    dataSource: '',
    ownerId: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof KPIFormData, string>>>({});

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: typeof errors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'KPI name is required';
    }
    
    if (!formData.baselineValue.trim()) {
      newErrors.baselineValue = 'Baseline value is required';
    } else if (isNaN(Number(formData.baselineValue))) {
      newErrors.baselineValue = 'Must be a valid number';
    }
    
    if (!formData.targetValue.trim()) {
      newErrors.targetValue = 'Target value is required';
    } else if (isNaN(Number(formData.targetValue))) {
      newErrors.targetValue = 'Must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle input change
  const handleChange = useCallback((field: keyof KPIFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/kpis`, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        unit: formData.unit,
        baselineValue: Number(formData.baselineValue),
        targetValue: Number(formData.targetValue),
        measurementFrequency: formData.measurementFrequency,
        dataSource: formData.dataSource.trim() || undefined,
        ownerId: formData.ownerId || undefined,
      });
      
      toast.success('KPI created successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('[KPICreateModal] Failed to create KPI:', error);
      toast.error('Failed to create KPI');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, initiativeId, validateForm, onSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Create KPI</h2>
            <p className="text-sm text-slate-400 mt-0.5">For: {initiativeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              KPI Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Customer Satisfaction Score"
              className={`w-full px-3 py-2 bg-navy-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                errors.name ? 'border-red-500' : 'border-navy-700'
              }`}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what this KPI measures..."
              rows={2}
              className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleChange('category', cat.id)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    formData.category === cat.id
                      ? cat.color
                      : 'bg-navy-800 border-navy-700 text-slate-400 hover:border-navy-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {cat.icon}
                    <span className="text-xs">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Baseline & Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">
                Baseline Value <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.baselineValue}
                onChange={(e) => handleChange('baselineValue', e.target.value)}
                placeholder="0"
                className={`w-full px-3 py-2 bg-navy-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                  errors.baselineValue ? 'border-red-500' : 'border-navy-700'
                }`}
              />
              {errors.baselineValue && <p className="text-xs text-red-400 mt-1">{errors.baselineValue}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">
                Target Value <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.targetValue}
                onChange={(e) => handleChange('targetValue', e.target.value)}
                placeholder="100"
                className={`w-full px-3 py-2 bg-navy-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                  errors.targetValue ? 'border-red-500' : 'border-navy-700'
                }`}
              />
              {errors.targetValue && <p className="text-xs text-red-400 mt-1">{errors.targetValue}</p>}
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Unit of Measurement
            </label>
            <div className="flex gap-2">
              <select
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="flex-1 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {COMMON_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                placeholder="Custom unit"
                className="w-32 px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Measurement Frequency */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Measurement Frequency
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq.id}
                  type="button"
                  onClick={() => handleChange('measurementFrequency', freq.id)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    formData.measurementFrequency === freq.id
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-navy-800 border-navy-700 text-slate-400 hover:border-navy-600'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Data Source
            </label>
            <input
              type="text"
              value={formData.dataSource}
              onChange={(e) => handleChange('dataSource', e.target.value)}
              placeholder="e.g., CRM System, Survey, Financial Report"
              className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Preview */}
          {formData.name && formData.baselineValue && formData.targetValue && (
            <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
              <div className="text-xs text-slate-500 mb-2">Preview</div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{formData.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {CATEGORIES.find((c) => c.id === formData.category)?.label} • {formData.measurementFrequency.toLowerCase()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Target</div>
                  <div className="text-lg font-bold text-cyan-400">
                    {formData.targetValue} {formData.unit}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (Number(formData.baselineValue) / Number(formData.targetValue)) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>Baseline: {formData.baselineValue} {formData.unit}</span>
                <span>Target: {formData.targetValue} {formData.unit}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-navy-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Create KPI
          </button>
        </div>
      </div>
    </div>
  );
};

export default KPICreateModal;
