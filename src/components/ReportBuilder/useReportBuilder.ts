/**
 * useReportBuilder Hook
 *
 * Manages state and API interactions for the Report Builder wizard.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ==========================================
// TYPES
// ==========================================

export type ReportSourceType = 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE';
export type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'UTILIZED';
export type SectionLength = 'short' | 'medium' | 'long';
export type SectionLanguage = 'technical' | 'business' | 'general';

export interface SourceOption {
  id: string;
  name: string;
  type: string;
  status: string;
  framework: string;
  approvedAt: string;
}

export interface TemplateSection {
  key: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  repeatFor?: string;
  repeatKey?: string;
}

export interface ReportSection {
  id: string;
  reportId: string;
  sectionKey: string;
  sectionType: string;
  title: string;
  orderIndex: number;
  enabled: boolean;
  required: boolean;
  length: SectionLength;
  language: SectionLanguage;
  customPrompt?: string;
  generatedContent?: string;
  editedContent?: string;
  tiptapContent?: string;
  generatedAt?: string;
  repeatFor?: string;
  repeatKey?: string;
}

export interface Report {
  id: string;
  organizationId: string;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  sourceFramework?: string;
  title: string;
  description?: string;
  reportType: string;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  approvedAt?: string;
  version: number;
}

export interface ReportBuilderState {
  currentStep: number;
  sourceType: ReportSourceType | null;
  selectedSource: SourceOption | null;
  report: Report | null;
  sections: ReportSection[];
  isLoading: boolean;
  isGenerating: boolean;
  generationProgress: number;
  error: string | null;
}

// ==========================================
// HOOK
// ==========================================

export function useReportBuilder() {
  const { t } = useTranslation();

  const [state, setState] = useState<ReportBuilderState>({
    currentStep: 0,
    sourceType: null,
    selectedSource: null,
    report: null,
    sections: [],
    isLoading: false,
    isGenerating: false,
    generationProgress: 0,
    error: null,
  });

  // ==========================================
  // API METHODS
  // ==========================================

  const fetchSources = useCallback(
    async (sourceType: ReportSourceType): Promise<SourceOption[]> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const response = await Api.get(`/report-builder/sources/${sourceType.toLowerCase()}`);
        setState((prev) => ({ ...prev, isLoading: false }));
        return response?.sources || [];
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || 'Failed to fetch sources',
        }));
        return [];
      }
    },
    []
  );

  const createReport = useCallback(
    async (
      sourceType: ReportSourceType,
      sourceId: string,
      title: string,
      description?: string
    ): Promise<{ report: Report; sections: ReportSection[] } | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post('/report-builder', {
          sourceType,
          sourceId,
          title,
          description,
        });

        const { report, sections } = response || {};

        setState((prev) => ({
          ...prev,
          isLoading: false,
          report,
          sections,
        }));

        return { report, sections };
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to create report',
        }));
        return null;
      }
    },
    []
  );

  const loadReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await Api.get(`/report-builder/${reportId}`);
      const { report, sections } = response || {};

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report,
        sections,
        sourceType: report?.sourceType,
        currentStep:
          report?.status === 'DRAFT'
            ? 1
            : report?.status === 'GENERATED' || report?.status === 'IN_REVIEW'
              ? 3
              : 2,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.error || err.message || 'Failed to load report',
      }));
      return false;
    }
  }, []);

  const updateSectionConfig = useCallback(
    async (
      reportId: string,
      updates: Array<{
        sectionKey: string;
        enabled?: boolean;
        orderIndex?: number;
        length?: SectionLength;
        language?: SectionLanguage;
        customPrompt?: string;
        title?: string;
      }>
    ): Promise<ReportSection[] | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.put(`/report-builder/${reportId}/config`, {
          sections: updates,
        });

        const sections = response?.sections;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          sections,
        }));

        return sections;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to update section config',
        }));
        return null;
      }
    },
    []
  );

  const addCustomSection = useCallback(
    async (
      reportId: string,
      title: string,
      afterSectionKey?: string,
      options?: { length?: SectionLength; language?: SectionLanguage }
    ): Promise<ReportSection | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post(`/report-builder/${reportId}/sections`, {
          title,
          afterSectionKey,
          ...options,
        });

        const newSection = response?.section;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          sections: [...prev.sections, newSection].sort((a, b) => a.orderIndex - b.orderIndex),
        }));

        return newSection;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to add section',
        }));
        return null;
      }
    },
    []
  );

  const removeSection = useCallback(
    async (reportId: string, sectionKey: string): Promise<boolean> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        await Api.delete(`/report-builder/${reportId}/sections/${sectionKey}`);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          sections: prev.sections.filter((s) => s.sectionKey !== sectionKey),
        }));

        return true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to remove section',
        }));
        return false;
      }
    },
    []
  );

  const generateReport = useCallback(
    async (reportId: string, regenerateAll: boolean = false): Promise<boolean> => {
      try {
        setState((prev) => ({
          ...prev,
          isGenerating: true,
          generationProgress: 0,
          error: null,
        }));

        const response = await Api.post(`/report-builder/${reportId}/generate`, {
          regenerateAll,
        });

        const { report, sections } = response || {};

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          generationProgress: 100,
          report,
          sections,
        }));

        return true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          generationProgress: 0,
          error: err?.error || err.message || 'Failed to generate report',
        }));
        return false;
      }
    },
    []
  );

  const generateSection = useCallback(
    async (
      reportId: string,
      sectionKey: string,
      customPrompt?: string
    ): Promise<{ content: string } | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post(
          `/report-builder/${reportId}/generate-section/${sectionKey}`,
          { customPrompt }
        );

        const { content } = response || {};

        // Update section in state
        setState((prev) => ({
          ...prev,
          isLoading: false,
          sections: prev.sections.map((s) =>
            s.sectionKey === sectionKey
              ? { ...s, generatedContent: content, generatedAt: new Date().toISOString() }
              : s
          ),
        }));

        return { content };
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to generate section',
        }));
        return null;
      }
    },
    []
  );

  const updateSectionContent = useCallback(
    async (
      reportId: string,
      sectionKey: string,
      content: string,
      contentFormat: 'markdown' | 'tiptap' = 'markdown'
    ): Promise<boolean> => {
      try {
        await Api.put(`/report-builder/${reportId}/sections/${sectionKey}/content`, {
          content,
          contentFormat,
        });

        // Update section in state
        setState((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.sectionKey === sectionKey ? { ...s, editedContent: content } : s
          ),
        }));

        return true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err?.error || err.message || 'Failed to save content',
        }));
        return false;
      }
    },
    []
  );

  const finalizeReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/finalize`);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report: prev.report ? { ...prev.report, status: 'IN_REVIEW' } : null,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.error || err.message || 'Failed to finalize report',
      }));
      return false;
    }
  }, []);

  const approveReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/approve`);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report: prev.report ? { ...prev.report, status: 'APPROVED' } : null,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.error || err.message || 'Failed to approve report',
      }));
      return false;
    }
  }, []);

  const duplicateReport = useCallback(
    async (
      reportId: string,
      newTitle?: string
    ): Promise<{ report: Report; sections: ReportSection[] } | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post(`/report-builder/${reportId}/duplicate`, {
          title: newTitle,
        });

        setState((prev) => ({ ...prev, isLoading: false }));

        return response;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.error || err.message || 'Failed to duplicate report',
        }));
        return null;
      }
    },
    []
  );

  // ==========================================
  // NAVIGATION
  // ==========================================

  const setStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, 3) }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 0) }));
  }, []);

  const setSourceType = useCallback((sourceType: ReportSourceType | null) => {
    setState((prev) => ({ ...prev, sourceType, selectedSource: null }));
  }, []);

  const setSelectedSource = useCallback((source: SourceOption | null) => {
    setState((prev) => ({ ...prev, selectedSource: source }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      currentStep: 0,
      sourceType: null,
      selectedSource: null,
      report: null,
      sections: [],
      isLoading: false,
      isGenerating: false,
      generationProgress: 0,
      error: null,
    });
  }, []);

  // ==========================================
  // LOCAL STATE UPDATES
  // ==========================================

  const updateLocalSection = useCallback((sectionKey: string, updates: Partial<ReportSection>) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.sectionKey === sectionKey ? { ...s, ...updates } : s)),
    }));
  }, []);

  const reorderSections = useCallback((newOrder: string[]) => {
    setState((prev) => ({
      ...prev,
      sections: newOrder
        .map((key, index) => {
          const section = prev.sections.find((s) => s.sectionKey === key);
          return section ? { ...section, orderIndex: index } : section;
        })
        .filter(Boolean) as ReportSection[],
    }));
  }, []);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    // State
    ...state,

    // Navigation
    setStep,
    nextStep,
    prevStep,
    setSourceType,
    setSelectedSource,
    clearError,
    reset,

    // API Methods
    fetchSources,
    createReport,
    loadReport,
    updateSectionConfig,
    addCustomSection,
    removeSection,
    generateReport,
    generateSection,
    updateSectionContent,
    finalizeReport,
    approveReport,
    duplicateReport,

    // Local Updates
    updateLocalSection,
    reorderSections,
  };
}

export default useReportBuilder;
