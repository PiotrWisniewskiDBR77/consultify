/**
 * ReportGeneratorDrawer
 * Slide-out drawer for generating new management reports
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  Loader2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { ManagementReport, ManagementReportScope, ManagementReportType } from '../../../types';

interface Project {
  id: string;
  name: string;
}

const normalizeProjects = (response: any): Project[] => {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.projects)
        ? response.data.projects
        : null;
  if (!rows) throw new Error('Invalid projects response');
  return rows
    .map((project: any) => ({
      id: String(project?.id || '').trim(),
      name: String(project?.name || '').trim(),
    }))
    .filter((project: Project) => project.id && project.name);
};

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

interface ReportGeneratorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onReportGenerated: (report: ManagementReport) => void;
}

export const ReportGeneratorDrawer: React.FC<ReportGeneratorDrawerProps> = ({
  isOpen,
  onClose,
  onReportGenerated,
}) => {
  const [reportType, setReportType] = useState<ManagementReportType>('TEAM_MEETING');
  const { t } = useTranslation();
  const [scope, setScope] = useState<ManagementReportScope>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [periodDays, setPeriodDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoadError, setProjectsLoadError] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await Api.get('/api/projects');
        setProjects(normalizeProjects(response));
        setProjectsLoadError(false);
      } catch (error) {
        setProjectsLoadError(true);
        console.error('Failed to load projects:', error);
      }
    };
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const handleTypeChange = (type: ManagementReportType) => {
    setReportType(type);
    const option = reportTypeOptions.find((o) => o.id === type);
    if (option) {
      setPeriodDays(option.defaultPeriod);
    }
    // Auto-set scope based on report type
    if (type === 'PORTFOLIO_HEALTH') {
      setScope('PORTFOLIO');
      setSelectedProjectId(undefined);
    }
    if (type === 'TEAM_MEETING' || type === 'TEAM_WEEKLY') {
      setScope('PROJECT');
    }
  };

  const handleGenerate = useCallback(async () => {
    if (scope === 'PROJECT' && !selectedProjectId) {
      toast.error(t('reports.toast.selectProject', 'Wybierz projekt'));
      return;
    }

    setGenerating(true);
    try {
      const response = await Api.post('/api/management-reports/generate', {
        reportType,
        scope,
        projectId: scope === 'PROJECT' ? selectedProjectId : undefined,
        periodDays,
        aiEnhancement: true,
      });

      if (response.data?.report) {
        onReportGenerated(response.data.report);
      }
    } catch (error: any) {
      console.error('Report generation failed:', error);
      toast.error(
        error.message || t('reports.toast.generateFailed', 'Nie udało się wygenerować raportu')
      );
    } finally {
      setGenerating(false);
    }
  }, [reportType, scope, selectedProjectId, periodDays, onReportGenerated]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Generate New Report
              </h2>
              <p className="text-sm text-slate-600">
                AI will analyze your data and generate insights
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Report Type
            </label>
            <div className="space-y-2">
              {reportTypeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = reportType === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleTypeChange(option.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-200 dark:border-navy-700 hover:border-primary-500/50 bg-slate-50 dark:bg-navy-800/50'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? 'bg-navy-900 text-white'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`font-medium ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {option.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                      <span className="text-xs text-primary-400 mt-1 inline-block">
                        PRINCE2: {option.prince2}
                      </span>
                    </div>
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
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setScope('PORTFOLIO');
                  setSelectedProjectId(undefined);
                }}
                disabled={reportType === 'TEAM_MEETING' || reportType === 'TEAM_WEEKLY'}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  scope === 'PORTFOLIO'
                    ? 'border-c-text bg-c-text text-c-bg'
                    : 'border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:border-primary-500/50'
                } ${reportType === 'TEAM_MEETING' || reportType === 'TEAM_WEEKLY' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Briefcase size={18} />
                <span className="font-medium">Portfolio</span>
              </button>
              <button
                onClick={() => setScope('PROJECT')}
                disabled={reportType === 'PORTFOLIO_HEALTH'}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  scope === 'PROJECT'
                    ? 'border-c-text bg-c-text text-c-bg'
                    : 'border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:border-primary-500/50'
                } ${reportType === 'PORTFOLIO_HEALTH' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Building2 size={18} />
                <span className="font-medium">Single Project</span>
              </button>
            </div>
          </div>

          {/* Project Selection */}
          {scope === 'PROJECT' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value || undefined)}
                  className="w-full appearance-none px-4 py-3 pr-10 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
              </div>
              {projectsLoadError && (
                <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">
                  Failed to load projects. Report generation is unavailable.
                </p>
              )}
            </div>
          )}

          {/* Period Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reporting Period
            </label>
            <div className="relative">
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(parseInt(e.target.value))}
                className="w-full appearance-none px-4 py-3 pr-10 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          {/* PMO Standards Info */}
          <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              PMO Standards Compliance
            </h3>
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-500">
              <div>
                <span className="font-medium text-slate-600">ISO 21500:2021</span>
                <p>Project Performance</p>
              </div>
              <div>
                <span className="font-medium text-slate-600">PMBOK 7</span>
                <p>Measurement Domain</p>
              </div>
              <div>
                <span className="font-medium text-slate-600">PRINCE2</span>
                <p>Progress Theme</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={handleGenerate}
            disabled={generating || (scope === 'PROJECT' && !selectedProjectId)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-primary-600/50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition-colors"
          >
            {generating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportGeneratorDrawer;
