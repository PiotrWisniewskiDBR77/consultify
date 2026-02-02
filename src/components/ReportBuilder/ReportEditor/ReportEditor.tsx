/**
 * ReportEditor
 *
 * Main report building interface inspired by Gamma.app
 * - Left sidebar: Settings panel (intent, styling, export options)
 * - Center: Block canvas for building report structure
 * - Blocks can be added, reordered, configured inline
 */

import {
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
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type { Report, ReportSection, ReportSourceType, SourceOption } from '../useReportBuilder';
import { BlockCard } from './BlockCard';
import { BlockPalette } from './BlockPalette';
import { SettingsPanel } from './SettingsPanel';

// ==========================================
// TYPES
// ==========================================

export interface ReportIntent {
  audience: 'executive' | 'technical' | 'board' | 'operational' | 'mixed';
  goal: 'diagnosis' | 'roadmap' | 'investment_decision' | 'stakeholder_update' | 'summary';
  language: 'pl' | 'en';
  tone: 'consulting' | 'neutral' | 'decisive' | 'academic';
  scope: 'full' | 'executive' | 'focused';
  focusedAxes?: string[];
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
  fontFamily: 'inter' | 'roboto' | 'poppins' | 'system';
  showLogo: boolean;
  showBranding: boolean;
}

export interface BlockConfig {
  id: string;
  type: string;
  title: string;
  description?: string;
  dataSource?: string;
  length: 'short' | 'medium' | 'long';
  includeVisuals: boolean;
  customPrompt?: string;
  enabled: boolean;
  orderIndex: number;
  content?: string;
  isGenerating?: boolean;
  isGenerated?: boolean;
}

interface ReportEditorProps {
  reportId?: string;
  sourceType?: ReportSourceType;
  sourceId?: string;
  sourceName?: string;
  onSave?: (reportId: string) => void;
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
  onSave,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  // State
  const [report, setReport] = useState<Report | null>(null);
  const [blocks, setBlocks] = useState<BlockConfig[]>([]);
  const [intent, setIntent] = useState<ReportIntent>({
    audience: 'executive',
    goal: 'diagnosis',
    language: isPl ? 'pl' : 'en',
    tone: 'consulting',
    scope: 'full',
    visuals: { assessmentMatrix: true, charts: true, icons: true },
  });
  const [styling, setStyling] = useState<ReportStyling>({
    theme: 'professional',
    primaryColor: '#3B82F6',
    accentColor: '#8B5CF6',
    fontFamily: 'inter',
    showLogo: true,
    showBranding: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<'intent' | 'styling' | 'export'>('intent');
  const [isSettingsPanelCollapsed, setIsSettingsPanelCollapsed] = useState(false);

  // Source state
  const [sourceType, setSourceType] = useState<ReportSourceType | null>(initialSourceType || null);
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId || null);
  const [sourceName, setSourceName] = useState<string | null>(initialSourceName || null);
  const [reportTitle, setReportTitle] = useState('');

  // Load existing report
  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    } else if (initialSourceType && initialSourceId) {
      // Initialize with default blocks for source type
      initializeDefaultBlocks(initialSourceType);
      setReportTitle(`${initialSourceName || 'Assessment'} - Report`);
    }
  }, [reportId, initialSourceType, initialSourceId, initialSourceName]);

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

        // Load intent from config
        if (response.report.config?.intent) {
          setIntent((prev) => ({ ...prev, ...response.report.config.intent }));
        }

        // Convert sections to blocks
        if (response.sections) {
          const loadedBlocks: BlockConfig[] = response.sections.map((s: ReportSection) => ({
            id: s.id,
            type: s.sectionType,
            title: s.title,
            length: s.length || 'medium',
            includeVisuals: s.renderKind === 'matrix' || false,
            enabled: s.enabled,
            orderIndex: s.orderIndex,
            content: s.editedContent || s.generatedContent,
            isGenerated: Boolean(s.generatedContent),
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
    (blockType: string, title: string, afterIndex?: number) => {
      const newBlock: BlockConfig = {
        id: `block_${Date.now()}`,
        type: blockType,
        title,
        length: 'medium',
        includeVisuals: blockType === 'matrix',
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
        // Update sections
        const sectionUpdates = blocks.map((b) => ({
          sectionKey: b.id,
          enabled: b.enabled,
          orderIndex: b.orderIndex,
          title: b.title,
          length: b.length,
        }));
        await Api.put(`/report-builder/${report.id}/config`, { sections: sectionUpdates });
      } else {
        // Create new
        const response = await Api.post('/report-builder', {
          sourceType,
          sourceId,
          title: reportTitle || `${sourceName} - Report`,
          config,
        });
        if (response?.report) {
          setReport(response.report);
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
            placeholder={isPl ? 'Tytuł raportu...' : 'Report title...'}
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
            {isPl ? 'Zapisz' : 'Save'}
          </button>

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
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Block Canvas */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Source Info */}
            {sourceName && (
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
          sourceType={sourceType}
          sourceName={sourceName}
          onIntentChange={(updates) => setIntent((prev) => ({ ...prev, ...updates }))}
          onStylingChange={(updates) => setStyling((prev) => ({ ...prev, ...updates }))}
          activeSection={settingsSection}
          onSectionChange={setSettingsSection}
          isCollapsed={isSettingsPanelCollapsed}
          onToggleCollapse={() => setIsSettingsPanelCollapsed((prev) => !prev)}
        />
      </div>

      {/* Block Palette Modal */}
      {showBlockPalette && (
        <BlockPalette
          onSelect={addBlock}
          onClose={() => setShowBlockPalette(false)}
          isPl={isPl}
          sourceType={sourceType}
        />
      )}
    </div>
  );
};

export default ReportEditor;
