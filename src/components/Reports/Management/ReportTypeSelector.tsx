/**
 * Report Type Selector Component
 * Select report type, scope, project, period, and sections
 */

import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Lock,
  Settings2,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { ManagementReportScope, ManagementReportType } from '../../../types';

interface Project {
  id: string;
  name: string;
}

interface SectionConfig {
  id: string;
  name: string;
  required: boolean;
}

interface ReportTypeSelectorProps {
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  selectedProjectId?: string;
  periodDays: number;
  projects: Project[];
  includeSections?: string[];
  excludeSections?: string[];
  onReportTypeChange: (type: ManagementReportType) => void;
  onScopeChange: (scope: ManagementReportScope) => void;
  onProjectChange: (projectId: string | undefined) => void;
  onPeriodChange: (days: number) => void;
  onSectionsChange?: (include: string[], exclude: string[]) => void;
  className?: string;
}

const reportTypeOptions = [
  {
    id: 'TEAM_MEETING' as ManagementReportType,
    icon: Users,
    title: 'Team Meeting Report',
    description: 'Checkpoint-style status for project teams',
    defaultPeriod: 7,
    prince2: 'Checkpoint Report',
  },
  {
    id: 'TEAM_WEEKLY' as ManagementReportType,
    icon: Users,
    title: 'Team Weekly Report',
    description: 'Weekly delivery summary with blockers and priorities',
    defaultPeriod: 7,
    prince2: 'Checkpoint Report',
  },
  {
    id: 'STEERING_COMMITTEE' as ManagementReportType,
    icon: Building2,
    title: 'Steering Committee Report',
    description: 'Executive summary for decision makers',
    defaultPeriod: 30,
    prince2: 'Highlight Report',
  },
  {
    id: 'PORTFOLIO_HEALTH' as ManagementReportType,
    icon: Briefcase,
    title: 'Portfolio Health Report',
    description: 'Portfolio-level health, RAG, and escalation view',
    defaultPeriod: 30,
    prince2: 'Portfolio Review',
  },
  {
    id: 'RAID' as ManagementReportType,
    icon: AlertTriangle,
    title: 'Risk, Assumptions, Issues, Dependencies',
    description: 'Consolidated RAID reporting for governance',
    defaultPeriod: 30,
    prince2: 'Risk Register Summary',
  },
];

const periodOptions = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last quarter (90 days)' },
];

const teamMeetingSections: SectionConfig[] = [
  { id: 'statusSummary', name: 'Status Overview', required: true },
  { id: 'completedWork', name: 'Completed Work', required: false },
  { id: 'workInProgress', name: 'Work in Progress', required: false },
  { id: 'blockers', name: 'Blockers & Issues', required: true },
  { id: 'pendingDecisions', name: 'Pending Decisions', required: false },
  { id: 'nextPeriodPlan', name: 'Next Period Plan', required: false },
];

const steeringCommitteeSections: SectionConfig[] = [
  { id: 'executiveSummary', name: 'Executive Summary', required: true },
  { id: 'overallStatus', name: 'RAG Status', required: true },
  { id: 'kpis', name: 'Key Performance Indicators', required: false },
  { id: 'risksAndIssues', name: 'Risks & Issues', required: false },
  { id: 'decisionsRequired', name: 'Decisions Required', required: true },
  { id: 'forecast', name: 'Forecast & Milestones', required: false },
];

const portfolioHealthSections: SectionConfig[] = [
  { id: 'executiveSummary', name: 'Executive Summary', required: true },
  { id: 'portfolioOverview', name: 'Portfolio Overview', required: true },
  { id: 'healthDrivers', name: 'Health Drivers', required: false },
  { id: 'benefitsSnapshot', name: 'Benefits Snapshot', required: false },
  { id: 'economicsSnapshot', name: 'Economic Outcomes', required: false },
  { id: 'risksAndIssues', name: 'Risks & Issues', required: false },
  { id: 'decisionsRequired', name: 'Decisions Required', required: true },
  { id: 'nextPeriodPriorities', name: 'Next Period Priorities', required: false },
];

const raidSections: SectionConfig[] = [
  { id: 'executiveSummary', name: 'Executive Summary', required: true },
  { id: 'risks', name: 'Risks', required: true },
  { id: 'assumptions', name: 'Assumptions', required: false },
  { id: 'issues', name: 'Issues', required: true },
  { id: 'dependencies', name: 'Dependencies', required: false },
  { id: 'decisionsRequired', name: 'Decisions Required', required: false },
];

export const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
  reportType,
  scope,
  selectedProjectId,
  periodDays,
  projects,
  includeSections = [],
  excludeSections = [],
  onReportTypeChange,
  onScopeChange,
  onProjectChange,
  onPeriodChange,
  onSectionsChange,
  className = '',
}) => {
  const [showSectionConfig, setShowSectionConfig] = useState(false);

  // Get sections based on report type
  const availableSections = useMemo(() => {
    if (reportType === 'TEAM_MEETING' || reportType === 'TEAM_WEEKLY') {
      return teamMeetingSections;
    }
    if (reportType === 'PORTFOLIO_HEALTH') {
      return portfolioHealthSections;
    }
    if (reportType === 'RAID') {
      return raidSections;
    }
    return steeringCommitteeSections;
  }, [reportType]);

  // Calculate enabled sections (all enabled by default except those in excludeSections)
  const enabledSections = useMemo(() => {
    return availableSections
      .filter((s) => !excludeSections.includes(s.id) || s.required)
      .map((s) => s.id);
  }, [availableSections, excludeSections]);

  const handleSectionToggle = (sectionId: string) => {
    const section = availableSections.find((s) => s.id === sectionId);
    if (!section || section.required) return;

    const isEnabled = enabledSections.includes(sectionId);
    let newExclude = [...excludeSections];

    if (isEnabled) {
      // Disable section by adding to exclude list
      newExclude.push(sectionId);
    } else {
      // Enable section by removing from exclude list
      newExclude = newExclude.filter((id) => id !== sectionId);
    }

    onSectionsChange?.(includeSections, newExclude);
  };
  const handleTypeChange = (type: ManagementReportType) => {
    onReportTypeChange(type);
    // Set default period based on report type
    const typeOption = reportTypeOptions.find((o) => o.id === type);
    if (typeOption) {
      onPeriodChange(typeOption.defaultPeriod);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Report Type Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Report Type
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportTypeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = reportType === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleTypeChange(option.id)}
                className={`flex flex-col p-4 rounded-xl border-2 transition-all text-left
                                    ${
                                      isSelected
                                        ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.07]'
                                        : 'border-slate-200 dark:border-navy-700 hover:border-slate-400 dark:hover:border-c-border'
                                    }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-2 rounded-lg ${isSelected ? 'bg-navy-900 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-navy-900 dark:text-white'}`}
                    >
                      {option.title}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      PRINCE2: {option.prince2}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Report Scope
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => {
              onScopeChange('PORTFOLIO');
              onProjectChange(undefined);
            }}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all
                            ${
                              scope === 'PORTFOLIO'
                                ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.07] text-slate-900 dark:text-white'
                                : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                            }`}
          >
            <Briefcase size={18} />
            <span className="font-medium">Portfolio (All Projects)</span>
          </button>
          <button
            onClick={() => onScopeChange('PROJECT')}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all
                            ${
                              scope === 'PROJECT'
                                ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.07] text-slate-900 dark:text-white'
                                : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                            }`}
          >
            <FileText size={18} />
            <span className="font-medium">Single Project</span>
          </button>
        </div>
      </div>

      {/* Project Selection (if scope is PROJECT) */}
      {scope === 'PROJECT' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select Project
          </label>
          <div className="relative">
            <select
              value={selectedProjectId || ''}
              onChange={(e) => onProjectChange(e.target.value || undefined)}
              className="w-full appearance-none px-4 py-3 pr-10 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Period Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          <Calendar size={16} className="inline mr-2" />
          Reporting Period
        </label>
        <div className="relative">
          <select
            value={periodDays}
            onChange={(e) => onPeriodChange(parseInt(e.target.value))}
            className="w-full appearance-none px-4 py-3 pr-10 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
          />
        </div>
      </div>

      {/* Section Configuration */}
      {onSectionsChange && (
        <div>
          <button
            onClick={() => setShowSectionConfig(!showSectionConfig)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <Settings2 size={16} />
            <span>Configure Report Sections</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${showSectionConfig ? 'rotate-180' : ''}`}
            />
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              {enabledSections.length}/{availableSections.length} enabled
            </span>
          </button>

          {showSectionConfig && (
            <div className="mt-3 p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Select which sections to include in the report. Required sections cannot be
                disabled.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {availableSections.map((section) => {
                  const isEnabled = enabledSections.includes(section.id);
                  const isRequired = section.required;

                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionToggle(section.id)}
                      disabled={isRequired}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all
                                                ${
                                                  isEnabled
                                                    ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                                                    : 'bg-white dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                                }
                                                ${
                                                  isRequired
                                                    ? 'cursor-not-allowed opacity-70'
                                                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                                                }
                                            `}
                      title={isRequired ? 'Required section' : undefined}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                                                ${
                                                  isEnabled
                                                    ? 'bg-navy-900 border-navy-900 text-white'
                                                    : 'border-slate-300 dark:border-slate-600'
                                                }`}
                      >
                        {isEnabled && <Check size={12} />}
                      </div>
                      <span className="flex-1 truncate">{section.name}</span>
                      {isRequired && (
                        <Lock
                          size={12}
                          className="text-slate-400 dark:text-slate-500 flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportTypeSelector;
