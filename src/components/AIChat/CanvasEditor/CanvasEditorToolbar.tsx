/**
 * Formatting toolbar for Canvas TipTap editor.
 * Pattern follows NotebookToolbar.tsx.
 */

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Table,
  Underline,
  Undo,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CanvasEditorToolbarProps {
  editor: Editor | null;
}

const Btn: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? 'bg-slate-200 dark:bg-white/[0.12] text-slate-900 dark:text-white'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider: React.FC = () => <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" />;

export const CanvasEditorToolbar: React.FC<CanvasEditorToolbarProps> = ({ editor }) => {
  const { t } = useTranslation();
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex-wrap">
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={t('canvas.toolbar.undo', 'Undo (Ctrl+Z)')}
      >
        <Undo size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t('canvas.toolbar.redo', 'Redo (Ctrl+Shift+Z)')}
      >
        <Redo size={16} />
      </Btn>

      <Divider />

      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title={t('canvas.toolbar.bold', 'Bold (Ctrl+B)')}
      >
        <Bold size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title={t('canvas.toolbar.italic', 'Italic (Ctrl+I)')}
      >
        <Italic size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title={t('canvas.toolbar.underline', 'Underline (Ctrl+U)')}
      >
        <Underline size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title={t('canvas.toolbar.strikethrough', 'Strikethrough')}
      >
        <Strikethrough size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title={t('canvas.toolbar.inlineCode', 'Inline code')}
      >
        <Code size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title={t('canvas.toolbar.highlight', 'Highlight')}
      >
        <Highlighter size={16} />
      </Btn>

      <Divider />

      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title={t('canvas.toolbar.heading1', 'Heading 1')}
      >
        <Heading1 size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title={t('canvas.toolbar.heading2', 'Heading 2')}
      >
        <Heading2 size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title={t('canvas.toolbar.heading3', 'Heading 3')}
      >
        <Heading3 size={16} />
      </Btn>

      <Divider />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title={t('canvas.toolbar.bulletList', 'Bullet list')}
      >
        <List size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title={t('canvas.toolbar.numberedList', 'Numbered list')}
      >
        <ListOrdered size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title={t('canvas.toolbar.taskList', 'Task list')}
      >
        <ListChecks size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title={t('canvas.toolbar.blockquote', 'Blockquote')}
      >
        <Quote size={16} />
      </Btn>

      <Divider />

      <Btn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title={t('canvas.toolbar.insertTable', 'Insert table')}
      >
        <Table size={16} />
      </Btn>
      <Btn
        onClick={() => {
          const url = window.prompt(t('canvas.toolbar.linkPrompt', 'Link URL:'));
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive('link')}
        title={t('canvas.toolbar.insertLink', 'Insert link')}
      >
        <Link size={16} />
      </Btn>
    </div>
  );
};
