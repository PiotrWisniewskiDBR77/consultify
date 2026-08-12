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
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Globe,
  Grip,
  Image,
  Layers,
  Loader2,
  Monitor,
  MoreHorizontal,
  Palette,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  Type,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { useAppStore } from '@/store/useAppStore';
import { isArtifactApprovalUiEnabled } from '@/utils/artifactApprovalUiFlag';

import { Api } from '../../../services/api';
import { getSourceDisplayLabel } from '../../Initiatives/InitiativeSourceLink';
import TeresaMark from '../../shared/TeresaMark';
import { SmartBlockRenderer } from '../blocks/SmartBlockRenderer';
import { ExportSharePanel } from '../ExportSharePanel';
import { QualityGatesPanel } from '../QualityGatesPanel';
import { ReportAgentChat } from '../ReportAgentChat';
import type {
  Report,
  ReportSection,
  ReportSourceType,
  ReportStatus,
  SourceOption,
} from '../useReportBuilder';
import { BlockCard } from './BlockCard';
import { BlockPalette } from './BlockPalette';
import { ChapterNavigation, groupBlocksIntoChapters, hasChapters } from './ChapterNavigation';
import { EscalationBanner } from './EscalationBanner';
import { NarrativeEngineMetadata } from './NarrativeEngineMetadata';
import { ReviewPanel } from './ReviewPanel';
import { SettingsPanel } from './SettingsPanel';
import { StaleDataBadge } from './StaleDataBadge';

// ==========================================
// TYPES
// ==========================================

export interface ReportIntent {
  audience: 'executive' | 'technical' | 'board' | 'operational' | 'mixed';
  goal: 'diagnosis' | 'roadmap' | 'investment_decision' | 'stakeholder_update' | 'summary';
  /** Supported languages: pl, en, de, es, ar, ja */
  language: 'pl' | 'en' | 'de' | 'es' | 'ar' | 'ja';
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
  /** Show "Created in Consultify" branding - default true */
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
  /**
   * Chapter/section grouping key for organizing long reports (REQ-7).
   * All blocks with the same chapterKey are grouped visually under that chapter.
   */
  chapterKey?: string;
  /** Display title for the chapter this block belongs to */
  chapterTitle?: string;
  /** User-provided source data, context, and references for AI generation */
  sourceContext?: string;
  /** Tracks if settings/prompt changed since last generation - block should be re-generated */
  needsRegeneration?: boolean;
  /** Whether this block can be refreshed from latest source data */
  isRefreshable?: boolean;
  /** Last time source data was synchronized */
  lastDataTimestamp?: string;
  /** When content was generated by AI */
  generatedAt?: string;
  /** True while a refresh-from-source is in progress */
  isRefreshing?: boolean;
  /** AI model/pipeline used for generation (e.g. 'narrative-engine-v3') */
  generationModel?: string;
  /** Narrative Engine pipeline metadata (when generationModel includes 'narrative-engine') */
  narrativeEngineStats?: {
    factsUsed: number;
    observationsUsed: number;
    postCheckPassed: boolean;
  };
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
// HELPERS
// ==========================================

function parseNarrativeEngineStats(
  snapshot: string | null | undefined
): BlockConfig['narrativeEngineStats'] | undefined {
  if (!snapshot) return undefined;
  try {
    const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    if (parsed?.narrative_engine) {
      const ne = parsed.narrative_engine;
      return {
        factsUsed: ne.facts_used ?? 0,
        observationsUsed: ne.observations_used ?? 0,
        postCheckPassed: Boolean(ne.post_check_passed),
      };
    }
  } catch {
    /* malformed */
  }
  return undefined;
}

// ==========================================
// PREVIEW MODAL
// ==========================================

interface ReportPreviewModalProps {
  blocks: BlockConfig[];
  reportTitle: string;
  sourceName: string | null;
  styling: ReportStyling;
  intent: ReportIntent;
  isPl: boolean;
  onClose: () => void;
}

/**
 * Renders a cover page block nicely instead of showing raw JSON.
 */
function renderCoverPage(
  content: string,
  reportTitle: string,
  styling: ReportStyling
): React.ReactNode {
  let parsed: Record<string, string> | null = null;
  try {
    // Cover pages are often stored as JSON
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed);
    }
  } catch {
    // Not JSON — render as markdown
  }

  if (parsed) {
    const title = parsed.title || reportTitle || 'Report';
    const subtitle = parsed.subtitle || '';
    const company = parsed.companyName || parsed.company || '';
    const date =
      parsed.date ||
      new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const assessmentType = parsed.assessmentType || '';

    return (
      <div
        className="flex flex-col items-center justify-center text-center py-24 px-8"
        style={{ minHeight: '60vh' }}
      >
        {assessmentType && (
          <div
            className="text-sm font-semibold uppercase tracking-widest mb-6 opacity-70"
            style={{ color: styling.accentColor }}
          >
            {assessmentType} Assessment
          </div>
        )}
        <h1
          className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
          style={{ color: styling.primaryColor }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-lg text-c-text-secondary mb-8 max-w-2xl">{subtitle}</p>}
        <div className="flex items-center gap-3 text-c-text-secondary text-sm mt-4">
          {company && <span className="font-medium">{company}</span>}
          {company && date && <span>·</span>}
          {date && <span>{date}</span>}
        </div>
      </div>
    );
  }

  // Fallback: render as markdown
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Detects if content is JSON (e.g. assessment_matrix) and renders it
 * as a nice table; otherwise renders markdown.
 */
const SmartContentRenderer: React.FC<{
  content: string;
  blockType: string;
  styling: ReportStyling;
}> = ({ content, blockType, styling }) => {
  const trimmed = content.trim();

  // Try to parse JSON matrix data
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      // Assessment matrix format: { type: "assessment_matrix", axes: [...] }
      if (parsed.type === 'assessment_matrix' && Array.isArray(parsed.axes)) {
        return (
          <div className="not-prose">
            <table
              /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-sm border-collapse"
            >
              <thead>
                <tr className="border-b-2 border-c-border-subtle">
                  <th className="text-left py-3 px-4 font-semibold text-c-text">Axis</th>
                  <th className="text-center py-3 px-4 font-semibold text-c-text">Score</th>
                  <th className="text-center py-3 px-4 font-semibold text-c-text">Max</th>
                  <th className="text-center py-3 px-4 font-semibold text-c-text">Gap</th>
                  <th className="text-left py-3 px-4 font-semibold text-c-text w-40">Progress</th>
                </tr>
              </thead>
              <tbody>
                {parsed.axes.map((axis: any, i: number) => {
                  const pct = parsed.scaleMax
                    ? Math.round((axis.score / parsed.scaleMax) * 100)
                    : 0;
                  return (
                    <tr key={axis.axisId || i} className="border-b border-c-border-subtle">
                      <td className="py-3 px-4 font-medium text-c-text">{axis.axisName}</td>
                      <td
                        className="py-3 px-4 text-center font-semibold"
                        style={{ color: styling.primaryColor }}
                      >
                        {axis.score}
                      </td>
                      <td className="py-3 px-4 text-center text-c-text-secondary">
                        {axis.maxScore || parsed.scaleMax}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-medium ${axis.gap > 2 ? 'text-danger-500' : axis.gap > 1 ? 'text-amber-500' : 'text-green-500'}`}
                        >
                          {axis.gap}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-c-border-subtle rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: styling.primaryColor,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    } catch {
      // Not valid JSON — fall through to markdown
    }
  }

  return <ReactMarkdown>{content}</ReactMarkdown>;
};

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  blocks,
  reportTitle,
  sourceName,
  styling,
  intent,
  isPl,
  onClose,
}) => {
  const { t } = useTranslation();
  const enabledBlocks = useMemo(
    () => blocks.filter((b) => b.enabled).sort((a, b) => a.orderIndex - b.orderIndex),
    [blocks]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fontClass =
    styling.fontFamily === 'inter'
      ? 'font-sans'
      : styling.fontFamily === 'roboto'
        ? 'font-sans'
        : styling.fontFamily === 'poppins'
          ? 'font-sans'
          : 'font-sans';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-c-surface">
      {/* Preview Header */}
      <header className="h-12 bg-c-surface-raised border-b border-c-border-subtle flex items-center justify-between px-6 flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-c-text-secondary" />
          <span className="text-sm font-medium text-c-text">
            {t('reportBuilder.editor.reportPreview', 'Report Preview')}
          </span>
          <span className="text-xs text-c-text-secondary ml-2">
            {enabledBlocks.length} {t('reportBuilder.editor.sections', 'sections')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
          >
            <Download className="w-4 h-4" />
            {t('reportBuilder.editor.printPdf', 'Print / PDF')}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-c-border-subtle text-c-text hover:bg-c-border rounded-lg"
          >
            <X className="w-4 h-4" />
            {t('reportBuilder.editor.close', 'Close')}
          </button>
        </div>
      </header>

      {/* Preview Body */}
      <div className="flex-1 overflow-y-auto bg-c-surface-raised print:bg-c-surface">
        <div
          className={`max-w-4xl mx-auto my-8 bg-c-surface shadow-xl rounded-lg print:shadow-none print:rounded-none print:my-0 print:max-w-none ${fontClass}`}
        >
          {enabledBlocks.map((block, idx) => {
            const content = block.content || '';
            const isCover = block.type === 'cover' || block.type === 'cover_page';
            const hasContent = content.trim().length > 0;

            return (
              <section
                key={block.id}
                className={`${idx > 0 ? 'border-t border-c-border-subtle' : ''} ${isCover ? '' : 'px-12 py-10 md:px-16 md:py-12'}`}
                style={{ pageBreakBefore: idx > 0 ? 'always' : undefined }}
              >
                {isCover && hasContent ? (
                  renderCoverPage(content, reportTitle, styling)
                ) : (
                  <>
                    {/* Section title */}
                    {!isCover && (
                      <h2
                        className="text-2xl font-bold mb-6"
                        style={{ color: styling.primaryColor }}
                      >
                        {block.title}
                      </h2>
                    )}

                    {/* Section content */}
                    {hasContent ? (
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h3:text-lg prose-p:leading-relaxed prose-li:leading-relaxed">
                        <SmartBlockRenderer
                          content={content}
                          blockType={block.type}
                          renderKind={block.renderKind}
                          primaryColor={styling.primaryColor}
                          accentColor={styling.accentColor}
                          blockSettings={block.blockSettings}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12 text-c-text-secondary">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm italic">
                          {t(
                            'reportBuilder.editor.thisSectionHasNoContentYet',
                            'This section has no content yet. Click "Generate" in the editor.'
                          )}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}

          {/* Footer */}
          {styling.showBranding && (
            <div className="border-t border-c-border-subtle px-12 py-6 text-center text-xs text-c-text-secondary print:text-c-text-secondary">
              {t('reportBuilder.editor.createdWith', 'Created with')} Consultify
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const { t, i18n } = useTranslation();
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
    accentColor: '#6366F1',
    customColors: [],
    fontFamily: 'inter',
    fontSize: 'medium',
    layoutOrientation: 'vertical',
    footerMode: 'minimal',
    showLogo: false,
    clientLogoUrl: undefined,
    showBranding: true, // "Stworzono w Consultify" - domyślnie włączone
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<
    'intent' | 'styling' | 'export' | 'review' | 'versions'
  >('intent');
  const [isSettingsPanelCollapsed, setIsSettingsPanelCollapsed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [showChapterNav, setShowChapterNav] = useState(true);
  const [ragMap, setRagMap] = useState<Record<string, 'green' | 'amber' | 'red'>>({});
  const [showAgentChat, setShowAgentChat] = useState(false);
  // Version history is now rendered inline inside SettingsPanel
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Source state
  const [sourceType, setSourceType] = useState<ReportSourceType | null>(initialSourceType || null);
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId || null);
  const [sourceName, setSourceName] = useState<string | null>(initialSourceName || null);
  const [reportTitle, setReportTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId || null
  );
  const [reportBacklinks, setReportBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [reportBacklinksLoading, setReportBacklinksLoading] = useState(false);

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
        t('reportBuilder.editor.presetApplied', {
          defaultValue: `Preset "${preset.replace('_', ' ')}" applied`,
          preset: preset.replace('_', ' '),
        })
      );
    },
    [isPl, t]
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
  const templateMetaForPanel = React.useMemo(
    () => ({
      sourceType: templateSourceType,
      reportType: templateReportType,
      description: templateDescription,
      author: templateAuthor,
    }),
    [templateSourceType, templateReportType, templateDescription, templateAuthor]
  );

  const handleTemplateMetaChange = useCallback((updates: Partial<typeof templateMetaForPanel>) => {
    if (updates.sourceType !== undefined)
      setTemplateSourceType(updates.sourceType as ReportSourceType);
    if (updates.reportType !== undefined) setTemplateReportType(updates.reportType);
    if (updates.description !== undefined) setTemplateDescription(updates.description);
    if (updates.author !== undefined) setTemplateAuthor(updates.author);
  }, []);

  const reportStatus = (report?.status || 'DRAFT') as ReportStatus;
  const reportIdForActions = report?.id || reportId || null;

  // HP-8 — current user for the approval status bar (canonical store source).
  const approvalUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (!reportIdForActions || isTemplateMode) return;
    setReportBacklinksLoading(true);
    Api.getLinkGraphBacklinks({ type: 'report', id: reportIdForActions, limit: 50 })
      .then((rows: any) => {
        setReportBacklinks(
          (Array.isArray(rows) ? rows : [])
            .map((x: any) => ({
              id: String(x?.id || ''),
              sourceType: String(x?.sourceType || ''),
              sourceId: String(x?.sourceId || ''),
            }))
            .filter((x) => x.sourceType && x.sourceId)
        );
      })
      .catch(() => setReportBacklinks([]))
      .finally(() => setReportBacklinksLoading(false));
  }, [isTemplateMode, reportIdForActions]);

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

  // Version loading (defined early because handleViewExport depends on it)
  const loadVersions = useCallback(async () => {
    if (!report?.id) return;
    setIsLoadingVersions(true);
    try {
      const res = await Api.get(`/report-builder/${report.id}/versions`);
      setVersions(res?.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [report?.id]);

  // Export + create version in one action
  const handleViewExport = useCallback(
    async (format: 'web' | 'pdf' | 'pptx' | 'docx') => {
      if (format === 'web') {
        setShowPreview(true);
        return;
      }
      setIsExporting(format);
      try {
        await downloadExport(format);
        // Save a version snapshot so the export is recorded in history
        if (report?.id) {
          const formatLabel = format.toUpperCase();
          await Api.post(`/report-builder/${report.id}/versions`, {
            changeSummary: t('reportBuilder.editor.exportFormatLabel', {
              defaultValue: `${formatLabel} export`,
              format: formatLabel,
            }),
          });
          loadVersions();
          toast.success(
            t('reportBuilder.editor.exportedAndVersionSaved', {
              defaultValue: `${formatLabel} exported & version saved`,
              format: formatLabel,
            })
          );
        }
      } catch (err) {
        console.error(`Export ${format} failed:`, err);
        toast.error(
          t('reportBuilder.editor.failedToExportFormat', {
            defaultValue: `Failed to export ${format.toUpperCase()}`,
            format: format.toUpperCase(),
          })
        );
      } finally {
        setIsExporting(null);
      }
    },
    [downloadExport, report?.id, t, loadVersions]
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
    <div className="text-sm text-c-text-secondary">
      {t(
        'reportBuilder.editor.saveTheReportToEnableExport',
        'Save the report to enable export and sharing.'
      )}
    </div>
  );

  // Review panel for report mode
  const reviewPanel = reportIdForActions ? (
    <>
      <ReviewPanel
        reportId={reportIdForActions}
        reportStatus={reportStatus}
        onStatusChange={(newStatus) => {
          // Update local report state to reflect new status
          setReport((prev) => (prev ? { ...prev, status: newStatus } : prev));
        }}
        isPl={isPl}
      />
      <EmbeddedView
        title={t('reportBuilder.editor.usedInBacklinks', 'Used in (backlinks)')}
        count={reportBacklinks.length}
        loading={reportBacklinksLoading}
        readOnly
        viewModes={['list']}
      >
        {reportBacklinks.length === 0 && !reportBacklinksLoading ? (
          <div className="text-xs text-c-text-secondary">
            {t('reportBuilder.editor.noLinksYet', 'No links yet')}
          </div>
        ) : (
          <div className="space-y-2">
            {reportBacklinks.slice(0, 8).map((bl) => (
              <div
                key={bl.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03]/[0.08] bg-c-surface/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-c-text">
                    {getSourceDisplayLabel(bl.sourceType, isPl)}
                  </div>
                  <div className="truncate text-[11px] text-c-text-secondary">{bl.sourceId}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('mywork-open-item', {
                        detail: {
                          type: bl.sourceType,
                          id: bl.sourceId,
                          name: `${bl.sourceType} ${bl.sourceId}`,
                        },
                      })
                    )
                  }
                  className="shrink-0 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {t('reportBuilder.editor.open', 'Open')}
                </button>
              </div>
            ))}
          </div>
        )}
      </EmbeddedView>
    </>
  ) : (
    <div className="text-sm text-c-text-secondary">
      {t(
        'reportBuilder.editor.saveTheReportToEnableReview',
        'Save the report to enable review workflow.'
      )}
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
          const loadedBlocks: BlockConfig[] = response.sections.map((s: ReportSection) => {
            // Parse blockConfig from backend
            let parsedBlockSettings: Record<string, unknown> = {};
            try {
              if ((s as any).blockConfigJson) {
                parsedBlockSettings =
                  typeof (s as any).blockConfigJson === 'string'
                    ? JSON.parse((s as any).blockConfigJson)
                    : (s as any).blockConfigJson;
              } else if ((s as any).blockConfig) {
                parsedBlockSettings =
                  typeof (s as any).blockConfig === 'string'
                    ? JSON.parse((s as any).blockConfig)
                    : (s as any).blockConfig;
              }
            } catch {
              /* ignore parse errors */
            }

            return {
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
              blockSettings: parsedBlockSettings,
              sourceContext: (parsedBlockSettings as any)?._sourceContext || undefined,
              chapterKey: (s as any).chapterKey || undefined,
              chapterTitle: (s as any).chapterTitle || undefined,
              isRefreshable: Boolean((s as any).isRefreshable),
              lastDataTimestamp: (s as any).lastDataTimestamp || undefined,
              generatedAt: (s as any).generatedAt || undefined,
              generationModel: (s as any).generationModel || undefined,
              narrativeEngineStats: parseNarrativeEngineStats((s as any).sourceDataSnapshot),
            };
          });
          setBlocks(loadedBlocks.sort((a, b) => a.orderIndex - b.orderIndex));

          // Extract RAG map from section data
          const newRagMap: Record<string, 'green' | 'amber' | 'red'> = {};
          for (const s of response.sections as ReportSection[]) {
            const ragValue = (s as any).rag;
            if (ragValue && (ragValue === 'green' || ragValue === 'amber' || ragValue === 'red')) {
              newRagMap[s.sectionKey] = ragValue;
            }
          }
          setRagMap(newRagMap);
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
              title: t('reportBuilder.editor.executiveSummary', 'Executive Summary'),
              length: 'medium',
              includeVisuals: false,
              enabled: true,
              orderIndex: 0,
            },
            {
              id: 'assessment_matrix',
              type: 'matrix',
              title: t('reportBuilder.editor.assessmentMatrix', 'Assessment Matrix'),
              length: 'medium',
              includeVisuals: true,
              enabled: true,
              orderIndex: 1,
            },
            {
              id: 'analysis',
              type: 'analysis',
              title: t('reportBuilder.editor.detailedAnalysis', 'Detailed Analysis'),
              length: 'long',
              includeVisuals: true,
              enabled: true,
              orderIndex: 2,
            },
            {
              id: 'recommendations',
              type: 'recommendations',
              title: t('reportBuilder.editor.recommendations', 'Recommendations'),
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
              title: t('reportBuilder.editor.summary', 'Summary'),
              length: 'medium',
              includeVisuals: false,
              enabled: true,
              orderIndex: 0,
            },
            {
              id: 'content',
              type: 'custom',
              title: t('reportBuilder.editor.content', 'Content'),
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
      meta?: {
        blockTypeId?: string;
        renderKind?: string;
        defaultLength?: 'short' | 'medium' | 'long';
      }
    ) => {
      const newBlock: BlockConfig = {
        id: `tmp_${Date.now()}`,
        type: blockType,
        title,
        length: meta?.defaultLength || 'medium',
        includeVisuals:
          blockType === 'matrix' || meta?.renderKind === 'matrix' || meta?.renderKind === 'chart',
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
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        // Auto-mark as needsRegeneration when AI-relevant fields change on already-generated block
        const aiRelevantKeys: (keyof BlockConfig)[] = [
          'customPrompt',
          'sourceContext',
          'blockSettings',
          'length',
          'includeVisuals',
        ];
        const hasAiChange = Object.keys(updates).some((k) =>
          aiRelevantKeys.includes(k as keyof BlockConfig)
        );
        const markDirty = b.isGenerated && hasAiChange && !('needsRegeneration' in updates);
        return { ...b, ...updates, ...(markDirty ? { needsRegeneration: true } : {}) };
      })
    );
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

  // Chapter operations (REQ-7)
  const addChapter = useCallback(
    (chapterName?: string) => {
      const existingChapterKeys = new Set(blocks.map((b) => b.chapterKey).filter(Boolean));
      const hasExistingChapters = existingChapterKeys.size > 0;
      const chapterNum = existingChapterKeys.size + 1;
      const newKey = `chapter_${chapterNum}_${Date.now()}`;
      const newTitle =
        chapterName ||
        t('reportBuilder.editor.chapterN', {
          defaultValue: `Chapter ${chapterNum}`,
          number: chapterNum,
        });

      if (!hasExistingChapters) {
        // FIRST TIME creating chapters: auto-split blocks into 2 chapters
        // Chapter 1 gets the first half, the user's chapter gets the second half
        const midpoint = Math.ceil(blocks.length / 2);
        const ts = Date.now();
        const ch1Key = `chapter_1_${ts}`;
        const ch1Title = t('reportBuilder.editor.chapter1', 'Chapter 1');
        const ch2Key = `chapter_2_${ts}`;
        const ch2Title = newTitle || t('reportBuilder.editor.chapter2', 'Chapter 2');

        setBlocks((prev) =>
          prev.map((b, idx) => ({
            ...b,
            chapterKey: idx < midpoint ? ch1Key : ch2Key,
            chapterTitle: idx < midpoint ? ch1Title : ch2Title,
          }))
        );
      } else {
        // Chapters already exist: create a new empty chapter
        // Assign the selected block to it, or the first ungrouped block
        const ungroupedBlocks = blocks.filter((b) => !b.chapterKey);
        const targetBlockId =
          (selectedBlockId && !blocks.find((b) => b.id === selectedBlockId)?.chapterKey
            ? selectedBlockId
            : null) || ungroupedBlocks[0]?.id;

        if (targetBlockId) {
          // Assign the target block to the new chapter
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === targetBlockId ? { ...b, chapterKey: newKey, chapterTitle: newTitle } : b
            )
          );
        } else {
          // All blocks are in chapters. Move the selected block (or last block)
          // to the new chapter so it's not empty.
          const blockToMove = selectedBlockId || blocks[blocks.length - 1]?.id;
          if (blockToMove) {
            setBlocks((prev) =>
              prev.map((b) =>
                b.id === blockToMove ? { ...b, chapterKey: newKey, chapterTitle: newTitle } : b
              )
            );
          }
        }
      }
    },
    [blocks, t, selectedBlockId]
  );

  const assignChapter = useCallback((blockId: string, chapterKey: string | undefined) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              chapterKey: chapterKey || undefined,
              chapterTitle: chapterKey ? b.chapterTitle : undefined,
            }
          : b
      )
    );
  }, []);

  const renameChapter = useCallback((chapterKey: string, newTitle: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.chapterKey === chapterKey ? { ...b, chapterTitle: newTitle } : b))
    );
  }, []);

  // Delete chapter - move all its blocks to ungrouped
  const deleteChapter = useCallback((chapterKey: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.chapterKey === chapterKey ? { ...b, chapterKey: undefined, chapterTitle: undefined } : b
      )
    );
  }, []);

  // Reorder blocks by swapping positions (for drag & drop)
  const reorderBlocks = useCallback((activeBlockId: string, overBlockId: string) => {
    setBlocks((prev) => {
      const activeIdx = prev.findIndex((b) => b.id === activeBlockId);
      const overIdx = prev.findIndex((b) => b.id === overBlockId);
      if (activeIdx === -1 || overIdx === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(activeIdx, 1);
      updated.splice(overIdx, 0, moved);
      return updated.map((b, i) => ({ ...b, orderIndex: i }));
    });
  }, []);

  // Move block to a different chapter
  const moveBlockToChapter = useCallback(
    (blockId: string, targetChapterKey: string | undefined) => {
      setBlocks((prev) => {
        const block = prev.find((b) => b.id === blockId);
        if (!block) return prev;

        // Get chapter title from existing blocks in target chapter
        const existingInChapter = prev.find(
          (b) => b.chapterKey === targetChapterKey && targetChapterKey
        );
        const chapterTitle = existingInChapter?.chapterTitle || targetChapterKey;

        return prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                chapterKey: targetChapterKey || undefined,
                chapterTitle: targetChapterKey ? chapterTitle : undefined,
              }
            : b
        );
      });
    },
    []
  );

  // Regenerate single block with AI instruction (REQ-3)
  const regenerateBlock = useCallback(
    async (blockId: string, instruction: string) => {
      if (!report?.id) return;
      const block = blocks.find((b) => b.id === blockId);
      if (!block || block.id.startsWith('tmp_')) return;

      // Mark block as generating
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, isGenerating: true } : b)));

      try {
        const response = await Api.post(
          `/report-builder/${report.id}/generate-section/${blockId}`,
          { customPrompt: instruction }
        );

        if (response?.section) {
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    content: response.section.editedContent || response.section.generatedContent,
                    isGenerated: true,
                    isGenerating: false,
                    needsRegeneration: false,
                  }
                : b
            )
          );
        }
      } catch (err) {
        console.error('Failed to regenerate block:', err);
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, isGenerating: false } : b))
        );
      }
    },
    [report?.id, blocks]
  );

  // Generate a single block (no instruction - uses block's own settings & customPrompt)
  const generateSingleBlock = useCallback(
    async (blockId: string) => {
      if (!report?.id) return;
      const block = blocks.find((b) => b.id === blockId);
      if (!block || block.id.startsWith('tmp_')) return;

      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, isGenerating: true } : b)));

      try {
        const response = await Api.post(
          `/report-builder/${report.id}/generate-section/${blockId}`,
          {}
        );

        if (response?.section) {
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    content: response.section.editedContent || response.section.generatedContent,
                    isGenerated: true,
                    isGenerating: false,
                    needsRegeneration: false,
                  }
                : b
            )
          );
          toast.success(
            t('reportBuilder.editor.generatedBlockTitle', {
              defaultValue: `Generated: ${block.title}`,
              title: block.title,
            })
          );
        }
      } catch (err) {
        console.error('Failed to generate block:', err);
        toast.error(t('reportBuilder.editor.generationFailed', 'Generation failed'));
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, isGenerating: false } : b))
        );
      }
    },
    [report?.id, blocks, t]
  );

  // Save edited content to backend (REQ-6: Inline Editing)
  const saveBlockContent = useCallback(
    async (blockId: string, newContent: string) => {
      // Update local state immediately
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b)));

      // Persist to backend if report exists and block is not temporary
      if (report?.id && !blockId.startsWith('tmp_')) {
        try {
          await Api.put(`/report-builder/${report.id}/sections/${blockId}/content`, {
            content: newContent,
            contentFormat: 'markdown',
          });
        } catch (err) {
          console.error('Failed to save block content:', err);
          toast.error(t('reportBuilder.editor.failedToSaveContent', 'Failed to save content'));
        }
      }
    },
    [report?.id, t]
  );

  // ===== REFRESH (Phase 8: Refreshable Blocks) =====

  const handleRefreshBlock = useCallback(
    async (blockId: string) => {
      if (!report?.id || blockId.startsWith('tmp_')) return;

      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, isRefreshing: true } : b)));

      try {
        const response = await Api.post(
          `/report-builder/${report.id}/sections/${blockId}/refresh`,
          {}
        );

        if (response?.newContent) {
          const changesList =
            (response.diff || []).join(', ') || t('reportBuilder.editor.noDetails', 'no details');
          const accept = window.confirm(
            t('reportBuilder.editor.newContentGeneratedConfirm', {
              defaultValue: `New content has been generated.\n\nChanges: ${changesList}\n\nApply the new version?`,
              changes: changesList,
            })
          );

          if (accept) {
            await Api.post(`/report-builder/${report.id}/sections/${blockId}/accept-refresh`, {
              newContent: response.newContent,
            });

            setBlocks((prev) =>
              prev.map((b) =>
                b.id === blockId
                  ? {
                      ...b,
                      content: response.newContent,
                      isRefreshing: false,
                      lastDataTimestamp: new Date().toISOString(),
                    }
                  : b
              )
            );
            toast.success(t('reportBuilder.editor.sectionRefreshed', 'Section refreshed'));
          } else {
            setBlocks((prev) =>
              prev.map((b) => (b.id === blockId ? { ...b, isRefreshing: false } : b))
            );
          }
        } else {
          setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, isRefreshing: false } : b))
          );
        }
      } catch (err) {
        console.error('Failed to refresh block:', err);
        toast.error(t('reportBuilder.editor.failedToRefreshSection', 'Failed to refresh section'));
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, isRefreshing: false } : b))
        );
      }
    },
    [report?.id, t]
  );

  // ===== COMMENTS (Backend CRUD) =====

  const loadBlockComments = useCallback(
    async (sectionKey: string) => {
      if (!report?.id) return [];
      try {
        const response = await Api.get(
          `/report-builder/${report.id}/comments?sectionKey=${sectionKey}`
        );
        return (response.comments || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          commentType: c.commentType || c.comment_type || 'FEEDBACK',
          status: c.status || 'OPEN',
          userId: c.userId || c.user_id,
          userName: c.userName || c.user_name || 'User',
          userAvatar: c.userAvatar || c.user_avatar,
          createdAt: c.createdAt || c.created_at,
          resolvedAt: c.resolvedAt || c.resolved_at,
          resolutionNotes: c.resolutionNotes || c.resolution_notes,
          parentCommentId: c.parentCommentId || c.parent_comment_id,
        }));
      } catch (err) {
        console.error('Failed to load comments:', err);
        return [];
      }
    },
    [report?.id]
  );

  const addBlockComment = useCallback(
    async (sectionKey: string, content: string, commentType: string) => {
      if (!report?.id) return null;
      try {
        const response = await Api.post(`/report-builder/${report.id}/comments`, {
          sectionKey,
          content,
          commentType,
        });
        const c = response.comment || response;
        return {
          id: c.id,
          content: c.content,
          commentType: c.commentType || c.comment_type || commentType,
          status: c.status || 'OPEN',
          userId: c.userId || c.user_id,
          userName: c.userName || c.user_name || 'You',
          createdAt: c.createdAt || c.created_at || new Date().toISOString(),
        };
      } catch (err) {
        console.error('Failed to add comment:', err);
        toast.error(t('reportBuilder.editor.failedToAddComment', 'Failed to add comment'));
        return null;
      }
    },
    [report?.id, t]
  );

  const resolveBlockComment = useCallback(
    async (commentId: string, notes?: string) => {
      if (!report?.id) return;
      try {
        await Api.post(`/report-builder/${report.id}/comments/${commentId}/resolve`, {
          resolutionNotes: notes,
        });
      } catch (err) {
        console.error('Failed to resolve comment:', err);
      }
    },
    [report?.id]
  );

  const dismissBlockComment = useCallback(
    async (commentId: string) => {
      if (!report?.id) return;
      try {
        await Api.patch(`/report-builder/${report.id}/comments/${commentId}`, {
          status: 'DISMISSED',
        });
      } catch (err) {
        console.error('Failed to dismiss comment:', err);
      }
    },
    [report?.id]
  );

  const bulkResolveComments = useCallback(
    async (commentIds: string[]) => {
      if (!report?.id) return;
      try {
        await Api.post(`/report-builder/${report.id}/comments/bulk-resolve`, {
          commentIds,
        });
      } catch (err) {
        console.error('Failed to bulk resolve comments:', err);
      }
    },
    [report?.id]
  );

  /** Get summary of a block's content (for context-aware regeneration) */
  const getBlockSummary = useCallback(
    (blockId: string): string | undefined => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block?.content) return undefined;
      const content = block.content;
      // Truncate to first 200 chars for context
      return content.length > 200 ? `${content.slice(0, 200)}...` : content;
    },
    [blocks]
  );

  // ==========================================
  // VERSION HISTORY
  // ==========================================

  const createManualVersion = useCallback(
    async (summary?: string) => {
      if (!report?.id) return;
      try {
        await Api.post(`/report-builder/${report.id}/versions`, {
          changeSummary: summary || t('reportBuilder.editor.manualSave', 'Manual save'),
        });
        toast.success(t('reportBuilder.editor.versionSaved', 'Version saved'));
        loadVersions();
      } catch (err) {
        console.error('Failed to create version:', err);
        toast.error(t('reportBuilder.editor.failedToSaveVersion', 'Failed to save version'));
      }
    },
    [report?.id, t, loadVersions]
  );

  const rollbackToVersion = useCallback(
    async (versionId: string) => {
      if (!report?.id) return;
      try {
        await Api.post(`/report-builder/versions/${versionId}/rollback`, {});
        toast.success(t('reportBuilder.editor.versionRestored', 'Version restored'));
        loadReport(report.id);
        loadVersions();
      } catch (err) {
        console.error('Failed to rollback:', err);
        toast.error(t('reportBuilder.editor.failedToRestoreVersion', 'Failed to restore version'));
      }
    },
    [report?.id, t, loadVersions]
  );

  // ==========================================
  // AUTO-SAVE (debounced 30s after changes)
  // ==========================================

  // Track unsaved changes
  useEffect(() => {
    if (!report?.id || isTemplateMode) return;
    setHasUnsavedChanges(true);
  }, [blocks, intent, styling, reportTitle]);

  // Auto-save with debounce
  useEffect(() => {
    if (!report?.id || isTemplateMode || !hasUnsavedChanges || isSaving || isGenerating) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        // Save config (intent + styling)
        await Api.put(`/report-builder/${report.id}/intent`, { config: { intent, styling } });

        // Save section order/config for persisted blocks
        const sectionUpdates = blocks
          .filter(
            (b) =>
              !b.id.startsWith('tmp_') && !b.id.startsWith('preset_') && !b.id.startsWith('tpl_')
          )
          .map((b, idx) => ({
            sectionKey: b.id,
            enabled: b.enabled,
            orderIndex: idx,
            title: b.title,
            length: b.length,
            customPrompt: b.customPrompt,
            blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
            chapterKey: b.chapterKey || null,
            chapterTitle: b.chapterTitle || null,
          }));

        if (sectionUpdates.length > 0) {
          await Api.put(`/report-builder/${report.id}/config`, { sections: sectionUpdates });
        }

        setHasUnsavedChanges(false);
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        console.error('[AutoSave] Failed:', err);
      }
    }, 30000); // 30-second debounce

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    report?.id,
    isTemplateMode,
    hasUnsavedChanges,
    isSaving,
    isGenerating,
    blocks,
    intent,
    styling,
  ]);

  // Save report title on blur
  const handleTitleBlur = useCallback(async () => {
    setIsEditingTitle(false);
    if (!report?.id || !reportTitle.trim()) return;
    try {
      await Api.patch(`/report-builder/${report.id}/metadata`, { title: reportTitle.trim() });
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  }, [report?.id, reportTitle]);

  // Save & Generate
  const handleSave = async () => {
    if (isTemplateMode) {
      const name = (reportTitle || '').trim();
      if (!name) {
        toast.error(t('reportBuilder.editor.templateNameIsRequired', 'Template name is required'));
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
                  'initiatives',
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
            blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
            chapterKey: b.chapterKey,
            chapterTitle: b.chapterTitle,
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
          toast.success(t('reportBuilder.editor.templateSaved', 'Template saved'));
          onTemplateSaved?.({ id: String(tpl.id), name: String(tpl.name || name) });
        } else {
          toast.success(t('reportBuilder.editor.templateSaved', 'Template saved'));
        }
      } catch (err: any) {
        console.error('Failed to save template:', err);
        toast.error(
          err?.error ||
            err?.message ||
            t('reportBuilder.editor.failedToSaveTemplate', 'Failed to save template')
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
              'initiatives',
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
            blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
            chapterKey: b.chapterKey,
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
            blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
            chapterKey: b.chapterKey || null,
            chapterTitle: b.chapterTitle || null,
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
                'initiatives',
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
              blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
              chapterKey: b.chapterKey,
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
            blockConfig: { ...b.blockSettings, _sourceContext: b.sourceContext || undefined },
            chapterKey: b.chapterKey || null,
            chapterTitle: b.chapterTitle || null,
          }));

          const sectionUpdates = [...visibleUpdates, ...disabledUpdates];
          await Api.put(`/report-builder/${newReportId}/config`, { sections: sectionUpdates });

          // Reload report to get final persisted ordering/content
          await loadReport(newReportId);
          onSave?.(response.report.id);
        }
      }
      // Create a version snapshot on manual save
      if (report?.id) {
        await createManualVersion(t('reportBuilder.editor.manualSave', 'Manual save'));
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        toast.success(t('reportBuilder.editor.reportSaved', 'Report saved'));
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async (mode: 'new_only' | 'modified' | 'all' = 'new_only') => {
    if (isTemplateMode) return;
    if (!report?.id) {
      await handleSave();
    }
    if (!report?.id) return;

    setIsGenerating(true);
    try {
      if (mode === 'modified') {
        // Only regenerate blocks marked as needsRegeneration
        const dirtyBlocks = blocks.filter(
          (b) => b.enabled && b.needsRegeneration && !b.id.startsWith('tmp_')
        );
        if (dirtyBlocks.length === 0) {
          toast(t('reportBuilder.editor.noBlocksNeedRegeneration', 'No blocks need regeneration'));
          setIsGenerating(false);
          return;
        }
        // Generate them one by one
        for (const block of dirtyBlocks) {
          setBlocks((prev) =>
            prev.map((b) => (b.id === block.id ? { ...b, isGenerating: true } : b))
          );
          try {
            const response = await Api.post(
              `/report-builder/${report.id}/generate-section/${block.id}`,
              {}
            );
            if (response?.section) {
              setBlocks((prev) =>
                prev.map((b) =>
                  b.id === block.id
                    ? {
                        ...b,
                        content:
                          response.section.editedContent || response.section.generatedContent,
                        isGenerated: true,
                        isGenerating: false,
                        needsRegeneration: false,
                      }
                    : b
                )
              );
            }
          } catch (err) {
            console.error(`Failed to regenerate block ${block.id}:`, err);
            setBlocks((prev) =>
              prev.map((b) => (b.id === block.id ? { ...b, isGenerating: false } : b))
            );
          }
        }
        toast.success(
          t('reportBuilder.editor.updatedNBlocks', {
            defaultValue: `Updated ${dirtyBlocks.length} blocks`,
            count: dirtyBlocks.length,
          })
        );
      } else {
        // new_only (regenerateAll: false) or all (regenerateAll: true)
        const response = await Api.post(`/report-builder/${report.id}/generate`, {
          regenerateAll: mode === 'all',
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
                needsRegeneration: false,
              };
            }
            return block;
          });
          setBlocks(updatedBlocks);
        }
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
      <div className="h-screen flex items-center justify-center bg-c-surface-raised">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-c-text-secondary">{t('reportBuilder.editor.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-c-surface-raised">
      {/* Top Bar */}
      <header className="h-14 bg-c-surface border-b border-c-border-subtle flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-c-border-subtle" />

          <input
            type="text"
            value={reportTitle}
            onChange={(e) => {
              setReportTitle(e.target.value);
              setIsEditingTitle(true);
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder={
              isTemplateMode
                ? t('reportBuilder.editor.templateName', 'Template name...')
                : t('reportBuilder.editor.reportTitle', 'Report title...')
            }
            className="text-lg font-semibold bg-transparent border-none outline-none text-c-text placeholder:text-c-text-muted w-80 hover:bg-c-surface-raised rounded px-2 py-0.5 -ml-2 transition-colors focus:bg-c-surface-raised"
          />

          {/* Unsaved dot indicator (no text) */}
          {!isTemplateMode && report?.id && hasUnsavedChanges && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse"
              title={t('reportBuilder.editor.unsavedChanges', 'Unsaved changes')}
            />
          )}

          {/* HP-8 workflow-engine status bar (report) — behind
              ff_artifactApprovalUi. At OFF this is null and the header renders
              1:1 as before (no new DOM, no visual change). Not shown in
              template mode (a template has no approval lifecycle). */}
          {!isTemplateMode && isArtifactApprovalUiEnabled() && reportIdForActions ? (
            <ArtifactApprovalStatusBar
              artifactType="report"
              artifactId={reportIdForActions}
              currentUserId={approvalUser?.id}
              canReview
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* 1. Save */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium rounded-full border transition-all ${
              hasUnsavedChanges
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                : 'border-c-border-strong bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-secondary'
            }`}
            title={
              hasUnsavedChanges
                ? t('reportBuilder.editor.saveChanges', 'Save changes')
                : t('reportBuilder.editor.saved', 'Saved')
            }
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {t('reportBuilder.editor.save', 'Save')}
          </button>

          {/* 2. Generate (AI) */}
          {!isTemplateMode && blocks.length > 0 && (
            <div className="relative group">
              <button
                onClick={() => handleGenerate('new_only')}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium rounded-full border border-c-accent bg-c-accent-soft0 text-c-accent hover:bg-c-accent-soft0 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {t('reportBuilder.editor.generate', 'Generate')}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 overflow-hidden">
                <button
                  onClick={() => handleGenerate('new_only')}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-c-accent flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">
                      {t('reportBuilder.editor.generateNew', 'Generate new')}
                    </div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.emptySectionsOnly', 'Empty sections only')}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleGenerate('modified')}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">
                      {t('reportBuilder.editor.refreshModified', 'Refresh modified')}
                    </div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.sectionsNeedingUpdate', 'Sections needing update')}
                    </div>
                  </div>
                </button>
                <div className="border-t border-c-border-subtle my-1" />
                <button
                  onClick={() => handleGenerate('all')}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">
                      {t('reportBuilder.editor.regenerateAll', 'Regenerate all')}
                    </div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.overwriteAllSections', 'Overwrite all sections')}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Agent Chat toggle */}
          {!isTemplateMode && reportIdForActions && (
            <button
              onClick={() => setShowAgentChat((p) => !p)}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium rounded-full border transition-all ${
                showAgentChat
                  ? 'border-c-accent bg-c-accent-soft0 text-c-accent'
                  : 'border-c-border-strong bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-secondary'
              }`}
              title={t('reportBuilder.editor.reportAgent', 'Report Agent')}
            >
              <TeresaMark className="w-3.5 h-3.5" />
              {t('reportBuilder.editor.agent', 'Agent')}
            </button>
          )}

          {/* 3. View / Export (dropdown: Web, PDF, PPTX, Word) */}
          {!isTemplateMode && (
            <div className="relative group">
              <button
                onClick={() => handleViewExport('web')}
                disabled={!!isExporting}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {isExporting
                  ? `${isExporting.toUpperCase()}...`
                  : t('reportBuilder.editor.view', 'View')}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 overflow-hidden">
                <button
                  onClick={() => handleViewExport('web')}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <Monitor className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">
                      {t('reportBuilder.editor.webPreview', 'Web Preview')}
                    </div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.previewInBrowser', 'Preview in browser')}
                    </div>
                  </div>
                </button>
                <div className="border-t border-c-border-subtle my-1" />
                <div className="px-3.5 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-c-text-secondary">
                    {t('reportBuilder.editor.exportSaveToVersions', 'Export & save to versions')}
                  </span>
                </div>
                <button
                  onClick={() => handleViewExport('pdf')}
                  disabled={!!isExporting}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-danger-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">PDF</div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.pdfDocument', 'PDF document')}
                    </div>
                  </div>
                  <Download className="w-3 h-3 text-c-text-secondary ml-auto" />
                </button>
                <button
                  onClick={() => handleViewExport('pptx')}
                  disabled={!!isExporting}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  <Presentation className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">PPTX</div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.powerpointPresentation', 'PowerPoint presentation')}
                    </div>
                  </div>
                  <Download className="w-3 h-3 text-c-text-secondary ml-auto" />
                </button>
                <button
                  onClick={() => handleViewExport('docx')}
                  disabled={!!isExporting}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">Word</div>
                    <div className="text-[10px] text-c-text-secondary">
                      {t('reportBuilder.editor.wordDocumentDocx', 'Word document (.docx)')}
                    </div>
                  </div>
                  <Download className="w-3 h-3 text-c-text-secondary ml-auto" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Chapter Navigation (TOC) */}
        <ChapterNavigation
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onAddChapter={addChapter}
          onAssignChapter={assignChapter}
          onRenameChapter={renameChapter}
          onDeleteChapter={deleteChapter}
          onReorderBlocks={reorderBlocks}
          onMoveBlockToChapter={moveBlockToChapter}
          isPl={isPl}
          isVisible={showChapterNav && blocks.length > 3}
          onToggle={() => setShowChapterNav((prev) => !prev)}
          sectionRagMap={ragMap}
        />

        {/* Center - Block Canvas */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Source Info */}
            {!isTemplateMode && sourceName && (
              <div className="flex items-center gap-2 text-sm text-c-text-secondary mb-6">
                <Layers className="w-4 h-4" />
                <span>
                  {t('reportBuilder.editor.source', 'Source:')} {sourceName}
                </span>
              </div>
            )}

            {/* R1→R2 Escalation Banner (G7) */}
            {!isTemplateMode && report?.id && (
              <EscalationBanner
                reportId={report.id}
                reportTypeV3={(report as any).reportTypeV3 || (report as any).report_type_v3}
              />
            )}

            {/* Blocks with Chapter Grouping */}
            {(() => {
              const useChapters = hasChapters(blocks);
              if (useChapters) {
                const chapters = groupBlocksIntoChapters(blocks);
                return chapters.map((chapter) => (
                  <div key={chapter.key} className="space-y-4">
                    {/* Chapter Header */}
                    {chapter.key !== '__ungrouped__' && (
                      <div className="flex items-center gap-3 pt-6 pb-2 border-b-2 border-c-border-subtle">
                        <div className="w-8 h-8 rounded-lg bg-c-surface-raised flex items-center justify-center text-c-text text-sm font-bold">
                          {chapters.filter((c) => c.key !== '__ungrouped__').indexOf(chapter) + 1}
                        </div>
                        <h2 className="text-lg font-bold text-c-text flex-1">{chapter.title}</h2>
                        <span className="text-xs text-c-text-secondary">
                          {chapter.blocks.filter((b) => b.enabled).length}{' '}
                          {t('reportBuilder.editor.blocks', 'blocks')}
                        </span>
                      </div>
                    )}
                    {/* Chapter Blocks */}
                    {chapter.blocks.map((block) => {
                      const globalIndex = blocks.findIndex((b) => b.id === block.id);
                      return (
                        <div key={block.id} id={`block-${block.id}`}>
                          {block.isRefreshable && (
                            <div className="flex justify-end mb-1">
                              <StaleDataBadge
                                isRefreshable={true}
                                lastDataTimestamp={block.lastDataTimestamp}
                                generatedAt={block.generatedAt}
                                onRefresh={() => handleRefreshBlock(block.id)}
                                isPl={isPl}
                                isRefreshing={block.isRefreshing}
                              />
                            </div>
                          )}
                          <BlockCard
                            block={block}
                            isSelected={selectedBlockId === block.id}
                            onSelect={() => setSelectedBlockId(block.id)}
                            onUpdate={(updates) => updateBlock(block.id, updates)}
                            onRemove={() => removeBlock(block.id)}
                            onMoveUp={() => moveBlock(block.id, 'up')}
                            onMoveDown={() => moveBlock(block.id, 'down')}
                            onAddBelow={() => setShowBlockPalette(true)}
                            onRegenerate={(instruction) => regenerateBlock(block.id, instruction)}
                            onGenerateBlock={() => generateSingleBlock(block.id)}
                            onSaveContent={(newContent) => saveBlockContent(block.id, newContent)}
                            canMoveUp={globalIndex > 0}
                            canMoveDown={globalIndex < blocks.length - 1}
                            isPl={isPl}
                            previousBlockSummary={
                              globalIndex > 0
                                ? getBlockSummary(blocks[globalIndex - 1].id)
                                : undefined
                            }
                            nextBlockSummary={
                              globalIndex < blocks.length - 1
                                ? getBlockSummary(blocks[globalIndex + 1].id)
                                : undefined
                            }
                            reportId={report?.id}
                            onLoadComments={loadBlockComments}
                            onAddComment={addBlockComment}
                            onResolveComment={resolveBlockComment}
                            onDismissComment={dismissBlockComment}
                            onBulkResolve={bulkResolveComments}
                          />
                          {block.narrativeEngineStats && (
                            <NarrativeEngineMetadata
                              factsUsed={block.narrativeEngineStats.factsUsed}
                              observationsUsed={block.narrativeEngineStats.observationsUsed}
                              postCheckPassed={block.narrativeEngineStats.postCheckPassed}
                              generationModel={block.generationModel}
                              className="mt-1"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              }

              // No chapters - flat list
              return blocks.map((block, index) => (
                <div key={block.id} id={`block-${block.id}`}>
                  {block.isRefreshable && (
                    <div className="flex justify-end mb-1">
                      <StaleDataBadge
                        isRefreshable={true}
                        lastDataTimestamp={block.lastDataTimestamp}
                        generatedAt={block.generatedAt}
                        onRefresh={() => handleRefreshBlock(block.id)}
                        isPl={isPl}
                        isRefreshing={block.isRefreshing}
                      />
                    </div>
                  )}
                  <BlockCard
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onUpdate={(updates) => updateBlock(block.id, updates)}
                    onRemove={() => removeBlock(block.id)}
                    onMoveUp={() => moveBlock(block.id, 'up')}
                    onMoveDown={() => moveBlock(block.id, 'down')}
                    onAddBelow={() => setShowBlockPalette(true)}
                    onRegenerate={(instruction) => regenerateBlock(block.id, instruction)}
                    onGenerateBlock={() => generateSingleBlock(block.id)}
                    onSaveContent={(newContent) => saveBlockContent(block.id, newContent)}
                    canMoveUp={index > 0}
                    canMoveDown={index < blocks.length - 1}
                    isPl={isPl}
                    previousBlockSummary={
                      index > 0 ? getBlockSummary(blocks[index - 1].id) : undefined
                    }
                    nextBlockSummary={
                      index < blocks.length - 1 ? getBlockSummary(blocks[index + 1].id) : undefined
                    }
                    reportId={report?.id}
                    onLoadComments={loadBlockComments}
                    onAddComment={addBlockComment}
                    onResolveComment={resolveBlockComment}
                    onDismissComment={dismissBlockComment}
                    onBulkResolve={bulkResolveComments}
                  />
                  {block.narrativeEngineStats && (
                    <NarrativeEngineMetadata
                      factsUsed={block.narrativeEngineStats.factsUsed}
                      observationsUsed={block.narrativeEngineStats.observationsUsed}
                      postCheckPassed={block.narrativeEngineStats.postCheckPassed}
                      generationModel={block.generationModel}
                      className="mt-1"
                    />
                  )}
                </div>
              ));
            })()}

            {/* Add Block Button */}
            <button
              onClick={() => setShowBlockPalette(true)}
              className="w-full py-4 border-2 border-dashed border-c-border-subtle rounded-xl text-c-text-secondary hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('reportBuilder.editor.addBlock', 'Add block')}
            </button>

            {/* Empty State */}
            {blocks.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 dark:from-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-c-text mb-2">
                  {t('reportBuilder.editor.startBuildingYourReport', 'Start building your report')}
                </h3>
                <p className="text-c-text-secondary max-w-md mx-auto mb-6">
                  {t(
                    'reportBuilder.editor.addBlocksToDefineYourReport',
                    'Add blocks to define your report structure. Each block can contain text, data, charts, or visualizations.'
                  )}
                </p>
                <button
                  onClick={() => setShowBlockPalette(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-c-text rounded-xl hover:bg-blue-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  {t('reportBuilder.editor.addFirstBlock', 'Add first block')}
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
          currentVersion={report?.version}
          versions={versions}
          isLoadingVersions={isLoadingVersions}
          onCreateVersion={(summary) => createManualVersion(summary)}
          onRollbackVersion={rollbackToVersion}
          onLoadVersions={loadVersions}
          reportStatus={reportStatus}
          reportId={reportIdForActions || undefined}
          lastSavedAt={lastSavedAt}
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

      {/* Preview Modal */}
      {showPreview && (
        <ReportPreviewModal
          blocks={blocks}
          reportTitle={reportTitle}
          sourceName={sourceName}
          styling={styling}
          intent={intent}
          isPl={isPl}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Version History slide-over removed — now integrated into SettingsPanel tabs */}

      {/* T060: Agent Chat Sidebar */}
      {showAgentChat && reportIdForActions && (
        <ReportAgentChat
          reportId={reportIdForActions}
          isOpen={showAgentChat}
          onClose={() => setShowAgentChat(false)}
          onStructureChanged={() => {
            if (report?.id) {
              void loadReport(report.id);
            }
          }}
        />
      )}
    </div>
  );
};

export default ReportEditor;
