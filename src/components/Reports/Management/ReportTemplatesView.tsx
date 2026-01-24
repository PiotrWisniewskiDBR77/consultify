/**
 * Report Templates View
 * Template builder for management reports
 */

import { Check, Plus, Wand2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { ManagementReportType } from '../../../types';

interface TemplateSection {
  id: string;
  name: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: ManagementReportType;
  sections: string[];
  createdAt: string;
  createdByName?: string;
}

const sectionConfig: Record<ManagementReportType, TemplateSection[]> = {
  TEAM_MEETING: [
    { id: 'statusSummary', name: 'Status Overview' },
    { id: 'completedWork', name: 'Completed Work' },
    { id: 'workInProgress', name: 'Work in Progress' },
    { id: 'blockers', name: 'Blockers & Issues' },
    { id: 'pendingDecisions', name: 'Pending Decisions' },
    { id: 'nextPeriodPlan', name: 'Next Period Plan' },
  ],
  TEAM_WEEKLY: [
    { id: 'statusSummary', name: 'Status Overview' },
    { id: 'completedWork', name: 'Completed Work' },
    { id: 'workInProgress', name: 'Work in Progress' },
    { id: 'blockers', name: 'Blockers & Issues' },
    { id: 'pendingDecisions', name: 'Pending Decisions' },
    { id: 'nextPeriodPlan', name: 'Next Period Plan' },
  ],
  STEERING_COMMITTEE: [
    { id: 'executiveSummary', name: 'Executive Summary' },
    { id: 'overallStatus', name: 'RAG Status' },
    { id: 'kpis', name: 'Key Performance Indicators' },
    { id: 'risksAndIssues', name: 'Risks & Issues' },
    { id: 'decisionsRequired', name: 'Decisions Required' },
    { id: 'forecast', name: 'Forecast & Milestones' },
  ],
  PORTFOLIO_HEALTH: [
    { id: 'executiveSummary', name: 'Executive Summary' },
    { id: 'portfolioOverview', name: 'Portfolio Overview' },
    { id: 'healthDrivers', name: 'Health Drivers' },
    { id: 'benefitsSnapshot', name: 'Benefits Snapshot' },
    { id: 'economicsSnapshot', name: 'Economic Outcomes' },
    { id: 'risksAndIssues', name: 'Risks & Issues' },
    { id: 'decisionsRequired', name: 'Decisions Required' },
    { id: 'nextPeriodPriorities', name: 'Next Period Priorities' },
  ],
  RAID: [
    { id: 'executiveSummary', name: 'Executive Summary' },
    { id: 'risks', name: 'Risks' },
    { id: 'assumptions', name: 'Assumptions' },
    { id: 'issues', name: 'Issues' },
    { id: 'dependencies', name: 'Dependencies' },
    { id: 'decisionsRequired', name: 'Decisions Required' },
  ],
};

export const ReportTemplatesView: React.FC = () => {
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
        toast.error('Failed to load templates');
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
      toast.error('Template name is required');
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
        toast.success('Template created');
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('Failed to create template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 size={18} className="text-violet-500" />
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">Template Builder</h2>
        </div>

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
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'bg-violet-500 border-violet-500 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </span>
                  {section.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleCreateTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium"
          >
            <Plus size={16} />
            Create template
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">Saved Templates</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
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
                    <p className="font-medium text-navy-900 dark:text-white">{template.name}</p>
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
      </div>
    </div>
  );
};

export default ReportTemplatesView;
