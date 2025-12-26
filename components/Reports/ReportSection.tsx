import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Edit3,
  Save,
  X,
  Wand2,
  Expand,
  Minimize2,
  RotateCcw,
  Languages,
  Scissors,
  Sparkles,
  Check,
  Copy,
  MoreVertical,
  History
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import './EnterpriseReportStyles.css';

// Convert content to HTML - handles both raw HTML and Markdown
function contentToHtml(content: string): string {
  if (!content) return '';
  
  const trimmed = content.trim();
  
  // If content starts with HTML tag, it's already HTML - return as is
  if (trimmed.startsWith('<') && (
    trimmed.startsWith('<div') || 
    trimmed.startsWith('<h1') || 
    trimmed.startsWith('<h2') || 
    trimmed.startsWith('<h3') ||
    trimmed.startsWith('<p') ||
    trimmed.startsWith('<table') ||
    trimmed.startsWith('<ul') ||
    trimmed.startsWith('<ol') ||
    trimmed.startsWith('<section') ||
    trimmed.startsWith('<article') ||
    trimmed.startsWith('<!') // doctype or comment
  )) {
    return content;
  }
  
  // Otherwise, treat as Markdown and convert to HTML
  let html = content
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Line breaks (convert double newline to paragraph)
    .replace(/\n\n/g, '</p><p>')
    // Single line breaks
    .replace(/\n/g, '<br />');

  // Handle tables (simple version)
  const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').filter((h: string) => h.trim()).map((h: string) => `<th>${h.trim()}</th>`).join('');
    const rows = bodyRows.split('\n').filter((r: string) => r.trim()).map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Handle bullet lists
  const bulletListRegex = /^[-*] (.+)$/gm;
  html = html.replace(bulletListRegex, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Handle numbered lists
  const numberedListRegex = /^\d+\. (.+)$/gm;
  html = html.replace(numberedListRegex, '<li>$1</li>');

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

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

interface ReportSectionProps {
  section: ReportSectionData;
  isEditing: boolean;
  readOnly: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onContentUpdate: (content: string, title?: string) => Promise<void>;
  onContentChange: () => void;
  onAIAction: (action: string) => Promise<void>;
}

// AI Actions available
const AI_ACTIONS = [
  { action: 'expand', icon: Expand, label: 'Expand', labelPl: 'Rozwiń' },
  { action: 'summarize', icon: Scissors, label: 'Summarize', labelPl: 'Skróć' },
  { action: 'improve', icon: Sparkles, label: 'Improve', labelPl: 'Ulepsz' },
  { action: 'translate', icon: Languages, label: 'Translate', labelPl: 'Przetłumacz' },
  { action: 'regenerate', icon: RotateCcw, label: 'Regenerate', labelPl: 'Regeneruj' }
];

export const ReportSection: React.FC<ReportSectionProps> = ({
  section,
  isEditing,
  readOnly,
  onStartEdit,
  onStopEdit,
  onContentUpdate,
  onContentChange,
  onAIAction
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [editedContent, setEditedContent] = useState(section.content);
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [panelMode, setPanelMode] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  // Sync content when section changes
  useEffect(() => {
    setEditedContent(section.content);
    setEditedTitle(section.title);
  }, [section.content, section.title]);

  // Handle content change
  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
    onContentChange();
  }, [onContentChange]);

  // Handle title change
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
    onContentChange();
  }, [onContentChange]);

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onContentUpdate(editedContent, editedTitle !== section.title ? editedTitle : undefined);
      onStopEdit();
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditedContent(section.content);
    setEditedTitle(section.title);
    onStopEdit();
  };

  // Handle AI action
  const handleAIAction = async (action: string) => {
    setIsAIProcessing(true);
    setShowAIMenu(false);
    try {
      await onAIAction(action);
    } finally {
      setIsAIProcessing(false);
    }
  };

  // Copy content
  const handleCopy = async () => {
    await navigator.clipboard.writeText(section.content);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Close AI menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setShowAIMenu(false);
      }
    };

    if (showAIMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAIMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Escape to cancel
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editedContent, editedTitle]);

  // View mode
  if (!isEditing) {
    return (
      <div className="relative group">
        {/* Actions toolbar */}
        <div className="absolute top-0 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!readOnly && (
            <>
              <button
                onClick={onStartEdit}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                title={t('common.edit', 'Edit')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <div className="relative" ref={aiMenuRef}>
                <button
                  onClick={() => setShowAIMenu(!showAIMenu)}
                  disabled={isAIProcessing}
                  className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
                  title={t('reports.aiActions', 'AI Actions')}
                >
                  {isAIProcessing ? (
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                </button>
                
                {/* AI actions menu */}
                {showAIMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 py-1 z-20">
                    {AI_ACTIONS.map(({ action, icon: Icon, label, labelPl }) => (
                      <button
                        key={action}
                        onClick={() => handleAIAction(action)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="text-navy-900 dark:text-white">
                          {isPolish ? labelPl : label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title={t('common.copy', 'Copy')}
          >
            {showCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Rendered content */}
        <div 
          className="enterprise-report prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-table:text-sm prose-p:my-3 prose-li:my-1"
          onClick={!readOnly ? onStartEdit : undefined}
          dangerouslySetInnerHTML={{ 
            __html: contentToHtml(section.content || (isPolish ? '*Brak treści*' : '*No content*')) 
          }}
        />

        {/* Section metadata */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span>
            {section.isAiGenerated ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('reports.aiGenerated', 'AI Generated')}
              </span>
            ) : (
              t('reports.manuallyEdited', 'Manually edited')
            )}
          </span>
          <span>
            v{section.version} • {new Date(section.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div ref={editorRef} className={`${panelMode ? 'fixed inset-4 z-50 bg-white dark:bg-navy-900 rounded-xl shadow-2xl flex flex-col' : ''}`}>
      {/* Edit header */}
      <div className={`flex items-center justify-between gap-4 ${panelMode ? 'p-4 border-b border-slate-200 dark:border-white/10' : 'mb-4'}`}>
        {/* Title input */}
        <input
          type="text"
          value={editedTitle}
          onChange={handleTitleChange}
          className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none text-navy-900 dark:text-white"
          placeholder={t('reports.sectionTitle', 'Section title')}
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanelMode(!panelMode)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title={panelMode ? t('common.minimize', 'Minimize') : t('common.maximize', 'Maximize')}
          >
            {panelMode ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>
          
          <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
          
          <button
            onClick={handleCancel}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            title={t('common.cancel', 'Cancel')}
          >
            <X className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className={`${panelMode ? 'flex-1 overflow-auto p-4' : ''}`}>
        <RichTextEditor
          content={editedContent}
          onChange={handleContentChange}
          placeholder={t('reports.enterContent', 'Enter section content...')}
        />
      </div>

      {/* Quick AI actions */}
      <div className={`flex items-center gap-2 ${panelMode ? 'p-4 border-t border-slate-200 dark:border-white/10' : 'mt-4'}`}>
        <span className="text-xs text-slate-400 mr-2">{t('reports.quickAI', 'Quick AI:')}</span>
        {AI_ACTIONS.slice(0, 3).map(({ action, icon: Icon, label, labelPl }) => (
          <button
            key={action}
            onClick={() => handleAIAction(action)}
            disabled={isAIProcessing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <Icon className="w-3 h-3" />
            {isPolish ? labelPl : label}
          </button>
        ))}
      </div>

      {/* Panel mode backdrop */}
      {panelMode && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={handleCancel}
        />
      )}
    </div>
  );
};

