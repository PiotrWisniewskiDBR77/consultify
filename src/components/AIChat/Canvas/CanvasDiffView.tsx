/**
 * CanvasDiffView - Side-by-side diff view for AI edits
 * Shows original vs modified content with highlighting
 *
 * @version 1.0.0
 */

import { Check, Info, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CanvasDiffViewProps {
  originalContent: string;
  modifiedContent: string;
  explanation?: string;
  language: string;
  onAccept: () => void;
  onReject: () => void;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  lineNumber: number;
  originalContent?: string;
  modifiedContent?: string;
}

export const CanvasDiffView: React.FC<CanvasDiffViewProps> = ({
  originalContent,
  modifiedContent,
  explanation,
  language,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();

  // Compute diff
  const diff = useMemo(() => {
    const originalLines = originalContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');
    const result: DiffLine[] = [];

    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    // Simple line-by-line diff (in production, use a proper diff algorithm like Myers)
    let origIdx = 0;
    let modIdx = 0;
    let lineNum = 1;

    while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
      const origLine = originalLines[origIdx];
      const modLine = modifiedLines[modIdx];

      if (origIdx >= originalLines.length) {
        // Added lines at the end
        result.push({
          type: 'added',
          lineNumber: lineNum,
          modifiedContent: modLine,
        });
        modIdx++;
      } else if (modIdx >= modifiedLines.length) {
        // Removed lines at the end
        result.push({
          type: 'removed',
          lineNumber: lineNum,
          originalContent: origLine,
        });
        origIdx++;
      } else if (origLine === modLine) {
        // Unchanged line
        result.push({
          type: 'unchanged',
          lineNumber: lineNum,
          originalContent: origLine,
          modifiedContent: modLine,
        });
        origIdx++;
        modIdx++;
      } else {
        // Modified line
        result.push({
          type: 'modified',
          lineNumber: lineNum,
          originalContent: origLine,
          modifiedContent: modLine,
        });
        origIdx++;
        modIdx++;
      }
      lineNum++;
    }

    return result;
  }, [originalContent, modifiedContent]);

  // Calculate statistics
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    diff.forEach((line) => {
      if (line.type === 'added') additions++;
      else if (line.type === 'removed') deletions++;
      else if (line.type === 'modified') modifications++;
    });

    return { additions, deletions, modifications };
  }, [diff]);

  const getLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'modified':
        return 'bg-amber-50 dark:bg-amber-900/20';
      default:
        return '';
    }
  };

  const getLineNumberClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'text-green-600 dark:text-green-400';
      case 'removed':
        return 'text-red-600 dark:text-red-400';
      case 'modified':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-slate-400 dark:text-slate-500';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Explanation Banner */}
      {explanation && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">{explanation}</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-600 dark:text-green-400">
            +{stats.additions} {t('diff.added', 'added')}
          </span>
          <span className="text-red-600 dark:text-red-400">
            -{stats.deletions} {t('diff.removed', 'removed')}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            ~{stats.modifications} {t('diff.modified', 'modified')}
          </span>
        </div>

        {/* Accept/Reject Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <X size={14} />
            {t('diff.reject', 'Reject')}
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
          >
            <Check size={14} />
            {t('diff.accept', 'Accept Changes')}
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-navy-700 min-h-full">
          {/* Original Content */}
          <div className="bg-white dark:bg-navy-900">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700 sticky top-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('diff.original', 'Original')}
              </span>
            </div>
            <div className="font-mono text-sm">
              {diff.map((line, idx) => (
                <div
                  key={`orig-${idx}`}
                  className={`flex ${line.type === 'added' ? 'bg-slate-50 dark:bg-navy-800/50' : getLineClass(line.type === 'modified' ? 'removed' : line.type)}`}
                >
                  <div
                    className={`w-10 shrink-0 px-2 py-0.5 text-right select-none ${getLineNumberClass(line.type === 'modified' ? 'removed' : line.type)}`}
                  >
                    {line.type !== 'added' ? line.lineNumber : ''}
                  </div>
                  <div className="flex-1 px-2 py-0.5 whitespace-pre text-slate-700 dark:text-slate-300">
                    {line.type === 'added' ? '' : line.originalContent}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modified Content */}
          <div className="bg-white dark:bg-navy-900">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700 sticky top-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('diff.modified', 'Modified')}
              </span>
            </div>
            <div className="font-mono text-sm">
              {diff.map((line, idx) => (
                <div
                  key={`mod-${idx}`}
                  className={`flex ${line.type === 'removed' ? 'bg-slate-50 dark:bg-navy-800/50' : getLineClass(line.type === 'modified' ? 'added' : line.type)}`}
                >
                  <div
                    className={`w-10 shrink-0 px-2 py-0.5 text-right select-none ${getLineNumberClass(line.type === 'modified' ? 'added' : line.type)}`}
                  >
                    {line.type !== 'removed' ? line.lineNumber : ''}
                  </div>
                  <div className="flex-1 px-2 py-0.5 whitespace-pre text-slate-700 dark:text-slate-300">
                    {line.type === 'removed' ? '' : line.modifiedContent}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasDiffView;
