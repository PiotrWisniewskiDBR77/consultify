/**
 * DiffView Component
 *
 * Displays side-by-side or inline diff between original and suggested content.
 * Highlights additions, deletions, and modifications.
 */

import { ArrowRight, Equal, Minus, Plus } from 'lucide-react';
import React, { useMemo } from 'react';

interface DiffViewProps {
    original: string | object;
    suggested: string | object;
    mode?: 'inline' | 'side-by-side';
    showLineNumbers?: boolean;
    className?: string;
}

interface DiffLine {
    type: 'added' | 'removed' | 'unchanged' | 'modified';
    originalLine?: string;
    suggestedLine?: string;
    lineNumber?: number;
}

function computeDiff(original: string, suggested: string): DiffLine[] {
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const diff: DiffLine[] = [];

    // Simple line-by-line comparison (for basic use case)
    // For production, consider using a proper diff library
    const maxLines = Math.max(originalLines.length, suggestedLines.length);

    for (let i = 0; i < maxLines; i++) {
        const origLine = originalLines[i];
        const suggLine = suggestedLines[i];

        if (origLine === undefined) {
            diff.push({
                type: 'added',
                suggestedLine: suggLine,
                lineNumber: i + 1,
            });
        } else if (suggLine === undefined) {
            diff.push({
                type: 'removed',
                originalLine: origLine,
                lineNumber: i + 1,
            });
        } else if (origLine === suggLine) {
            diff.push({
                type: 'unchanged',
                originalLine: origLine,
                suggestedLine: suggLine,
                lineNumber: i + 1,
            });
        } else {
            diff.push({
                type: 'modified',
                originalLine: origLine,
                suggestedLine: suggLine,
                lineNumber: i + 1,
            });
        }
    }

    return diff;
}

export function DiffView({
    original,
    suggested,
    mode = 'side-by-side',
    showLineNumbers = true,
    className = '',
}: DiffViewProps) {
    const originalStr = useMemo(
        () => (typeof original === 'string' ? original : JSON.stringify(original, null, 2)),
        [original],
    );

    const suggestedStr = useMemo(
        () => (typeof suggested === 'string' ? suggested : JSON.stringify(suggested, null, 2)),
        [suggested],
    );

    const diff = useMemo(() => computeDiff(originalStr, suggestedStr), [originalStr, suggestedStr]);

    const stats = useMemo(() => {
        const added = diff.filter((d) => d.type === 'added').length;
        const removed = diff.filter((d) => d.type === 'removed').length;
        const modified = diff.filter((d) => d.type === 'modified').length;
        return { added, removed, modified };
    }, [diff]);

    const renderInlineDiff = () => (
        <div className="font-mono text-sm">
            {diff.map((line, idx) => (
                <div
                    key={idx}
                    className={`flex items-start px-2 py-0.5 ${
                        line.type === 'added'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : line.type === 'removed'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : line.type === 'modified'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                : ''
                    }`}
                >
                    {showLineNumbers && (
                        <span className="w-8 text-gray-400 text-xs flex-shrink-0">{line.lineNumber}</span>
                    )}
                    <span className="w-6 flex-shrink-0">
                        {line.type === 'added' && <Plus className="w-4 h-4 text-green-600" />}
                        {line.type === 'removed' && <Minus className="w-4 h-4 text-red-600" />}
                        {line.type === 'modified' && <ArrowRight className="w-4 h-4 text-yellow-600" />}
                    </span>
                    <div className="flex-1 min-w-0">
                        {line.type === 'modified' ? (
                            <>
                                <div className="line-through text-red-600">{line.originalLine}</div>
                                <div className="text-green-600">{line.suggestedLine}</div>
                            </>
                        ) : line.type === 'removed' ? (
                            <span className="text-red-600 line-through">{line.originalLine}</span>
                        ) : line.type === 'added' ? (
                            <span className="text-green-600">{line.suggestedLine}</span>
                        ) : (
                            <span className="text-gray-700 dark:text-gray-300">{line.originalLine}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSideBySideDiff = () => (
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {/* Original Column */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-900/30 px-3 py-2 border-b text-sm font-medium text-red-700 dark:text-red-300">
                    Oryginał
                </div>
                <div className="max-h-96 overflow-auto">
                    {diff.map((line, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start px-2 py-0.5 ${
                                line.type === 'removed' || line.type === 'modified'
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : ''
                            }`}
                        >
                            {showLineNumbers && (
                                <span className="w-8 text-gray-400 text-xs flex-shrink-0">
                                    {line.originalLine !== undefined ? line.lineNumber : ''}
                                </span>
                            )}
                            <span
                                className={`flex-1 ${
                                    line.type === 'removed'
                                        ? 'text-red-600 line-through'
                                        : line.type === 'modified'
                                          ? 'text-red-600'
                                          : 'text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {line.originalLine || '\u00A0'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Suggested Column */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 dark:bg-green-900/30 px-3 py-2 border-b text-sm font-medium text-green-700 dark:text-green-300">
                    Sugestia AI
                </div>
                <div className="max-h-96 overflow-auto">
                    {diff.map((line, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start px-2 py-0.5 ${
                                line.type === 'added' || line.type === 'modified'
                                    ? 'bg-green-50 dark:bg-green-900/20'
                                    : ''
                            }`}
                        >
                            {showLineNumbers && (
                                <span className="w-8 text-gray-400 text-xs flex-shrink-0">
                                    {line.suggestedLine !== undefined ? line.lineNumber : ''}
                                </span>
                            )}
                            <span
                                className={`flex-1 ${
                                    line.type === 'added'
                                        ? 'text-green-600'
                                        : line.type === 'modified'
                                          ? 'text-green-600'
                                          : 'text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {line.suggestedLine || '\u00A0'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Stats Bar */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                    <Plus className="w-4 h-4" />
                    <span>{stats.added} dodane</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                    <Minus className="w-4 h-4" />
                    <span>{stats.removed} usunięte</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-600">
                    <ArrowRight className="w-4 h-4" />
                    <span>{stats.modified} zmodyfikowane</span>
                </div>
            </div>

            {/* Diff Content */}
            <div className="border rounded-lg overflow-hidden">
                {mode === 'inline' ? renderInlineDiff() : renderSideBySideDiff()}
            </div>
        </div>
    );
}

export default DiffView;

