import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
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
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo,
} from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface NotebookToolbarProps {
  editor: Editor;
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
        ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);

const Divider: React.FC = () => <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5" />;

export const NotebookToolbar: React.FC<NotebookToolbarProps> = ({ editor }) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt(pl ? 'Wklej URL:' : 'Paste URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, pl]);

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 shrink-0 flex-wrap">
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
        icon={Underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title={pl ? 'Podkreślenie (Ctrl+U)' : 'Underline (Ctrl+U)'}
      />
      <Btn
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title={pl ? 'Przekreślenie' : 'Strikethrough'}
      />
      <Btn
        icon={Highlighter}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title={pl ? 'Podświetlenie' : 'Highlight'}
      />
      <Btn
        icon={Code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title={pl ? 'Kod inline' : 'Inline code'}
      />
      <Btn
        icon={Link}
        onClick={setLink}
        isActive={editor.isActive('link')}
        title={pl ? 'Link (Ctrl+K)' : 'Link (Ctrl+K)'}
      />
      <Divider />

      <Btn
        icon={AlignLeft}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title={pl ? 'Wyrównaj do lewej' : 'Align left'}
      />
      <Btn
        icon={AlignCenter}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title={pl ? 'Wyśrodkuj' : 'Align center'}
      />
      <Btn
        icon={AlignRight}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title={pl ? 'Wyrównaj do prawej' : 'Align right'}
      />
      <Btn
        icon={AlignJustify}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title={pl ? 'Justowanie' : 'Justify'}
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
      <Btn
        icon={Quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title={pl ? 'Cytat' : 'Blockquote'}
      />
      <Divider />

      <Btn
        icon={RemoveFormatting}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title={pl ? 'Wyczyść formatowanie' : 'Clear formatting'}
      />

      <div className="flex-1" />
    </div>
  );
};
