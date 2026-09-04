/**
 * useReportBuilder Hook
 *
 * Manages state and API interactions for the Report Builder wizard.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { getAppErrorLine } from '../../services/errors/appErrorCopy';

// ==========================================
// TYPES
// ==========================================

export type ReportSourceType = 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' | 'UPLOAD_BUNDLE';
export type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED';
export type SectionLength = 'short' | 'medium' | 'long';
export type SectionLanguage = 'technical' | 'business' | 'general';

// V3 types
export type ReportTypeV3 = 'R1' | 'R2' | 'R3' | 'R4' | 'custom';
export type CommunicationRegister = 'executive' | 'professional' | 'technical' | 'narrative';
export type ReportDensity = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type ReportForm = 'strategic' | 'operational' | 'technical' | 'investment';
export type DataLevel = 'data-heavy' | 'balanced' | 'narrative-heavy';
export type Confidentiality = 'confidential' | 'internal' | 'public';
export type GoalV3 = 'inform' | 'decide' | 'sell' | 'align';
export type RagStatus = 'green' | 'amber' | 'red';

export interface SourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

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
  blockTypeId?: string;
  blockConfig?: Record<string, unknown>;
  renderKind?: string;
  generatedContent?: string;
  editedContent?: string;
  tiptapContent?: string;
  contentFormat?: string;
  generatedAt?: string;
  repeatFor?: string;
  repeatKey?: string;
  // V3 fields
  rag?: RagStatus;
  summary?: string;
  sourceRefs?: SourceRef[];
  isRefreshable?: boolean;
  lastDataTimestamp?: string;
}

export interface Report {
  id: string;
  organizationId: string;
  projectId?: string;
  templateId?: string;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  sourceFramework?: string;
  title: string;
  description?: string;
  reportType: string;
  config?: Record<string, unknown>;
  companyContext?: Record<string, unknown>;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  approvedAt?: string;
  version: number;
  // V3 Report Definition Layer
  reportTypeV3?: ReportTypeV3;
  periodFrom?: string;
  periodTo?: string;
  communicationRegister?: CommunicationRegister;
  density?: ReportDensity;
  form?: ReportForm;
  dataLevel?: DataLevel;
  confidentiality?: Confidentiality;
  themeId?: string;
  goalV3?: GoalV3;
  sourceRefs?: SourceRef[];
}

// ==========================================
// COMMENT TYPES
// ==========================================

export type CommentType =
  | 'FEEDBACK'
  | 'SUGGESTION'
  | 'QUESTION'
  | 'APPROVAL'
  | 'REJECTION'
  | 'CHANGE_REQUEST';
export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'WONT_FIX';
export type CommentPriority = 'low' | 'normal' | 'high' | 'critical';

export interface CommentAnchor {
  type: 'section' | 'fragment';
  rangeStart?: number;
  rangeEnd?: number;
  quote?: string;
  contentHash?: string;
}

export interface ReportComment {
  id: string;
  reportId: string;
  sectionKey: string | null;
  anchorType: 'section' | 'fragment';
  rangeStart: number | null;
  rangeEnd: number | null;
  quote: string | null;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  commentType: CommentType;
  content: string;
  aiResponse: string | null;
  aiSuggestedEdits: string[] | null;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  parentCommentId: string | null;
  priority: CommentPriority;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
  bySection: Record<string, { total: number; open: number }>;
}

export interface CanApproveResult {
  canApprove: boolean;
  openCount: number;
  blockers: string[];
}

export interface ReportBuilderState {
  currentStep: number;
  sourceType: ReportSourceType | null;
  selectedSource: SourceOption | null;
  report: Report | null;
  sections: ReportSection[];
  comments: ReportComment[];
  commentSummary: CommentSummary | null;
  canApprove: CanApproveResult | null;
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
    comments: [],
    commentSummary: null,
    canApprove: null,
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
          error: getAppErrorLine(t, err),
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
      description?: string,
      config?: Record<string, unknown>,
      confidentiality?: Confidentiality
    ): Promise<{ report: Report; sections: ReportSection[] } | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // FIX-215 pkt 1: `confidentiality` musi jechać jako pole najwyższego
        // poziomu (nie tylko wewnątrz `config`) — trasa `POST /report-builder`
        // i `reportBuilderService.createReport` czytają wyłącznie top-level
        // `params.confidentiality`. Zagnieżdżenie w `config` nigdy tam nie
        // dociera (patrz ODBIÓR_215.md, luka poufności).
        const response = await Api.post('/report-builder', {
          sourceType,
          sourceId,
          title,
          description,
          config,
          confidentiality,
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
          error: getAppErrorLine(t, err),
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
        // Wizard steps:
        // 0 = Intent (must be completed before outline/generation)
        // 1 = Outline / structure
        // 2 = Generate & Edit
        currentStep: report?.status === 'CONFIGURING' ? 0 : report?.status === 'DRAFT' ? 1 : 2,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
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
      options?: {
        length?: SectionLength;
        language?: SectionLanguage;
        blockTypeId?: string;
        blockConfig?: Record<string, unknown>;
        renderKind?: string;
      }
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
          error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
        }));
        return false;
      }
    },
    []
  );

  const finalizeReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/finalize`, {});

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
        error: getAppErrorLine(t, err),
      }));
      return false;
    }
  }, []);

  const approveReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/approve`, {});

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
        error: getAppErrorLine(t, err),
      }));
      return false;
    }
  }, []);

  const sendBackReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/send-back`, {});

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report: prev.report ? { ...prev.report, status: 'DRAFT' } : null,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getAppErrorLine(t, err),
      }));
      return false;
    }
  }, []);

  const markSentInternal = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/mark-sent-internal`, {});

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report: prev.report ? { ...prev.report, status: 'SENT_INTERNAL' } : null,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getAppErrorLine(t, err),
      }));
      return false;
    }
  }, []);

  const markSentExternal = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await Api.post(`/report-builder/${reportId}/mark-sent-external`, {});

      setState((prev) => ({
        ...prev,
        isLoading: false,
        report: prev.report ? { ...prev.report, status: 'SENT_EXTERNAL' } : null,
      }));

      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getAppErrorLine(t, err),
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
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  // ==========================================
  // EXPORT & SHARE METHODS
  // ==========================================

  const exportPdf = useCallback(async (reportId: string): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Trigger download via browser
      const url = `/api/report-builder/${reportId}/export/pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = 'report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: getAppErrorLine(t, err),
      }));
    }
  }, []);

  const getExports = useCallback(
    async (
      reportId: string
    ): Promise<Array<{
      id: string;
      format: string;
      exportedAt: string;
      downloadCount: number;
    }> | null> => {
      try {
        const response = await Api.get(`/report-builder/${reportId}/exports`);
        return response?.exports || [];
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  const createShareLink = useCallback(
    async (
      reportId: string,
      options?: {
        password?: string;
        expiresInDays?: number;
        showCompanyLogo?: boolean;
        showConsultifyBranding?: boolean;
        customMessage?: string;
      }
    ): Promise<{
      id: string;
      token: string;
      url: string;
      hasPassword: boolean;
      expiresAt?: string;
    } | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post(`/report-builder/${reportId}/share`, options || {});

        setState((prev) => ({ ...prev, isLoading: false }));

        return response?.link || null;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  const getShareLinks = useCallback(
    async (
      reportId: string
    ): Promise<Array<{
      id: string;
      token: string;
      url: string;
      hasPassword: boolean;
      expiresAt?: string;
      viewCount: number;
      createdAt: string;
    }> | null> => {
      try {
        const response = await Api.get(`/report-builder/${reportId}/share`);
        return response?.links || [];
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  const revokeShareLink = useCallback(
    async (reportId: string, linkId: string): Promise<boolean> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        await Api.delete(`/report-builder/${reportId}/share/${linkId}`);

        setState((prev) => ({ ...prev, isLoading: false }));

        return true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: getAppErrorLine(t, err),
        }));
        return false;
      }
    },
    []
  );

  // ==========================================
  // COMMENTS METHODS
  // ==========================================

  const loadComments = useCallback(
    async (
      reportId: string,
      filters?: {
        sectionKey?: string | null;
        status?: CommentStatus | CommentStatus[];
      }
    ): Promise<ReportComment[]> => {
      try {
        const params = new URLSearchParams();
        if (filters?.sectionKey !== undefined) {
          params.append('sectionKey', filters.sectionKey === null ? 'null' : filters.sectionKey);
        }
        if (filters?.status) {
          params.append(
            'status',
            Array.isArray(filters.status) ? filters.status.join(',') : filters.status
          );
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await Api.get(`/report-builder/${reportId}/comments${query}`);

        const comments = response?.comments || [];
        const summary = response?.summary || null;

        setState((prev) => ({
          ...prev,
          comments,
          commentSummary: summary,
        }));

        return comments;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return [];
      }
    },
    []
  );

  const loadCommentSummary = useCallback(
    async (
      reportId: string
    ): Promise<{
      summary: CommentSummary;
      canApprove: CanApproveResult;
    } | null> => {
      try {
        const response = await Api.get(`/report-builder/${reportId}/comments/summary`);

        setState((prev) => ({
          ...prev,
          commentSummary: response?.summary || null,
          canApprove: response?.canApprove || null,
        }));

        return {
          summary: response?.summary,
          canApprove: response?.canApprove,
        };
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  const createComment = useCallback(
    async (
      reportId: string,
      params: {
        sectionKey?: string;
        anchor?: CommentAnchor;
        commentType?: CommentType;
        content: string;
        parentCommentId?: string;
        priority?: CommentPriority;
        tags?: string[];
      }
    ): Promise<ReportComment | null> => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await Api.post(`/report-builder/${reportId}/comments`, params);
        const comment = response?.comment;

        if (comment) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            comments: [...prev.comments, comment],
          }));
          // Refresh summary
          await loadCommentSummary(reportId);
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }

        return comment || null;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    [loadCommentSummary]
  );

  const updateComment = useCallback(
    async (
      reportId: string,
      commentId: string,
      updates: {
        content?: string;
        commentType?: CommentType;
        status?: CommentStatus;
        resolutionNotes?: string;
        priority?: CommentPriority;
        tags?: string[];
      }
    ): Promise<ReportComment | null> => {
      try {
        const response = await Api.patch(
          `/report-builder/${reportId}/comments/${commentId}`,
          updates
        );
        const comment = response?.comment;

        if (comment) {
          setState((prev) => ({
            ...prev,
            comments: prev.comments.map((c) => (c.id === commentId ? comment : c)),
          }));
          // Refresh summary if status changed
          if (updates.status) {
            await loadCommentSummary(reportId);
          }
        }

        return comment || null;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    [loadCommentSummary]
  );

  const deleteComment = useCallback(
    async (reportId: string, commentId: string): Promise<boolean> => {
      try {
        await Api.delete(`/report-builder/${reportId}/comments/${commentId}`);

        setState((prev) => ({
          ...prev,
          comments: prev.comments.filter((c) => c.id !== commentId),
        }));
        await loadCommentSummary(reportId);

        return true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return false;
      }
    },
    [loadCommentSummary]
  );

  const resolveComment = useCallback(
    async (
      reportId: string,
      commentId: string,
      resolutionNotes?: string
    ): Promise<ReportComment | null> => {
      try {
        const response = await Api.post(
          `/report-builder/${reportId}/comments/${commentId}/resolve`,
          {
            resolutionNotes,
          }
        );
        const comment = response?.comment;
        const summary = response?.summary;

        if (comment) {
          setState((prev) => ({
            ...prev,
            comments: prev.comments.map((c) => (c.id === commentId ? comment : c)),
            commentSummary: summary || prev.commentSummary,
          }));
        }

        return comment || null;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return null;
      }
    },
    []
  );

  const bulkResolveComments = useCallback(
    async (reportId: string, commentIds: string[], resolutionNotes?: string): Promise<number> => {
      try {
        const response = await Api.post(`/report-builder/${reportId}/comments/bulk-resolve`, {
          commentIds,
          resolutionNotes,
        });
        const resolvedCount = response?.resolvedCount || 0;
        const summary = response?.summary;

        // Refresh comments list to get updated statuses
        await loadComments(reportId);

        if (summary) {
          setState((prev) => ({
            ...prev,
            commentSummary: summary,
          }));
        }

        return resolvedCount;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: getAppErrorLine(t, err),
        }));
        return 0;
      }
    },
    [loadComments]
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
      comments: [],
      commentSummary: null,
      canApprove: null,
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
    sendBackReport,
    markSentInternal,
    markSentExternal,
    duplicateReport,

    // Export & Share
    exportPdf,
    getExports,
    createShareLink,
    getShareLinks,
    revokeShareLink,

    // Comments
    loadComments,
    loadCommentSummary,
    createComment,
    updateComment,
    deleteComment,
    resolveComment,
    bulkResolveComments,

    // Local Updates
    updateLocalSection,
    reorderSections,
  };
}

export default useReportBuilder;
