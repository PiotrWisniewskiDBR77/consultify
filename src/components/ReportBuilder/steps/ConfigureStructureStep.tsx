/**
 * ConfigureStructureStep
 *
 * Step 2: Configure report structure - enable/disable sections, set options, reorder.
 */

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  MessageSquarePlus,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type { Report, ReportSection, SectionLanguage, SectionLength } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface ConfigureStructureStepProps {
  report: Report | null;
  sections: ReportSection[];
  onUpdateSection: (sectionKey: string, updates: Partial<ReportSection>) => void;
  onReorderSections: (newOrder: string[]) => void;
  onAddSection: (args: {
    title: string;
    blockTypeId?: string;
    renderKind?: string;
    length?: SectionLength;
    language?: SectionLanguage;
  }) => Promise<ReportSection | null>;
  onRemoveSection: (sectionKey: string) => Promise<boolean>;
  onSaveConfig: (
    updates: Array<{
      sectionKey: string;
      enabled?: boolean;
      orderIndex?: number;
      length?: SectionLength;
      language?: SectionLanguage;
      customPrompt?: string;
      title?: string;
    }>
  ) => Promise<void>;
  isLoading: boolean;
}

const LENGTH_OPTIONS: Array<{
  value: SectionLength;
  label: string;
  labelPl: string;
  description: string;
}> = [
  { value: 'short', label: 'Short', labelPl: 'Krótka', description: '200-400 words' },
  { value: 'medium', label: 'Medium', labelPl: 'Średnia', description: '500-800 words' },
  { value: 'long', label: 'Long', labelPl: 'Długa', description: '1000-1500 words' },
];

const LANGUAGE_OPTIONS: Array<{
  value: SectionLanguage;
  label: string;
  labelPl: string;
  description: string;
}> = [
  {
    value: 'technical',
    label: 'Technical',
    labelPl: 'Techniczny',
    description: 'IT/Engineering focus',
  },
  {
    value: 'business',
    label: 'Business',
    labelPl: 'Biznesowy',
    description: 'Executive/Management',
  },
  { value: 'general', label: 'General', labelPl: 'Ogólny', description: 'All stakeholders' },
];

// ==========================================
// SECTION OPTIONS MODAL
// ==========================================

interface SectionOptionsModalProps {
  section: ReportSection;
  onClose: () => void;
  onSave: (updates: Partial<ReportSection>) => void;
  isPl: boolean;
}

const SectionOptionsModal: React.FC<SectionOptionsModalProps> = ({
  section,
  onClose,
  onSave,
  isPl,
}) => {
  const [length, setLength] = useState<SectionLength>(section.length);
  const [language, setLanguage] = useState<SectionLanguage>(section.language);
  const [customPrompt, setCustomPrompt] = useState(section.customPrompt || '');
  const [title, setTitle] = useState(section.title);

  const handleSave = () => {
    onSave({ length, language, customPrompt: customPrompt.trim() || undefined, title });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Opcje Sekcji' : 'Section Options'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Tytuł Sekcji' : 'Section Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Length */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Długość' : 'Length'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLength(opt.value)}
                  className={`
                    p-3 rounded-lg border text-center transition-all
                    ${
                      length === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                    }
                  `}
                >
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    {isPl ? opt.labelPl : opt.label}
                  </div>
                  <div className="text-xs text-slate-500">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Styl Języka' : 'Language Style'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                  className={`
                    p-3 rounded-lg border text-center transition-all
                    ${
                      language === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                    }
                  `}
                >
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    {isPl ? opt.labelPl : opt.label}
                  </div>
                  <div className="text-xs text-slate-500">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Dodatkowe Wskazówki dla AI' : 'Additional AI Guidance'}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={
                isPl
                  ? 'Np. "Skup się na aspektach finansowych", "Dodaj porównanie z konkurencją"...'
                  : 'E.g., "Focus on financial aspects", "Include competitor comparison"...'
              }
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ADD SECTION MODAL
// ==========================================

interface AddSectionModalProps {
  onClose: () => void;
  onAdd: (args: {
    title: string;
    blockTypeId?: string;
    renderKind?: string;
    length?: SectionLength;
    language?: SectionLanguage;
  }) => void;
  isPl: boolean;
  blockTypes: Array<{
    id: string;
    name: string;
    renderKind?: string;
    defaultLength?: SectionLength;
    defaultLanguage?: SectionLanguage;
  }>;
  isLoadingBlocks: boolean;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
  onClose,
  onAdd,
  isPl,
  blockTypes,
  isLoadingBlocks,
}) => {
  const [title, setTitle] = useState('');
  const [selectedBlockTypeId, setSelectedBlockTypeId] = useState<string>('');

  const handleAdd = () => {
    if (title.trim()) {
      const bt = blockTypes.find((b) => b.id === selectedBlockTypeId);
      onAdd({
        title: title.trim(),
        blockTypeId: bt?.id || undefined,
        renderKind: bt?.renderKind || undefined,
        length: bt?.defaultLength,
        language: bt?.defaultLanguage,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Dodaj Sekcję' : 'Add Section'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {isPl ? 'Typ bloku' : 'Block type'}
          </label>
          <select
            value={selectedBlockTypeId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedBlockTypeId(id);
              const bt = blockTypes.find((b) => b.id === id);
              if (bt && !title) setTitle(bt.name);
            }}
            className="w-full mb-4 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{isPl ? 'Custom (tytuł + prompt)' : 'Custom (title + prompt)'}</option>
            {isLoadingBlocks ? (
              <option value="" disabled>
                {isPl ? 'Ładowanie…' : 'Loading…'}
              </option>
            ) : (
              blockTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))
            )}
          </select>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {isPl ? 'Tytuł Sekcji' : 'Section Title'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPl ? 'Wprowadź tytuł...' : 'Enter title...'}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPl ? 'Dodaj' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ConfigureStructureStep: React.FC<ConfigureStructureStepProps> = ({
  report,
  sections,
  onUpdateSection,
  onReorderSections,
  onAddSection,
  onRemoveSection,
  onSaveConfig,
  isLoading,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [optionsSection, setOptionsSection] = useState<ReportSection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [blockTypes, setBlockTypes] = useState<
    Array<{
      id: string;
      name: string;
      renderKind?: string;
      defaultLength?: SectionLength;
      defaultLanguage?: SectionLanguage;
    }>
  >([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!showAddModal) return;
    // Lazy-load block types when user opens "Add section"
    setIsLoadingBlocks(true);
    Api.get('/report-builder/block-types')
      .then((res: any) => setBlockTypes(res?.blocks || []))
      .catch(() => setBlockTypes([]))
      .finally(() => setIsLoadingBlocks(false));
  }, [showAddModal]);

  // Sort sections by order
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

  // Toggle section enabled
  const handleToggleEnabled = useCallback(
    (section: ReportSection) => {
      if (section.required) return; // Can't disable required sections
      onUpdateSection(section.sectionKey, { enabled: !section.enabled });
      onSaveConfig([{ sectionKey: section.sectionKey, enabled: !section.enabled }]);
    },
    [onUpdateSection, onSaveConfig]
  );

  // Move section up/down
  const handleMove = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sortedSections.length) return;

      const newOrder = [...sortedSections.map((s) => s.sectionKey)];
      [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
      onReorderSections(newOrder);

      // Save new order
      const updates = newOrder.map((key, i) => ({ sectionKey: key, orderIndex: i }));
      onSaveConfig(updates);
    },
    [sortedSections, onReorderSections, onSaveConfig]
  );

  // Save options from modal
  const handleSaveOptions = useCallback(
    (updates: Partial<ReportSection>) => {
      if (!optionsSection) return;
      onUpdateSection(optionsSection.sectionKey, updates);
      onSaveConfig([
        {
          sectionKey: optionsSection.sectionKey,
          length: updates.length,
          language: updates.language,
          customPrompt: updates.customPrompt,
          title: updates.title,
        },
      ]);
    },
    [optionsSection, onUpdateSection, onSaveConfig]
  );

  // Add new section
  const handleAddSection = useCallback(
    async (args: {
      title: string;
      blockTypeId?: string;
      renderKind?: string;
      length?: SectionLength;
      language?: SectionLanguage;
    }) => {
      await onAddSection(args);
    },
    [onAddSection]
  );

  // Remove section
  const handleRemoveSection = useCallback(
    async (sectionKey: string) => {
      if (
        confirm(
          isPl
            ? 'Czy na pewno chcesz usunąć tę sekcję?'
            : 'Are you sure you want to remove this section?'
        )
      ) {
        await onRemoveSection(sectionKey);
      }
    },
    [onRemoveSection, isPl]
  );

  // Get section type badge color
  const getSectionTypeColor = (type: string): string => {
    switch (type) {
      case 'cover':
      case 'summary':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'methodology':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'matrix':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'axis_analysis':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'list':
      case 'recommendations':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'action_plan':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {isPl
            ? `${sortedSections.filter((s) => s.enabled).length} z ${sortedSections.length} sekcji włączonych`
            : `${sortedSections.filter((s) => s.enabled).length} of ${sortedSections.length} sections enabled`}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isPl ? 'Dodaj Sekcję' : 'Add Section'}
        </button>
      </div>

      {/* Sections List */}
      <div className="space-y-2">
        {sortedSections.map((section, index) => (
          <div
            key={section.sectionKey}
            className={`
              flex items-center gap-3 p-4 rounded-lg border transition-all
              ${
                section.enabled
                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60'
              }
            `}
          >
            {/* Drag Handle */}
            <div className="cursor-grab text-slate-400 hover:text-slate-600">
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Checkbox */}
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={() => handleToggleEnabled(section)}
              disabled={section.required}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />

            {/* Section Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white truncate">
                  {section.title}
                </span>
                {section.required && <span className="text-xs text-slate-400">(required)</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${getSectionTypeColor(section.sectionType)}`}
                >
                  {section.sectionType}
                </span>
                <span className="text-xs text-slate-400">
                  {section.length} • {section.language}
                </span>
                {section.customPrompt && (
                  <span className="flex items-center gap-1 text-xs text-blue-500">
                    <MessageSquarePlus className="w-3 h-3" />
                    {isPl ? 'Dodatkowe wskazówki' : 'Custom prompt'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Move Up */}
              <button
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              {/* Move Down */}
              <button
                onClick={() => handleMove(index, 'down')}
                disabled={index === sortedSections.length - 1}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Options */}
              <button
                onClick={() => setOptionsSection(section)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Remove (only custom sections) */}
              {!section.required && section.sectionKey.startsWith('custom_') && (
                <button
                  onClick={() => handleRemoveSection(section.sectionKey)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Options Modal */}
      {optionsSection && (
        <SectionOptionsModal
          section={optionsSection}
          onClose={() => setOptionsSection(null)}
          onSave={handleSaveOptions}
          isPl={isPl}
        />
      )}

      {/* Add Section Modal */}
      {showAddModal && (
        <AddSectionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSection}
          isPl={isPl}
          blockTypes={blockTypes}
          isLoadingBlocks={isLoadingBlocks}
        />
      )}
    </div>
  );
};

export default ConfigureStructureStep;
