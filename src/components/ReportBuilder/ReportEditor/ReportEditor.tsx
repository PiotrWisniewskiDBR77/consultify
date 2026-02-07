/**
 * ReportEditor
 *
 * Main report building interface inspired by Gamma.app
 * - Left sidebar: Settings panel (intent, styling, export options)
 * - Center: Block canvas for building report structure
 * - Blocks can be added, reordered, configured inline
 */

import {
  BookTemplate,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Grip,
  Image,
  Layers,
  Loader2,
  MoreHorizontal,
  Palette,
  Plus,
  Save,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { ExportSharePanel } from '../ExportSharePanel';
import type { Report, ReportSection, ReportSourceType, ReportStatus, SourceOption } from '../useReportBuilder';
import { BlockCard } from './BlockCard';
import { BlockPalette } from './BlockPalette';
import { ReviewPanel } from './ReviewPanel';
import { SettingsPanel } from './SettingsPanel';

// ==========================================
// TYPES
// ==========================================

export interface ReportIntent {
  audience: 'executive' | 'technical' | 'board' | 'operational' | 'mixed';
  goal: 'diagnosis' | 'roadmap' | 'investment_decision' | 'stakeholder_update' | 'summary';
  /** Supported languages: pl, en, de, es, ar, jp */
  language: 'pl' | 'en' | 'de' | 'es' | 'ar' | 'jp';
  tone: 'consulting' | 'neutral' | 'decisive' | 'academic';
  scope: 'full' | 'executive' | 'focused';
  focusedAxes?: string[];
  /** Optional: high-level structure preset (drives defaults & QA checks). */
  requiredSectionsPreset?: 'assessment_full' | 'board_pack' | 'ops_delivery' | 'standard';
  /** Optional: target length hint for generation and export. */
  targetLength?: 'short' | 'standard' | 'long';
  /** Optional: when true, blocks should include references/citations (lite, enforcement later). */
  requireCitations?: boolean;
  visuals?: {
    assessmentMatrix?: boolean;
    charts?: boolean;
    icons?: boolean;
  };
}

export interface ReportStyling {
  theme: 'professional' | 'modern' | 'minimal' | 'corporate';
  primaryColor: string;
  accentColor: string;
  /** Custom color palette - user can add their own colors */
  customColors?: string[];
  fontFamily: 'inter' | 'roboto' | 'poppins' | 'system';
  /** Font size preset - affects H1, H2, H3, body, caption sizes */
  fontSize?: 'small' | 'medium' | 'large';
  /** Layout orientation - how the report is presented (horizontal = landscape, vertical = portrait) */
  layoutOrientation?: 'horizontal' | 'vertical';
  /** Minimal footer settings */
  footerMode?: 'none' | 'minimal' | 'full';
  /** Show client logo (uploaded) */
  showLogo: boolean;
  /** Client logo URL or base64 */
  clientLogoUrl?: string;
  /** Show "Created in Consultinity" branding - default true */
  showBranding: boolean;
}

export interface BlockConfig {
  /**
   * For persisted blocks, this MUST be the backend `sectionKey`.
   * For newly created blocks it will be a temporary key: `tmp_*`.
   */
  id: string;
  type: string;
  title: string;
  description?: string;
  dataSource?: string;
  length: 'short' | 'medium' | 'long';
  includeVisuals: boolean;
  customPrompt?: string;
  blockTypeId?: string;
  renderKind?: string;
  enabled: boolean;
  orderIndex: number;
  content?: string;
  isGenerating?: boolean;
  isGenerated?: boolean;
  /**
   * Block-specific settings from BlockSettingsRegistry.
   * These settings customize how the block is generated and rendered.
   */
  blockSettings?: Record<string, unknown>;
}

interface ReportEditorProps {
  reportId?: string;
  sourceType?: ReportSourceType;
  sourceId?: string;
  sourceName?: string;
  templateId?: string;
  /** When set to 'template', the editor saves a template (not a report). */
  mode?: 'report' | 'template';
  /** Initial metadata used in template mode. */
  templateMeta?: {
    name?: string;
    description?: string;
    recipient?: 'board' | 'bank' | 'team';
    sourceType?: ReportSourceType;
    /** Tool/Framework identifier - e.g. 'DRD', 'SIRI' for Assessment */
    reportType?: string;
  };
  onSave?: (reportId: string) => void;
  onTemplateSaved?: (template: { id: string; name: string }) => void;
  onClose?: () => void;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ReportEditor: React.FC<ReportEditorProps> = ({
  reportId,
  sourceType: initialSourceType,
  sourceId: initialSourceId,
  sourceName: initialSourceName,
  templateId: initialTemplateId,
  mode = 'report',
  templateMeta,
  onSave,
  onTemplateSaved,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const isTemplateMode = mode === 'template';

  // State
  const [report, setReport] = useState<Report | null>(null);
  const [blocks, setBlocks] = useState<BlockConfig[]>([]);
  const [intent, setIntent] = useState<ReportIntent>({
    audience: 'executive',
    goal: 'diagnosis',
    language: isPl ? 'pl' : 'en',
    tone: 'consulting',
    scope: 'full',
    requiredSectionsPreset: 'assessment_full',
    targetLength: 'standard',
    requireCitations: false,
    visuals: { assessmentMatrix: true, charts: true, icons: true },
  });
  const [styling, setStyling] = useState<ReportStyling>({
    theme: 'professional',
    primaryColor: '#3B82F6',
    accentColor: '#8B5CF6',
    customColors: [],
    fontFamily: 'inter',
    fontSize: 'medium',
    layoutOrientation: 'vertical',
    footerMode: 'minimal',
    showLogo: false,
    clientLogoUrl: undefined,
    showBranding: true, // "Stworzono w Consultinity" - domyślnie włączone
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<'intent' | 'styling' | 'export' | 'review'>('intent');
  const [isSettingsPanelCollapsed, setIsSettingsPanelCollapsed] = useState(false);

  // Source state
  const [sourceType, setSourceType] = useState<ReportSourceType | null>(initialSourceType || null);
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId || null);
  const [sourceName, setSourceName] = useState<string | null>(initialSourceName || null);
  const [reportTitle, setReportTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId || null
  );

  // ==========================================
  // TEMPLATE PRESETS
  // ==========================================

  const PRESET_CONFIGS: Record<
    'assessment_full' | 'board_pack' | 'ops_delivery',
    {
      intent: Partial<ReportIntent>;
      styling: Partial<ReportStyling>;
      blocks: Array<{ type: string; title: string; titlePl: string }>;
    }
  > = {
    assessment_full: {
      intent: {
        audience: 'executive',
        goal: 'diagnosis',
        tone: 'consulting',
        scope: 'full',
        requiredSectionsPreset: 'assessment_full',
        targetLength: 'standard',
        visuals: { assessmentMatrix: true, charts: true, icons: true },
      },
      styling: {
        theme: 'professional',
        layoutOrientation: 'vertical', // Portrait - standard report
        footerMode: 'minimal',
      },
      blocks: [
        { type: 'cover', title: 'Cover Page', titlePl: 'Strona tytułowa' },
        { type: 'summary', title: 'Executive Summary', titlePl: 'Streszczenie zarządcze' },
        { type: 'matrix', title: 'Assessment Matrix', titlePl: 'Macierz oceny' },
        { type: 'findings', title: 'Key Findings', titlePl: 'Kluczowe wnioski' },
        { type: 'recommendations', title: 'Recommendations', titlePl: 'Rekomendacje' },
        { type: 'action_plan', title: 'Roadmap / Action Plan', titlePl: 'Roadmapa / Plan działań' },
        { type: 'gap_analysis', title: 'Risks & Gaps', titlePl: 'Ryzyka i luki' },
        { type: 'appendix', title: 'Appendix', titlePl: 'Aneks' },
      ],
    },
    board_pack: {
      intent: {
        audience: 'board',
        goal: 'stakeholder_update',
        tone: 'decisive',
        scope: 'executive',
        requiredSectionsPreset: 'board_pack',
        targetLength: 'short',
        visuals: { assessmentMatrix: false, charts: true, icons: true },
      },
      styling: {
        theme: 'corporate',
        layoutOrientation: 'horizontal', // Landscape - presentation style
        footerMode: 'minimal',
      },
      blocks: [
        { type: 'cover', title: 'Cover Page', titlePl: 'Strona tytułowa' },
        { type: 'summary', title: 'Key Message', titlePl: 'Kluczowy przekaz' },
        { type: 'dashboard', title: 'KPI Snapshot', titlePl: 'Podsumowanie KPI' },
        { type: 'recommendations', title: 'Decisions Needed', titlePl: 'Decyzje do podjęcia' },
        { type: 'gap_analysis', title: 'Risks', titlePl: 'Ryzyka' },
        { type: 'action_plan', title: 'Next Steps', titlePl: 'Następne kroki' },
      ],
    },
    ops_delivery: {
      intent: {
        audience: 'operational',
        goal: 'roadmap',
        tone: 'neutral',
        scope: 'focused',
        requiredSectionsPreset: 'ops_delivery',
        targetLength: 'standard',
        visuals: { assessmentMatrix: false, charts: true, icons: false },
      },
      styling: {
        theme: 'minimal',
        layoutOrientation: 'vertical', // Portrait - document style
        footerMode: 'full',
      },
      blocks: [
        { type: 'cover', title: 'Cover Page', titlePl: 'Strona tytułowa' },
        { type: 'summary', title: 'Objectives', titlePl: 'Cele' },
        { type: 'context', title: 'Current State', titlePl: 'Stan obecny' },
        { type: 'table', title: 'Backlog', titlePl: 'Backlog' },
        { type: 'action_plan', title: 'Milestones', titlePl: 'Kamienie milowe' },
        { type: 'table', title: 'Dependencies', titlePl: 'Zależności' },
        { type: 'gap_analysis', title: 'Risks', titlePl: 'Ryzyka' },
      ],
    },
  };

  const applyPreset = useCallback(
    (preset: 'assessment_full' | 'board_pack' | 'ops_delivery') => {
      const config = PRESET_CONFIGS[preset];
      if (!config) return;

      // Apply intent
      setIntent((prev) => ({ ...prev, ...config.intent }));

      // Apply styling
      setStyling((prev) => ({ ...prev, ...config.styling }));

      // Replace blocks with preset defaults
      const newBlocks: BlockConfig[] = config.blocks.map((b, idx) => ({
        id: `preset_${preset}_${idx}_${Date.now()}`,
        type: b.type,
        title: isPl ? b.titlePl : b.title,
        length: 'medium',
        includeVisuals: true,
        enabled: true,
        orderIndex: idx,
      }));
      setBlocks(newBlocks);

      toast.success(
        isPl
          ? `Preset "${preset.replace('_', ' ')}" zastosowany`
          : `Preset "${preset.replace('_', ' ')}" applied`
      );
    },
    [isPl]
  );

  // Template-mode metadata
  const [templateDescription, setTemplateDescription] = useState<string>(
    templateMeta?.description || ''
  );
  const [templateSourceType, setTemplateSourceType] = useState<ReportSourceType>(
    templateMeta?.sourceType || 'ASSESSMENT'
  );
  const [templateReportType, setTemplateReportType] = useState<string>(
    templateMeta?.reportType || ''
  );
  const [templateAuthor, setTemplateAuthor] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    isTemplateMode ? initialTemplateId || null : null
  );

  // Computed template meta for SettingsPanel
  const templateMetaForPanel = React.useMemo(() => ({
    sourceType: templateSourceType,
    reportType: templateReportType,
    description: templateDescription,
    author: templateAuthor,
  }), [templateSourceType, templateReportType, templateDescription, templateAuthor]);

  const handleTemplateMetaChange = useCallback(
    (updates: Partial<typeof templateMetaForPanel>) => {
      if (updates.sourceType !== undefined) setTemplateSourceType(updates.sourceType as ReportSourceType);
      if (updates.reportType !== undefined) setTemplateReportType(updates.reportType);
      if (updates.description !== undefined) setTemplateDescription(updates.description);
      if (updates.author !== undefined) setTemplateAuthor(updates.author);
    },
    []
  );

  const reportStatus = (report?.status || 'DRAFT') as ReportStatus;
  const reportIdForActions = report?.id || reportId || null;

  const downloadExport = useCallback(
    async (format: 'pdf' | 'pptx' | 'docx', fileNameBase?: string) => {
      if (!reportIdForActions) return;
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/report-builder/${reportIdForActions}/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Export failed (${format})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (fileNameBase || reportTitle || report?.title || 'report').replace(
        /[^\p{L}\p{N}_-]+/gu,
        '_'
      );
      const ext = format;
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    [reportIdForActions, reportTitle, report?.title]
  );

  const exportPanel = reportIdForActions ? (
    <ExportSharePanel
      reportId={reportIdForActions}
      reportTitle={reportTitle}
      reportStatus={reportStatus}
      onExportPdf={() => downloadExport('pdf')}
      onExportPptx={() => downloadExport('pptx')}
      onExportWord={() => downloadExport('docx')}
      onCreateShareLink={async (options) => {
        const resp = await Api.post(`/report-builder/${reportIdForActions}/share`, options || {});
        return resp?.link || null;
      }}
      onGetShareLinks={async () => {
        const resp = await Api.get(`/report-builder/${reportIdForActions}/share`);
        return resp?.links || [];
      }}
      onRevokeShareLink={async (linkId) => {
        const resp = await Api.delete(`/report-builder/${reportIdForActions}/share/${linkId}`);
        return Boolean(resp?.success);
      }}
      isLoading={isSaving || isGenerating}
      blocks={blocks.map((b) => ({
        id: b.id,
        title: b.title,
        enabled: b.enabled,
        content: b.content,
        isGenerated: b.isGenerated,
      }))}
    />
  ) : (
    <div className="text-sm text-slate-500 dark:text-slate-400">
      {isPl
        ? 'Zapisz raport, aby odblokować eksport i udostępnianie.'
        : 'Save the report to enable export and sharing.'}
    </div>
  );

  // Review panel for report mode
  const reviewPanel = reportIdForActions ? (
    <ReviewPanel
      reportId={reportIdForActions}
      reportStatus={reportStatus}
      onStatusChange={(newStatus) => {
        // Update local report state to reflect new status
        setReport((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }}
      isPl={isPl}
    />
  ) : (
    <div className="text-sm text-slate-500 dark:text-slate-400">
      {isPl
        ? 'Zapisz raport, aby włączyć workflow recenzji.'
        : 'Save the report to enable review workflow.'}
    </div>
  );

  // Load existing report
  useEffect(() => {
    // Template mode: either edit an existing template, or start from defaults.
    if (isTemplateMode) {
      if (templateMeta?.name) setReportTitle(templateMeta.name);
      if (templateMeta?.description !== undefined)
        setTemplateDescription(templateMeta.description || '');
      if (templateMeta?.sourceType) setTemplateSourceType(templateMeta.sourceType);
      if (templateMeta?.reportType !== undefined)
        setTemplateReportType(templateMeta.reportType || '');

      if (initialTemplateId) {
        void loadTemplate(initialTemplateId);
        setEditingTemplateId(initialTemplateId);
      } else {
        initializeDefaultBlocks(templateMeta?.sourceType || templateSourceType);
      }
      return;
    }

    // Report mode (default)
    if (reportId) {
      loadReport(reportId);
    } else if (initialTemplateId) {
      // Initialize from template (generator mode)
      loadTemplate(initialTemplateId);
      setReportTitle(`${initialSourceName || 'Assessment'} - Report`);
    } else if (initialSourceType && initialSourceId) {
      // Initialize from the default template for this source (keeps frontend/backed in sync)
      void initializeFromSource(initialSourceType, initialSourceId);
      setReportTitle(`${initialSourceName || 'Assessment'} - Report`);
    }
  }, [
    reportId,
    initialSourceType,
    initialSourceId,
    initialSourceName,
    initialTemplateId,
    isTemplateMode,
    templateMeta,
    templateSourceType,
  ]);

  const loadReport = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await Api.get(`/report-builder/${id}`);
      if (response?.report) {
        setReport(response.report);
        setReportTitle(response.report.title);
        setSourceType(response.report.sourceType);
        setSourceId(response.report.sourceId);
        setSourceName(response.report.sourceName);
        setSelectedTemplateId((response.report as any).templateId || null);

        // Load intent from config
        if (response.report.config?.intent) {
          setIntent((prev) => ({ ...prev, ...response.report.config.intent }));
        }

        // Convert sections to blocks
        if (response.sections) {
          const loadedBlocks: BlockConfig[] = response.sections.map((s: ReportSection) => ({
            // IMPORTANT: use sectionKey as stable identifier
            id: s.sectionKey,
            type: (s as any).blockTypeId || s.sectionType,
            title: s.title,
            length: s.length || 'medium',
            includeVisuals:
              s.renderKind === 'matrix' ||
              Boolean(
                (s as any).renderKind &&
                ['json', 'matrix', 'table', 'chart', 'callout'].includes(
                  String((s as any).renderKind)
                )
              ),
            blockTypeId: (s as any).blockTypeId,
            renderKind: (s as any).renderKind,
            enabled: s.enabled,
            orderIndex: s.orderIndex,
            content: s.editedContent || s.generatedContent,
            isGenerated: Boolean(s.generatedContent),
            customPrompt: s.customPrompt,
          }));
          setBlocks(loadedBlocks.sort((a, b) => a.orderIndex - b.orderIndex));
        }
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplate = async (templateId: string) => {
    setIsLoading(true);
    try {
      const res = await Api.get(`/report-builder/templates/${templateId}/details`);
      const tpl = res?.template;
      if (!tpl) return;
      setSelectedTemplateId(templateId);
      if (isTemplateMode) {
        if (tpl?.name) setReportTitle(String(tpl.name));
        setTemplateDescription(String(tpl.description || ''));
        if (tpl?.sourceType) setTemplateSourceType(String(tpl.sourceType) as ReportSourceType);
        setTemplateReportType(String(tpl.reportType || ''));
      }
      const sections: any[] = Array.isArray((tpl as any).sections)
        ? (tpl as any).sections
        : (tpl as any).sections_json
          ? JSON.parse(String((tpl as any).sections_json || '[]'))
          : [];
      const templateBlocks: BlockConfig[] = sections.map((s, idx) => ({
        id: String(s.key || `tpl_${idx}`),
        type: String(s.blockTypeId || s.type || 'custom'),
        title: String(s.title || s.name || s.key || 'Section'),
        length: (s.defaultLength || s.length || 'medium') as any,
        includeVisuals: Boolean(
          s.renderKind === 'matrix' ||
          ['json', 'matrix', 'table', 'chart', 'callout'].includes(String(s.renderKind || ''))
        ),
        customPrompt: s.customPrompt || undefined,
        blockTypeId: s.blockTypeId || undefined,
        renderKind: s.renderKind || undefined,
        enabled: s.enabled !== undefined ? Boolean(s.enabled) : true,
        orderIndex: typeof s.order === 'number' ? s.order : idx,
      }));
      setBlocks(templateBlocks.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeFromSource = async (type: ReportSourceType, id: string) => {
    setIsLoading(true);
    try {
      let framework: string | undefined;
      if (type === 'ASSESSMENT') {
        const src = await Api.get(`/report-builder/sources/assessment/${id}`);
        framework = src?.framework || src?.assessmentType || undefined;
        if (src?.name) setSourceName(String(src.name));
      }

      const templateRes = await Api.get(
        `/report-builder/templates/${type}${framework ? `?framework=${encodeURIComponent(framework)}` : ''}`
      );
      const tpl = templateRes?.template;
      if (!tpl) {
        initializeDefaultBlocks(type);
        return;
      }

      // The default-template endpoint returns { id, sections }
      const sections: any[] = Array.isArray(tpl.sections) ? tpl.sections : [];
      if (sections.length === 0) {
        initializeDefaultBlocks(type);
        return;
      }
      if (tpl.id) setSelectedTemplateId(String(tpl.id));

      const defaultBlocks: BlockConfig[] = sections.map((s: any, idx: number) => ({
        id: String(s.key || `tpl_${idx}`),
        type: String(s.blockTypeId || s.type || 'custom'),
        title: String(s.title || s.name || s.key || 'Section'),
        length: (s.defaultLength || s.length || 'medium') as any,
        includeVisuals: Boolean(
          s.renderKind === 'matrix' ||
          s.type === 'matrix' ||
          ['json', 'matrix', 'table', 'chart', 'callout'].includes(String(s.renderKind || ''))
        ),
        customPrompt: s.customPrompt || undefined,
        blockTypeId: s.blockTypeId || undefined,
        renderKind: s.renderKind || undefined,
        enabled: s.enabled !== undefined ? Boolean(s.enabled) : true,
        orderIndex: typeof s.order === 'number' ? s.order : idx,
      }));
      setBlocks(defaultBlocks.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (err) {
      console.error('Failed to initialize from source:', err);
      initializeDefaultBlocks(type);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeDefaultBlocks = (type: ReportSourceType) => {
    const defaultBlocks: BlockConfig[] =
      type === 'ASSESSMENT'
        ? [
            {
              id: 'exec_summary',
              type: 'summary',
              title: isPl ? 'Streszczenie Zarządcze' : 'Executive Summary',
              length: 'medium',
              includeVisuals: false,
              enabled: true,
              orderIndex: 0,
            },
            {
              id: 'assessment_matrix',
              type: 'matrix',
              title: isPl ? 'Macierz Oceny' : 'Assessment Matrix',
              length: 'medium',
              includeVisuals: true,
              enabled: true,
              orderIndex: 1,
            },
            {
              id: 'analysis',
              type: 'analysis',
              title: isPl ? 'Analiza Szczegółowa' : 'Detailed Analysis',
              length: 'long',
              includeVisuals: true,
              enabled: true,
              orderIndex: 2,
            },
            {
              id: 'recommendations',
              type: 'recommendations',
              title: isPl ? 'Rekomendacje' : 'Recommendations',
              length: 'medium',
              includeVisuals: false,
              enabled: true,
              orderIndex: 3,
            },
          ]
        : [
            {
              id: 'summary',
              type: 'summary',
              title: isPl ? 'Podsumowanie' : 'Summary',
              length: 'medium',
              includeVisuals: false,
              enabled: true,
              orderIndex: 0,
            },
            {
              id: 'content',
              type: 'custom',
              title: isPl ? 'Treść' : 'Content',
              length: 'long',
              includeVisuals: true,
              enabled: true,
              orderIndex: 1,
            },
          ];

    setBlocks(defaultBlocks);
  };

  // Block operations
  const addBlock = useCallback(
    (
      blockType: string,
      title: string,
      afterIndex?: number,
      meta?: { blockTypeId?: string; renderKind?: string; defaultLength?: 'short' | 'medium' | 'long' }
    ) => {
      const newBlock: BlockConfig = {
        id: `tmp_${Date.now()}`,
        type: blockType,
        title,
        length: meta?.defaultLength || 'medium',
        includeVisuals: blockType === 'matrix' || meta?.renderKind === 'matrix' || meta?.renderKind === 'chart',
        blockTypeId: meta?.blockTypeId,
        renderKind: meta?.renderKind,
        enabled: true,
        orderIndex: afterIndex !== undefined ? afterIndex + 1 : blocks.length,
      };

      setBlocks((prev) => {
        const updated = [...prev];
        if (afterIndex !== undefined) {
          // Insert after specific index
          updated.splice(afterIndex + 1, 0, newBlock);
          // Reindex
          return updated.map((b, i) => ({ ...b, orderIndex: i }));
        }
        return [...updated, newBlock];
      });

      setShowBlockPalette(false);
      setSelectedBlockId(newBlock.id);
    },
    [blocks.length]
  );

  const updateBlock = useCallback((blockId: string, updates: Partial<BlockConfig>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
  }, []);

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== blockId);
      return filtered.map((b, i) => ({ ...b, orderIndex: i }));
    });
    setSelectedBlockId(null);
  }, []);

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated.map((b, i) => ({ ...b, orderIndex: i }));
    });
  }, []);

  // Save & Generate
  const handleSave = async () => {
    if (isTemplateMode) {
      const name = (reportTitle || '').trim();
      if (!name) {
        toast.error(isPl ? 'Nazwa szablonu jest wymagana' : 'Template name is required');
        return;
      }

      setIsSaving(true);
      try {
        const normalizedSections = [...blocks]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((b, idx) => ({
            key: b.id,
            type: String(
              (
                [
                  'cover',
                  'summary',
                  'methodology',
                  'matrix',
                  'axis_analysis',
                  'list',
                  'recommendations',
                  'action_plan',
                  'appendix',
                  'custom',
                ] as const
              ).includes(b.type as any)
                ? b.type
                : 'custom'
            ),
            title: b.title,
            required: Boolean(b.enabled),
            enabled: Boolean(b.enabled),
            order: idx,
            defaultLength: b.length,
            customPrompt: b.customPrompt,
            blockTypeId: b.blockTypeId,
            renderKind: b.type === 'matrix' ? 'matrix' : b.renderKind,
            description: b.description,
            dataSource: b.dataSource,
            includeVisuals: Boolean(b.includeVisuals),
          }));

        let saved: any;
        // Build defaultOptions with intent and styling for template presets
        const defaultOptions: Record<string, unknown> = {
          intent,
          styling,
        };
        if (editingTemplateId) {
          saved = await Api.put(`/report-builder/templates/${editingTemplateId}`, {
            name,
            description: templateDescription || undefined,
            sections: normalizedSections,
            defaultOptions,
          });
        } else {
          saved = await Api.post('/report-builder/templates', {
            name,
            description: templateDescription || undefined,
            sourceType: templateSourceType,
            reportType: templateReportType || undefined,
            sections: normalizedSections,
            defaultOptions,
            isPublic: false,
          });
        }

        const tpl = saved?.template;
        if (tpl?.id) {
          setEditingTemplateId(String(tpl.id));
          toast.success(isPl ? 'Szablon zapisany' : 'Template saved');
          onTemplateSaved?.({ id: String(tpl.id), name: String(tpl.name || name) });
        } else {
          toast.success(isPl ? 'Szablon zapisany' : 'Template saved');
        }
      } catch (err: any) {
        console.error('Failed to save template:', err);
        toast.error(
          err?.error || err?.message || (isPl ? 'Błąd zapisu szablonu' : 'Failed to save template')
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!sourceType || !sourceId) return;

    setIsSaving(true);
    try {
      const config = {
        intent,
        styling,
      };

      if (report?.id) {
        // Update existing
        await Api.put(`/report-builder/${report.id}/intent`, { config });
        // Persist new blocks first (tmp_ ids)
        const workingBlocks = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
        for (let i = 0; i < workingBlocks.length; i++) {
          const b = workingBlocks[i];
          if (!b.id.startsWith('tmp_')) continue;

          const afterSectionKey =
            i > 0 && !workingBlocks[i - 1].id.startsWith('tmp_')
              ? workingBlocks[i - 1].id
              : undefined;

          const normalizedSectionType = (
            [
              'cover',
              'summary',
              'methodology',
              'matrix',
              'axis_analysis',
              'list',
              'recommendations',
              'action_plan',
              'appendix',
              'custom',
            ] as const
          ).includes(b.type as any)
            ? (b.type as any)
            : 'custom';

          const created = await Api.post(`/report-builder/${report.id}/sections`, {
            title: b.title,
            sectionType: normalizedSectionType,
            afterSectionKey,
            length: b.length,
            customPrompt: b.customPrompt,
            blockTypeId: b.blockTypeId,
            renderKind: b.type === 'matrix' ? 'matrix' : b.renderKind,
          });

          const newSectionKey = created?.section?.sectionKey;
          if (newSectionKey) {
            workingBlocks[i] = { ...b, id: newSectionKey };
          }
        }

        // Sync local ids if needed
        if (workingBlocks.some((b) => b.id.startsWith('tmp_')) === false) {
          setBlocks(workingBlocks.map((b, idx) => ({ ...b, orderIndex: idx })));
        }

        // Update sections config for persisted blocks only
        const sectionUpdates = workingBlocks
          .filter((b) => !b.id.startsWith('tmp_'))
          .map((b, idx) => ({
            sectionKey: b.id,
            enabled: b.enabled,
            orderIndex: idx,
            title: b.title,
            length: b.length,
            customPrompt: b.customPrompt,
          }));
        await Api.put(`/report-builder/${report.id}/config`, { sections: sectionUpdates });
      } else {
        // Create new
        const response = await Api.post('/report-builder', {
          sourceType,
          sourceId,
          title: reportTitle || `${sourceName} - Report`,
          config,
          templateId: selectedTemplateId || undefined,
        });
        if (response?.report) {
          setReport(response.report);
          // Sync server-created sections (from template) with local desired blocks:
          const newReportId = response.report.id as string;
          const serverSections: ReportSection[] = Array.isArray(response.sections)
            ? response.sections
            : [];

          const desiredOrder = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
          const desiredKeys = new Set(
            desiredOrder.filter((b) => !b.id.startsWith('tmp_')).map((b) => b.id)
          );
          const serverKeys = new Set(serverSections.map((s: any) => String(s.sectionKey)));

          // Create any blocks not present on server (tmp_ or custom keys)
          const workingBlocks = [...desiredOrder];
          for (let i = 0; i < workingBlocks.length; i++) {
            const b = workingBlocks[i];
            if (!b.id.startsWith('tmp_') && serverKeys.has(b.id)) continue;
            if (!b.id.startsWith('tmp_') && desiredKeys.has(b.id) && !serverKeys.has(b.id)) {
              // key-based custom block not present server-side
            }
            if (!b.id.startsWith('tmp_') && serverKeys.has(b.id)) continue;

            const afterSectionKey =
              i > 0 && !workingBlocks[i - 1].id.startsWith('tmp_')
                ? workingBlocks[i - 1].id
                : undefined;
            const normalizedSectionType = (
              [
                'cover',
                'summary',
                'methodology',
                'matrix',
                'axis_analysis',
                'list',
                'recommendations',
                'action_plan',
                'appendix',
                'custom',
              ] as const
            ).includes(b.type as any)
              ? (b.type as any)
              : 'custom';

            const created = await Api.post(`/report-builder/${newReportId}/sections`, {
              title: b.title,
              sectionType: normalizedSectionType,
              afterSectionKey,
              length: b.length,
              customPrompt: b.customPrompt,
              blockTypeId: b.blockTypeId,
              renderKind: b.type === 'matrix' ? 'matrix' : b.renderKind,
            });
            const newSectionKey = created?.section?.sectionKey;
            if (newSectionKey) {
              workingBlocks[i] = { ...b, id: newSectionKey };
            }
          }

          // Update config order/title/etc for blocks we want visible.
          // For server sections missing in the desired blocks list, disable them instead of deleting
          // (some sections may be required and cannot be deleted).
          const desiredBlocksPersisted = workingBlocks.filter((b) => !b.id.startsWith('tmp_'));
          const desiredOrderKeys = desiredBlocksPersisted.map((b) => b.id);
          const desiredOrderIndex = new Map(desiredOrderKeys.map((k, idx) => [k, idx]));

          const disabledUpdates = serverSections
            .map((s: any) => String(s.sectionKey))
            .filter((key) => key && !desiredOrderIndex.has(key))
            .map((key, idx) => ({
              sectionKey: key,
              enabled: false,
              // keep them after visible blocks to avoid collisions
              orderIndex: desiredBlocksPersisted.length + idx + 100,
            }));

          const visibleUpdates = desiredBlocksPersisted.map((b, idx) => ({
            sectionKey: b.id,
            enabled: b.enabled,
            orderIndex: idx,
            title: b.title,
            length: b.length,
            customPrompt: b.customPrompt,
          }));

          const sectionUpdates = [...visibleUpdates, ...disabledUpdates];
          await Api.put(`/report-builder/${newReportId}/config`, { sections: sectionUpdates });

          // Reload report to get final persisted ordering/content
          await loadReport(newReportId);
          onSave?.(response.report.id);
        }
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (isTemplateMode) return;
    if (!report?.id) {
      // Save first
      await handleSave();
    }

    if (!report?.id) return;

    setIsGenerating(true);
    try {
      const response = await Api.post(`/report-builder/${report.id}/generate`, {
        regenerateAll: false,
      });

      if (response?.sections) {
        const updatedBlocks = blocks.map((block) => {
          const section = response.sections.find(
            (s: ReportSection) => s.sectionKey === block.id || s.id === block.id
          );
          if (section) {
            return {
              ...block,
              content: section.editedContent || section.generatedContent,
              isGenerated: true,
            };
          }
          return block;
        });
        setBlocks(updatedBlocks);
      }
    } catch (err) {
      console.error('Failed to generate:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">{isPl ? 'Ładowanie...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Top Bar */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder={
              isTemplateMode
                ? isPl
                  ? 'Nazwa szablonu...'
                  : 'Template name...'
                : isPl
                  ? 'Tytuł raportu...'
                  : 'Report title...'
            }
            className="text-lg font-semibold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 w-80"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isTemplateMode
              ? isPl
                ? 'Zapisz szablon'
                : 'Save template'
              : isPl
                ? 'Zapisz'
                : 'Save'}
          </button>

          {!isTemplateMode && (
            <>
              <button className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <Eye className="w-4 h-4" />
                {isPl ? 'Podgląd' : 'Preview'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || blocks.filter((b) => b.enabled).length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isPl ? 'Generuj' : 'Generate'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Block Canvas */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Source Info */}
            {!isTemplateMode && sourceName && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Layers className="w-4 h-4" />
                <span>
                  {isPl ? 'Źródło:' : 'Source:'} {sourceName}
                </span>
              </div>
            )}

            {/* Blocks */}
            {blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onRemove={() => removeBlock(block.id)}
                onMoveUp={() => moveBlock(block.id, 'up')}
                onMoveDown={() => moveBlock(block.id, 'down')}
                onAddBelow={() => {
                  setShowBlockPalette(true);
                }}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
                isPl={isPl}
              />
            ))}

            {/* Add Block Button */}
            <button
              onClick={() => setShowBlockPalette(true)}
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {isPl ? 'Dodaj blok' : 'Add block'}
            </button>

            {/* Empty State */}
            {blocks.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {isPl ? 'Zacznij budować raport' : 'Start building your report'}
                </h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                  {isPl
                    ? 'Dodaj bloki, aby zdefiniować strukturę raportu. Każdy blok może zawierać tekst, dane, wykresy lub wizualizacje.'
                    : 'Add blocks to define your report structure. Each block can contain text, data, charts, or visualizations.'}
                </p>
                <button
                  onClick={() => setShowBlockPalette(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  {isPl ? 'Dodaj pierwszy blok' : 'Add first block'}
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Settings */}
        <SettingsPanel
          intent={intent}
          styling={styling}
          sourceType={isTemplateMode ? templateSourceType : sourceType}
          sourceName={isTemplateMode ? null : sourceName}
          onIntentChange={(updates) => setIntent((prev) => ({ ...prev, ...updates }))}
          onStylingChange={(updates) => setStyling((prev) => ({ ...prev, ...updates }))}
          activeSection={settingsSection}
          onSectionChange={setSettingsSection}
          isTemplateMode={isTemplateMode}
          onApplyPreset={isTemplateMode ? applyPreset : undefined}
          templateMeta={isTemplateMode ? templateMetaForPanel : undefined}
          onTemplateMetaChange={isTemplateMode ? handleTemplateMetaChange : undefined}
          exportPanel={exportPanel}
          isCollapsed={isSettingsPanelCollapsed}
          onToggleCollapse={() => setIsSettingsPanelCollapsed((prev) => !prev)}
          reviewPanel={isTemplateMode ? undefined : reviewPanel}
        />
      </div>

      {/* Block Palette Modal */}
      {showBlockPalette && (
        <BlockPalette
          onSelect={addBlock}
          onClose={() => setShowBlockPalette(false)}
          isPl={isPl}
          sourceType={isTemplateMode ? templateSourceType : sourceType}
        />
      )}
    </div>
  );
};

export default ReportEditor;
