import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Wand2,
  FileText,
  BarChart3,
  Target,
  Map,
  BookOpen,
  Settings,
  Layers,
  Brain,
  Shield,
  Users,
  Database,
  Briefcase,
  Package,
  Cpu
} from 'lucide-react';
import { ReportSection } from './ReportSection';
import { EmbeddedMatrix } from './EmbeddedMatrix';

// Types
interface ReportSectionData {
  id: string;
  reportId: string;
  sectionType: string;
  axisId?: string;
  areaId?: string;
  title: string;
  content: string;
  dataSnapshot: Record<string, unknown>;
  orderIndex: number;
  isAiGenerated: boolean;
  version: number;
  updatedAt: string;
}

interface FullReport {
  id: string;
  name: string;
  status: 'DRAFT' | 'FINAL';
  assessmentId: string;
  assessmentName?: string;
  projectName?: string;
  organizationName?: string;
  axisData: Record<string, { actual?: number; target?: number; justification?: string }>;
  sections: ReportSectionData[];
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportBuilderProps {
  report: FullReport;
  readOnly?: boolean;
  focusSectionId?: string | null;
  onSectionUpdate: (sectionId: string, content: string, title?: string) => Promise<void>;
  onSectionAdd: (sectionType: string, afterIndex: number) => Promise<unknown>;
  onSectionDelete: (sectionId: string) => Promise<void>;
  onSectionReorder: (newOrder: { id: string; orderIndex: number }[]) => Promise<void>;
  onAIAction: (sectionId: string, action: string) => Promise<void>;
  onFocusChange: (sectionId: string | null) => void;
  onUnsavedChange: (hasChanges: boolean) => void;
}

// Section type icons
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cover_page: FileText,
  executive_summary: BarChart3,
  methodology: BookOpen,
  maturity_overview: Target,
  axis_detail: Layers,
  area_detail: Settings,
  gap_analysis: Target,
  initiatives: Briefcase,
  roadmap: Map,
  appendix: FileText,
  custom: FileText
};

// Axis icons
const AXIS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  processes: Cpu,
  digitalProducts: Package,
  businessModels: Briefcase,
  dataManagement: Database,
  culture: Users,
  cybersecurity: Shield,
  aiMaturity: Brain
};

// Available section types for adding
const SECTION_TYPES = [
  { type: 'cover_page', label: 'Cover Page', labelPl: 'Strona Tytułowa' },
  { type: 'executive_summary', label: 'Executive Summary', labelPl: 'Podsumowanie Wykonawcze' },
  { type: 'methodology', label: 'Methodology', labelPl: 'Metodologia' },
  { type: 'maturity_overview', label: 'Maturity Overview', labelPl: 'Przegląd Dojrzałości' },
  { type: 'axis_detail', label: 'Axis Detail', labelPl: 'Szczegóły Osi' },
  { type: 'gap_analysis', label: 'Gap Analysis', labelPl: 'Analiza Luk' },
  { type: 'initiatives', label: 'Initiatives', labelPl: 'Inicjatywy' },
  { type: 'roadmap', label: 'Roadmap', labelPl: 'Roadmapa' },
  { type: 'appendix', label: 'Appendix', labelPl: 'Załączniki' },
  { type: 'custom', label: 'Custom Section', labelPl: 'Sekcja Niestandardowa' }
];

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  report,
  readOnly = false,
  focusSectionId,
  onSectionUpdate,
  onSectionAdd,
  onSectionDelete,
  onSectionReorder,
  onAIAction,
  onFocusChange,
  onUnsavedChange
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State - defensive coding for sections
  const sections = report?.sections || [];
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Get section icon
  const getSectionIcon = (section: ReportSectionData) => {
    if (section.sectionType === 'axis_detail' && section.axisId) {
      return AXIS_ICONS[section.axisId] || Layers;
    }
    return SECTION_ICONS[section.sectionType] || FileText;
  };

  // Toggle section expanded state
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Expand all sections
  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  // Collapse all sections
  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Start editing section
  const startEditing = (sectionId: string) => {
    if (readOnly) return;
    setEditingSection(sectionId);
    onFocusChange(sectionId);
  };

  // Stop editing section
  const stopEditing = () => {
    setEditingSection(null);
  };

  // Handle content update
  const handleContentUpdate = async (sectionId: string, content: string, title?: string) => {
    await onSectionUpdate(sectionId, content, title);
    onUnsavedChange(false);
  };

  // Handle content change (mark unsaved)
  const handleContentChange = () => {
    onUnsavedChange(true);
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    if (readOnly) return;
    setDraggedSection(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (readOnly) return;
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (readOnly || !draggedSection) return;

    const sourceIndex = sections.findIndex(s => s.id === draggedSection);
    if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) {
      setDraggedSection(null);
      setDragOverIndex(null);
      return;
    }

    // Calculate new order
    const newSections = [...sections];
    const [removed] = newSections.splice(sourceIndex, 1);
    const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    newSections.splice(insertIndex, 0, removed);

    const newOrder = newSections.map((s, i) => ({ id: s.id, orderIndex: i }));
    await onSectionReorder(newOrder);

    setDraggedSection(null);
    setDragOverIndex(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedSection(null);
    setDragOverIndex(null);
  };

  // Handle add section
  const handleAddSection = async (type: string, afterIndex: number) => {
    await onSectionAdd(type, afterIndex);
    setShowAddMenu(null);
  };

  // Handle delete section
  const handleDeleteSection = async (sectionId: string) => {
    const confirmed = window.confirm(t('reports.confirmDelete', 'Are you sure you want to delete this section?'));
    if (!confirmed) return;
    await onSectionDelete(sectionId);
  };

  // Check if section has embeddable data
  const hasEmbeddableData = (section: ReportSectionData) => {
    return ['maturity_overview', 'axis_detail', 'gap_analysis'].includes(section.sectionType) && 
           section.dataSnapshot && Object.keys(section.dataSnapshot).length > 0;
  };

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto py-8 px-6">
      {/* Report Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{report.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {report.organizationName} • {report.assessmentName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              {t('reports.expandAll', 'Expand All')}
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              {t('reports.collapseAll', 'Collapse All')}
            </button>
          </div>
        </div>

        {/* Report info bar */}
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{sections.length} {t('reports.sections', 'sections')}</span>
          <span>•</span>
          <span>{t('reports.lastUpdated', 'Last updated')}: {new Date(report.updatedAt).toLocaleDateString()}</span>
          {readOnly && (
            <>
              <span>•</span>
              <span className="text-yellow-600 dark:text-yellow-400">
                {t('reports.readOnlyMode', 'Read-only mode')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const Icon = getSectionIcon(section);
          const isExpanded = expandedSections.has(section.id);
          const isEditing = editingSection === section.id;
          const isFocused = focusSectionId === section.id;
          const isDragging = draggedSection === section.id;
          const isDragOver = dragOverIndex === index;

          return (
            <div key={section.id} data-section-id={section.id}>
              {/* Drop zone indicator */}
              {isDragOver && !isDragging && (
                <div className="h-1 bg-blue-500 rounded-full mb-2 animate-pulse" />
              )}

              {/* Section card */}
              <div
                draggable={!readOnly && !isEditing}
                onDragStart={(e) => handleDragStart(e, section.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  bg-white dark:bg-navy-900 rounded-xl border transition-all
                  ${isFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-white/10'}
                  ${isDragging ? 'opacity-50 scale-98' : ''}
                  ${isEditing ? 'ring-2 ring-blue-500/20' : ''}
                `}
              >
                {/* Section header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                  onClick={() => !isEditing && toggleSection(section.id)}
                >
                  {/* Drag handle */}
                  {!readOnly && (
                    <div 
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${
                    section.sectionType === 'axis_detail' 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-navy-900 dark:text-white truncate">
                      {section.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {section.isAiGenerated ? t('reports.aiGenerated', 'AI Generated') : t('reports.manual', 'Manual')}
                      {' • v'}{section.version}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => onAIAction(section.id, 'improve')}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title={t('reports.aiImprove', 'AI Improve')}
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSection(section.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Section content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/5">
                    {/* Embedded matrix for data sections */}
                    {hasEmbeddableData(section) && (
                      <div className="mt-4 mb-4">
                        <EmbeddedMatrix
                          sectionType={section.sectionType}
                          axisId={section.axisId}
                          dataSnapshot={section.dataSnapshot}
                          axisData={report.axisData}
                        />
                      </div>
                    )}

                    {/* Content editor */}
                    <div className="mt-4">
                      <ReportSection
                        section={section}
                        isEditing={isEditing}
                        readOnly={readOnly}
                        onStartEdit={() => startEditing(section.id)}
                        onStopEdit={stopEditing}
                        onContentUpdate={(content, title) => handleContentUpdate(section.id, content, title)}
                        onContentChange={handleContentChange}
                        onAIAction={(action) => onAIAction(section.id, action)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Add section button between sections */}
              {!readOnly && (
                <div className="relative my-2">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => setShowAddMenu(showAddMenu === index ? null : index)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Add section dropdown */}
                  {showAddMenu === index && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-8 z-10 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-2 max-h-80 overflow-auto">
                      <p className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('reports.addSection', 'Add Section')}
                      </p>
                      {SECTION_TYPES.map(({ type, label, labelPl }) => {
                        const TypeIcon = SECTION_ICONS[type] || FileText;
                        return (
                          <button
                            key={type}
                            onClick={() => handleAddSection(type, index)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <TypeIcon className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-navy-900 dark:text-white">
                              {isPolish ? labelPl : label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Final drop zone */}
        {draggedSection && (
          <div
            onDragOver={(e) => handleDragOver(e, sections.length)}
            onDrop={(e) => handleDrop(e, sections.length)}
            className={`h-20 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors ${
              dragOverIndex === sections.length 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            <span className="text-sm text-slate-500">
              {t('reports.dropHere', 'Drop section here')}
            </span>
          </div>
        )}

        {/* Add section button at end */}
        {!readOnly && sections.length > 0 && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setShowAddMenu(showAddMenu === sections.length ? null : sections.length)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('reports.addSectionEnd', 'Add Section')}
            </button>
            
            {showAddMenu === sections.length && (
              <div className="absolute mt-10 z-10 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-2 max-h-80 overflow-auto">
                <p className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('reports.addSection', 'Add Section')}
                </p>
                {SECTION_TYPES.map(({ type, label, labelPl }) => {
                  const TypeIcon = SECTION_ICONS[type] || FileText;
                  return (
                    <button
                      key={type}
                      onClick={() => handleAddSection(type, sections.length - 1)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <TypeIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-navy-900 dark:text-white">
                        {isPolish ? labelPl : label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close add menu */}
      {showAddMenu !== null && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowAddMenu(null)}
        />
      )}
    </div>
  );
};

