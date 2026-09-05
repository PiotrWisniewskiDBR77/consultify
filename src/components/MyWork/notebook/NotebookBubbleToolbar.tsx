import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code as CodeIcon,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS } from './notebookActionRegistry';

type NotebookBubbleToolbarActionId = (typeof NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS)[number];

/**
 * NotebookBubbleToolbar — N8 floating format toolbar (Notion/Craft-grade).
 *
 * A selection bubble that appears over highlighted text in the Living Notebook
 * editor, exposing the most-used inline marks without reaching for the static
 * top toolbar. Reuses the exact same TipTap commands as NotebookToolbar so the
 * two stay in lockstep.
 *
 * Self-contained: owns only the bubble + buttons. Monochrome chrome (slate/navy)
 * per the UI canon — the only colour budget here is the active-mark slate fill.
 * Hidden inside code blocks (inline marks don't apply) and for node selections
 * (e.g. images), and never shows for an empty/collapsed selection.
 */
interface NotebookBubbleToolbarProps {
  editor: Editor;
}

interface MarkBtnProps {
  actionId: NotebookBubbleToolbarActionId;
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  isActive?: boolean;
  title: string;
  ariaLabel: string;
}

const MarkBtn: React.FC<MarkBtnProps> = ({
  actionId,
  icon: Icon,
  onClick,
  isActive,
  title,
  ariaLabel,
}) => (
  <button
    type="button"
    data-notebook-action-id={`format:bubble:${actionId}`}
    aria-label={ariaLabel}
    aria-pressed={!!isActive}
    title={title}
    // onMouseDown (not onClick) so the editor keeps its text selection.
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
      isActive
        ? 'bg-c-surface-raised text-c-text'
        : 'text-c-text-secondary hover:bg-c-surface-raised dark:text-c-text-secondary dark:hover:bg-white/[0.06]'
    }`}
  >
    <Icon size={15} />
  </button>
);

export const NotebookBubbleToolbar: React.FC<NotebookBubbleToolbarProps> = ({ editor }) => {
  const { t } = useTranslation();

  /**
   * ★ NAPRAWA (odbiór CTO 05.09, `14-notatnik-open.png`): pasek renderował się
   * na PIERWSZYM renderze świeżo otwartej notatki, choć nikt nic nie zaznaczył.
   * Edytor jest JEDNĄ instancją współdzieloną między notatkami — przełączenie
   * strony w `NotebookContent.tsx` woła `editor.commands.setContent(...)`, nie
   * tworzy nowego `Editor`. `setContent` podmienia całą treść przez
   * `tr.replaceWith(0, doc.content.size, …)`, a ProseMirror MAPUJE stare
   * zaznaczenie na nowy dokument zamiast je collapsować — zaznaczenie
   * sprzed przełączenia (np. z poprzedniej notatki) bywa więc dalej niepuste
   * (`from !== to`) w notatce, którą użytkownik dopiero co otworzył, a fokus
   * z edytora nigdy nie znika (kliknięcie pozycji na liście po lewej nie
   * przenosi focusu z contenteditable). Same `from !== to` + `isFocused` tego
   * nie odróżnia od świadomego zaznaczenia myszą/klawiaturą — stąd osobny
   * bezpiecznik: pasek wolno pokazać TYLKO po realnym geście zaznaczania
   * (mouseup/keyup) W BIEŻĄCYM dokumencie; każda podmiana treści albo powrót
   * do pustego zaznaczenia go rozbraja.
   */
  const armedRef = useRef(false);

  useEffect(() => {
    const dom = editor?.view?.dom;
    if (!dom) return undefined;
    const arm = () => {
      armedRef.current = true;
    };
    // Disarm ONLY for the specific transaction `setContent` issues when
    // NotebookContent.tsx swaps notes (`{ emitUpdate: false }` → ProseMirror
    // sets the `preventUpdate` meta on that transaction — see
    // `@tiptap/core`'s `setContent` command). Do NOT disarm on every
    // doc-changing transaction: toggling Bold/Italic from THIS SAME bubble
    // also changes the doc (marks are part of it) while the selection stays
    // put — disarming there would hide the bar the instant it is used,
    // before the user can click a second mark.
    const disarmOnNoteSwitch = ({ transaction }: { transaction: { getMeta: (key: string) => unknown } }) => {
      if (transaction.getMeta('preventUpdate')) armedRef.current = false;
    };
    const disarmOnCollapse = () => {
      if (editor.state.selection.empty) armedRef.current = false;
    };
    dom.addEventListener('mouseup', arm);
    dom.addEventListener('keyup', arm);
    editor.on('update', disarmOnNoteSwitch);
    editor.on('selectionUpdate', disarmOnCollapse);
    return () => {
      dom.removeEventListener('mouseup', arm);
      dom.removeEventListener('keyup', arm);
      editor.off('update', disarmOnNoteSwitch);
      editor.off('selectionUpdate', disarmOnCollapse);
    };
  }, [editor]);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('notebook.bubbleToolbar.linkUrl', 'Link URL'), previous || '');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      // Show only for a real, non-empty text selection, made by an actual user
      // gesture in the currently open document (`armedRef`, see above) with the
      // editor genuinely focused — never inside a code block (inline marks are
      // meaningless there) or over a node selection.
      shouldShow={({ editor: ed, from, to, state }) => {
        if (!armedRef.current) return false;
        if (!ed.isFocused) return false;
        if (!ed.isEditable) return false;
        if (from === to) return false;
        if (ed.isActive('codeBlock')) return false;
        // Node selection (image, hr, …) → ProseMirror NodeSelection has node set.
        if ((state.selection as { node?: unknown }).node) return false;
        const text = state.doc.textBetween(from, to, ' ').trim();
        return text.length > 0;
      }}
      className="flex items-center gap-0.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-1 shadow-lg dark:border-navy-700 dark:bg-navy-900"
      role="toolbar"
      aria-label={t('notebook.bubbleToolbar.formatting', 'Selection formatting')}
    >
      <MarkBtn
        actionId="bold"
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={t('notebook.bubbleToolbar.bold', 'Bold')}
        ariaLabel={t('notebook.bubbleToolbar.bold', 'Bold')}
      />
      <MarkBtn
        actionId="italic"
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={t('notebook.bubbleToolbar.italic', 'Italic')}
        ariaLabel={t('notebook.bubbleToolbar.italic', 'Italic')}
      />
      <MarkBtn
        actionId="underline"
        icon={UnderlineIcon}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title={t('notebook.bubbleToolbar.underline', 'Underline')}
        ariaLabel={t('notebook.bubbleToolbar.underline', 'Underline')}
      />
      <MarkBtn
        actionId="strike"
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title={t('notebook.bubbleToolbar.strikethrough', 'Strikethrough')}
        ariaLabel={t('notebook.bubbleToolbar.strikethrough', 'Strikethrough')}
      />
      <div className="mx-0.5 h-5 w-px bg-c-surface-raised" />
      <MarkBtn
        actionId="code"
        icon={CodeIcon}
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title={t('notebook.bubbleToolbar.inlineCode', 'Inline code')}
        ariaLabel={t('notebook.bubbleToolbar.inlineCode', 'Inline code')}
      />
      <MarkBtn
        actionId="highlight"
        icon={Highlighter}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title={t('notebook.bubbleToolbar.highlight', 'Highlight')}
        ariaLabel={t('notebook.bubbleToolbar.highlight', 'Highlight')}
      />
      <MarkBtn
        actionId="link"
        icon={LinkIcon}
        onClick={setLink}
        isActive={editor.isActive('link')}
        title={t('notebook.bubbleToolbar.link', 'Link')}
        ariaLabel={t('notebook.bubbleToolbar.link', 'Link')}
      />
    </BubbleMenu>
  );
};

export default NotebookBubbleToolbar;
