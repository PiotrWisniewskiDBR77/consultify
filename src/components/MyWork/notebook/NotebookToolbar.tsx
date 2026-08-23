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

import type { NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS } from './notebookActionRegistry';

type NotebookStaticToolbarActionId = (typeof NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS)[number];

interface NotebookToolbarProps {
  editor: Editor;
}

interface ToolbarBtnProps {
  actionId: NotebookStaticToolbarActionId;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
}

const Btn: React.FC<ToolbarBtnProps> = ({
  actionId,
  icon: Icon,
  onClick,
  isActive,
  disabled,
  title,
}) => (
  <button
    type="button"
    data-notebook-action-id={`format:toolbar:${actionId}`}
    aria-label={title}
    aria-pressed={isActive === undefined ? undefined : isActive}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-md transition-all duration-100 ${
      isActive
        ? 'bg-c-surface-raised text-c-text-secondary'
        : 'text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);

const Divider: React.FC = () => <div className="w-px h-5 bg-c-surface-raised mx-0.5" />;

export const NotebookToolbar: React.FC<NotebookToolbarProps> = ({ editor }) => {
  const { t } = useTranslation();

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt(t('myWorkNotebook.toolbar.pasteUrl'), prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  return (
    <div
      role="toolbar"
      aria-label={t('myWorkNotebook.toolbar.formatting', 'Note formatting')}
      className="flex max-w-full shrink-0 flex-wrap items-center gap-0.5 overflow-x-auto px-3 py-1.5"
    >
      <Btn
        actionId="undo"
        icon={Undo}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={t('myWorkNotebook.toolbar.undo')}
      />
      <Btn
        actionId="redo"
        icon={Redo}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t('myWorkNotebook.toolbar.redo')}
      />
      <Divider />

      <Btn
        actionId="bold"
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={t('myWorkNotebook.toolbar.bold')}
      />
      <Btn
        actionId="italic"
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={t('myWorkNotebook.toolbar.italic')}
      />
      <Btn
        actionId="underline"
        icon={Underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title={t('myWorkNotebook.toolbar.underline')}
      />
      <Btn
        actionId="strike"
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title={t('myWorkNotebook.toolbar.strikethrough')}
      />
      <Btn
        actionId="highlight"
        icon={Highlighter}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title={t('myWorkNotebook.toolbar.highlight')}
      />
      <Btn
        actionId="code"
        icon={Code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title={t('myWorkNotebook.toolbar.inlineCode')}
      />
      <Btn
        actionId="link"
        icon={Link}
        onClick={setLink}
        isActive={editor.isActive('link')}
        title={t('myWorkNotebook.toolbar.link')}
      />
      <Divider />

      <Btn
        actionId="align-left"
        icon={AlignLeft}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title={t('myWorkNotebook.toolbar.alignLeft')}
      />
      <Btn
        actionId="align-center"
        icon={AlignCenter}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title={t('myWorkNotebook.toolbar.alignCenter')}
      />
      <Btn
        actionId="align-right"
        icon={AlignRight}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title={t('myWorkNotebook.toolbar.alignRight')}
      />
      <Btn
        actionId="align-justify"
        icon={AlignJustify}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title={t('myWorkNotebook.toolbar.justify')}
      />
      <Divider />

      <Btn
        actionId="heading-1"
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title={t('myWorkNotebook.toolbar.heading1')}
      />
      <Btn
        actionId="heading-2"
        icon={Heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title={t('myWorkNotebook.toolbar.heading2')}
      />
      <Btn
        actionId="heading-3"
        icon={Heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title={t('myWorkNotebook.toolbar.heading3')}
      />
      <Divider />

      <Btn
        actionId="bullet-list"
        icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title={t('myWorkNotebook.toolbar.bulletList')}
      />
      <Btn
        actionId="ordered-list"
        icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title={t('myWorkNotebook.toolbar.numberedList')}
      />
      <Btn
        actionId="task-list"
        icon={ListChecks}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title={t('myWorkNotebook.toolbar.todoList')}
      />
      <Btn
        actionId="blockquote"
        icon={Quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title={t('myWorkNotebook.toolbar.blockquote')}
      />
      <Divider />

      <Btn
        actionId="clear-formatting"
        icon={RemoveFormatting}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title={t('myWorkNotebook.toolbar.clearFormatting')}
      />

      <div className="flex-1" />
    </div>
  );
};
