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
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Globe,
  Image,
  Layers,
  LayoutGrid,
  Monitor,
  Palette,
  Plus,
  Smartphone,
  Target,
  Trash2,
  Upload,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
};

interface SettingsPanelProps {
  intent: ReportIntent;
  styling: ReportStyling;
  sourceType: ReportSourceType | null;
  sourceName: string | null;
  onIntentChange: (updates: Partial<ReportIntent>) => void;
  onStylingChange: (updates: Partial<ReportStyling>) => void;
  activeSection: 'intent' | 'styling' | 'export' | 'review';
  onSectionChange: (section: 'intent' | 'styling' | 'export' | 'review') => void;
  exportPanel?: React.ReactNode;
  reviewPanel?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isTemplateMode?: boolean;
  onApplyPreset?: (preset: 'assessment_full' | 'board_pack' | 'ops_delivery') => void;
  templateMeta?: TemplateMeta;
  onTemplateMetaChange?: (updates: Partial<TemplateMeta>) => void;
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
  { value: 'jp', label: 'JP', fullName: '日本語', flag: '🇯🇵' },
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
    <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
          {audienceLabels[intent.audience] || intent.audience}
        </span>
        <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
          {orientationLabel}
        </span>
        <span className="px-2 py-1 bg-white dark:bg-slate-900 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
          {langLabel} {intent.language?.toUpperCase()}
        </span>
        <span
          className="w-4 h-4 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"
          style={{ backgroundColor: styling.primaryColor }}
          title={isPl ? 'Kolor główny' : 'Primary color'}
        />
      </div>
    </div>
  );
};

// ==========================================
// SECTION CARD COMPONENT
// ==========================================

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-slate-400">{icon}</span>}
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {title}
      </h3>
    </div>
    {children}
  </div>
);

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
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newColor, setNewColor] = useState('#6366F1');

  // Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(isPl ? 'Proszę wybrać plik obrazu' : 'Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert(isPl ? 'Plik jest za duży (max 2MB)' : 'File is too large (max 2MB)');
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
    return (
      <aside className="relative flex-shrink-0">
        <div className="w-12 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center py-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="mt-4 space-y-2">
            <button
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('intent');
              }}
              className={`p-2 rounded-lg ${activeSection === 'intent' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Target className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('styling');
              }}
              className={`p-2 rounded-lg ${activeSection === 'styling' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Palette className="w-5 h-5" />
            </button>
            {!isTemplateMode && (
              <button
                onClick={() => {
                  onToggleCollapse?.();
                  onSectionChange('review');
                }}
                className={`p-2 rounded-lg ${activeSection === 'review' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <ClipboardCheck className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {isPl ? 'Ustawienia' : 'Settings'}
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Preview Bar */}
      <QuickPreviewBar intent={intent} styling={styling} isPl={isPl} />

      {/* Tabs: Content | Design | (Review) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onSectionChange('intent')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeSection === 'intent'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {isPl ? 'Treść' : 'Content'}
        </button>
        <button
          onClick={() => onSectionChange('styling')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeSection === 'styling'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {isPl ? 'Wygląd' : 'Design'}
        </button>
        {!isTemplateMode && (
          <button
            onClick={() => onSectionChange('review')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeSection === 'review'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isPl ? 'Recenzja' : 'Review'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ========== CONTENT TAB ========== */}
        {activeSection === 'intent' && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Template Info (only in template mode) */}
            {isTemplateMode && templateMeta && onTemplateMetaChange && (
              <SectionCard
                title={isPl ? 'Szablon' : 'Template'}
                icon={<FileText className="w-4 h-4" />}
              >
                <div className="space-y-3">
                  {/* Module selection */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Moduł' : 'Module'}
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
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="ASSESSMENT">📊 Assessment</option>
                      <option value="TOOL">🛠️ Tool</option>
                      <option value="INTERVIEW">🎤 Interview</option>
                      <option value="INITIATIVE">🚀 Initiative</option>
                    </select>
                  </div>

                  {/* Tool/Framework selection - dynamic based on module */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Narzędzie / Framework' : 'Tool / Framework'}
                    </label>
                    <select
                      value={templateMeta.reportType || ''}
                      onChange={(e) => onTemplateMetaChange?.({ reportType: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="">— {isPl ? 'Wybierz' : 'Select'} —</option>
                      {MODULE_TOOLS[templateMeta.sourceType || 'ASSESSMENT']?.map((tool) => (
                        <option key={tool.value} value={tool.value}>
                          {tool.label}
                        </option>
                      ))}
                    </select>
                    {/* Show description of selected tool */}
                    {templateMeta.reportType && (
                      <div className="mt-1 text-[10px] text-slate-400">
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
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Autor' : 'Author'}
                    </label>
                    <input
                      value={templateMeta.author || ''}
                      onChange={(e) => onTemplateMetaChange?.({ author: e.target.value })}
                      placeholder={isPl ? 'Imię i nazwisko...' : 'Name...'}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>

                  {/* Description */}
                  <textarea
                    value={templateMeta.description || ''}
                    onChange={(e) => onTemplateMetaChange?.({ description: e.target.value })}
                    placeholder={isPl ? 'Opis szablonu...' : 'Template description...'}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-none"
                  />
                </div>
              </SectionCard>
            )}

            {/* Quick Preset (template mode) */}
            {isTemplateMode && onApplyPreset && (
              <SectionCard
                title={isPl ? 'Szybki preset' : 'Quick Preset'}
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
                      className="flex-1 py-2 px-2 text-xs font-medium bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-400 hover:shadow-sm transition-all"
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
              title={isPl ? 'Cel i odbiorcy' : 'Goal & Audience'}
              icon={<Target className="w-4 h-4" />}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Odbiorca' : 'Audience'}
                    </label>
                    <select
                      value={intent.audience}
                      onChange={(e) => onIntentChange({ audience: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="executive">{isPl ? 'Zarząd' : 'Executive'}</option>
                      <option value="board">{isPl ? 'Rada' : 'Board'}</option>
                      <option value="technical">{isPl ? 'Techniczny' : 'Technical'}</option>
                      <option value="operational">{isPl ? 'Operacyjny' : 'Operational'}</option>
                      <option value="mixed">{isPl ? 'Mieszany' : 'Mixed'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Cel' : 'Goal'}
                    </label>
                    <select
                      value={intent.goal}
                      onChange={(e) => onIntentChange({ goal: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="diagnosis">{isPl ? 'Diagnoza' : 'Diagnosis'}</option>
                      <option value="roadmap">{isPl ? 'Roadmap' : 'Roadmap'}</option>
                      <option value="investment_decision">
                        {isPl ? 'Decyzja inwest.' : 'Investment'}
                      </option>
                      <option value="stakeholder_update">{isPl ? 'Update' : 'Update'}</option>
                      <option value="summary">{isPl ? 'Podsumowanie' : 'Summary'}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPl ? 'Ton' : 'Tone'}
                  </label>
                  <div className="flex gap-1">
                    {[
                      { value: 'consulting', label: isPl ? 'Konsultingowy' : 'Consulting' },
                      { value: 'neutral', label: isPl ? 'Neutralny' : 'Neutral' },
                      { value: 'decisive', label: isPl ? 'Decyzyjny' : 'Decisive' },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => onIntentChange({ tone: t.value as any })}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                          intent.tone === t.value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
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
            <SectionCard title={isPl ? 'Zakres' : 'Scope'} icon={<Layers className="w-4 h-4" />}>
              <div className="space-y-3">
                <div className="flex gap-1">
                  {[
                    { value: 'full', label: isPl ? 'Pełny' : 'Full' },
                    { value: 'executive', label: 'Executive' },
                    { value: 'focused', label: isPl ? 'Wybrany' : 'Focused' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => onIntentChange({ scope: s.value as any })}
                      className={`flex-1 py-2 text-xs rounded-lg transition-all ${
                        intent.scope === s.value
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium ring-2 ring-blue-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Długość' : 'Length'}
                    </label>
                    <select
                      value={intent.targetLength || 'standard'}
                      onChange={(e) => onIntentChange({ targetLength: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="short">{isPl ? 'Krótki' : 'Short'}</option>
                      <option value="standard">Standard</option>
                      <option value="long">{isPl ? 'Długi' : 'Long'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Preset' : 'Preset'}
                    </label>
                    <select
                      value={intent.requiredSectionsPreset || 'standard'}
                      onChange={(e) =>
                        onIntentChange({ requiredSectionsPreset: e.target.value as any })
                      }
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
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

            {/* Language - 6 languages */}
            <SectionCard
              title={isPl ? 'Język raportu' : 'Report Language'}
              icon={<Globe className="w-4 h-4" />}
            >
              <div className="grid grid-cols-3 gap-2">
                {REPORT_LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => onIntentChange({ language: lang.value as any })}
                    className={`py-2 px-2 text-xs rounded-lg transition-all flex flex-col items-center gap-1 ${
                      intent.language === lang.value
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 font-medium'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
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
              title={isPl ? 'Wizualizacje' : 'Visuals'}
              icon={<Image className="w-4 h-4" />}
            >
              <div className="space-y-2">
                {[
                  { key: 'assessmentMatrix', label: isPl ? 'Macierz oceny' : 'Assessment Matrix' },
                  { key: 'charts', label: isPl ? 'Wykresy' : 'Charts' },
                  { key: 'icons', label: isPl ? 'Ikony' : 'Icons' },
                ].map((v) => (
                  <label key={v.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{v.label}</span>
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                        ((intent.visuals as any)?.[v.key] ?? true)
                          ? 'bg-blue-600'
                          : 'bg-slate-300 dark:bg-slate-600'
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
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
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
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Layout */}
            <SectionCard
              title={isPl ? 'Układ' : 'Layout'}
              icon={<LayoutGrid className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onStylingChange({ layoutOrientation: 'vertical' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      styling.layoutOrientation === 'vertical'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Smartphone className="w-8 h-8 text-slate-500" />
                    <div className="text-center">
                      <div className="text-sm font-medium">{isPl ? 'Pionowy' : 'Portrait'}</div>
                      <div className="text-[10px] text-slate-400">A4 / Letter</div>
                    </div>
                  </button>
                  <button
                    onClick={() => onStylingChange({ layoutOrientation: 'horizontal' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      styling.layoutOrientation === 'horizontal'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Monitor className="w-8 h-8 text-slate-500" />
                    <div className="text-center">
                      <div className="text-sm font-medium">{isPl ? 'Poziomy' : 'Landscape'}</div>
                      <div className="text-[10px] text-slate-400">16:9 / Slides</div>
                    </div>
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPl ? 'Stopka' : 'Footer'}
                  </label>
                  <select
                    value={styling.footerMode || 'minimal'}
                    onChange={(e) => onStylingChange({ footerMode: e.target.value as any })}
                    className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="none">{isPl ? 'Brak' : 'None'}</option>
                    <option value="minimal">{isPl ? 'Minimalna' : 'Minimal'}</option>
                    <option value="full">{isPl ? 'Pełna' : 'Full'}</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            {/* Theme & Font */}
            <SectionCard title={isPl ? 'Styl' : 'Style'} icon={<Palette className="w-4 h-4" />}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'professional', label: isPl ? 'Profesjonalny' : 'Professional' },
                    { value: 'modern', label: isPl ? 'Nowoczesny' : 'Modern' },
                    { value: 'minimal', label: isPl ? 'Minimalistyczny' : 'Minimal' },
                    { value: 'corporate', label: isPl ? 'Korporacyjny' : 'Corporate' },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => onStylingChange({ theme: theme.value as any })}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                        styling.theme === theme.value
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Font' : 'Font'}
                    </label>
                    <select
                      value={styling.fontFamily || 'inter'}
                      onChange={(e) => onStylingChange({ fontFamily: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="inter">Inter</option>
                      <option value="roboto">Roboto</option>
                      <option value="poppins">Poppins</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {isPl ? 'Rozmiar' : 'Size'}
                    </label>
                    <select
                      value={styling.fontSize || 'medium'}
                      onChange={(e) => onStylingChange({ fontSize: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="small">{isPl ? 'Mały' : 'Small'}</option>
                      <option value="medium">{isPl ? 'Średni' : 'Medium'}</option>
                      <option value="large">{isPl ? 'Duży' : 'Large'}</option>
                    </select>
                  </div>
                </div>
                {/* Font size preview hint */}
                <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
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
            <SectionCard title={isPl ? 'Kolory' : 'Colors'} icon={<Palette className="w-4 h-4" />}>
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
                      <div className="text-xs text-slate-500">{isPl ? 'Główny' : 'Primary'}</div>
                      <div className="text-[10px] font-mono text-slate-400">
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
                      <div className="text-xs text-slate-500">{isPl ? 'Akcent' : 'Accent'}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {styling.accentColor}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom palette */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 mb-2">{isPl ? 'Paleta' : 'Palette'}</div>
                  <div className="flex flex-wrap gap-2">
                    {(styling.customColors || []).map((color) => (
                      <div key={color} className="relative group">
                        <div
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <button
                          onClick={() => removeCustomColor(color)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
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
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
                        >
                          <Plus className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Branding */}
            <SectionCard title="Branding" icon={<Image className="w-4 h-4" />}>
              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <div className="text-xs text-slate-500 mb-2">
                    {isPl ? 'Logo klienta' : 'Client Logo'}
                  </div>
                  {styling.clientLogoUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={styling.clientLogoUrl}
                        alt="Logo"
                        className="max-h-12 rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        onClick={() =>
                          onStylingChange({ clientLogoUrl: undefined, showLogo: false })
                        }
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-all text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      {isPl ? 'Wgraj logo' : 'Upload logo'}
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

                {/* Consultinity branding */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        {isPl ? '"Stworzono w Consultinity"' : '"Created in Consultinity"'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isPl ? 'Automatyczny napis w stopce' : 'Auto footer text'}
                      </div>
                    </div>
                    <div
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        styling.showBranding ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      onClick={() => onStylingChange({ showBranding: !styling.showBranding })}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
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
          <div className="p-4">{reviewPanel || null}</div>
        )}

        {/* ========== EXPORT TAB (hidden, but kept for compatibility) ========== */}
        {activeSection === 'export' && <div className="p-4">{exportPanel || null}</div>}
      </div>
    </aside>
  );
};

export default SettingsPanel;
