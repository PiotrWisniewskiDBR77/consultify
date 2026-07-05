/**
 * ReportEditorModal
 *
 * Full-featured report editor modal for creating and editing assessment reports.
 * Features:
 * - Edit report name, description
 * - Sections: Executive Summary, Gap Analysis, Recommendations
 * - AI-assisted content generation
 * - Preview before finalization
 */

import DOMPurify from 'dompurify';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Eye,
  FileOutput,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  isExpanded: boolean;
  aiGenerated?: boolean;
  isTemplate?: boolean;
}

interface ReportData {
  id?: string;
  name: string;
  description: string;
  assessmentId: string;
  assessmentName: string;
  status: 'DRAFT' | 'FINAL';
  sections: ReportSection[];
  createdAt?: string;
  updatedAt?: string;
}

interface ReportEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string | null;
  assessmentId?: string;
  assessmentName?: string;
  onSave: (report: ReportData) => void;
  onFinalize?: (reportId: string) => void;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    content: '',
    isExpanded: true,
  },
  {
    id: 'current-state',
    title: 'Current State Analysis',
    content: '',
    isExpanded: false,
  },
  {
    id: 'gap-analysis',
    title: 'Gap Analysis',
    content: '',
    isExpanded: false,
  },
  {
    id: 'recommendations',
    title: 'Key Recommendations',
    content: '',
    isExpanded: false,
  },
  {
    id: 'roadmap',
    title: 'Transformation Roadmap',
    content: '',
    isExpanded: false,
  },
  {
    id: 'next-steps',
    title: 'Next Steps',
    content: '',
    isExpanded: false,
  },
];

export const ReportEditorModal: React.FC<ReportEditorModalProps> = ({
  isOpen,
  onClose,
  reportId,
  assessmentId,
  assessmentName,
  onSave,
  onFinalize,
}) => {
  // State
  const [report, setReport] = useState<ReportData>({
    name: `Report - ${assessmentName || 'Assessment'}`,
    description: '',
    assessmentId: assessmentId || '',
    assessmentName: assessmentName || '',
    status: 'DRAFT',
    sections: DEFAULT_SECTIONS,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing report if editing
  useEffect(() => {
    if (isOpen && reportId) {
      loadReport(reportId);
    } else if (isOpen && !reportId) {
      // New report - reset to defaults
      setReport({
        name: `Report - ${assessmentName || 'Assessment'}`,
        description: '',
        assessmentId: assessmentId || '',
        assessmentName: assessmentName || '',
        status: 'DRAFT',
        sections: DEFAULT_SECTIONS,
      });
      setHasChanges(false);
    }
  }, [isOpen, reportId, assessmentId, assessmentName]);

  const loadReport = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assessment-reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load report');

      const data = await response.json();
      setReport({
        ...data,
        sections: data.sections || DEFAULT_SECTIONS,
      });
    } catch (err) {
      setError('Failed to load report');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle section content change
  const handleSectionChange = (sectionId: string, content: string) => {
    setReport((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, content } : s)),
    }));
    setHasChanges(true);
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setReport((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
      ),
    }));
  };

  // Generate AI content for a section
  const generateAIContent = async (sectionId: string) => {
    setIsGeneratingAI(sectionId);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/assessment/report-section', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentId: report.assessmentId,
          sectionType: sectionId,
          existingContent: report.sections.find((s) => s.id === sectionId)?.content,
        }),
      });

      if (!response.ok) {
        const templateContent = getTemplateContent(sectionId);
        handleSectionChange(sectionId, templateContent);
        setReport((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, aiGenerated: false, isTemplate: true } : s
          ),
        }));
        setError('AI generation unavailable — using template. You can edit the content manually.');
        return;
      }

      const data = await response.json();
      handleSectionChange(sectionId, data.content);

      setReport((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, aiGenerated: true, isTemplate: false } : s
        ),
      }));
    } catch (err) {
      const templateContent = getTemplateContent(sectionId);
      handleSectionChange(sectionId, templateContent);
      setReport((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, aiGenerated: false, isTemplate: true } : s
        ),
      }));
      setError('AI generation unavailable — using template. You can edit the content manually.');
    } finally {
      setIsGeneratingAI(null);
    }
  };

  // Template content used as fallback when AI generation is unavailable
  const getTemplateContent = (sectionId: string): string => {
    const TEMPLATE_HEADER = `<!-- Template content - edit or regenerate with AI -->\n\n`;
    const templates: Record<string, string> = {
      'executive-summary': `## Executive Summary

This Digital Readiness Assessment provides a comprehensive evaluation of the organization's current digital maturity across 7 key dimensions.

**Key Findings:**
- Current average maturity level: [X.X]/7
- Target maturity level: [X.X]/7
- Total gap points: [X]

**Priority Areas:**
1. [Highest gap area]
2. [Second priority area]
3. [Third priority area]

**Recommended Actions:**
The assessment reveals significant opportunities for digital transformation, particularly in [key areas]. Immediate focus should be placed on [priority recommendations].`,

      'current-state': `## Current State Analysis

### Overview
The organization currently operates at an average digital maturity level of [X.X] across all assessed dimensions.

### Dimension Breakdown
| Dimension | Current Level | Description |
|-----------|--------------|-------------|
| Digital Processes | [X] | [Status] |
| Digital Products | [X] | [Status] |
| Business Models | [X] | [Status] |
| Data Management | [X] | [Status] |
| Culture | [X] | [Status] |
| Cybersecurity | [X] | [Status] |
| AI Maturity | [X] | [Status] |

### Strengths
- [Identified strength 1]
- [Identified strength 2]

### Areas for Improvement
- [Improvement area 1]
- [Improvement area 2]`,

      'gap-analysis': `## Gap Analysis

### Overall Gap Assessment
The assessment reveals a total gap of [X] points between current state and target state.

### Critical Gaps (Priority 1)
| Area | Current | Target | Gap | Impact |
|------|---------|--------|-----|--------|
| [Area] | [X] | [Y] | [Z] | High |

### Significant Gaps (Priority 2)
| Area | Current | Target | Gap | Impact |
|------|---------|--------|-----|--------|
| [Area] | [X] | [Y] | [Z] | Medium |

### Root Causes
1. [Root cause 1]
2. [Root cause 2]
3. [Root cause 3]`,

      recommendations: `## Key Recommendations

### Immediate Actions (0-3 months)
1. **[Recommendation 1]**
   - Description: [Details]
   - Expected Impact: High
   - Estimated Effort: [X] person-days

2. **[Recommendation 2]**
   - Description: [Details]
   - Expected Impact: High
   - Estimated Effort: [X] person-days

### Short-term Initiatives (3-6 months)
1. [Initiative description]
2. [Initiative description]

### Medium-term Initiatives (6-12 months)
1. [Initiative description]
2. [Initiative description]

### Success Metrics
- [KPI 1]
- [KPI 2]
- [KPI 3]`,

      roadmap: `## Transformation Roadmap

### Phase 1: Foundation (Q1)
- [ ] Establish governance framework
- [ ] Identify quick wins
- [ ] Build digital capabilities team

### Phase 2: Acceleration (Q2-Q3)
- [ ] Implement priority initiatives
- [ ] Scale successful pilots
- [ ] Develop advanced capabilities

### Phase 3: Optimization (Q4)
- [ ] Measure and optimize
- [ ] Expand to new areas
- [ ] Continuous improvement

### Investment Summary
| Phase | Timeline | Estimated Budget |
|-------|----------|-----------------|
| Foundation | Q1 | [Amount] |
| Acceleration | Q2-Q3 | [Amount] |
| Optimization | Q4 | [Amount] |`,

      'next-steps': `## Next Steps

### Immediate Actions
1. **Review and validate** this assessment with key stakeholders
2. **Prioritize initiatives** based on business impact and feasibility
3. **Assign ownership** for each recommendation
4. **Define success metrics** and tracking mechanisms

### Governance
- Establish Digital Transformation Steering Committee
- Define review cadence (monthly/quarterly)
- Set up progress tracking dashboard

### Communication
- Share findings with leadership team
- Develop change management plan
- Create employee communication strategy

### Timeline
| Action | Owner | Due Date |
|--------|-------|----------|
| Stakeholder review | [Name] | [Date] |
| Initiative prioritization | [Name] | [Date] |
| Kick-off meeting | [Name] | [Date] |`,
    };

    const raw = templates[sectionId] || '## [Section Title]\n\nContent to be added...';
    return TEMPLATE_HEADER + raw;
  };

  // Save report
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const method = report.id ? 'PUT' : 'POST';
      const url = report.id ? `/api/assessment-reports/${report.id}` : '/api/assessment-reports';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) throw new Error('Failed to save report');

      const savedReport = await response.json();
      setReport((prev) => ({ ...prev, id: savedReport.id }));
      setHasChanges(false);
      onSave(savedReport);
    } catch (err) {
      setError('Failed to save report');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Finalize report
  const handleFinalize = async () => {
    if (!report.id) {
      await handleSave();
    }

    if (report.id && onFinalize) {
      onFinalize(report.id);
    }
  };

  // Generate all sections with AI
  const generateAllSections = async () => {
    for (const section of report.sections) {
      if (!section.content) {
        await generateAIContent(section.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!hasChanges || confirm('You have unsaved changes. Are you sure you want to close?')) {
            onClose();
          }
        }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-navy-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                {report.id ? 'Edit Report' : 'Create Report'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{report.assessmentName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Toggle */}
            <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'edit'
                    ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
                }`}
              >
                <Edit3 size={14} className="inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
                }`}
              >
                <Eye size={14} className="inline mr-1" />
                Preview
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : activeTab === 'edit' ? (
            <div className="space-y-6">
              {/* Report Name & Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Report Name
                  </label>
                  <input
                    type="text"
                    value={report.name}
                    onChange={(e) => {
                      setReport((prev) => ({ ...prev, name: e.target.value }));
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter report name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={report.description}
                    onChange={(e) => {
                      setReport((prev) => ({ ...prev, description: e.target.value }));
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description..."
                  />
                </div>
              </div>

              {/* AI Generate All Button */}
              <div className="flex justify-end">
                <button
                  onClick={generateAllSections}
                  disabled={!!isGeneratingAI}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-lg hover:from-primary-700 hover:to-blue-700 transition-all disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  Generate All with AI
                </button>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                {report.sections.map((section) => (
                  <div
                    key={section.id}
                    className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden"
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-navy-900 dark:text-white">
                          {section.title}
                        </span>
                        {section.aiGenerated && (
                          <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                            AI Generated
                          </span>
                        )}
                        {section.isTemplate && !section.aiGenerated && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                            Template
                          </span>
                        )}
                        {section.content && <CheckCircle2 size={14} className="text-green-500" />}
                      </div>
                      {section.isExpanded ? (
                        <ChevronUp size={18} className="text-slate-600 dark:text-slate-500" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-600 dark:text-slate-500" />
                      )}
                    </button>

                    {/* Section Content */}
                    {section.isExpanded && (
                      <div className="p-4 space-y-3">
                        {section.isTemplate && !section.aiGenerated && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-sm">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            <span>Template content — edit manually or regenerate with AI.</span>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => generateAIContent(section.id)}
                            disabled={isGeneratingAI === section.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors disabled:opacity-50"
                          >
                            {isGeneratingAI === section.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            {section.content ? 'Regenerate' : 'Generate'} with AI
                          </button>
                        </div>
                        <textarea
                          value={section.content}
                          onChange={(e) => handleSectionChange(section.id, e.target.value)}
                          className="w-full h-48 px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-navy-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                          placeholder={`Enter ${section.title.toLowerCase()} content...`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Preview Tab */
            <div className="prose dark:prose-invert max-w-none">
              <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                {report.name}
              </h1>
              {report.description && (
                <p className="text-slate-500 dark:text-slate-400 mb-6">{report.description}</p>
              )}

              {report.sections.map((section) => (
                <div key={section.id} className="mb-8">
                  {section.content ? (
                    <div
                      className="whitespace-pre-wrap text-slate-700 dark:text-slate-300"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          section.content
                            .replace(
                              /^## (.+)$/gm,
                              '<h2 class="text-xl font-bold text-navy-900 dark:text-white mt-6 mb-3">$1</h2>'
                            )
                            .replace(
                              /^### (.+)$/gm,
                              '<h3 class="text-lg font-semibold text-navy-900 dark:text-white mt-4 mb-2">$1</h3>'
                            )
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>')
                        ),
                      }}
                    />
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg text-slate-600 dark:text-slate-500 italic">
                      {section.title} - No content yet
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {hasChanges && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertCircle size={14} />
                Unsaved changes
              </span>
            )}
            {report.status === 'DRAFT' && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs">
                Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Draft
            </button>
            {report.id && (
              <button
                onClick={handleFinalize}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={16} />
                Finalize Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
