/**
 * SettingsPanel
 *
 * Left sidebar with report settings organized in collapsible sections
 */

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Globe,
  Image,
  Layers,
  MessageSquare,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Share2,
  Target,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ReportSourceType } from '../useReportBuilder';
import type { ReportIntent, ReportStyling } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface SettingsPanelProps {
  intent: ReportIntent;
  styling: ReportStyling;
  sourceType: ReportSourceType | null;
  sourceName: string | null;
  onIntentChange: (updates: Partial<ReportIntent>) => void;
  onStylingChange: (updates: Partial<ReportStyling>) => void;
  activeSection: 'intent' | 'styling' | 'export';
  onSectionChange: (section: 'intent' | 'styling' | 'export') => void;
  exportPanel?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ==========================================
// COMPONENT
// ==========================================

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  intent,
  styling,
  sourceType,
  sourceName,
  onIntentChange,
  onStylingChange,
  activeSection,
  onSectionChange,
  exportPanel,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['audience', 'goal', 'visuals'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderCollapsible = (
    id: string,
    icon: React.ReactNode,
    title: string,
    children: React.ReactNode
  ) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <span className="text-slate-400">{icon}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {isExpanded && <div className="px-4 pb-4 space-y-3">{children}</div>}
      </div>
    );
  };

  const renderSelect = (
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  const renderToggle = (checked: boolean, onChange: (checked: boolean) => void, label: string) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <div
        className={`
          relative w-10 h-6 rounded-full transition-colors
          ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}
        `}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
            ${checked ? 'left-5' : 'left-1'}
          `}
        />
      </div>
    </label>
  );

  const renderColorPicker = (value: string, onChange: (value: string) => void, label: string) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <span className="text-xs text-slate-400 font-mono">{value}</span>
      </div>
    </div>
  );

  // Collapsed state - show only expand button
  if (isCollapsed) {
    return (
      <aside className="relative flex-shrink-0">
        {/* Expand trigger zone - invisible but hoverable at right edge */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 hover:w-4 bg-transparent hover:bg-blue-500/10 cursor-pointer transition-all z-10"
          onClick={onToggleCollapse}
          onMouseEnter={(e) => {
            // Auto-expand on hover at edge
            const timer = setTimeout(() => {
              onToggleCollapse?.();
            }, 300);
            (e.target as HTMLElement).dataset.timer = String(timer);
          }}
          onMouseLeave={(e) => {
            const timer = (e.target as HTMLElement).dataset.timer;
            if (timer) clearTimeout(Number(timer));
          }}
        />
        {/* Collapsed bar */}
        <div className="w-12 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center py-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title={isPl ? 'Rozwiń panel' : 'Expand panel'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Vertical icons for quick access */}
          <div className="mt-4 space-y-2">
            <button
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('intent');
              }}
              className={`p-2 rounded-lg transition-colors ${activeSection === 'intent' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={isPl ? 'Cel' : 'Intent'}
            >
              <Target className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('styling');
              }}
              className={`p-2 rounded-lg transition-colors ${activeSection === 'styling' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={isPl ? 'Styl' : 'Style'}
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                onToggleCollapse?.();
                onSectionChange('export');
              }}
              className={`p-2 rounded-lg transition-colors ${activeSection === 'export' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Export"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden flex-shrink-0 transition-all duration-300">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {isPl ? 'Ustawienia' : 'Settings'}
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          title={isPl ? 'Zwiń panel' : 'Collapse panel'}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'intent', icon: <Target className="w-4 h-4" />, label: isPl ? 'Cel' : 'Intent' },
          { id: 'styling', icon: <Palette className="w-4 h-4" />, label: isPl ? 'Styl' : 'Style' },
          { id: 'export', icon: <Share2 className="w-4 h-4" />, label: 'Export' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSectionChange(tab.id as any)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
              ${
                activeSection === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }
            `}
          >
            {tab.icon}
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'intent' && (
          <>
            {/* Audience */}
            {renderCollapsible(
              'audience',
              <Users className="w-4 h-4" />,
              isPl ? 'Odbiorca' : 'Audience',
              <>
                {renderSelect(
                  intent.audience,
                  [
                    {
                      value: 'executive',
                      label: isPl ? 'Zarząd / C-level' : 'Executive / C-level',
                    },
                    { value: 'board', label: isPl ? 'Rada Nadzorcza' : 'Board' },
                    { value: 'technical', label: isPl ? 'Techniczny' : 'Technical' },
                    { value: 'operational', label: isPl ? 'Operacyjny' : 'Operational' },
                    { value: 'mixed', label: isPl ? 'Mieszany' : 'Mixed' },
                  ],
                  (v) => onIntentChange({ audience: v as any })
                )}
                <p className="text-xs text-slate-400">
                  {isPl
                    ? 'Określ głównego odbiorcę raportu'
                    : 'Define the primary audience for this report'}
                </p>
              </>
            )}

            {/* Goal */}
            {renderCollapsible(
              'goal',
              <Target className="w-4 h-4" />,
              isPl ? 'Cel raportu' : 'Report Goal',
              <>
                {renderSelect(
                  intent.goal,
                  [
                    { value: 'diagnosis', label: isPl ? 'Diagnoza' : 'Diagnosis' },
                    { value: 'roadmap', label: isPl ? 'Roadmap / Plan' : 'Roadmap / Plan' },
                    {
                      value: 'investment_decision',
                      label: isPl ? 'Decyzja inwestycyjna' : 'Investment Decision',
                    },
                    {
                      value: 'stakeholder_update',
                      label: isPl ? 'Update dla stakeholderów' : 'Stakeholder Update',
                    },
                    { value: 'summary', label: isPl ? 'Podsumowanie' : 'Summary' },
                  ],
                  (v) => onIntentChange({ goal: v as any })
                )}
              </>
            )}

            {/* Language */}
            {renderCollapsible(
              'language',
              <Globe className="w-4 h-4" />,
              isPl ? 'Język' : 'Language',
              <>
                <div className="flex gap-2">
                  {[
                    { value: 'pl', label: 'Polski' },
                    { value: 'en', label: 'English' },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => onIntentChange({ language: lang.value as any })}
                      className={`
                        flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                        ${
                          intent.language === lang.value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }
                      `}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Tone */}
            {renderCollapsible(
              'tone',
              <MessageSquare className="w-4 h-4" />,
              isPl ? 'Ton' : 'Tone',
              <>
                {renderSelect(
                  intent.tone,
                  [
                    { value: 'consulting', label: isPl ? 'Konsultingowy' : 'Consulting' },
                    { value: 'neutral', label: isPl ? 'Neutralny' : 'Neutral' },
                    { value: 'decisive', label: isPl ? 'Decyzyjny' : 'Decisive' },
                    { value: 'academic', label: isPl ? 'Akademicki' : 'Academic' },
                  ],
                  (v) => onIntentChange({ tone: v as any })
                )}
              </>
            )}

            {/* Scope */}
            {renderCollapsible(
              'scope',
              <Layers className="w-4 h-4" />,
              isPl ? 'Zakres' : 'Scope',
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'full', label: isPl ? 'Pełny' : 'Full' },
                    { value: 'executive', label: 'Executive' },
                    { value: 'focused', label: isPl ? 'Wybrany' : 'Focused' },
                  ].map((scope) => (
                    <button
                      key={scope.value}
                      onClick={() => onIntentChange({ scope: scope.value as any })}
                      className={`
                        py-2 px-2 rounded-lg text-xs font-medium transition-all
                        ${
                          intent.scope === scope.value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }
                      `}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Visuals */}
            {renderCollapsible(
              'visuals',
              <Image className="w-4 h-4" />,
              isPl ? 'Wizualizacje' : 'Visuals',
              <div className="space-y-3">
                {renderToggle(
                  intent.visuals?.assessmentMatrix ?? true,
                  (v) => onIntentChange({ visuals: { ...intent.visuals, assessmentMatrix: v } }),
                  isPl ? 'Macierz oceny' : 'Assessment Matrix'
                )}
                {renderToggle(
                  intent.visuals?.charts ?? true,
                  (v) => onIntentChange({ visuals: { ...intent.visuals, charts: v } }),
                  isPl ? 'Wykresy' : 'Charts'
                )}
                {renderToggle(
                  intent.visuals?.icons ?? true,
                  (v) => onIntentChange({ visuals: { ...intent.visuals, icons: v } }),
                  isPl ? 'Ikony' : 'Icons'
                )}
              </div>
            )}
          </>
        )}

        {activeSection === 'styling' && (
          <>
            {/* Theme */}
            {renderCollapsible(
              'theme',
              <Palette className="w-4 h-4" />,
              isPl ? 'Motyw' : 'Theme',
              <>
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
                      className={`
                        py-3 px-3 rounded-lg text-sm font-medium transition-all
                        ${
                          styling.theme === theme.value
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }
                      `}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Colors */}
            {renderCollapsible(
              'colors',
              <Palette className="w-4 h-4" />,
              isPl ? 'Kolory' : 'Colors',
              <div className="space-y-3">
                {renderColorPicker(
                  styling.primaryColor,
                  (v) => onStylingChange({ primaryColor: v }),
                  isPl ? 'Kolor główny' : 'Primary'
                )}
                {renderColorPicker(
                  styling.accentColor,
                  (v) => onStylingChange({ accentColor: v }),
                  isPl ? 'Kolor akcentu' : 'Accent'
                )}
              </div>
            )}

            {/* Branding */}
            {renderCollapsible(
              'branding',
              <FileText className="w-4 h-4" />,
              'Branding',
              <div className="space-y-3">
                {renderToggle(
                  styling.showLogo,
                  (v) => onStylingChange({ showLogo: v }),
                  isPl ? 'Logo firmy' : 'Company Logo'
                )}
                {renderToggle(
                  styling.showBranding,
                  (v) => onStylingChange({ showBranding: v }),
                  isPl ? 'Branding Consultinity' : 'Consultinity Branding'
                )}
              </div>
            )}
          </>
        )}

        {activeSection === 'export' && <div className="p-4 space-y-4">{exportPanel || null}</div>}
      </div>
    </aside>
  );
};

export default SettingsPanel;
