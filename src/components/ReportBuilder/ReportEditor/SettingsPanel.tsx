/**
 * SettingsPanel
 *
 * Reorganized sidebar with clean UX:
 * - 2 main tabs: Content (what) and Design (how)
 * - Quick Preview Bar showing current config
 * - Grouped related settings together
 * - Support for 6 languages: EN, PL, DE, AR, JP, ES
 */

import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  GitBranch,
  Globe,
  History,
  Image,
  Layers,
  LayoutGrid,
  Loader2,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  Upload,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QualityGatesPanel } from '../QualityGatesPanel';
import type { ReportSourceType } from '../useReportBuilder';
import type { ReportIntent, ReportStyling } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface TemplateMeta {
  sourceType: ReportSourceType;
  /** Framework/tool identifier - e.g. 'DRD', 'SIRI' for Assessment, or tool name for TOOL */
  reportType: string;
  description: string;
  author: string;
}

// ==========================================
// MODULE TOOLS CONFIG
// ==========================================

/** Tools/frameworks available per module (sourceType) */
const MODULE_TOOLS: Record<
  ReportSourceType,
  { value: string; label: string; description?: string }[]
> = {
  ASSESSMENT: [
    { value: 'DRD', label: 'DRD', description: 'Digital Readiness Diagnostic' },
    { value: 'SIRI', label: 'SIRI', description: 'Smart Industry Readiness Index' },
    { value: 'ADMA', label: 'ADMA', description: 'Advanced Manufacturing Assessment' },
    { value: 'CMMI', label: 'CMMI', description: 'Capability Maturity Model Integration' },
    { value: 'LEAN', label: 'LEAN', description: 'Lean Manufacturing Assessment' },
  ],
  TOOL: [
    { value: 'SWOT', label: 'SWOT', description: 'Strengths, Weaknesses, Opportunities, Threats' },
    {
      value: 'PESTEL',
      label: 'PESTEL',
      description: 'Political, Economic, Social, Technological...',
    },
    { value: 'PORTER', label: 'Porter 5 Forces', description: 'Industry competitive analysis' },
    { value: 'BCG', label: 'BCG Matrix', description: 'Growth-share matrix' },
    {
      value: 'CANVAS',
      label: 'Business Model Canvas',
      description: 'Business model visualization',
    },
    { value: 'VALUE_CHAIN', label: 'Value Chain', description: 'Value chain analysis' },
    { value: 'ROADMAP', label: 'Roadmap', description: 'Strategic roadmap' },
    { value: 'OKR', label: 'OKR', description: 'Objectives and Key Results' },
  ],
  INTERVIEW: [
    {
      value: 'STAKEHOLDER',
      label: 'Stakeholder Interview',
      description: 'Key stakeholder insights',
    },
    { value: 'EXPERT', label: 'Expert Interview', description: 'Domain expert consultation' },
    { value: 'USER', label: 'User Interview', description: 'End-user research' },
  ],
  INITIATIVE: [
    { value: 'PROJECT', label: 'Project Report', description: 'Project status and progress' },
    { value: 'PROGRAM', label: 'Program Report', description: 'Multi-project program overview' },
    {
      value: 'TRANSFORMATION',
      label: 'Transformation',
      description: 'Digital transformation initiative',
    },
  ],
  UPLOAD_BUNDLE: [
    {
      value: 'UPLOAD_DRAFT',
      label: 'Upload Draft',
      description: 'Draft report generated from uploaded documents',
    },
    {
      value: 'UPLOAD_SUMMARY',
      label: 'Upload Summary',
      description: 'Executive summary from uploaded bundle',
    },
  ],
};

type SettingsSection = 'intent' | 'styling' | 'export' | 'review' | 'versions';

interface VersionEntry {
  id: string;
  versionNumber: number;
  changeType: 'auto' | 'manual' | 'rollback';
  changeSummary?: string;
  createdAt: string;
  createdByName?: string;
  previousStatus?: string;
  newStatus?: string;
}

interface SettingsPanelProps {
  intent: ReportIntent;
  styling: ReportStyling;
  sourceType: ReportSourceType | null;
  sourceName: string | null;
  onIntentChange: (updates: Partial<ReportIntent>) => void;
  onStylingChange: (updates: Partial<ReportStyling>) => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  exportPanel?: React.ReactNode;
  reviewPanel?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isTemplateMode?: boolean;
  onApplyPreset?: (preset: 'assessment_full' | 'board_pack' | 'ops_delivery') => void;
  templateMeta?: TemplateMeta;
  onTemplateMetaChange?: (updates: Partial<TemplateMeta>) => void;
  /** Current version number */
  currentVersion?: number;
  /** Version history data */
  versions?: VersionEntry[];
  isLoadingVersions?: boolean;
  onCreateVersion?: (summary?: string) => void;
  onRollbackVersion?: (versionId: string) => void;
  onLoadVersions?: () => void;
  /** Report status for context in versions */
  reportStatus?: string;
  /** Report ID for quality gates */
  reportId?: string;
  /** Last saved timestamp */
  lastSavedAt?: string | null;
}

// ==========================================
// LANGUAGE CONFIG
// ==========================================

const REPORT_LANGUAGES = [
  { value: 'pl', label: 'PL', fullName: 'Polski', flag: '🇵🇱' },
  { value: 'en', label: 'EN', fullName: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'DE', fullName: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'ES', fullName: 'Español', flag: '🇪🇸' },
  { value: 'ar', label: 'AR', fullName: 'العربية', flag: '🇸🇦' },
  { value: 'ja', label: 'JP', fullName: '日本語', flag: '🇯🇵' },
] as const;

// ==========================================
// QUICK PREVIEW BAR
// ==========================================

interface QuickPreviewBarProps {
  intent: ReportIntent;
  styling: ReportStyling;
  isPl: boolean;
}

const QuickPreviewBar: React.FC<QuickPreviewBarProps> = ({ intent, styling, isPl }) => {
  const { t } = useTranslation();
  const audienceLabels: Record<string, string> = {
    executive: '👔 Executive',
    board: '🏛️ Board',
    technical: '⚙️ Technical',
    operational: '📊 Operational',
    mixed: '👥 Mixed',
  };

  const orientationLabel =
    styling.layoutOrientation === 'horizontal' ? '📺 Landscape' : '📄 Portrait';
  const langLabel = REPORT_LANGUAGES.find((l) => l.value === intent.language)?.flag || '🌐';

  return (
    <div className="px-3 py-1.5 bg-c-surface border-b border-c-border-subtle">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-c-surface text-c-text-secondary rounded border border-c-border-subtle">
          {audienceLabels[intent.audience] || intent.audience}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-c-surface text-c-text-secondary rounded border border-c-border-subtle">
          {orientationLabel}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-c-surface text-c-text-secondary rounded border border-c-border-subtle">
          {langLabel} {intent.language?.toUpperCase()}
        </span>
        <span
          className="w-3.5 h-3.5 rounded-full border border-c-border-strong"
          style={{ backgroundColor: styling.primaryColor }}
          title={t('reportBuilder.settingsPanel.primaryColor', 'Primary color')}
        />
      </div>
    </div>
  );
};

// ==========================================
// COLLAPSIBLE SECTION CARD COMPONENT
// ==========================================

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  children,
  className = '',
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-c-surface transition-colors cursor-pointer select-none"
      >
        {icon && <span className="text-c-text-secondary">{icon}</span>}
        <h3 className="text-[10px] font-bold text-c-text-secondary uppercase tracking-wider flex-1 text-left">
          {title}
        </h3>
        <ChevronDown
          className={`w-3 h-3 text-c-text-secondary transition-transform duration-200 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// ==========================================
// VERSIONS TAB CONTENT
// ==========================================

interface VersionsTabContentProps {
  versions: VersionEntry[];
  isLoadingVersions: boolean;
  onCreateVersion?: (summary?: string) => void;
  onRollbackVersion?: (versionId: string) => void;
  reportStatus?: string;
  lastSavedAt?: string | null;
  currentVersion?: number;
  isPl: boolean;
}

const VersionsTabContent: React.FC<VersionsTabContentProps> = ({
  versions,
  isLoadingVersions,
  onCreateVersion,
  onRollbackVersion,
  reportStatus,
  lastSavedAt,
  currentVersion,
  isPl,
}) => {
  const { t } = useTranslation();
  const [saveSummary, setSaveSummary] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const manualCount = versions.filter((v) => v.changeType === 'manual').length;
  const autoCount = versions.filter((v) => v.changeType === 'auto').length;
  const rollbackCount = versions.filter((v) => v.changeType === 'rollback').length;

  const handleSaveVersion = () => {
    onCreateVersion?.(saveSummary.trim() || undefined);
    setSaveSummary('');
    setShowSaveForm(false);
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t('reportBuilder.settingsPanel.justNow', 'Just now');
    if (min < 60) return `${min}m ${t('reportBuilder.settingsPanel.ago', 'ago')}`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ${t('reportBuilder.settingsPanel.ago', 'ago')}`;
    const d = Math.floor(hr / 24);
    return `${d}d ${t('reportBuilder.settingsPanel.ago', 'ago')}`;
  };

  return (
    <div className="p-3 space-y-3">
      {/* --- Status bar --- */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-c-surface border border-slate-200/60 dark:border-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/30 flex items-center justify-center">
            <GitBranch className="w-3 h-3 text-indigo-400" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-c-text font-mono">
              v{currentVersion || versions.length}
            </span>
            {reportStatus && (
              <span className="ml-1.5 text-[8px] px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary uppercase font-bold tracking-wider">
                {reportStatus}
              </span>
            )}
          </div>
        </div>
        {lastSavedAt && (
          <span className="text-[9px] text-c-text-secondary flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(lastSavedAt)}
          </span>
        )}
      </div>

      {/* --- Save version card --- */}
      {onCreateVersion && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-900/10 overflow-hidden">
          {!showSaveForm ? (
            <button
              onClick={() => setShowSaveForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-900/20 transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              {t('reportBuilder.settingsPanel.saveVersion', 'Save version')}
            </button>
          ) : (
            <div className="p-3 space-y-2">
              <label className="block text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
                {t(
                  'reportBuilder.settingsPanel.changeSummaryOptional',
                  'Change summary (optional)'
                )}
              </label>
              <textarea
                value={saveSummary}
                onChange={(e) => setSaveSummary(e.target.value)}
                placeholder={t(
                  'reportBuilder.settingsPanel.whatChangedInThisVersion',
                  'What changed in this version...'
                )}
                className="w-full px-2.5 py-2 text-[11px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg resize-none h-14 focus:ring-1 focus:ring-indigo-500 text-c-text-secondary placeholder:text-c-text-secondary leading-relaxed"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveVersion();
                }}
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveVersion}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-c-text rounded-lg text-[10px] font-semibold transition-colors"
                >
                  <Save className="w-3 h-3" />
                  {t('reportBuilder.settingsPanel.save', 'Save')}
                </button>
                <button
                  onClick={() => {
                    setShowSaveForm(false);
                    setSaveSummary('');
                  }}
                  className="px-3 py-1.5 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface rounded-lg text-[10px] font-medium transition-colors"
                >
                  {t('reportBuilder.settingsPanel.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Stats --- */}
      {versions.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="text-center py-1.5 px-1 rounded-md bg-c-surface border border-c-border-subtle">
            <div className="text-[13px] font-bold text-blue-400 font-mono">{manualCount}</div>
            <div className="text-[8px] text-c-text-secondary uppercase tracking-wider font-semibold">
              {t('reportBuilder.settingsPanel.manual', 'Manual')}
            </div>
          </div>
          <div className="text-center py-1.5 px-1 rounded-md bg-c-surface border border-c-border-subtle">
            <div className="text-[13px] font-bold text-c-text-secondary font-mono">{autoCount}</div>
            <div className="text-[8px] text-c-text-secondary uppercase tracking-wider font-semibold">
              Auto
            </div>
          </div>
          <div className="text-center py-1.5 px-1 rounded-md bg-c-surface border border-c-border-subtle">
            <div className="text-[13px] font-bold text-amber-400 font-mono">{rollbackCount}</div>
            <div className="text-[8px] text-c-text-secondary uppercase tracking-wider font-semibold">
              {t('reportBuilder.settingsPanel.rollback', 'Rollback')}
            </div>
          </div>
        </div>
      )}

      {/* --- Timeline --- */}
      {isLoadingVersions ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-c-text-secondary" />
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="w-7 h-7 text-c-text-secondary mx-auto mb-2" />
          <p className="text-[11px] text-c-text-secondary leading-relaxed">
            {t('reportBuilder.settingsPanel.noSavedVersions', 'No saved versions')}
          </p>
          <p className="text-[9px] text-c-text-secondary mt-0.5">
            {t(
              'reportBuilder.settingsPanel.saveTheFirstVersionOfYour',
              'Save the first version of your report'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          <div className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-2">
            {t('reportBuilder.settingsPanel.history', 'History')} ({versions.length})
          </div>
          {versions.map((v, idx) => {
            const isLatest = idx === 0;
            const isLast = idx === versions.length - 1;
            return (
              <div key={v.id} className="flex gap-2.5 group/ver">
                {/* Timeline line */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: '18px' }}>
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                      isLatest
                        ? 'border-indigo-400 bg-indigo-500 shadow-sm shadow-indigo-500/40'
                        : v.changeType === 'manual'
                          ? 'border-blue-500/60 bg-blue-500/30'
                          : v.changeType === 'rollback'
                            ? 'border-amber-500/60 bg-amber-500/30'
                            : 'border-c-border-strong bg-c-surface-raised'
                    }`}
                  />
                  {!isLast && <div className="w-px flex-1 bg-c-surface-raised min-h-[24px]" />}
                </div>

                {/* Version card */}
                <div className={`flex-1 pb-3 ${isLast ? '' : ''}`}>
                  <div
                    className={`p-2 rounded-lg transition-all ${
                      isLatest
                        ? 'bg-indigo-900/15 border border-indigo-500/25'
                        : 'hover:bg-c-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold font-mono ${isLatest ? 'text-indigo-300' : 'text-c-text-secondary'}`}
                        >
                          v{v.versionNumber}
                        </span>
                        {isLatest && (
                          <span className="text-[7px] px-1 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-bold uppercase tracking-wider">
                            {t('reportBuilder.settingsPanel.current', 'Current')}
                          </span>
                        )}
                        <span
                          className={`text-[7px] px-1 py-0.5 rounded font-bold uppercase tracking-wider ${
                            v.changeType === 'manual'
                              ? 'bg-blue-900/40 text-blue-400'
                              : v.changeType === 'rollback'
                                ? 'bg-amber-900/40 text-amber-400'
                                : 'bg-c-surface-raised text-c-text-secondary'
                          }`}
                        >
                          {v.changeType === 'manual'
                            ? t('reportBuilder.settingsPanel.manual2', 'Manual')
                            : v.changeType === 'rollback'
                              ? t('reportBuilder.settingsPanel.rollback2', 'Rollback')
                              : 'Auto'}
                        </span>
                      </div>
                      {/* Restore button (not for latest) */}
                      {!isLatest && onRollbackVersion && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                t('reportBuilder.settingsPanel.confirmRestoreVersion', {
                                  defaultValue: `Restore version v${v.versionNumber}?`,
                                  version: v.versionNumber,
                                })
                              )
                            ) {
                              onRollbackVersion(v.id);
                            }
                          }}
                          className="opacity-0 group-hover/ver:opacity-100 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-indigo-400 hover:bg-indigo-900/30 rounded transition-all"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          {t('reportBuilder.settingsPanel.restore', 'Restore')}
                        </button>
                      )}
                    </div>

                    {/* Summary */}
                    {v.changeSummary && (
                      <p className="text-[10px] text-c-text-secondary mb-1 line-clamp-2 leading-snug">
                        {v.changeSummary}
                      </p>
                    )}

                    {/* Status change */}
                    {v.previousStatus && v.newStatus && v.previousStatus !== v.newStatus && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[8px] px-1 py-0.5 bg-c-surface-raised text-c-text-secondary rounded">
                          {v.previousStatus}
                        </span>
                        <span className="text-[8px] text-c-text-secondary">&rarr;</span>
                        <span className="text-[8px] px-1 py-0.5 bg-c-surface-raised text-c-text-secondary rounded">
                          {v.newStatus}
                        </span>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-1.5 text-[9px] text-c-text-secondary">
                      <User className="w-2.5 h-2.5" />
                      <span>{v.createdByName || 'System'}</span>
                      <span>·</span>
                      <span>
                        {new Date(v.createdAt).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  intent,
  styling,
  onIntentChange,
  onStylingChange,
  activeSection,
  onSectionChange,
  exportPanel,
  reviewPanel,
  isCollapsed = false,
  onToggleCollapse,
  isTemplateMode = false,
  onApplyPreset,
  templateMeta,
  onTemplateMetaChange,
  currentVersion,
  versions = [],
  isLoadingVersions = false,
  onCreateVersion,
  onRollbackVersion,
  onLoadVersions,
  reportStatus,
  reportId,
  lastSavedAt,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newColor, setNewColor] = useState('#6366F1');

  // Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(
        t('reportBuilder.settingsPanel.pleaseSelectAnImageFile', 'Please select an image file')
      );
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert(t('reportBuilder.settingsPanel.fileIsTooLargeMax2mb', 'File is too large (max 2MB)'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      onStylingChange({ clientLogoUrl: event.target?.result as string, showLogo: true });
    };
    reader.readAsDataURL(file);
  };

  const addCustomColor = () => {
    const currentColors = styling.customColors || [];
    if (currentColors.length >= 8) return;
    if (!currentColors.includes(newColor)) {
      onStylingChange({ customColors: [...currentColors, newColor] });
    }
  };

  const removeCustomColor = (color: string) => {
    onStylingChange({ customColors: (styling.customColors || []).filter((c) => c !== color) });
  };

  // Collapsed state
  if (isCollapsed) {
    const SideIcon: React.FC<{
      icon: React.ReactNode;
      active: boolean;
      label: string;
      onClick: () => void;
      badge?: string | number;
    }> = ({ icon, active, label, onClick, badge }) => (
      <button
        onClick={onClick}
        title={label}
        className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 ${
          active
            ? 'bg-blue-600/15 text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]'
            : 'text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface'
        }`}
      >
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 bg-indigo-500 text-c-text text-[7px] font-bold rounded-full flex items-center justify-center shadow-sm">
            {badge}
          </span>
        )}
      </button>
    );

    return (
      <aside className="relative flex-shrink-0">
        <div className="w-11 h-full bg-c-bg border-l border-c-border-subtle flex flex-col items-center py-3 gap-1">
          {/* Expand */}
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 flex items-center justify-center text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface rounded-md transition-colors mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Versions */}
          {!isTemplateMode && (
            <SideIcon
              icon={<History className="w-4 h-4" />}
              active={activeSection === 'versions'}
              label={t('reportBuilder.settingsPanel.versions', 'Versions')}
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('versions');
                onLoadVersions?.();
              }}
              badge={currentVersion && currentVersion > 0 ? `v${currentVersion}` : undefined}
            />
          )}

          {/* Divider */}
          <div className="w-5 border-t border-c-border-subtle my-0.5" />

          {/* Content */}
          <SideIcon
            icon={<Target className="w-4 h-4" />}
            active={activeSection === 'intent'}
            label={t('reportBuilder.settingsPanel.content', 'Content')}
            onClick={() => {
              onToggleCollapse?.();
              onSectionChange('intent');
            }}
          />

          {/* Design */}
          <SideIcon
            icon={<Palette className="w-4 h-4" />}
            active={activeSection === 'styling'}
            label={t('reportBuilder.settingsPanel.design', 'Design')}
            onClick={() => {
              onToggleCollapse?.();
              onSectionChange('styling');
            }}
          />

          {/* Review */}
          {!isTemplateMode && (
            <SideIcon
              icon={<ClipboardCheck className="w-4 h-4" />}
              active={activeSection === 'review'}
              label={t('reportBuilder.settingsPanel.review', 'Review')}
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('review');
              }}
            />
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-c-surface border-l border-c-border-subtle flex flex-col overflow-hidden flex-shrink-0">
      {/* Header — segmented toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle bg-c-surface">
        {/* Segmented control */}
        <div className="flex items-center bg-c-surface rounded-lg p-0.5 border border-slate-200/60 dark:border-white/[0.03]">
          {/* Settings pill */}
          <button
            onClick={() => {
              if (activeSection === 'versions') onSectionChange('intent');
            }}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
              activeSection !== 'versions'
                ? 'bg-c-surface-raised text-c-text shadow-sm shadow-black/20'
                : 'text-c-text-secondary hover:text-c-text-secondary'
            }`}
          >
            <Layers className="w-3 h-3" />
            {t('reportBuilder.settingsPanel.settings', 'Settings')}
          </button>

          {/* Versions pill */}
          {!isTemplateMode && (
            <button
              onClick={() => {
                onSectionChange('versions');
                onLoadVersions?.();
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                activeSection === 'versions'
                  ? 'bg-indigo-600/80 text-c-text shadow-sm shadow-indigo-900/30'
                  : 'text-c-text-secondary hover:text-c-text-secondary'
              }`}
            >
              <History className="w-3 h-3" />
              {t('reportBuilder.settingsPanel.versions', 'Versions')}
            </button>
          )}
        </div>

        {/* Collapse */}
        <button
          onClick={onToggleCollapse}
          className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded-md transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Preview Bar — hide on versions */}
      {activeSection !== 'versions' && (
        <QuickPreviewBar intent={intent} styling={styling} isPl={isPl} />
      )}

      {/* Tabs — hide on versions */}
      {activeSection !== 'versions' && (
        <div className="flex border-b border-c-border-subtle bg-c-surface">
          {[
            { key: 'intent' as const, labelKey: 'reportBuilder.settingsPanel.content' },
            { key: 'styling' as const, labelKey: 'reportBuilder.settingsPanel.design' },
            ...(!isTemplateMode
              ? [{ key: 'review' as const, labelKey: 'reportBuilder.settingsPanel.review' }]
              : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => onSectionChange(tab.key)}
              className={`flex-1 py-2 text-[11px] font-semibold tracking-wide uppercase transition-all ${
                activeSection === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                  : 'text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface border-b-2 border-transparent'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ========== CONTENT TAB ========== */}
        {activeSection === 'intent' && (
          <div className="divide-y divide-c-border-subtle">
            {/* Template Info (only in template mode) */}
            {isTemplateMode && templateMeta && onTemplateMetaChange && (
              <SectionCard
                title={t('reportBuilder.settingsPanel.template', 'Template')}
                icon={<FileText className="w-4 h-4" />}
              >
                <div className="space-y-3">
                  {/* Module selection */}
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.module', 'Module')}
                    </label>
                    <select
                      value={templateMeta.sourceType || 'ASSESSMENT'}
                      onChange={(e) => {
                        const newSourceType = e.target.value as ReportSourceType;
                        // Reset reportType when module changes
                        onTemplateMetaChange?.({
                          sourceType: newSourceType,
                          reportType: MODULE_TOOLS[newSourceType]?.[0]?.value || '',
                        });
                      }}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="ASSESSMENT">📊 Assessment</option>
                      <option value="TOOL">🛠️ Tool</option>
                      <option value="INTERVIEW">🎤 Interview</option>
                      <option value="INITIATIVE">🚀 Initiative</option>
                    </select>
                  </div>

                  {/* Tool/Framework selection - dynamic based on module */}
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.toolFramework', 'Tool / Framework')}
                    </label>
                    <select
                      value={templateMeta.reportType || ''}
                      onChange={(e) => onTemplateMetaChange?.({ reportType: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="">
                        — {t('reportBuilder.settingsPanel.select', 'Select')} —
                      </option>
                      {MODULE_TOOLS[templateMeta.sourceType || 'ASSESSMENT']?.map((tool) => (
                        <option key={tool.value} value={tool.value}>
                          {tool.label}
                        </option>
                      ))}
                    </select>
                    {/* Show description of selected tool */}
                    {templateMeta.reportType && (
                      <div className="mt-1 text-[10px] text-c-text-secondary">
                        {
                          MODULE_TOOLS[templateMeta.sourceType || 'ASSESSMENT']?.find(
                            (t) => t.value === templateMeta.reportType
                          )?.description
                        }
                      </div>
                    )}
                  </div>

                  {/* Author */}
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.author', 'Author')}
                    </label>
                    <input
                      value={templateMeta.author || ''}
                      onChange={(e) => onTemplateMetaChange?.({ author: e.target.value })}
                      placeholder={t('reportBuilder.settingsPanel.name', 'Name...')}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    />
                  </div>

                  {/* Description */}
                  <textarea
                    value={templateMeta.description || ''}
                    onChange={(e) => onTemplateMetaChange?.({ description: e.target.value })}
                    placeholder={t(
                      'reportBuilder.settingsPanel.templateDescription',
                      'Template description...'
                    )}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg resize-none"
                  />
                </div>
              </SectionCard>
            )}

            {/* Quick Preset (template mode) */}
            {isTemplateMode && onApplyPreset && (
              <SectionCard
                title={t('reportBuilder.settingsPanel.quickPreset', 'Quick Preset')}
                icon={<Zap className="w-4 h-4" />}
              >
                <div className="flex gap-2">
                  {[
                    { id: 'assessment_full', label: 'Assessment', emoji: '📊' },
                    { id: 'board_pack', label: 'Board', emoji: '👔' },
                    { id: 'ops_delivery', label: 'Ops', emoji: '⚙️' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onApplyPreset(preset.id as any)}
                      className="flex-1 py-2 px-2 text-xs font-medium bg-gradient-to-b from-c-surface  border border-c-border-subtle rounded-lg hover:border-c-accent hover:shadow-sm transition-all"
                    >
                      <span className="block text-base mb-0.5">{preset.emoji}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Audience & Goal */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.goalAudience', 'Goal & Audience')}
              icon={<Target className="w-4 h-4" />}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.audience', 'Audience')}
                    </label>
                    <select
                      value={intent.audience}
                      onChange={(e) => onIntentChange({ audience: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="executive">
                        {t('reportBuilder.settingsPanel.executive', 'Executive')}
                      </option>
                      <option value="board">
                        {t('reportBuilder.settingsPanel.board', 'Board')}
                      </option>
                      <option value="technical">
                        {t('reportBuilder.settingsPanel.technical', 'Technical')}
                      </option>
                      <option value="operational">
                        {t('reportBuilder.settingsPanel.operational', 'Operational')}
                      </option>
                      <option value="mixed">
                        {t('reportBuilder.settingsPanel.mixed', 'Mixed')}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.goal', 'Goal')}
                    </label>
                    <select
                      value={intent.goal}
                      onChange={(e) => onIntentChange({ goal: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="diagnosis">
                        {t('reportBuilder.settingsPanel.diagnosis', 'Diagnosis')}
                      </option>
                      <option value="roadmap">
                        {t('reportBuilder.settingsPanel.roadmap', 'Roadmap')}
                      </option>
                      <option value="investment_decision">
                        {t('reportBuilder.settingsPanel.investment', 'Investment')}
                      </option>
                      <option value="stakeholder_update">
                        {t('reportBuilder.settingsPanel.update', 'Update')}
                      </option>
                      <option value="summary">
                        {t('reportBuilder.settingsPanel.summary', 'Summary')}
                      </option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">
                    {t('reportBuilder.settingsPanel.tone', 'Tone')}
                  </label>
                  <div className="flex gap-1">
                    {[
                      {
                        value: 'consulting',
                        label: t('reportBuilder.settingsPanel.consulting', 'Consulting'),
                      },
                      {
                        value: 'neutral',
                        label: t('reportBuilder.settingsPanel.neutral', 'Neutral'),
                      },
                      {
                        value: 'decisive',
                        label: t('reportBuilder.settingsPanel.decisive', 'Decisive'),
                      },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => onIntentChange({ tone: t.value as any })}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                          intent.tone === t.value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                            : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Scope */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.scope', 'Scope')}
              icon={<Layers className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <div className="flex gap-1">
                  {[
                    { value: 'full', label: t('reportBuilder.settingsPanel.full', 'Full') },
                    { value: 'executive', label: 'Executive' },
                    {
                      value: 'focused',
                      label: t('reportBuilder.settingsPanel.focused', 'Focused'),
                    },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => onIntentChange({ scope: s.value as any })}
                      className={`flex-1 py-2 text-xs rounded-lg transition-all ${
                        intent.scope === s.value
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium ring-2 ring-blue-500'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.length', 'Length')}
                    </label>
                    <select
                      value={intent.targetLength || 'standard'}
                      onChange={(e) => onIntentChange({ targetLength: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="short">
                        {t('reportBuilder.settingsPanel.short', 'Short')}
                      </option>
                      <option value="standard">Standard</option>
                      <option value="long">{t('reportBuilder.settingsPanel.long', 'Long')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.preset', 'Preset')}
                    </label>
                    <select
                      value={intent.requiredSectionsPreset || 'standard'}
                      onChange={(e) =>
                        onIntentChange({ requiredSectionsPreset: e.target.value as any })
                      }
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="assessment_full">Assessment</option>
                      <option value="board_pack">Board Pack</option>
                      <option value="ops_delivery">Ops/Delivery</option>
                      <option value="standard">Standard</option>
                    </select>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Content Coherence (REQ-5) */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.contentCoherence', 'Content Coherence')}
              icon={<Target className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">
                    {t('reportBuilder.settingsPanel.narrativeThread', 'Narrative Thread')}
                  </label>
                  <textarea
                    value={(intent as any).narrativeThread || ''}
                    onChange={(e) => onIntentChange({ narrativeThread: e.target.value } as any)}
                    placeholder={t(
                      'reportBuilder.settingsPanel.eGTheOrganizationNeedsA',
                      'E.g., "The organization needs a fundamental shift in data strategy..."'
                    )}
                    className="w-full px-3 py-2 text-xs bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg resize-none h-16"
                  />
                  <p className="text-[10px] text-c-text-secondary mt-1">
                    {t(
                      'reportBuilder.settingsPanel.thisThreadWillBeEmphasizedAcross',
                      'This thread will be emphasized across all report sections'
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">
                    {t('reportBuilder.settingsPanel.keyTermsGlossary', 'Key Terms / Glossary')}
                  </label>
                  <textarea
                    value={(intent as any).glossaryTerms || ''}
                    onChange={(e) => onIntentChange({ glossaryTerms: e.target.value } as any)}
                    placeholder={t(
                      'reportBuilder.settingsPanel.eGDrdDigitalReadinessDiagnosis',
                      'E.g., "DRD = Digital Readiness Diagnosis; digital transformation; Industry 4.0"'
                    )}
                    className="w-full px-3 py-2 text-xs bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg resize-none h-16"
                  />
                  <p className="text-[10px] text-c-text-secondary mt-1">
                    {t(
                      'reportBuilder.settingsPanel.aiWillConsistentlyUseTheseTerms',
                      'AI will consistently use these terms throughout'
                    )}
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Language - 6 languages */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.reportLanguage', 'Report Language')}
              icon={<Globe className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="grid grid-cols-3 gap-2">
                {REPORT_LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => onIntentChange({ language: lang.value as any })}
                    className={`py-2 px-2 text-xs rounded-lg transition-all flex flex-col items-center gap-1 ${
                      intent.language === lang.value
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 font-medium'
                        : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Visuals */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.visuals', 'Visuals')}
              icon={<Image className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="space-y-2">
                {[
                  {
                    key: 'assessmentMatrix',
                    label: t('reportBuilder.settingsPanel.assessmentMatrix', 'Assessment Matrix'),
                  },
                  { key: 'charts', label: t('reportBuilder.settingsPanel.charts', 'Charts') },
                  { key: 'icons', label: t('reportBuilder.settingsPanel.icons', 'Icons') },
                ].map((v) => (
                  <label key={v.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-c-text-secondary">{v.label}</span>
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                        ((intent.visuals as any)?.[v.key] ?? true) ? 'bg-blue-600' : 'bg-c-border'
                      }`}
                      onClick={() =>
                        onIntentChange({
                          visuals: {
                            ...intent.visuals,
                            [v.key]: !((intent.visuals as any)?.[v.key] ?? true),
                          },
                        })
                      }
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-c-surface rounded-full shadow transition-transform ${
                          ((intent.visuals as any)?.[v.key] ?? true) ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ========== DESIGN TAB ========== */}
        {activeSection === 'styling' && (
          <div className="divide-y divide-c-border-subtle">
            {/* Layout */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.layout', 'Layout')}
              icon={<LayoutGrid className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onStylingChange({ layoutOrientation: 'vertical' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      styling.layoutOrientation === 'vertical'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-c-border-subtle hover:border-c-border-subtle'
                    }`}
                  >
                    <Smartphone className="w-8 h-8 text-c-text-secondary" />
                    <div className="text-center">
                      <div className="text-sm font-medium">
                        {t('reportBuilder.settingsPanel.portrait', 'Portrait')}
                      </div>
                      <div className="text-[10px] text-c-text-secondary">A4 / Letter</div>
                    </div>
                  </button>
                  <button
                    onClick={() => onStylingChange({ layoutOrientation: 'horizontal' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      styling.layoutOrientation === 'horizontal'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-c-border-subtle hover:border-c-border-subtle'
                    }`}
                  >
                    <Monitor className="w-8 h-8 text-c-text-secondary" />
                    <div className="text-center">
                      <div className="text-sm font-medium">
                        {t('reportBuilder.settingsPanel.landscape', 'Landscape')}
                      </div>
                      <div className="text-[10px] text-c-text-secondary">16:9 / Slides</div>
                    </div>
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">
                    {t('reportBuilder.settingsPanel.footer', 'Footer')}
                  </label>
                  <select
                    value={styling.footerMode || 'minimal'}
                    onChange={(e) => onStylingChange({ footerMode: e.target.value as any })}
                    className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                  >
                    <option value="none">{t('reportBuilder.settingsPanel.none', 'None')}</option>
                    <option value="minimal">
                      {t('reportBuilder.settingsPanel.minimal', 'Minimal')}
                    </option>
                    <option value="full">{t('reportBuilder.settingsPanel.full2', 'Full')}</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            {/* Theme & Font */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.style', 'Style')}
              icon={<Palette className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: 'professional',
                      label: t('reportBuilder.settingsPanel.professional', 'Professional'),
                    },
                    { value: 'modern', label: t('reportBuilder.settingsPanel.modern', 'Modern') },
                    {
                      value: 'minimal',
                      label: t('reportBuilder.settingsPanel.minimal2', 'Minimal'),
                    },
                    {
                      value: 'corporate',
                      label: t('reportBuilder.settingsPanel.corporate', 'Corporate'),
                    },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => onStylingChange({ theme: theme.value as any })}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                        styling.theme === theme.value
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.font', 'Font')}
                    </label>
                    <select
                      value={styling.fontFamily || 'inter'}
                      onChange={(e) => onStylingChange({ fontFamily: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="inter">Inter</option>
                      <option value="roboto">Roboto</option>
                      <option value="poppins">Poppins</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-secondary mb-1">
                      {t('reportBuilder.settingsPanel.size', 'Size')}
                    </label>
                    <select
                      value={styling.fontSize || 'medium'}
                      onChange={(e) => onStylingChange({ fontSize: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg"
                    >
                      <option value="small">
                        {t('reportBuilder.settingsPanel.small', 'Small')}
                      </option>
                      <option value="medium">
                        {t('reportBuilder.settingsPanel.medium', 'Medium')}
                      </option>
                      <option value="large">
                        {t('reportBuilder.settingsPanel.large', 'Large')}
                      </option>
                    </select>
                  </div>
                </div>
                {/* Font size preview hint */}
                <div className="text-[10px] text-c-text-secondary bg-c-surface-raised rounded-lg p-2">
                  {styling.fontSize === 'small' && (
                    <span>H1: 24px • H2: 18px • H3: 14px • Body: 12px</span>
                  )}
                  {(styling.fontSize === 'medium' || !styling.fontSize) && (
                    <span>H1: 32px • H2: 24px • H3: 18px • Body: 14px</span>
                  )}
                  {styling.fontSize === 'large' && (
                    <span>H1: 40px • H2: 30px • H3: 22px • Body: 16px</span>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Colors */}
            <SectionCard
              title={t('reportBuilder.settingsPanel.colors', 'Colors')}
              icon={<Palette className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                {/* Primary & Accent in row */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={styling.primaryColor}
                      onChange={(e) => onStylingChange({ primaryColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <div>
                      <div className="text-xs text-c-text-secondary">
                        {t('reportBuilder.settingsPanel.primary', 'Primary')}
                      </div>
                      <div className="text-[10px] font-mono text-c-text-secondary">
                        {styling.primaryColor}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={styling.accentColor}
                      onChange={(e) => onStylingChange({ accentColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <div>
                      <div className="text-xs text-c-text-secondary">
                        {t('reportBuilder.settingsPanel.accent', 'Accent')}
                      </div>
                      <div className="text-[10px] font-mono text-c-text-secondary">
                        {styling.accentColor}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom palette */}
                <div className="pt-2 border-t border-c-border-subtle">
                  <div className="text-xs text-c-text-secondary mb-2">
                    {t('reportBuilder.settingsPanel.palette', 'Palette')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(styling.customColors || []).map((color) => (
                      <div key={color} className="relative group">
                        <div
                          className="w-7 h-7 rounded-lg border border-c-border-subtle shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <button
                          onClick={() => removeCustomColor(color)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-c-text rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {(styling.customColors?.length || 0) < 8 && (
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0"
                        />
                        <button
                          onClick={addCustomColor}
                          className="w-7 h-7 flex items-center justify-center bg-c-surface-raised rounded-lg hover:bg-c-border-subtle"
                        >
                          <Plus className="w-4 h-4 text-c-text-secondary" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Branding */}
            <SectionCard title="Branding" icon={<Image className="w-4 h-4" />} defaultOpen={false}>
              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <div className="text-xs text-c-text-secondary mb-2">
                    {t('reportBuilder.settingsPanel.clientLogo', 'Client Logo')}
                  </div>
                  {styling.clientLogoUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={styling.clientLogoUrl}
                        alt="Logo"
                        className="max-h-12 rounded-lg border border-c-border-subtle"
                      />
                      <button
                        onClick={() =>
                          onStylingChange({ clientLogoUrl: undefined, showLogo: false })
                        }
                        className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-c-text rounded-full flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-c-border-subtle rounded-lg text-c-text-secondary hover:border-blue-400 hover:text-blue-500 transition-all text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      {t('reportBuilder.settingsPanel.uploadLogo', 'Upload logo')}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>

                {/* Consultify branding */}
                <div className="pt-3 border-t border-c-border-subtle">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-sm text-c-text">
                        {t(
                          'reportBuilder.settingsPanel.createdInConsultify',
                          '"Created in Consultify"'
                        )}
                      </div>
                      <div className="text-xs text-c-text-secondary">
                        {t('reportBuilder.settingsPanel.autoFooterText', 'Auto footer text')}
                      </div>
                    </div>
                    <div
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        styling.showBranding ? 'bg-blue-600' : 'bg-c-border'
                      }`}
                      onClick={() => onStylingChange({ showBranding: !styling.showBranding })}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-c-surface rounded-full shadow transition-transform ${
                          styling.showBranding ? 'left-5' : 'left-1'
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ========== REVIEW TAB ========== */}
        {activeSection === 'review' && !isTemplateMode && (
          <div className="p-4 space-y-4">
            {reportId && <QualityGatesPanel reportId={reportId} />}
            {reviewPanel || null}
          </div>
        )}

        {/* ========== VERSIONS TAB — Professional Version Management ========== */}
        {activeSection === 'versions' && !isTemplateMode && (
          <VersionsTabContent
            versions={versions}
            isLoadingVersions={isLoadingVersions}
            onCreateVersion={onCreateVersion}
            onRollbackVersion={onRollbackVersion}
            reportStatus={reportStatus}
            lastSavedAt={lastSavedAt}
            currentVersion={currentVersion}
            isPl={isPl}
          />
        )}

        {/* ========== EXPORT TAB (hidden, but kept for compatibility) ========== */}
        {activeSection === 'export' && <div className="p-4">{exportPanel || null}</div>}
      </div>
    </aside>
  );
};

export default SettingsPanel;
