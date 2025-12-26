import React, { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Link,
  Table,
  Undo,
  Redo,
  Minus
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Toolbar button component
const ToolbarButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  title: string;
}> = ({ icon: Icon, onClick, active, title }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-1.5 rounded transition-colors ${
      active 
        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' 
        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
    }`}
    title={title}
  >
    <Icon className="w-4 h-4" />
  </button>
);

// Divider component
const ToolbarDivider: React.FC = () => (
  <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Enter content...',
  minHeight = '300px'
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, parseInt(minHeight))}px`;
    }
  }, [content, minHeight]);

  // Handle content change with history
  const handleChange = useCallback((newContent: string) => {
    historyRef.current.past.push(content);
    historyRef.current.future = [];
    onChange(newContent);
  }, [content, onChange]);

  // Undo
  const handleUndo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    
    const previous = past.pop()!;
    future.push(content);
    onChange(previous);
  }, [content, onChange]);

  // Redo
  const handleRedo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    
    const next = future.pop()!;
    past.push(content);
    onChange(next);
  }, [content, onChange]);

  // Get current selection
  const getSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: 0, end: 0, text: '' };
    
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    };
  }, []);

  // Set selection
  const setSelection = useCallback((start: number, end: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.focus();
    textarea.setSelectionRange(start, end);
  }, []);

  // Wrap selected text with markdown
  const wrapSelection = useCallback((before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const { start, end, text } = getSelection();
    const newText = `${content.slice(0, start)}${before}${text}${after}${content.slice(end)}`;
    handleChange(newText);
    
    // Set cursor position after the change
    setTimeout(() => {
      setSelection(start + before.length, end + before.length);
    }, 0);
  }, [content, getSelection, handleChange, setSelection]);

  // Insert text at cursor
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const { start, end } = getSelection();
    const newContent = `${content.slice(0, start)}${text}${content.slice(end)}`;
    handleChange(newContent);
    
    setTimeout(() => {
      setSelection(start + text.length, start + text.length);
    }, 0);
  }, [content, getSelection, handleChange, setSelection]);

  // Prepend line with prefix (for headings, lists)
  const prependLine = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const { start } = getSelection();
    
    // Find the start of the current line
    let lineStart = start;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Check if line already has this prefix
    const lineContent = content.slice(lineStart);
    const existingPrefix = lineContent.match(/^(#{1,3}\s|>\s|\d+\.\s|-\s)/)?.[0];
    
    if (existingPrefix) {
      // Remove existing prefix
      const newContent = `${content.slice(0, lineStart)}${content.slice(lineStart + existingPrefix.length)}`;
      if (existingPrefix === prefix) {
        handleChange(newContent);
        return;
      }
      handleChange(`${content.slice(0, lineStart)}${prefix}${newContent.slice(lineStart)}`);
    } else {
      const newContent = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`;
      handleChange(newContent);
    }
  }, [content, getSelection, handleChange]);

  // Toolbar actions
  const actions = {
    bold: () => wrapSelection('**'),
    italic: () => wrapSelection('*'),
    h1: () => prependLine('# '),
    h2: () => prependLine('## '),
    h3: () => prependLine('### '),
    quote: () => prependLine('> '),
    bulletList: () => prependLine('- '),
    numberedList: () => prependLine('1. '),
    code: () => wrapSelection('`'),
    codeBlock: () => wrapSelection('```\n', '\n```'),
    link: () => {
      const { text } = getSelection();
      if (text) {
        wrapSelection('[', '](url)');
      } else {
        insertAtCursor('[link text](url)');
      }
    },
    hr: () => insertAtCursor('\n---\n'),
    table: () => insertAtCursor('\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n'),
    undo: handleUndo,
    redo: handleRedo
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey;
    
    if (isMod && e.key === 'b') {
      e.preventDefault();
      actions.bold();
    } else if (isMod && e.key === 'i') {
      e.preventDefault();
      actions.italic();
    } else if (isMod && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        actions.redo();
      } else {
        actions.undo();
      }
    } else if (isMod && e.key === 'y') {
      e.preventDefault();
      actions.redo();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      insertAtCursor('  ');
    }
  }, [actions, insertAtCursor]);

  return (
    <div className="border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-navy-900/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-white/10">
        {/* History */}
        <ToolbarButton icon={Undo} onClick={actions.undo} title={t('editor.undo', 'Undo (Ctrl+Z)')} />
        <ToolbarButton icon={Redo} onClick={actions.redo} title={t('editor.redo', 'Redo (Ctrl+Y)')} />
        
        <ToolbarDivider />
        
        {/* Text formatting */}
        <ToolbarButton icon={Bold} onClick={actions.bold} title={t('editor.bold', 'Bold (Ctrl+B)')} />
        <ToolbarButton icon={Italic} onClick={actions.italic} title={t('editor.italic', 'Italic (Ctrl+I)')} />
        
        <ToolbarDivider />
        
        {/* Headings */}
        <ToolbarButton icon={Heading1} onClick={actions.h1} title={t('editor.h1', 'Heading 1')} />
        <ToolbarButton icon={Heading2} onClick={actions.h2} title={t('editor.h2', 'Heading 2')} />
        <ToolbarButton icon={Heading3} onClick={actions.h3} title={t('editor.h3', 'Heading 3')} />
        
        <ToolbarDivider />
        
        {/* Lists */}
        <ToolbarButton icon={List} onClick={actions.bulletList} title={t('editor.bulletList', 'Bullet List')} />
        <ToolbarButton icon={ListOrdered} onClick={actions.numberedList} title={t('editor.numberedList', 'Numbered List')} />
        <ToolbarButton icon={Quote} onClick={actions.quote} title={t('editor.quote', 'Quote')} />
        
        <ToolbarDivider />
        
        {/* Code & Links */}
        <ToolbarButton icon={Code} onClick={actions.code} title={t('editor.code', 'Inline Code')} />
        <ToolbarButton icon={Link} onClick={actions.link} title={t('editor.link', 'Link')} />
        
        <ToolbarDivider />
        
        {/* Extras */}
        <ToolbarButton icon={Table} onClick={actions.table} title={t('editor.table', 'Insert Table')} />
        <ToolbarButton icon={Minus} onClick={actions.hr} title={t('editor.hr', 'Horizontal Rule')} />
      </div>

      {/* Editor area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-4 bg-transparent text-navy-900 dark:text-white font-mono text-sm leading-relaxed resize-none focus:outline-none"
          style={{ minHeight }}
        />

        {/* Help text */}
        <div className="absolute bottom-2 right-3 text-xs text-slate-400 pointer-events-none">
          Markdown
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-white/10 text-xs text-slate-400">
        <span>
          {content.length} {t('editor.characters', 'characters')} • {content.split(/\s+/).filter(Boolean).length} {t('editor.words', 'words')}
        </span>
        <span className="hidden sm:block">
          {t('editor.shortcuts', 'Ctrl+B Bold • Ctrl+I Italic • Tab to indent')}
        </span>
      </div>
    </div>
  );
};

