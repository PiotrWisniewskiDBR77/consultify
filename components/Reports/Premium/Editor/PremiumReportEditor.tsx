/**
 * PremiumReportEditor
 * 
 * McKinsey/BCG-grade WYSIWYG editor for DRD Assessment Reports.
 * Built on TipTap with custom blocks for charts, matrices, and recommendations.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';

import { EditorToolbar } from './Toolbar/EditorToolbar';
import { BlockInsertMenu } from './Toolbar/BlockInsertMenu';
import { AIAssistantPanel } from './Toolbar/AIAssistantPanel';

// Custom Extensions
import { MaturityRadarExtension } from './Extensions/MaturityRadar';
import { GapHeatmapExtension } from './Extensions/GapHeatmap';
import { RecommendationCardExtension } from './Extensions/RecommendationCard';
import { ExecutiveSummaryExtension } from './Extensions/ExecutiveSummary';
import { MetricCardExtension } from './Extensions/MetricCard';
import { CalloutExtension } from './Extensions/Callout';

import './PremiumEditor.css';

export interface PremiumReportEditorProps {
    initialContent?: JSONContent;
    reportId?: string;
    assessmentId?: string;
    readOnly?: boolean;
    onContentChange?: (content: JSONContent) => void;
    onSave?: (content: JSONContent) => Promise<void>;
    className?: string;
}

export const PremiumReportEditor: React.FC<PremiumReportEditorProps> = ({
    initialContent,
    reportId,
    assessmentId,
    readOnly = false,
    onContentChange,
    onSave,
    className = ''
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [showBlockMenu, setShowBlockMenu] = useState(false);
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4]
                }
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'premium-table'
                }
            }),
            TableRow,
            TableCell,
            TableHeader,
            Placeholder.configure({
                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') {
                        return 'Tytuł sekcji...';
                    }
                    return 'Zacznij pisać lub wpisz "/" aby wstawić blok...';
                }
            }),
            Highlight.configure({
                multicolor: true
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph']
            }),
            Underline,
            TextStyle,
            Color,
            // Custom extensions
            MaturityRadarExtension,
            GapHeatmapExtension,
            RecommendationCardExtension,
            ExecutiveSummaryExtension,
            MetricCardExtension,
            CalloutExtension
        ],
        content: initialContent || getDefaultReportStructure(),
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            onContentChange?.(json);
        },
        editorProps: {
            attributes: {
                class: 'premium-editor-content prose prose-slate dark:prose-invert max-w-none focus:outline-none'
            },
            handleKeyDown: (view, event) => {
                // Slash command trigger
                if (event.key === '/' && !readOnly) {
                    const { from } = view.state.selection;
                    const coords = view.coordsAtPos(from);
                    setBlockMenuPosition({ x: coords.left, y: coords.bottom + 8 });
                    setShowBlockMenu(true);
                    return false;
                }
                return false;
            }
        }
    });

    // Auto-save
    const handleSave = useCallback(async () => {
        if (!editor || !onSave) return;

        setIsSaving(true);
        try {
            await onSave(editor.getJSON());
        } finally {
            setIsSaving(false);
        }
    }, [editor, onSave]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [handleSave]);

    // Insert block handler
    const handleInsertBlock = useCallback((blockType: string, data?: Record<string, unknown>) => {
        if (!editor) return;

        switch (blockType) {
            case 'maturityRadar':
                editor.chain().focus().insertContent({
                    type: 'maturityRadar',
                    attrs: { assessmentId, ...data }
                }).run();
                break;
            case 'gapHeatmap':
                editor.chain().focus().insertContent({
                    type: 'gapHeatmap',
                    attrs: { assessmentId, ...data }
                }).run();
                break;
            case 'recommendationCard':
                editor.chain().focus().insertContent({
                    type: 'recommendationCard',
                    attrs: data
                }).run();
                break;
            case 'executiveSummary':
                editor.chain().focus().insertContent({
                    type: 'executiveSummary',
                    attrs: { assessmentId, ...data }
                }).run();
                break;
            case 'metricCard':
                editor.chain().focus().insertContent({
                    type: 'metricCard',
                    attrs: data
                }).run();
                break;
            case 'callout':
                editor.chain().focus().insertContent({
                    type: 'callout',
                    attrs: { type: 'info', ...data },
                    content: [{ type: 'paragraph' }]
                }).run();
                break;
            case 'table':
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                break;
            default:
                break;
        }

        setShowBlockMenu(false);
    }, [editor, assessmentId]);

    // AI content generation
    const handleAIGenerate = useCallback(async (prompt: string, targetSection?: string) => {
        if (!editor || !assessmentId) return;

        try {
            const response = await fetch('/api/ai/report/generate-section', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    assessmentId,
                    sectionType: targetSection,
                    customPrompt: prompt
                })
            });

            if (response.ok) {
                const data = await response.json();
                editor.chain().focus().insertContent(data.content).run();
            }
        } catch (error) {
            console.error('AI generation failed:', error);
        }
    }, [editor, assessmentId]);

    if (!editor) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className={`premium-report-editor ${className}`}>
            {/* Toolbar */}
            {!readOnly && (
                <EditorToolbar
                    editor={editor}
                    isSaving={isSaving}
                    onSave={handleSave}
                    onAIClick={() => setShowAIPanel(!showAIPanel)}
                />
            )}

            {/* Editor Content */}
            <div className="premium-editor-wrapper">
                <EditorContent editor={editor} />
            </div>

            {/* Block Insert Menu (Slash Command) */}
            {showBlockMenu && (
                <BlockInsertMenu
                    position={blockMenuPosition}
                    onSelect={handleInsertBlock}
                    onClose={() => setShowBlockMenu(false)}
                />
            )}

            {/* AI Assistant Panel */}
            {showAIPanel && (
                <AIAssistantPanel
                    assessmentId={assessmentId}
                    onGenerate={handleAIGenerate}
                    onInsertBlock={handleInsertBlock}
                    onClose={() => setShowAIPanel(false)}
                />
            )}

            {/* Status Bar */}
            <div className="premium-editor-status">
                <span className="text-xs text-slate-400">
                    {isSaving ? 'Zapisywanie...' : 'Wszystkie zmiany zapisane'}
                </span>
                {!readOnly && (
                    <span className="text-xs text-slate-400">
                        Ctrl+S aby zapisać • "/" aby wstawić blok
                    </span>
                )}
            </div>
        </div>
    );
};

// Default report structure
function getDefaultReportStructure(): JSONContent {
    return {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Digital Readiness Assessment Report' }]
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Rozpocznij edycję raportu. Wpisz "/" aby wstawić bloki takie jak wykresy, tabele czy karty rekomendacji.' }]
            }
        ]
    };
}

export default PremiumReportEditor;
