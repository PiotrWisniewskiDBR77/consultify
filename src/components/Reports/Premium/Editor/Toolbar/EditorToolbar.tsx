/**
 * EditorToolbar
 *
 * Professional toolbar for the Premium Report Editor with formatting controls,
 * block insertion, and AI assistant trigger.
 */

import { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Quote,
  Redo,
  Save,
  Sparkles,
  Strikethrough,
  Table,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded-lg transition-all duration-150
      ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200'
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
  onAIClick,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-slate-700 flex-wrap">
      {/* History */}
      <ToolbarButton
        icon={Undo}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={t('reports.premium.editorToolbar.undoShortcut', 'Undo (Ctrl+Z)')}
      />
      <ToolbarButton
        icon={Redo}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t('reports.premium.editorToolbar.redoCtrlY', 'Redo (Ctrl+Y)')}
      />

      <ToolbarDivider />

      {/* Text Formatting */}
      <ToolbarButton
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={t('reports.premium.editorToolbar.boldShortcut', 'Bold (Ctrl+B)')}
      />
      <ToolbarButton
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={t('reports.premium.editorToolbar.italicShortcut', 'Italic (Ctrl+I)')}
      />
      <ToolbarButton
        icon={UnderlineIcon}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title={t('reports.premium.editorToolbar.underlineCtrlU', 'Underline (Ctrl+U)')}
      />
      <ToolbarButton
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title={t('reports.premium.editorToolbar.strikethrough', 'Strikethrough')}
      />
      <ToolbarButton
        icon={Highlighter}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title={t('reports.premium.editorToolbar.highlight', 'Highlight')}
      />

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title={t('reports.premium.editorToolbar.heading1', 'Heading 1')}
      />
      <ToolbarButton
        icon={Heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title={t('reports.premium.editorToolbar.heading2', 'Heading 2')}
      />
      <ToolbarButton
        icon={Heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title={t('reports.premium.editorToolbar.heading3', 'Heading 3')}
      />

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title={t('reports.premium.editorToolbar.bulletList', 'Bullet list')}
      />
      <ToolbarButton
        icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title={t('reports.premium.editorToolbar.numberedList', 'Numbered list')}
      />

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton
        icon={AlignLeft}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title={t('reports.premium.editorToolbar.alignLeft', 'Align left')}
      />
      <ToolbarButton
        icon={AlignCenter}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title={t('reports.premium.editorToolbar.centre', 'Centre')}
      />
      <ToolbarButton
        icon={AlignRight}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title={t('reports.premium.editorToolbar.alignRight', 'Align right')}
      />

      <ToolbarDivider />

      {/* Blocks */}
      <ToolbarButton
        icon={Table}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title={t('reports.premium.editorToolbar.insertATable', 'Insert a table')}
      />
      <ToolbarButton
        icon={Quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title={t('reports.premium.editorToolbar.quote', 'Quote')}
      />
      <ToolbarButton
        icon={Code}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title={t('reports.premium.editorToolbar.codeBlock', 'Code block')}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* AI Assistant */}
      <button
        onClick={onAIClick}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-lg hover:from-primary-700 hover:to-blue-700 transition-all text-sm font-medium"
      >
        <Sparkles className="w-4 h-4" />
        {t('reports.premium.editorToolbar.aiAssistant', 'AI Assistant')}
      </button>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 dark:hover:bg-navy-800/30 transition-all text-sm font-medium disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Zapisz
      </button>
    </div>
  );
};

export default EditorToolbar;
