/**
 * InitiativeCompletenessChecker
 *
 * Shows charter completeness progress and missing fields.
 * Used in Initiative cards and detail modals.
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  DollarSign,
  FileText,
  ListChecks,
  Target,
  User,
} from 'lucide-react';
import React from 'react';

interface FieldStatus {
  field: string;
  label: string;
  icon: React.ReactNode;
  weight: number;
  isFilled: boolean;
  isRequired: boolean;
}

interface InitiativeCompletenessCheckerProps {
  initiative: {
    name?: string;
    summary?: string;
    problemStatement?: string;
    hypothesis?: string;
    businessValue?: string | number;
    costCapex?: number;
    costOpex?: number;
    expectedRoi?: number;
    ownerBusinessId?: string;
    ownerBusiness?: any;
    ownerExecutionId?: string;
    ownerExecution?: any;
    plannedStartDate?: string;
    plannedEndDate?: string;
    deliverables?: string[];
    successCriteria?: string[];
    keyRisks?: string[];
    /**
     * Backend-computed charter completeness (0-100), e.g. Assessment →
     * Initiatives table. When present it is AUTHORITATIVE and used verbatim
     * for the bar/%/color instead of the field-by-field recompute below.
     *
     * Bug fixed 2026-08-13 (MPQ odbiór): the recompute walks a fixed set of
     * ~15 charter fields (problemStatement/hypothesis/businessValue weigh 35
     * of 110 points). Callers that only pass the summary fields already
     * visible in a list row (no full charter form data) always landed under
     * the 40% threshold, so the bar rendered `bg-danger-500` for EVERY row
     * regardless of the real completeness — the color logic itself was
     * already correct, but the completeness number feeding it was wrong.
     */
    charterCompleteness?: number;
  };
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

const calculateFieldStatuses = (
  initiative: InitiativeCompletenessCheckerProps['initiative']
): FieldStatus[] => {
  const fields: FieldStatus[] = [
    {
      field: 'name',
      label: 'Initiative Name',
      icon: <FileText size={14} />,
      weight: 10,
      isFilled: !!initiative.name,
      isRequired: true,
    },
    {
      field: 'summary',
      label: 'Summary / Description',
      icon: <FileText size={14} />,
      weight: 10,
      isFilled: !!initiative.summary,
      isRequired: true,
    },
    {
      field: 'problemStatement',
      label: 'Problem Statement',
      icon: <AlertCircle size={14} />,
      weight: 15,
      isFilled: !!initiative.problemStatement,
      isRequired: true,
    },
    {
      field: 'hypothesis',
      label: 'Hypothesis / Solution',
      icon: <Target size={14} />,
      weight: 10,
      isFilled: !!initiative.hypothesis,
      isRequired: true,
    },
    {
      field: 'businessValue',
      label: 'Business Value',
      icon: <DollarSign size={14} />,
      weight: 10,
      isFilled: !!initiative.businessValue && initiative.businessValue !== 0,
      isRequired: true,
    },
    {
      field: 'costCapex',
      label: 'CAPEX Budget',
      icon: <DollarSign size={14} />,
      weight: 5,
      isFilled: initiative.costCapex !== undefined && initiative.costCapex !== null,
      isRequired: false,
    },
    {
      field: 'costOpex',
      label: 'OPEX Budget',
      icon: <DollarSign size={14} />,
      weight: 5,
      isFilled: initiative.costOpex !== undefined && initiative.costOpex !== null,
      isRequired: false,
    },
    {
      field: 'expectedRoi',
      label: 'Expected ROI',
      icon: <Target size={14} />,
      weight: 5,
      isFilled: initiative.expectedRoi !== undefined && initiative.expectedRoi !== null,
      isRequired: false,
    },
    {
      field: 'ownerBusiness',
      label: 'Business Owner',
      icon: <User size={14} />,
      weight: 10,
      isFilled: !!(initiative.ownerBusinessId || initiative.ownerBusiness),
      isRequired: true,
    },
    {
      field: 'ownerExecution',
      label: 'Execution Owner',
      icon: <User size={14} />,
      weight: 5,
      isFilled: !!(initiative.ownerExecutionId || initiative.ownerExecution),
      isRequired: false,
    },
    {
      field: 'plannedStartDate',
      label: 'Planned Start Date',
      icon: <Calendar size={14} />,
      weight: 5,
      isFilled: !!initiative.plannedStartDate,
      isRequired: false,
    },
    {
      field: 'plannedEndDate',
      label: 'Planned End Date',
      icon: <Calendar size={14} />,
      weight: 5,
      isFilled: !!initiative.plannedEndDate,
      isRequired: false,
    },
    {
      field: 'deliverables',
      label: 'Deliverables',
      icon: <ListChecks size={14} />,
      weight: 5,
      isFilled: Array.isArray(initiative.deliverables) && initiative.deliverables.length > 0,
      isRequired: false,
    },
    {
      field: 'successCriteria',
      label: 'Success Criteria',
      icon: <CheckCircle2 size={14} />,
      weight: 5,
      isFilled: Array.isArray(initiative.successCriteria) && initiative.successCriteria.length > 0,
      isRequired: false,
    },
    {
      field: 'keyRisks',
      label: 'Key Risks',
      icon: <AlertTriangle size={14} />,
      weight: 5,
      isFilled: Array.isArray(initiative.keyRisks) && initiative.keyRisks.length > 0,
      isRequired: false,
    },
  ];

  return fields;
};

const calculateCompleteness = (fields: FieldStatus[]): number => {
  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const completedWeight = fields.reduce((sum, f) => sum + (f.isFilled ? f.weight : 0), 0);
  return Math.round((completedWeight / totalWeight) * 100);
};

export const InitiativeCompletenessChecker: React.FC<InitiativeCompletenessCheckerProps> = ({
  initiative,
  showDetails = false,
  compact = false,
  className = '',
}) => {
  const fields = calculateFieldStatuses(initiative);
  // Prefer the authoritative backend value when the caller has it (see prop
  // doc above) — the field recompute stays for `showDetails`, where it lists
  // WHICH fields are missing, but must not drive the headline % / color.
  const completeness =
    typeof initiative.charterCompleteness === 'number' && !Number.isNaN(initiative.charterCompleteness)
      ? Math.max(0, Math.min(100, Math.round(initiative.charterCompleteness)))
      : calculateCompleteness(fields);
  const missingRequired = fields.filter((f) => f.isRequired && !f.isFilled);
  const missingOptional = fields.filter((f) => !f.isRequired && !f.isFilled);

  const getProgressColor = () => {
    if (completeness >= 80) return 'bg-green-500';
    if (completeness >= 60) return 'bg-amber-500';
    if (completeness >= 40) return 'bg-amber-500';
    return 'bg-danger-500';
  };

  const getStatusText = () => {
    if (completeness >= 80) return 'Ready for Review';
    if (completeness >= 60) return 'Almost Ready';
    if (completeness >= 40) return 'Needs Work';
    return 'Incomplete';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-300`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {completeness}%
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-300`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className="text-sm font-bold text-navy-900 dark:text-white">{completeness}%</span>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-medium ${
            completeness >= 60
              ? 'text-green-600 dark:text-green-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {getStatusText()}
        </span>
        {completeness < 60 && (
          <span className="text-[10px] text-slate-600 dark:text-slate-500">
            Min. 60% required for Review
          </span>
        )}
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-3">
          {/* Missing Required Fields */}
          {missingRequired.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-danger-600 dark:text-danger-400 mb-1.5">
                Missing Required ({missingRequired.length})
              </div>
              <div className="space-y-1">
                {missingRequired.map((field) => (
                  <div
                    key={field.field}
                    className="flex items-center gap-2 px-2 py-1 bg-danger-50 dark:bg-danger-900/20 rounded text-xs text-danger-700 dark:text-danger-400"
                  >
                    <Circle size={10} className="text-danger-400" />
                    <span>{field.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Optional Fields */}
          {missingOptional.length > 0 && showDetails && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-500 mb-1.5">
                Optional ({missingOptional.length})
              </div>
              <div className="space-y-1">
                {missingOptional.slice(0, 4).map((field) => (
                  <div
                    key={field.field}
                    className="flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-navy-800/50 rounded text-xs text-slate-500 dark:text-slate-400"
                  >
                    <Circle size={10} className="text-slate-600 dark:text-slate-400" />
                    <span>{field.label}</span>
                  </div>
                ))}
                {missingOptional.length > 4 && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-500 pl-2">
                    +{missingOptional.length - 4} more fields
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Completed Fields */}
          {showDetails && fields.filter((f) => f.isFilled).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-green-600 dark:text-green-400 mb-1.5">
                Completed ({fields.filter((f) => f.isFilled).length})
              </div>
              <div className="flex flex-wrap gap-1">
                {fields
                  .filter((f) => f.isFilled)
                  .map((field) => (
                    <div
                      key={field.field}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 rounded text-[10px] text-green-700 dark:text-green-400"
                    >
                      <CheckCircle2 size={10} />
                      <span>{field.label}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export utility function for external use
export const getInitiativeCompleteness = (
  initiative: InitiativeCompletenessCheckerProps['initiative']
): number => {
  const fields = calculateFieldStatuses(initiative);
  return calculateCompleteness(fields);
};

export default InitiativeCompletenessChecker;
