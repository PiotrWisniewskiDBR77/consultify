/**
 * ArtifactEditor - Inline editing for artifacts
 * Provides syntax-aware editing with preview capability
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Artifact } from '../../../types';
import { ArtifactViewer } from './ArtifactViewer';

interface ArtifactEditorProps {
  artifact: Artifact;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const ArtifactEditor: React.FC<ArtifactEditorProps> = ({
  artifact,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(artifact.content);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHasChanges(content !== artifact.content);
  }, [content, artifact.content]);

  useEffect(() => {
    // Focus textarea and move cursor to end
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave(content);
  }, [content, onSave]);

  const handleReset = useCallback(() => {
    setContent(artifact.content);
  }, [artifact.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (hasChanges) {
        handleSave();
      }
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      onCancel();
    }
    // Tab handling for code
    if (e.key === 'Tab' && artifact.type === 'code') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
        setContent(newContent);
        // Reset cursor position after state update
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  }, [hasChanges, handleSave, onCancel, content, artifact.type]);

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors
              ${showPreview 
                ? 'bg-brand/10 text-brand' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
              }
            `}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? t('artifacts.hidePreview', 'Hide Preview') : t('artifacts.showPreview', 'Show Preview')}
          </button>
          
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700"
            >
              <RotateCcw size={14} />
              {t('artifacts.reset', 'Reset')}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('artifacts.shortcutSave', '⌘S to save, Esc to cancel')}
          </span>
          
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700"
          >
            <X size={14} />
            {t('common.cancel', 'Cancel')}
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${hasChanges 
                ? 'bg-brand text-white hover:bg-brand-dark' 
                : 'bg-slate-100 dark:bg-navy-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Save size={14} />
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className={`flex-1 ${showPreview ? 'grid grid-cols-2 gap-0' : ''}`}>
        {/* Textarea */}
        <div className={`${showPreview ? 'border-r border-slate-200 dark:border-navy-700' : 'h-full'}`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`
              w-full h-full p-4 
              bg-white dark:bg-navy-900 
              text-slate-800 dark:text-slate-200
              font-mono text-sm
              resize-none
              focus:outline-none
              ${artifact.type === 'code' ? 'leading-relaxed' : 'leading-normal'}
            `}
            placeholder={t('artifacts.startTyping', 'Start typing...')}
            spellCheck={artifact.type !== 'code'}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="overflow-auto bg-slate-50 dark:bg-navy-950">
            <ArtifactViewer 
              artifact={{ ...artifact, content }} 
              className="min-h-full"
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>{content.length} {t('artifacts.characters', 'characters')}</span>
          <span>{content.split('\n').length} {t('artifacts.lines', 'lines')}</span>
        </div>
        {hasChanges && (
          <span className="text-amber-600 dark:text-amber-400">
            {t('artifacts.unsavedChanges', 'Unsaved changes')}
          </span>
        )}
      </div>
    </div>
  );
};

export default ArtifactEditor;

