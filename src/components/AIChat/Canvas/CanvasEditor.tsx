/**
 * CanvasEditor - Monaco-based code/text editor
 * Provides syntax highlighting and intelligent editing
 *
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CanvasEditorProps {
  content: string;
  onChange: (content: string) => void;
  language: string;
  type: string;
  readOnly?: boolean;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  content,
  onChange,
  language,
  type,
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);

  // Update line numbers when content changes
  useEffect(() => {
    const lines = content.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, [content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = editorRef.current;
      if (!textarea) return;

      // Handle Tab key
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.shiftKey) {
          // Outdent
          const lines = content.split('\n');
          let charCount = 0;
          const newLines = lines.map((line, idx) => {
            const lineStart = charCount;
            charCount += line.length + 1;

            // Check if line is within selection
            if (lineStart <= end && charCount > start) {
              if (line.startsWith('  ')) {
                return line.substring(2);
              } else if (line.startsWith('\t')) {
                return line.substring(1);
              }
            }
            return line;
          });
          onChange(newLines.join('\n'));
        } else {
          // Indent
          const newContent = content.substring(0, start) + '  ' + content.substring(end);
          onChange(newContent);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }, 0);
        }
      }

      // Handle Enter key - auto-indent
      if (e.key === 'Enter') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const currentLine = content.substring(0, start).split('\n').pop() || '';
        const indent = currentLine.match(/^(\s*)/)?.[1] || '';

        // Extra indent if line ends with { or :
        let extraIndent = '';
        if (currentLine.trimEnd().endsWith('{') || currentLine.trimEnd().endsWith(':')) {
          extraIndent = '  ';
        }

        const newContent = content.substring(0, start) + '\n' + indent + extraIndent + content.substring(textarea.selectionEnd);
        onChange(newContent);
        setTimeout(() => {
          const newPos = start + 1 + indent.length + extraIndent.length;
          textarea.selectionStart = textarea.selectionEnd = newPos;
        }, 0);
      }

      // Handle bracket auto-close
      const brackets: Record<string, string> = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'",
        '`': '`',
      };

      if (brackets[e.key]) {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);

        const newContent =
          content.substring(0, start) +
          e.key +
          selectedText +
          brackets[e.key] +
          content.substring(end);
        onChange(newContent);

        setTimeout(() => {
          if (selectedText) {
            textarea.selectionStart = start + 1;
            textarea.selectionEnd = start + 1 + selectedText.length;
          } else {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          }
        }, 0);
      }
    },
    [content, onChange]
  );

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const lineNumbersEl = document.getElementById('line-numbers');
    if (lineNumbersEl) {
      lineNumbersEl.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  // Get syntax highlighting class based on language
  const getHighlightClass = () => {
    const langMap: Record<string, string> = {
      javascript: 'language-javascript',
      typescript: 'language-typescript',
      python: 'language-python',
      html: 'language-html',
      css: 'language-css',
      json: 'language-json',
      markdown: 'language-markdown',
    };
    return langMap[language] || 'language-plaintext';
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-navy-950">
      {/* Line Numbers */}
      <div
        id="line-numbers"
        className="select-none overflow-hidden py-2 px-2 text-right bg-slate-100 dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 font-mono text-xs text-slate-400 dark:text-slate-500"
        style={{ minWidth: '3rem' }}
      >
        {lineNumbers.map((num) => (
          <div key={num} className="leading-6">
            {num}
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck={type !== 'code'}
          className={`
            w-full h-full resize-none
            py-2 px-4
            bg-transparent
            text-slate-800 dark:text-slate-200
            font-mono text-sm leading-6
            focus:outline-none
            ${getHighlightClass()}
          `}
          placeholder={
            type === 'code'
              ? '// Start coding...'
              : 'Start writing...'
          }
        />
      </div>
    </div>
  );
};

export default CanvasEditor;
