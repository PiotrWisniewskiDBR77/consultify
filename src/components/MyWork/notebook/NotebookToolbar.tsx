import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Info,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Redo,
  Sparkles,
  Strikethrough,
  ToggleRight,
  Undo,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface NotebookToolbarProps {
  editor: Editor;
  onAIClick?: () => void;
}

interface ToolbarBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
}

const Btn: React.FC<ToolbarBtnProps> = ({ icon: Icon, onClick, isActive, disabled, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-md transition-all duration-100 ${
      isActive
        ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);

const Divider: React.FC = () => (
  <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5" />
);

export const NotebookToolbar: React.FC<NotebookToolbarProps> = ({ editor, onAIClick }) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 flex-wrap">
      <Btn
        icon={Undo}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={pl ? 'Cofnij' : 'Undo'}
      />
      <Btn
        icon={Redo}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={pl ? 'Ponów' : 'Redo'}
      />

      <Divider />

      <Btn
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={pl ? 'Pogrubienie (Ctrl+B)' : 'Bold (Ctrl+B)'}
      />
      <Btn
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={pl ? 'Kursywa (Ctrl+I)' : 'Italic (Ctrl+I)'}
      />
      <Btn
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title={pl ? 'Przekreślenie' : 'Strikethrough'}
      />
      <Btn
        icon={Code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title={pl ? 'Kod inline' : 'Inline code'}
      />

      <Divider />

      <Btn
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title={pl ? 'Nagłówek 1' : 'Heading 1'}
      />
      <Btn
        icon={Heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title={pl ? 'Nagłówek 2' : 'Heading 2'}
      />
      <Btn
        icon={Heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title={pl ? 'Nagłówek 3' : 'Heading 3'}
      />

      <Divider />

      <Btn
        icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title={pl ? 'Lista punktowana' : 'Bullet list'}
      />
      <Btn
        icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title={pl ? 'Lista numerowana' : 'Numbered list'}
      />
      <Btn
        icon={ListChecks}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title={pl ? 'Checklista' : 'Todo list'}
      />

      <Divider />

      <Btn
        icon={Info}
        onClick={() => (editor.commands as any).setCallout({ variant: 'info' })}
        title={pl ? 'Wyróżnienie' : 'Callout'}
      />
      <Btn
        icon={ToggleRight}
        onClick={() => (editor.commands as any).setDetails()}
        title={pl ? 'Sekcja zwijana' : 'Toggle'}
      />
      <Btn
        icon={Columns3}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title={pl ? 'Tabela' : 'Table'}
      />
      <Btn
        icon={Minus}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title={pl ? 'Separator' : 'Divider'}
      />

      <div className="flex-1" />

      {onAIClick && (
        <button
          type="button"
          onClick={onAIClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-xs font-medium transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {pl ? 'AI' : 'AI'}
        </button>
      )}
    </div>
  );
};
