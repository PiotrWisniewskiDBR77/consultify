/**
 * Financial Input Form Component
 *
 * Form for entering costs, benefits, and time parameters for financial analysis.
 * Designed for minimalist, enterprise-grade UX.
 */

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Info,
  RefreshCw,
  Save,
  Settings,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

// Types
interface FinancialData {
  // Costs
  initialInvestment: number;
  implementationCost: number;
  annualOperatingCost: number;
  trainingCost: number;
  contingencyPercent: number;

  // Benefits
  annualCostSavings: number;
  annualRevenueIncrease: number;
  productivityGainsPercent: number;
  riskReductionValue: number;

  // Time Parameters
  implementationMonths: number;
  benefitRealizationMonths: number;
  analysisHorizonYears: number;
  discountRate: number;

  // Metadata
  currency: string;
  assumptions: string[];
}

interface FinancialInputFormProps {
  initialData?: Partial<FinancialData>;
  onSave: (data: FinancialData) => Promise<void>;
  onCalculate?: (data: FinancialData) => void;
  isLoading?: boolean;
  readOnly?: boolean;
  currency?: string;
}

const defaultData: FinancialData = {
  initialInvestment: 0,
  implementationCost: 0,
  annualOperatingCost: 0,
  trainingCost: 0,
  contingencyPercent: 15,
  annualCostSavings: 0,
  annualRevenueIncrease: 0,
  productivityGainsPercent: 0,
  riskReductionValue: 0,
  implementationMonths: 12,
  benefitRealizationMonths: 6,
  analysisHorizonYears: 5,
  discountRate: 10,
  currency: 'PLN',
  assumptions: [],
};

export const FinancialInputForm: React.FC<FinancialInputFormProps> = ({
  initialData,
  onSave,
  onCalculate,
  isLoading = false,
  readOnly = false,
  currency = 'PLN',
}) => {
  const [formData, setFormData] = useState<FinancialData>({
    ...defaultData,
    ...initialData,
    currency,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    costs: true,
    benefits: true,
    time: true,
    assumptions: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newAssumption, setNewAssumption] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = useCallback(
    (field: keyof FinancialData, value: number | string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));

      // Trigger live calculation if available
      if (onCalculate) {
        const newData = { ...formData, [field]: value };
        onCalculate(newData);
      }
    },
    [formData, onCalculate]
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.initialInvestment < 0) {
      newErrors.initialInvestment = 'Cannot be negative';
    }
    if (formData.discountRate < 0 || formData.discountRate > 50) {
      newErrors.discountRate = 'Must be between 0% and 50%';
    }
    if (formData.analysisHorizonYears < 1 || formData.analysisHorizonYears > 20) {
      newErrors.analysisHorizonYears = 'Must be between 1 and 20 years';
    }
    if (formData.contingencyPercent < 0 || formData.contingencyPercent > 50) {
      newErrors.contingencyPercent = 'Must be between 0% and 50%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const addAssumption = () => {
    if (!newAssumption.trim()) return;
    setFormData((prev) => ({
      ...prev,
      assumptions: [...prev.assumptions, newAssumption.trim()],
    }));
    setNewAssumption('');
  };

  const removeAssumption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      assumptions: prev.assumptions.filter((_, i) => i !== index),
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: formData.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const InputField: React.FC<{
    label: string;
    field: keyof FinancialData;
    type?: 'currency' | 'percent' | 'number';
    hint?: string;
    min?: number;
    max?: number;
  }> = ({ label, field, type = 'currency', hint, min, max }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        {type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">
            {currency}
          </span>
        )}
        <input
          type="number"
          value={formData[field] as number}
          onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
          disabled={readOnly || isLoading}
          min={min}
          max={max}
          className={`w-full px-3 py-2 ${type === 'currency' ? 'pl-12' : ''} ${type === 'percent' ? 'pr-8' : ''} 
                        bg-white dark:bg-navy-800 border rounded-lg text-right
                        ${
                          errors[field]
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-200 dark:border-navy-700 focus:ring-blue-500'
                        }
                        focus:outline-none focus:ring-2 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        text-navy-900 dark:text-white`}
        />
        {type === 'percent' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">
            %
          </span>
        )}
      </div>
      {errors[field] && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {errors[field]}
        </p>
      )}
      {hint && !errors[field] && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Info size={12} /> {hint}
        </p>
      )}
    </div>
  );

  const SectionHeader: React.FC<{
    title: string;
    icon: React.ReactNode;
    section: string;
    summary?: string;
  }> = ({ title, icon, section, summary }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-navy-900 dark:text-white">{title}</h3>
          {summary && !expandedSections[section] && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{summary}</p>
          )}
        </div>
      </div>
      {expandedSections[section] ? (
        <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
      ) : (
        <ChevronDown size={20} className="text-slate-400 dark:text-slate-500" />
      )}
    </button>
  );

  const totalInvestment =
    formData.initialInvestment + formData.implementationCost + formData.trainingCost;
  const totalAnnualBenefits =
    formData.annualCostSavings + formData.annualRevenueIncrease + formData.riskReductionValue;

  return (
    <div className="space-y-4">
      {/* Cost Section */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <SectionHeader
          title="Costs"
          icon={<DollarSign size={18} />}
          section="costs"
          summary={`Total investment: ${formatCurrency(totalInvestment)}`}
        />
        {expandedSections.costs && (
          <div className="p-4 border-t border-slate-100 dark:border-navy-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Initial Investment"
                field="initialInvestment"
                hint="Equipment and license purchase cost"
              />
              <InputField
                label="Implementation Costs"
                field="implementationCost"
                hint="Consulting services, integration"
              />
              <InputField
                label="Roczne costs operacyjne"
                field="annualOperatingCost"
                hint="Utrzymanie, wsparcie, licencje"
              />
              <InputField label="Training Costs" field="trainingCost" hint="User training" />
            </div>
            <InputField
              label="Rezerwa na nieprzewidziane wydatki"
              field="contingencyPercent"
              type="percent"
              hint="Typically 10-20% of total budget"
              min={0}
              max={50}
            />
            <div className="pt-2 border-t border-slate-100 dark:border-navy-700">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Total initial investment:
                </span>
                <span className="font-semibold text-navy-900 dark:text-white">
                  {formatCurrency(totalInvestment)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Benefits Section */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <SectionHeader
          title="Benefits"
          icon={<TrendingUp size={18} />}
          section="benefits"
          summary={`Roczne benefits: ${formatCurrency(totalAnnualBenefits)}`}
        />
        {expandedSections.benefits && (
          <div className="p-4 border-t border-slate-100 dark:border-navy-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Annual Savings costs"
                field="annualCostSavings"
                hint="Redukcja costs operacyjnych"
              />
              <InputField
                label="Annual revenue increase"
                field="annualRevenueIncrease"
                hint="Dodatkowe przychody"
              />
              <InputField
                label="Wzrost produktywns"
                field="productivityGainsPercent"
                type="percent"
                hint="Work efficiency improvement"
              />
              <InputField
                label="Value redukcji ryzyka"
                field="riskReductionValue"
                hint="Unikniete straty, kary"
              />
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-navy-700">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total annual benefits:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(totalAnnualBenefits)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Parameters Section */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <SectionHeader
          title="Parametry czasowe"
          icon={<Clock size={18} />}
          section="time"
          summary={`Horyzont: ${formData.analysisHorizonYears} lat, Stopa dyskontowa: ${formData.discountRate}%`}
        />
        {expandedSections.time && (
          <div className="p-4 border-t border-slate-100 dark:border-navy-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Implementation Time (months)"
                field="implementationMonths"
                type="number"
                hint="From start to full launch"
                min={1}
                max={60}
              />
              <InputField
                label="Benefits Realization Period (months)"
                field="benefitRealizationMonths"
                type="number"
                hint="From launch to full benefits"
                min={0}
                max={24}
              />
              <InputField
                label="Horyzont analysis (lata)"
                field="analysisHorizonYears"
                type="number"
                hint="Typowo 3-7 lat"
                min={1}
                max={20}
              />
              <InputField
                label="Stopa dyskontowa"
                field="discountRate"
                type="percent"
                hint="Organization's cost of capital"
                min={0}
                max={30}
              />
            </div>
          </div>
        )}
      </div>

      {/* Assumptions Section */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <SectionHeader
          title="Assumptions"
          icon={<Settings size={18} />}
          section="assumptions"
          summary={`${formData.assumptions.length} assumptions defined`}
        />
        {expandedSections.assumptions && (
          <div className="p-4 border-t border-slate-100 dark:border-navy-700 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newAssumption}
                onChange={(e) => setNewAssumption(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAssumption()}
                placeholder="Add new assumption..."
                disabled={readOnly}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg
                                    focus:outline-none focus:ring-2 focus:ring-blue-500
                                    text-navy-900 dark:text-white placeholder-slate-400"
              />
              <button
                onClick={addAssumption}
                disabled={readOnly || !newAssumption.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Dodaj
              </button>
            </div>

            {formData.assumptions.length > 0 ? (
              <ul className="space-y-2">
                {formData.assumptions.map((assumption, index) => (
                  <li
                    key={index}
                    className="flex items-start justify-between gap-2 p-3 bg-slate-50 dark:bg-navy-900 rounded-lg"
                  >
                    <span className="text-sm text-navy-900 dark:text-slate-300">
                      {index + 1}. {assumption}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeAssumption(index)}
                        className="text-red-500 hover:text-red-700 text-sm shrink-0"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                No defined assumptions. Add assumptions to increase analysis credibility.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex justify-end gap-3 pt-4">
          {onCalculate && (
            <button
              onClick={() => onCalculate(formData)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 
                                bg-slate-100 dark:bg-navy-700 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700/40 
                                dark:hover:bg-navy-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Przelicz
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg 
                            hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Zapisz analysis'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FinancialInputForm;
