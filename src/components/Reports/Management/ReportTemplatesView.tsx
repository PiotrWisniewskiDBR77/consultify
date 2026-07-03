/**
 * Report Templates View
 * Template builder for management reports
 */

import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  FileBarChart2,
  FileText,
  GitBranch,
  Lightbulb,
  MessageSquare,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { ManagementReportType } from '../../../types';

interface TemplateSection {
  id: string;
  name: string;
  icon?: React.ReactNode;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: ManagementReportType;
  sections: string[];
  createdAt: string;
  createdByName?: string;
  /** B4.4: Template scope — 'application' (system-provided, read-only) or 'organization' (user-created, editable) */
  scope?: 'application' | 'organization';
}

const sectionConfig: Record<ManagementReportType, TemplateSection[]> = {
  TEAM_MEETING: [
    { id: 'statusSummary', name: 'Status Overview', icon: <BarChart3 size={14} /> },
    { id: 'completedWork', name: 'Completed Work', icon: <CheckCircle size={14} /> },
    { id: 'workInProgress', name: 'Work in Progress', icon: <Clock size={14} /> },
    { id: 'blockers', name: 'Blockers & Issues', icon: <AlertTriangle size={14} /> },
    { id: 'pendingDecisions', name: 'Pending Decisions', icon: <MessageSquare size={14} /> },
    { id: 'nextPeriodPlan', name: 'Next Period Plan', icon: <Target size={14} /> },
  ],
  TEAM_WEEKLY: [
    { id: 'statusSummary', name: 'Status Overview', icon: <BarChart3 size={14} /> },
    { id: 'completedWork', name: 'Completed Work', icon: <CheckCircle size={14} /> },
    { id: 'workInProgress', name: 'Work in Progress', icon: <Clock size={14} /> },
    { id: 'blockers', name: 'Blockers & Issues', icon: <AlertTriangle size={14} /> },
    { id: 'pendingDecisions', name: 'Pending Decisions', icon: <MessageSquare size={14} /> },
    { id: 'nextPeriodPlan', name: 'Next Period Plan', icon: <Target size={14} /> },
  ],
  STEERING_COMMITTEE: [
    { id: 'executiveSummary', name: 'Executive Summary', icon: <FileText size={14} /> },
    { id: 'overallStatus', name: 'RAG Status', icon: <TrendingUp size={14} /> },
    { id: 'kpis', name: 'Key Performance Indicators', icon: <FileBarChart2 size={14} /> },
    { id: 'risksAndIssues', name: 'Risks & Issues', icon: <AlertTriangle size={14} /> },
    { id: 'decisionsRequired', name: 'Decisions Required', icon: <MessageSquare size={14} /> },
    { id: 'forecast', name: 'Forecast & Milestones', icon: <Target size={14} /> },
  ],
  PORTFOLIO_HEALTH: [
    { id: 'executiveSummary', name: 'Executive Summary', icon: <FileText size={14} /> },
    { id: 'portfolioOverview', name: 'Portfolio Overview', icon: <ClipboardList size={14} /> },
    { id: 'healthDrivers', name: 'Health Drivers', icon: <TrendingUp size={14} /> },
    { id: 'benefitsSnapshot', name: 'Benefits Snapshot', icon: <Lightbulb size={14} /> },
    { id: 'economicsSnapshot', name: 'Economic Outcomes', icon: <BarChart3 size={14} /> },
    { id: 'risksAndIssues', name: 'Risks & Issues', icon: <AlertTriangle size={14} /> },
    { id: 'decisionsRequired', name: 'Decisions Required', icon: <MessageSquare size={14} /> },
    { id: 'nextPeriodPriorities', name: 'Next Period Priorities', icon: <Target size={14} /> },
  ],
  RAID: [
    { id: 'executiveSummary', name: 'Executive Summary', icon: <FileText size={14} /> },
    { id: 'risks', name: 'Risks', icon: <AlertTriangle size={14} /> },
    { id: 'assumptions', name: 'Assumptions', icon: <Lightbulb size={14} /> },
    { id: 'issues', name: 'Issues', icon: <Shield size={14} /> },
    { id: 'dependencies', name: 'Dependencies', icon: <GitBranch size={14} /> },
    { id: 'decisionsRequired', name: 'Decisions Required', icon: <MessageSquare size={14} /> },
  ],
};

export const ReportTemplatesView: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState<ManagementReportType>('TEAM_MEETING');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const availableSections = useMemo(() => sectionConfig[reportType] || [], [reportType]);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const response = await Api.get('/api/management-reports/templates');
        setTemplates(response.data?.templates || []);
      } catch (error) {
        console.error('Failed to load templates:', error);
        toast.error(t('reports.toast.loadTemplatesError', 'Nie udało się załadować szablonów'));
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    setSelectedSections(availableSections.map((section) => section.id));
  }, [availableSections]);

  const handleToggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const handleCreateTemplate = async () => {
    if (!name.trim()) {
      toast.error(t('reports.toast.templateNameRequired', 'Nazwa szablonu jest wymagana'));
      return;
    }

    try {
      const response = await Api.post('/api/management-reports/templates', {
        name,
        description,
        reportType,
        sections: selectedSections,
      });
      if (response.data?.template) {
        setTemplates((prev) => [response.data.template, ...prev]);
        setName('');
        setDescription('');
        toast.success(t('reports.toast.templateCreated', 'Szablon utworzony'));
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error(t('reports.toast.templateCreateError', 'Nie udało się utworzyć szablonu'));
    }
  };

  // B4.1: Collapsible sections — start collapsed
  // B4.2: Accordion behavior — opening one section closes the other
  const [builderExpanded, setBuilderExpanded] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);

  const toggleBuilder = () => {
    setBuilderExpanded((prev) => !prev);
    if (!builderExpanded) setSavedExpanded(false); // B4.2: close other
  };
  const toggleSaved = () => {
    setSavedExpanded((prev) => !prev);
    if (!savedExpanded) setBuilderExpanded(false); // B4.2: close other
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <button
          onClick={toggleBuilder}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-primary-500" />
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
              Template Builder
            </h2>
          </div>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${builderExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {builderExpanded && (
          <div className="px-6 pb-6 border-t border-slate-100 dark:border-navy-700 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Template name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
                  placeholder="Executive Steering Template"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Report type
                </label>
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value as ManagementReportType)}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
                >
                  <option value="TEAM_MEETING">Team Meeting</option>
                  <option value="TEAM_WEEKLY">Team Weekly</option>
                  <option value="STEERING_COMMITTEE">Steering Committee</option>
                  <option value="PORTFOLIO_HEALTH">Portfolio Health</option>
                  <option value="RAID">Risk/Assumption/Issue/Dependency</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2 min-h-[80px]"
                placeholder="Highlight key decision drivers and escalation status."
              />
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Sections</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableSections.map((section) => {
                  const isSelected = selectedSections.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleToggleSection(section.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left border text-sm transition-colors ${
                        isSelected
                          ? 'border-slate-400 dark:border-white/30 bg-slate-100/60 dark:bg-white/[0.07] text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? 'bg-navy-900 border-navy-900 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </span>
                      {section.icon && (
                        <span
                          className={
                            isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {section.icon}
                        </span>
                      )}
                      {section.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* B7.6: Live preview — template creator influences card shape */}
            {selectedSections.length > 0 && (
              <div className="mt-4 p-3 rounded-xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10">
                <p className="text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-2">
                  Card Preview
                </p>
                <div className="bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700 p-3 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {name || 'Untitled Template'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedSections.map((sId) => {
                      const sec = availableSections.find((s) => s.id === sId);
                      return sec ? (
                        <span
                          key={sId}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300"
                        >
                          {sec.icon}
                          {sec.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedSections.length} section{selectedSections.length !== 1 ? 's' : ''} ·{' '}
                    {reportType.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleCreateTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-medium"
              >
                <Plus size={16} />
                Create template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* B4.1: Saved Templates — collapsible, starts collapsed */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <button
          onClick={toggleSaved}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            Saved Templates{' '}
            {templates.length > 0 && (
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                ({templates.length})
              </span>
            )}
          </h3>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${savedExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {savedExpanded && (
          <div className="divide-y divide-slate-100 dark:divide-navy-700 border-t border-slate-100 dark:border-navy-700">
            {loading ? (
              <div className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">
                No templates created yet.
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-navy-900 dark:text-white">{template.name}</p>
                        {/* B4.4: Template scope badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                            template.scope === 'application'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {template.scope === 'application' ? 'System' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {template.description || 'No description'}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {template.reportType} • {template.sections.length} sections
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportTemplatesView;
