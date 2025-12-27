/**
 * EditorToolbar
 * 
 * Professional toolbar for the Premium Report Editor with formatting controls,
 * block insertion, and AI assistant trigger.
 */

import React from 'react';
import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Table,
    Quote,
    Code,
    Highlighter,
    Undo,
    Redo,
    Save,
    Sparkles,
    Plus,
    Loader2
} from 'lucide-react';

interface EditorToolbarProps {
    editor: Editor;
    isSaving: boolean;
    onSave: () => void;
    onAIClick: () => void;
}

interface ToolbarButtonProps {
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    icon: Icon,
    onClick,
    isActive = false,
    disabled = false,
    title
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
      p-2 rounded-lg transition-all duration-150
      ${isActive
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200'
            }
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
    >
        <Icon className="w-4 h-4" />
    </button>
);

const ToolbarDivider: React.FC = () => (
    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    editor,
    isSaving,
    onSave,
    onAIClick
}) => {
    return (
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-slate-700 flex-wrap">
            {/* History */}
            <ToolbarButton
                icon={Undo}
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Cofnij (Ctrl+Z)"
            />
            <ToolbarButton
                icon={Redo}
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Ponów (Ctrl+Y)"
            />

            <ToolbarDivider />

            {/* Text Formatting */}
            <ToolbarButton
                icon={Bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Pogrubienie (Ctrl+B)"
            />
            <ToolbarButton
                icon={Italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Kursywa (Ctrl+I)"
            />
            <ToolbarButton
                icon={UnderlineIcon}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Podkreślenie (Ctrl+U)"
            />
            <ToolbarButton
                icon={Strikethrough}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Przekreślenie"
            />
            <ToolbarButton
                icon={Highlighter}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
                title="Wyróżnienie"
            />

            <ToolbarDivider />

            {/* Headings */}
            <ToolbarButton
                icon={Heading1}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Nagłówek 1"
            />
            <ToolbarButton
                icon={Heading2}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Nagłówek 2"
            />
            <ToolbarButton
                icon={Heading3}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Nagłówek 3"
            />

            <ToolbarDivider />

            {/* Lists */}
            <ToolbarButton
                icon={List}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Lista punktowana"
            />
            <ToolbarButton
                icon={ListOrdered}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Lista numerowana"
            />

            <ToolbarDivider />

            {/* Alignment */}
            <ToolbarButton
                icon={AlignLeft}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Wyrównaj do lewej"
            />
            <ToolbarButton
                icon={AlignCenter}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Wyśrodkuj"
            />
            <ToolbarButton
                icon={AlignRight}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Wyrównaj do prawej"
            />

            <ToolbarDivider />

            {/* Blocks */}
            <ToolbarButton
                icon={Table}
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="Wstaw tabelę"
            />
            <ToolbarButton
                icon={Quote}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Cytat"
            />
            <ToolbarButton
                icon={Code}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title="Blok kodu"
            />

            {/* Spacer */}
            <div className="flex-1" />

            {/* AI Assistant */}
            <button
                onClick={onAIClick}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-sm font-medium"
            >
                <Sparkles className="w-4 h-4" />
                Asystent AI
            </button>

            {/* Save */}
            <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-sm font-medium disabled:opacity-50"
            >
                {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Save className="w-4 h-4" />
                )}
                Zapisz
            </button>
        </div>
    );
};

export default EditorToolbar;
