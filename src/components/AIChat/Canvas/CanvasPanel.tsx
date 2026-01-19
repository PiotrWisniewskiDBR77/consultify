/**
 * CanvasPanel - Split view for AI-assisted artifact editing
 * Combines chat interface with Monaco editor for code/documents
 *
 * @version 1.0.0
 */

import { ArrowLeft, Code2, FileText, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact } from '../../../types';
import { CanvasDiffView } from './CanvasDiffView';
import { CanvasEditor } from './CanvasEditor';
import { CanvasToolbar } from './CanvasToolbar';

interface CanvasPanelProps {
  artifact: Artifact;
  onClose: () => void;
  onSave: (content: string) => void;
  onAIEdit: (instruction: string) => Promise<{ content: string; explanation?: string }>;
}

type ViewMode = 'edit' | 'diff' | 'preview';

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  artifact,
  onClose,
  onSave,
  onAIEdit,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(artifact.content);
  const [originalContent] = useState(artifact.content);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ content: string; explanation?: string } | null>(
    null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editHistory, setEditHistory] = useState<string[]>([artifact.content]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(content !== artifact.content);
  }, [content, artifact.content]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (!e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else {
          e.preventDefault();
          handleRedo();
        }
      }

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isFullscreen, historyIndex, editHistory]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    // Add to history (debounced in real implementation)
    setEditHistory((prev) => [...prev.slice(0, historyIndex + 1), newContent]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleSave = useCallback(() => {
    onSave(content);
    setHasUnsavedChanges(false);
  }, [content, onSave]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setContent(editHistory[historyIndex - 1]);
    }
  }, [historyIndex, editHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setContent(editHistory[historyIndex + 1]);
    }
  }, [historyIndex, editHistory]);

  const handleAIEditRequest = useCallback(
    async (instruction: string) => {
      setIsProcessing(true);
      try {
        const result = await onAIEdit(instruction);
        setPendingEdit(result);
        setViewMode('diff');
      } catch (error) {
        console.error('AI edit failed:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [onAIEdit]
  );

  const handleAcceptEdit = useCallback(() => {
    if (pendingEdit) {
      handleContentChange(pendingEdit.content);
      setPendingEdit(null);
      setViewMode('edit');
    }
  }, [pendingEdit, handleContentChange]);

  const handleRejectEdit = useCallback(() => {
    setPendingEdit(null);
    setViewMode('edit');
  }, []);

  const getLanguage = (): string => {
    if (artifact.type === 'code' && artifact.language) {
      return artifact.language;
    }
    if (artifact.type === 'markdown') {
      return 'markdown';
    }
    return 'plaintext';
  };

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-white dark:bg-navy-900'
    : 'flex-1 flex flex-col h-full';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            title={t('common.close', 'Close')}
          >
            <ArrowLeft size={18} className="text-slate-500" />
          </button>

          <div className="flex items-center gap-2">
            {artifact.type === 'code' ? (
              <Code2 size={16} className="text-primary-500" />
            ) : (
              <FileText size={16} className="text-primary-500" />
            )}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {artifact.title || t('canvas.untitled', 'Untitled')}
            </span>
            {hasUnsavedChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'bg-primary-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
              }`}
            >
              {t('canvas.edit', 'Edit')}
            </button>
            <button
              onClick={() => setViewMode('diff')}
              disabled={!pendingEdit}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'diff'
                  ? 'bg-primary-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-50'
              }`}
            >
              {t('canvas.diff', 'Diff')}
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-primary-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
              }`}
            >
              {t('canvas.preview', 'Preview')}
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 size={16} className="text-slate-500" />
            ) : (
              <Maximize2 size={16} className="text-slate-500" />
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <CanvasToolbar
        type={artifact.type}
        language={getLanguage()}
        onAIEdit={handleAIEditRequest}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < editHistory.length - 1}
        hasChanges={hasUnsavedChanges}
        isProcessing={isProcessing}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 dark:bg-navy-900/80 z-10 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('canvas.processingEdit', 'AI is editing...')}
              </p>
            </div>
          </div>
        )}

        {viewMode === 'edit' && (
          <CanvasEditor
            content={content}
            onChange={handleContentChange}
            language={getLanguage()}
            type={artifact.type}
          />
        )}

        {viewMode === 'diff' && pendingEdit && (
          <CanvasDiffView
            originalContent={content}
            modifiedContent={pendingEdit.content}
            explanation={pendingEdit.explanation}
            language={getLanguage()}
            onAccept={handleAcceptEdit}
            onReject={handleRejectEdit}
          />
        )}

        {viewMode === 'preview' && (
          <div className="h-full overflow-auto p-4 bg-white dark:bg-navy-900">
            {artifact.type === 'markdown' ? (
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <pre className="font-mono text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {content}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span>{getLanguage()}</span>
          <span>
            {content.split('\n').length} {t('canvas.lines', 'lines')}
          </span>
          <span>
            {content.length} {t('canvas.chars', 'chars')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>{t('canvas.shortcuts', '⌘S save, ⌘Z undo')}</span>
        </div>
      </div>
    </div>
  );
};

export default CanvasPanel;
